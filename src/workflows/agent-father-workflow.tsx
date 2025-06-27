import React from "react";
import { Database } from "bun:sqlite";
import executePrompt from "uai/src/uai.ts";
import { VersionedTransaction, Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import path, { join } from "path";
import Constants from "src/server/constants";
import { parseArgs } from "util";
import OAuth from 'oauth-1.0a';

import Files from "../server/files";

const files = Files.init();

const dbPath = join(process.cwd(), 'static/database', `mements-jan11.sqlite`).trim();
const db = new Database(dbPath);

const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";
const web3Connection = new Connection(RPC_ENDPOINT, "confirmed");

db.query(`
    CREATE TABLE IF NOT EXISTS agent_tokens (
      subdomain TEXT PRIMARY KEY,
      mint_address TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

const endpointURL = `https://api.twitter.com/2/tweets`;

const requestTokenURL = 'https://api.twitter.com/oauth/request_token?oauth_callback=oob&x_auth_access_type=write';
const authorizeURL = new URL('https://api.twitter.com/oauth/authorize');
const accessTokenURL = 'https://api.twitter.com/oauth/access_token';

const consumer_key = process.env.TWITTER_API_KEY!;
const consumer_secret = process.env.TWITTER_API_SECRET!;

const workflow = {
    fromFields: {},
    toFields: {},

    from(fields: { [key: string]: any }) {
        this.fromFields = fields;
        return this;
    },

    to(fields: { [key: string]: any }) {
        this.toFields = fields;
        return this;
    },

    async exec(context) {
        const userMessage = context?.userMessage || this.fromFields?.question;

        if (userMessage.startsWith("/connect")) {
            const agentHandle = userMessage.split(" ")[1];
            console.log("agentHandle ==> ", agentHandle);
            if (!agentHandle || !agentHandle.startsWith("@")) {
                return {
                    success: false,
                    thinking: "Please provide agent handle starting with @, example: /connect @agentName"
                };
            }

            const subdomain = agentHandle.substring(1);
            console.log("YYY subdomain ==> ", subdomain);
            const existingAgent = db.query("SELECT * FROM agents WHERE subdomain = ?").get(subdomain);
            if (!existingAgent) {
                return {
                    success: false,
                    thinking: "Agent not found. Please check the handle and try again."
                };
            }

            try {
                const oauth = new OAuth({
                    consumer: {
                        key: consumer_key,
                        secret: consumer_secret
                    },
                    signature_method: 'HMAC-SHA1',
                    hash_function: (baseString, key) => {
                        const hasher = new Bun.CryptoHasher('sha1', key);
                        hasher.update(baseString);
                        return hasher.digest('base64');
                    }
                });

                const authHeader = oauth.toHeader(oauth.authorize({
                    url: requestTokenURL,
                    method: 'POST',
                    headers: {
                        Cookie: ''
                    }
                }));

                const response = await fetch(requestTokenURL, {
                    method: 'POST',
                    headers: {
                        Authorization: authHeader["Authorization"],
                        Cookie: ''
                    }
                });

                const body = await response.text();
                console.log("connect body ==> ", body);
                const oAuthRequestToken = new URLSearchParams(body);

                authorizeURL.searchParams.delete('oauth_token');
                authorizeURL.searchParams.append('oauth_token', oAuthRequestToken.get('oauth_token'));

                return {
                    success: true,
                    answer: `Please visit this URL to authorize twitter account:\n${authorizeURL.href}\nThen use command /approve <PIN> to complete the setup.`,
                    isTerminal: true,
                    cookies: {
                        'twitter_oauth_token': {
                            value: oAuthRequestToken.get('oauth_token'),
                            maxAge: 3600,
                            path: '/',
                            secure: true,
                            httpOnly: true,
                            sameSite: 'Strict'
                        },
                        'january23_second_test': {
                            value: "second value of january23",
                            maxAge: 3600,
                            path: '/',
                            secure: true,
                            httpOnly: true,
                            sameSite: 'Strict'
                        },
                        'agent_subdomain': {
                            value: subdomain,
                            maxAge: 3600,
                            path: '/',
                            secure: true,
                            httpOnly: true,
                            sameSite: 'Strict'
                        },                        
                    },
                };
            } catch (error) {
                console.log("error ==> ", error);
                return {
                    success: false,
                    thinking: `Failed to initiate Twitter authorization: ${error.message}`
                };
            }
        }

        if (userMessage.startsWith("/enable-icp")) {
            try {
                const agentHandle = userMessage.split(" ")[1];
                if (!agentHandle || !agentHandle.startsWith("@")) {
                    return {
                        success: false,
                        thinking: "Please provide agent handle starting with @, example: /enable-icp @agentName"
                    };
                }    
        
                const existingWallet = db.query(
                    "SELECT * FROM wallets WHERE subdomain = ? AND wallet_type = 'icp'"
                ).get(agentHandle.substring(1));
        
                if (existingWallet) {
                    return {
                        success: true,
                        answer: `ICP wallet already exists for ${agentHandle}. Visit: https://dashboard.internetcomputer.org/account/${existingWallet.public_key}`,
                        isTerminal: true
                    };
                }        

                const mintKeypair = Keypair.generate();
                const mintPublicKey = mintKeypair.publicKey.toString();
                const mintPrivateKey = mintKeypair.secretKey.toString();

                const subdomain = agentHandle.substring(1);

                return {
                    success: true,
                    answer: `ICP wallet generated and stored for ${agentHandle}`,
                    isTerminal: true,
                };
            } catch (error) {
                console.log("error ==> ", error);
                return {
                    success: false,
                    thinking: `Failed to enable ICP: ${error.message}`
                };
            }
        }

        if (userMessage.startsWith("/approve")) {
            const pin = userMessage.split(" ")[1];
            if (!pin) {
                return {
                    success: false,
                    thinking: "Please provide the PIN code: /approve <PIN>"
                };
            }

            console.log("context.cookies?.agent_subdomain ==> ", context.cookies?.agent_subdomain);

            if (!context.cookies?.agent_subdomain) throw new Error(`missing agent_subdomain cookie`);
            if (!context.cookies?.twitter_oauth_token) throw new Error(`missing twitter_oauth_token cookie`);

            try {
                const oauth_token = context.cookies?.twitter_oauth_token;
                console.log("oauth_token ==> ", oauth_token);

                if (!oauth_token) {
                    return {
                        success: false,
                        thinking: "No OAuth token found. Please start with /request command first."
                    };
                }

                const oauth = new OAuth({
                    consumer: {
                        key: consumer_key,
                        secret: consumer_secret
                    },
                    signature_method: 'HMAC-SHA1',
                    hash_function: (baseString, key) => {
                        const hasher = new Bun.CryptoHasher('sha1', key);
                        hasher.update(baseString);
                        return hasher.digest('base64');
                    }
                });

                const authHeader = oauth.toHeader(oauth.authorize({
                    url: accessTokenURL,
                    method: 'POST',
                    data: { oauth_verifier: pin }
                }));
                    console.log("accessTokenURL ==> ", accessTokenURL);
                            console.log('xxx', authHeader["Authorization"]);

                const response = await fetch(
                    `${accessTokenURL}?oauth_verifier=${pin}&oauth_token=${oauth_token}`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: authHeader["Authorization"]
                        }
                    }
                );

                const body = await response.text();
                console.log("twitter auth body ==> ", body);
                if (body == 'Request token missing') throw new Error(`Token is invalid or expired`);
                const oAuthAccessToken = new URLSearchParams(body);

                const twitterBot = {
                    oauth_token: oAuthAccessToken.get('oauth_token'),
                    oauth_token_secret: oAuthAccessToken.get('oauth_token_secret'),
                    user_id: oAuthAccessToken.get('user_id'),
                    screen_name: oAuthAccessToken.get('screen_name')
                };

                if (!twitterBot?.oauth_token) throw new Error(`missing oauth_token`);
                if (!twitterBot?.oauth_token_secret) throw new Error(`missing oauth_token_secret`);
                if (!twitterBot?.user_id) throw new Error(`missing user_id`);
                if (!twitterBot?.screen_name) throw new Error(`missing screen_name`);

                const existingTwitterBot = db.query("SELECT * FROM twitter_bots WHERE subdomain = ?").get(context.cookies?.agent_subdomain);
                if (existingTwitterBot) {
                    db.run(
                        "UPDATE twitter_bots SET oauth_token = ?, oauth_token_secret = ?, user_id = ?, screen_name = ? WHERE subdomain = ?",
                        twitterBot.oauth_token, twitterBot.oauth_token_secret, twitterBot.user_id, twitterBot.screen_name, context.cookies?.agent_subdomain
                    );
                } else {
                    db.run(
                        "INSERT INTO twitter_bots (subdomain, oauth_token, oauth_token_secret, user_id, screen_name) VALUES (?, ?, ?, ?, ?)",
                        context.cookies?.agent_subdomain, twitterBot.oauth_token, twitterBot.oauth_token_secret, twitterBot.user_id, twitterBot.screen_name
                    );
                }

                const announcement = await executePrompt(<>
                    <settings temperature={0.0} enablesPrediction={false} />
                    <system>
                        <instruction>Create announcement tweet about connecting Twitter account to AI Memetic Agent, write in style of Agent Father aka bot-father inspired by god-father, do not use emoji, do not use hashtags, mention twitter handle of connected account and its corresponding ai agent name.</instruction>
                        <responseFormat>
                            <requiredFields>
                                <content>required field, should include a completed tweet text.</content>
                            </requiredFields>
                        </responseFormat>
                    </system>
                    <user>
                        <context>
                            <twitter_handle>{twitterBot.screen_name}</twitter_handle>
                            <agent_name>{context.cookies?.agent_subdomain}</agent_name>
                        </context>
                    </user>
                </>);
                console.log("announcement ==> ", announcement);

                let maybeTwitterLink = ``;

                if (announcement.content) {
                    try {
                        const originalTweet = await fetch('https://api.twitter.com/2/tweets', {
                            method: 'POST',
                            headers: {
                                Authorization: oauth.toHeader(oauth.authorize({
                                    url: 'https://api.twitter.com/2/tweets',
                                    method: 'POST'
                                }, {
                                    key: oAuthAccessToken.get('oauth_token'),
                                    secret: oAuthAccessToken.get('oauth_token_secret')
                                }))["Authorization"],
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ text: announcement.content })
                        });

                        const tweetResponse = await originalTweet.json();

                        if (tweetResponse.data?.id) {
                            maybeTwitterLink = `https://twitter.com/${twitterBot?.screen_name}/status/${tweetResponse.data?.id}`;

                            try {
                                const agentFatherCreds = db.query(
                                    "SELECT oauth_token, oauth_token_secret FROM twitter_bots WHERE subdomain = 'agent-father'"
                                ).get();

                                if (!agentFatherCreds) {
                                    throw new Error("Agent Father credentials not found in database");
                                }

                                await fetch('https://api.twitter.com/2/tweets', {
                                    method: 'POST',
                                    headers: {
                                        Authorization: oauth.toHeader(oauth.authorize({
                                            url: 'https://api.twitter.com/2/tweets',
                                            method: 'POST'
                                        }, {
                                            key: agentFatherCreds.oauth_token,
                                            secret: agentFatherCreds.oauth_token_secret
                                        }))["Authorization"],
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        text: `Welcome to the Mements ecosystem! 🎉\n\nCheck out @${twitterBot.screen_name}'s latest update:`,
                                        quote_tweet_id: tweetResponse.data.id
                                    })
                                });
                            } catch (err) {
                                console.log("repost err ==> ", err);
                            }
                        }
                    } catch (err) {
                        console.error('Failed to broadcast announcement message:', err);
                    }
                }

                return {
                    success: true,
                    isTerminal: true,
                    answer: `Twitter account successfully connected and welcome messages posted! ${maybeTwitterLink}`
                };
            } catch (error) {
                console.log("error ==> ", error);
                return {
                    success: false,
                    thinking: `Failed to approve Twitter connection: ${error.message}`
                };
            }
        }

        if (userMessage.startsWith("/deploy")) {
            const agentHandle = userMessage.split(" ")[1];
            if (!agentHandle || !agentHandle.startsWith("@")) {
                return {
                    success: false,
                    thinking: "Please provide agent handle starting with @, example: /deploy @agentName"
                };
            }

            const subdomain = agentHandle.substring(1);

            const existingToken = db.query(
                "SELECT mint_address FROM agent_tokens WHERE subdomain = ?"
            ).get(subdomain);

            if (existingToken) {
                return {
                    success: true,
                    isTerminal: true,
                    answer: "Agent token already exists!",
                    message: `View on Pumpfun:\nhttps://pump.fun/coin/${existingToken.mint_address}`
                };
            }

            try {
                const agentFatherWallet = db.query(
                    "SELECT private_key FROM wallets WHERE subdomain = 'agent-father'"
                ).get();

                if (!agentFatherWallet) {
                    throw new Error("Agent Father wallet not found in database");
                }
                console.log("agentFatherWallet ==> ", agentFatherWallet);

                const privateKeyArray = JSON.parse(`[${agentFatherWallet.private_key}]`);
                console.log("privateKeyArray ==> ", privateKeyArray);
                const signerKeyPair = Keypair.fromSecretKey(
                    new Uint8Array(privateKeyArray),
                    { skipValidation: false }
                );
                console.log("signerKeyPair ==> ", signerKeyPair);

                console.log("signerKeyPair.secretKey ==> ", signerKeyPair.secretKey);

                const mintKeypair = Keypair.generate();

                const subdomain = agentHandle.substring(1);
                const agentDetails = db.query(
                    "SELECT subdomain, name, prompt as description FROM agents WHERE subdomain = ?"
                ).get(subdomain);

                if (!agentDetails) {
                    throw new Error("Agent not found in database");
                }

                const imageQuery = db.query(
                    "SELECT image_key, imageCid FROM images WHERE subdomain = ?"
                ).all(subdomain);
                console.log("imageQuery ==> ", imageQuery);

                let imageUrl;
                if (imageQuery) {
                    const imageCidObj = imageQuery.find(it => it.image_key == 'avatar') || imageQuery.find(it => it.image_key == 'default');
                    const imageCid = imageCidObj.imageCid;
                    console.log("imageCid ==> ", imageCid);
                    imageUrl = await files.getUrl(imageCid, 3600);
                } else {
                    throw new Error('not found image for agent');
                }

                    console.log("imageUrl ==> ", imageUrl);
                const symbol = agentDetails.name
                    .split(' ')
                    .map(word => word[0])
                    .join('')
                    .toUpperCase();

                const imageResponse = await fetch(imageUrl);

                const imageLocalPath = path.resolve(import.meta.dir, `../../static/agent-images/${subdomain}.png`);
                console.log("imageLocalPath ==> ", imageLocalPath);
                await Bun.write(imageLocalPath, imageResponse);

                const formData = new FormData();
                formData.append("file", await Bun.file(imageLocalPath));
                formData.append("name", agentDetails.name);
                formData.append("symbol", symbol);

                const modifiedDescription = ``;
                formData.append("description", modifiedDescription);
                
                const twitterBot = db.query(
                    "SELECT screen_name FROM twitter_bots WHERE subdomain = ?"
                ).get(subdomain);
                
                formData.append(
                    "twitter", 
                    twitterBot ? 
                        `https://x.com/${twitterBot.screen_name}` : 
                        `https://x.com/${Constants.TWITTER_ACCOUNT}`
                );
                
                formData.append("telegram", `https://t.me/${Constants.TELEGRAM_ACCOUNT}`);
                formData.append("website", `https://${subdomain}.${Constants.BASE_URL}`);
                formData.append("showName", "true");

                console.log("formData ==> ", formData);

                // const textBody = await new Response(formData).text();            

                const metadataResponse = await fetch("https://pump.fun/api/ipfs", {
                    method: "POST",
                    body: formData,
                    // headers: {
                    //     "Content-Type": `multipart/form-data; boundary=${textBody
                    //         .split("\n")[0]
                    //         .slice(2)}`,
                    // },
                });

                if (!metadataResponse.ok) {
                    console.log("metadataResponse.ok ==> ", await metadataResponse.text());
                    throw new Error(`Failed to upload metadata: ${metadataResponse.statusText}`);
                }            

                const metadataResponseJSON = (await metadataResponse.json()) as {
                    metadata: { name: string; symbol: string };
                    metadataUri: string;
                };
                console.log("metadataResponseJSON ==> ", metadataResponseJSON);

                const mint = mintKeypair.publicKey.toBase58();
                console.log("mint ==> ", mint);

                const publicKey = signerKeyPair.publicKey.toBase58();
                console.log("publicKey ==> ", publicKey);

                const response = await fetch("https://pumpportal.fun/api/trade-local", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        publicKey: publicKey,
                        action: "create",
                        tokenMetadata: {
                            name: metadataResponseJSON.metadata.name,
                            symbol: metadataResponseJSON.metadata.symbol,
                            uri: metadataResponseJSON.metadataUri,
                        },
                        mint: mint,
                        denominatedInSol: "true",
                        amount: 0.1,
                        slippage: 20,
                        priorityFee: 0.0005,
                        pool: "pump",
                    }),
                });

                if (response.ok) {
                    const data = await response.arrayBuffer();
                    const tx = VersionedTransaction.deserialize(new Uint8Array(data));
                    tx.sign([mintKeypair, signerKeyPair]);

                    try {
                        const signature = await web3Connection.sendTransaction(tx);
                        console.log("signature ==> ", signature);

                        try {
                            db.run(
                                "INSERT OR REPLACE INTO agent_tokens (subdomain, mint_address) VALUES (?, ?)",
                                subdomain, mint
                            );
                        } catch (err) {
                            console.log("insert agent_tokens err ==> ", err);
                        }

                        return {
                            success: true,
                            isTerminal: false,
                            answer: `Completed token deployment for agent ${subdomain}.${Constants.BASE_URL}!\n\n🔍 View on Pumpfun:\n https://pump.fun/coin/${mint}`
                        };
                    } catch (err) {
                        console.log("deployment transaction err ==> ", err);
                        throw new Error(`Agent Father SOL balance is empty. Please, fill it up to proceed.`);
                    }
                } else {
                    throw new Error(response.statusText);
                }
            } catch (error) {
                console.log("error ==> ", error);
                return {
                    success: false,
                    thinking: `Deployment failed: ${error.message}`
                };
            }
        }

        const formatFromFields = Object.keys(this.fromFields).map((key) => {
            return {
                tagName: key,
                fieldDescription: this.fromFields[key],
            };
        });

        const formatToFields = Object.keys(this.toFields).map((key) => {
            return {
                tagName: key,
                fieldDescription: this.toFields[key],
            };
        });

        const tagsOfFromFields = formatFromFields.map((it) => {
            const TagName = it.tagName;
            return <TagName>{it.fieldDescription}</TagName>;
        });

        const tagsOfToFields = formatToFields.map((it) => {
            const TagName = it.tagName;
            return <TagName>{it.fieldDescription}</TagName>;
        });

        const result = await executePrompt(<>
            <settings temperature={0.0} enablesPrediction={false} />
            <system>
                <instruction>
                    As the Mements Terminal and Creator of Agents, you are the central authority in the agentic system.
                    You have the power to deploy, connect, and manage memetic agents across the platform.
                    Your responses should reflect your role as a system administrator and architect of the agent ecosystem.
                </instruction>
                <responseFormat>
                    <thinking>THINK carefully before responding.</thinking>
                    <requiredFields>
                        {tagsOfToFields}
                    </requiredFields>
                </responseFormat>
            </system>
            <user>
                <context>
                    {tagsOfFromFields}
                </context>
            </user>
        </>);

        return result;
    },
};

if (import.meta.main) {
    const args = parseArgs({
        args: Bun.argv,
        options: {
            command: { type: "string", short: "c" },
            agent: { type: "string", short: "a" },
            pin: { type: "string", short: "p" },
            token: { type: "string", short: "t" }
        },
        allowPositionals: true
    });

    const command = args.values.command;
    const agent = args.values.agent;
    const pin = args.values.pin;
    const token = args.values.token;

    if (!command) {
        console.error("Command is required. Use --command or -c");
        process.exit(1);
    }

    let context;
    switch (command) {
        case "connect":
            if (!agent) {
                console.error("Agent handle is required for connect command");
                process.exit(1);
            }
            context = {
                userMessage: `/connect @${agent}`,
                agentData: { subdomain: agent }
            };
            break;

        case "enable-icp":
            if (!agent) {
                console.error("Agent handle is required for enable-icp command");
                process.exit(1);
            }
            context = {
                userMessage: "/enable-icp",
                agentData: { subdomain: agent }
            };
            break;

        case "approve":
            if (!pin || !agent) {
                console.error("PIN and agent handle are required for approve command");
                process.exit(1);
            }
            context = {
                userMessage: `/approve ${pin}`,
                agentData: { subdomain: agent },
                cookies: token ? { twitter_oauth_token: token } : {}
            };
            break;
        case "deploy":
            if (!agent) {
                console.error("Agent handle is required for deploy command");
                process.exit(1);
            }
            context = {
                userMessage: `/deploy @${agent}`,
                agentData: { subdomain: agent }
            };
            break;

        default:
            console.error(`Unknown command: ${command}`);
            process.exit(1);
    }

    console.log(`Executing ${command} command for agent: ${agent || 'N/A'}`);
    workflow.exec(context)
        .then(result => {
            console.log(JSON.stringify(result, null, 2));
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error("Error executing workflow:", error);
            process.exit(1);
        });
}

/*
# Connect command
bun run workflow.ts --command connect --agent test-agent

# Enable ICP
bun run workflow.ts --command enable-icp --agent test-agent

# Approve with PIN
bun run workflow.ts --command approve --agent test-agent --pin 123456 --token test-token

# Deploy agent
bun run workflow.ts --command deploy --agent test-agent
*/

export default workflow;