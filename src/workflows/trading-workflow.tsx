// @ts-nocheck
import OAuth from 'oauth-1.0a';
import { URL, URLSearchParams } from 'url';
import Query from "uai/src/query";

/*

todo: implement this workflow with three commands: /buy, /send and /balance

i'll communicate to it through secure api-calls /ask-agent also by providing secret key along the request aka password /buy [mint] [password] and it'll block those ips who give wrong password otherwise buy and sell and maybe also withdraw

and so i'll have my galaxy running not to show invoke phantom popup but simply invoke my agent instead automatically on new coin or when i press sell and i show balance in my ui

*/

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

    async exec(context: { subdomain: string, agentData: any, cookies?: Record<string, string> }) {
        const userMessage = this.fromFields.question || "";
        if (!userMessage.startsWith("/request") && !userMessage.startsWith("/approve")) {
            return {
                success: false,
                thinking: "Invalid command. Please use /request to initiate Twitter connection or /approve <pin> to complete authentication."
            };
        }

        const consumer_key = process.env.TWITTER_API_KEY!;
        const consumer_secret = process.env.TWITTER_API_SECRET!;
        const requestTokenURL = 'https://api.twitter.com/oauth/request_token?oauth_callback=oob&x_auth_access_type=write';
        const authorizeURL = new URL('https://api.twitter.com/oauth/authorize');
        const accessTokenURL = 'https://api.twitter.com/oauth/access_token';

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
                        }
                    },
                };
            } catch (error) {
                return {
                    success: false,
                    thinking: `Failed to initiate Twitter authorization: ${error.message}`
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

            try {
                const oauth_token = context.cookies?.twitter_oauth_token;

                if (!oauth_token) {
                    return {
                        success: false,
                        thinking: "No OAuth token found. Please start with /request command first."
                    };
                }

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

                const agentResponse = await fetch(`http://localhost:${process.env.PORT}/registerSharedAccount`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.CREATE_AGENT_SECRET}`
                    },
                    body: JSON.stringify({
                        agent: {
                            subdomain: context.agentData.subdomain,
                        },
                        twitterBot: {
                            oauth_token: oAuthAccessToken.get('oauth_token'),
                            oauth_token_secret: oAuthAccessToken.get('oauth_token_secret'),
                            user_id: oAuthAccessToken.get('user_id'),
                            screen_name: oAuthAccessToken.get('screen_name')
                        }
                    }),
                });

                const result = await Query.from({
                    user_name: oAuthAccessToken.get('screen_name'),
                }, 'gpt-4o-mini').infer({
                    announcementMessage: `Create a poetic and engaging announcement tweet that introduces a cluster of memetic agents taking a partial control of this Twitter account. The tweet should mention that @user_name account will now be used to broadcast thoughts of #mements, and should invite all friends to rent their accounts too getting paid for it. Keep it under 280 characters and include user name and the only hashtag is #mements in the middle of text.`,
                })
                console.log("twitter-connector ==> ", result);

                if (result.announcementMessage) {
                    const announcementText = result.announcementMessage;

                    try {
                        // await fetch('https://api.twitter.com/2/tweets', {
                        //     method: 'POST',
                        //     headers: {
                        //         Authorization: oauth.toHeader(oauth.authorize({
                        //             url: 'https://api.twitter.com/2/tweets',
                        //             method: 'POST'
                        //         }, {
                        //             key: oAuthAccessToken.get('oauth_token'),
                        //             secret: oAuthAccessToken.get('oauth_token_secret')
                        //         }))["Authorization"],
                        //         'Content-Type': 'application/json',
                        //     },
                        //     body: JSON.stringify({ text: announcementText })
                        // });
                    } catch (err) {
                        console.log('FAILED to broadcast announcement message', err);
                    }
                } else {
                    console.log(`FAILED to generate announcement message`, result);
                }

                return {
                    success: true,
                    answer: "Twitter account successfully connected! I've posted an announcement tweet. Check your Twitter profile to see it!",
                    agent: oAuthAccessToken.get('screen_name'),
                    cookies: {
                        'twitter_oauth_token': {
                            value: '',
                            maxAge: 0,
                            path: '/',
                            secure: true,
                            httpOnly: true,
                            sameSite: 'Strict'
                        }
                    },
                    isTerminal: true,
                };
            } catch (error) {
                console.log("twitter-connector ==> ", error);
                return {
                    success: false,
                    thinking: `Failed to complete Twitter authorization: ${error.message}`
                };
            }
        }
    },
};