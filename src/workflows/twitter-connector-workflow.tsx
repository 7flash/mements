// @ts-nocheck
import React from "react";
import executePrompt from "uai/src/uai.ts";
import OAuth from 'oauth-1.0a';
import readline from 'readline';
import { URL, URLSearchParams } from 'url';
import path from 'path';
import { parseArgs } from "util";

export default {
    fromFields: {},
    toFields: {},
    instruction: "",

    from(fields: { [key: string]: any }) {
        this.fromFields = fields;
        return this;
    },

    to(fields: { [key: string]: any }) {
        this.toFields = fields;
        return this;
    },

    async exec(context: { subdomain: string, agentData: any }) {
        const userMessage = this.fromFields.message || "";
        if (!userMessage.startsWith("/request") && !userMessage.startsWith("/approve")) {
            return {
                success: false,
                message: "Invalid command. Please use /request to initiate Twitter connection or /approve <pin> to complete authentication."
            };
        }

        const consumer_key = process.env.TWITTER_API_KEY!;
        const consumer_secret = process.env.TWITTER_API_SECRET!;
        const requestTokenURL = 'https://api.twitter.com/oauth/request_token?oauth_callback=oob&x_auth_access_type=write';
        const authorizeURL = new URL('https://api.twitter.com/oauth/authorize');
        const accessTokenURL = 'https://api.twitter.com/oauth/access_token';
        const tokenFilePath = path.join(process.cwd(), 'static', 'tokens/oAuthAccessToken.json');

        const oauth = new OAuth({
            consumer: {
                key: consumer_key,
                secret: consumer_secret
            },
            signature_method: 'HMAC-SHA1',
            hash_function: (baseString: string, key: string) => {
                const hasher = new Bun.CryptoHasher('sha1', key);
                hasher.update(baseString);
                return hasher.digest('base64');
            }
        });

        if (userMessage.startsWith("/request")) {
            try {
                const authHeader = oauth.toHeader(oauth.authorize({
                    url: requestTokenURL,
                    method: 'POST'
                }));

                const response = await fetch(requestTokenURL, {
                    method: 'POST',
                    headers: {
                        Authorization: authHeader["Authorization"]
                    }
                });

                const body = await response.text();
                const oAuthRequestToken = new URLSearchParams(body);
                authorizeURL.searchParams.append('oauth_token', oAuthRequestToken.get('oauth_token'));

                // Save the oauth_token for later use
                await Bun.write(tokenFilePath, JSON.stringify({
                    oauth_token: oAuthRequestToken.get('oauth_token')
                }));

                return {
                    success: true,
                    message: `Please visit this URL to authorize the application: ${authorizeURL.href}\nThen use /approve <PIN> to complete the setup.`,
                    oauth_token: oAuthRequestToken.get('oauth_token')
                };
            } catch (error) {
                return {
                    success: false,
                    message: `Failed to initiate Twitter authorization: ${error.message}`
                };
            }
        }

        if (userMessage.startsWith("/approve")) {
            const pin = userMessage.split(" ")[1];
            if (!pin) {
                return {
                    success: false,
                    message: "Please provide the PIN code: /approve <PIN>"
                };
            }

            try {
                const storedToken = await Bun.file(tokenFilePath).json().catch(() => null);
                const oauth_token = storedToken?.oauth_token;
                
                const authHeader = oauth.toHeader(oauth.authorize({
                    url: accessTokenURL,
                    method: 'POST',
                    data: { oauth_verifier: pin }
                }));

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
                const oAuthAccessToken = new URLSearchParams(body);

                // Store the access tokens
                const tokenData = {
                    oauth_token: oAuthAccessToken.get('oauth_token'),
                    oauth_token_secret: oAuthAccessToken.get('oauth_token_secret'),
                    user_id: oAuthAccessToken.get('user_id'),
                    screen_name: oAuthAccessToken.get('screen_name')
                };

                const agentResponse = await fetch(`http://localhost:${process.env.BUN_PORT}/createAgent`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.CREATE_AGENT_SECRET}`
                    },
                    body: JSON.stringify({
                        agent: {
                            subdomain: context.agentData.subdomain,
                        },
                        twitterBot: tokenData
                    }),
                });

                // Generate announcement tweet using the agent's personality
                const result = await executePrompt(<>
                    <settings temperature={0.7} />
                    <system>
                        <instruction>
                            Create a poetic announcement tweet that explains this Twitter account is now controlled by a memetic agent. 
                            The tweet should mention that the account will echo thoughts from {subdomain}.mements.xyz.
                            Keep it under 280 characters and make it engaging and mysterious.
                            Include relevant hashtags.
                        </instruction>
                        <responseFormat>
                            <thinking>THINK carefully before responding.</thinking>
                            <requiredFields>
                                <announcementMessage>The announcement tweet text</announcementMessage>
                            </requiredFields>
                        </responseFormat>
                    </system>
                    <user>
                        <context>
                            {context.agentData.prompt}
                            Subdomain: {context.subdomain}
                        </context>
                    </user>
                </>);

                const announcementText = result.announcementMessage;
                
                // Post the announcement tweet
                await fetch('https://api.twitter.com/2/tweets', {
                    method: 'POST',
                    headers: {
                        Authorization: oauth.toHeader(oauth.authorize({
                            url: 'https://api.twitter.com/2/tweets',
                            method: 'POST'
                        }, {
                            key: tokenData.oauth_token,
                            secret: tokenData.oauth_token_secret
                        }))["Authorization"],
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ text: announcementText })
                });

                return {
                    success: true,
                    message: "Twitter account successfully connected! I've posted an announcement tweet. Check your Twitter profile to see it!",
                    agent: tokenData.screen_name
                };
            } catch (error) {
                return {
                    success: false,
                    message: `Failed to complete Twitter authorization: ${error.message}`
                };
            }
        }
    },
};