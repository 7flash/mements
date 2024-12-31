// @ts-nocheck
import React from "react";
import executePrompt from "uai/src/uai.ts";

interface Token {
    mint: string;
    amount: string;
    decimals: number;
    name: string;
    symbol: string;
  }
  
  interface TokenMetadata {
    name: string;
    symbol: string;
    description: string;
    image: string;
    showName: boolean;
    createdOn: string;
    twitter: string;
    telegram: string;
    website: string;
  }
  

const fetchWalletTokens = async (walletAddress: string) => {
    try {
        const response = await fetch(
            `https://solana-gateway.moralis.io/account/mainnet/${walletAddress}/tokens`,
            {
                headers: {
                    'accept': 'application/json',
                    'X-API-Key': process.env.MORALIS_API_KEY
                }
            }
        );
        return await response.json();
    } catch (error) {
        console.error("Error fetching wallet tokens:", error);
        return [];
    }
};

const fetchTokenMetadata = async (tokenMint: string) => {
    try {
        const response = await fetch(
            `https://solana-gateway.moralis.io/token/mainnet/${tokenMint}/metadata`,
            {
                headers: {
                    'accept': 'application/json',
                    'X-API-Key': process.env.MORALIS_API_KEY
                }
            }
        );
        const metadata = await response.json();

        if (metadata.metaplex?.metadataUri) {
            const metadataResponse = await fetch(metadata.metaplex.metadataUri);
            const fullMetadata = await metadataResponse.json();
            return {
                ...metadata,
                details: fullMetadata
            };
        }
        return metadata;
    } catch (error) {
        console.error("Error fetching token metadata:", error);
        return null;
    }
};

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

    async exec(instruction: string) {
        this.instruction = instruction;

        const walletAddress = this.fromFields.question;
        const tokens = await fetchWalletTokens(walletAddress);
        // console.log("tokens ==> ", tokens);

        /*
        todo: it should consider actual token prices like this
        
        curl --request GET \
             --url 'https://solana-gateway.moralis.io/token/mainnet/SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt/price' \
             --header 'accept: application/json' \
             --header 'X-API-Key: ' 
        
        
        Response
        
        200 Test Request
        {
          "exchangeName": "Raydium",
          "exchangeAddress": "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
          "nativePrice": {
            "value": "175000",
            "symbol": "WSOL",
            "name": "Wrapped Solana",
            "decimals": 9
          },
          "usdPrice": 0.033216
        }
        
        however it might return 500 error meaning its price very low

also might use this function

    calculateOwnershipPercentage(token: any, metadata: any) {
        const totalSupply = parseFloat(metadata.totalSupplyFormatted);
        const userAmount = parseFloat(token.amount);
        return (userAmount / totalSupply * 100).toFixed(2);
    }


        */

        const topTokens = tokens
            .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
            .slice(0, 3);
        console.log("topTokens ==> ", topTokens);

        const tokenDetails = await Promise.all(
            topTokens.map(token => fetchTokenMetadata(token.mint))
        );
        console.log("tokenDetails ==> ", tokenDetails);

        const tokenContexts = topTokens.map((token, index) => ({
            name: token.name,
            symbol: token.symbol,
            amount: token.amount,
            metadata: tokenDetails[index]?.details?.description || "No description available"
        }));
        console.log("tokenContexts ==> ", tokenContexts);

        // todo: do not need to include wallet address, but instead should consider total number of different tokens in wallet etc
        const formatFromFields = [
            {
                tagName: "walletAddress",
                fieldDescription: walletAddress
            },
            /* todo: should not just serialize to json but rather make nested JSX

something like this

        const tokenTags = topTokens.map((token, index) => {
            const metadata = tokenMetadata[index];
            return (
                <token>
                    <name>{metadata.name}</name>
                    <description>{metadata.description}</description>
                    <ownershipPercentage>{this.calculateOwnershipPercentage(token, metadata)}%</ownershipPercentage>
                </token>
            );
        });

        const tagsOfFromFields = [
            <question>{walletAddress}</question>,
            <situation>{this.fromFields.situation}</situation>,
            ...tokenTags
        ];

or like this

        const tagsOfFromFields = [
            <question>{walletAddress}</question>,
            <situation>{this.fromFields.situation}</situation>,
            ...topFiveTokens.map((token, index) => 
                <token key={index}>
                    <name>{token.name}</name>
                    <symbol>{token.symbol}</symbol>
                    <amount>{token.amount}</amount>
                    <metadata>{JSON.stringify(tokenMetadata[index])}</metadata>
                </token>
            )
        ];

but dont need to put situation every time        

            */
            {
                tagName: "portfolio",
                fieldDescription: JSON.stringify(tokenContexts)
            },
            {
                tagName: "situation",
                fieldDescription: this.fromFields.situation || "Santa is analyzing this wallet's contents to determine if the owner has been naughty or nice"
            }
        ];

        const formatToFields = [
            {
                tagName: "success",
                fieldDescription: "TRUE or FALSE indicating if the wallet analysis was successful"
            },
            {
                tagName: "answer",
                fieldDescription: "A funny Santa-style Twitter post analyzing the wallet contents and determining if the owner is naughty or nice. No hashtags or special characters."
            }
        ];

        const tagsOfFromFields = formatFromFields.map((it) => {
            const TagName = it.tagName;
            return <TagName>{it.fieldDescription}</TagName>;
        });
        console.log("tagsOfFromFields ==> ", tagsOfFromFields);

        const tagsOfToFields = formatToFields.map((it) => {
            const TagName = it.tagName;
            return <TagName>{it.fieldDescription}</TagName>;
        });
        console.log("tagsOfToFields ==> ", tagsOfToFields);

        // Looks like someone croaked their way into an ocean of CHILL FROG tokens. With over 10 million, this wallet owner is either the zen master of chill or hoarding all the relaxation for themselves. Let's hope they are spreading the good vibes and not just ribbiting around. Verdict: Nice if they're sharing the chill vibes naughty if they're just froggeting about others

        // answer: "\nHo ho ho looks like we've got a wallet swimming in chill frogs and divine vibes. With over 14 million chill tokens this owner is clearly hopping into the festive season with maximum relaxation. And those divine coins? Someone's hedging their naughty list bets with a sprinkle of holiness. Keep up the good work and keep ribbiting along the nice list.\n",

        const prompt = <>
            <settings temperature={0.7} enablesPrediction={false} />
            <system>
                <instruction>
                    You are Santa Claus analyzing a crypto wallet to determine if its owner has been naughty or nice.
                    Based on the tokens they hold and their quantities, create a funny and witty response about their behavior.
                    The response should be in the style of a Twitter post (without hashtags or special characters).
                </instruction>
                <responseFormat>
                    <thinking>
                        THINK about the types of tokens, their purposes, and what they might indicate about the wallet owner's behavior.
                        Consider both the quantity and quality of their holdings.
                    </thinking>
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
        </>
        console.log("prompt ==> ", prompt);

        const result = await executePrompt(prompt);
        console.log("result ==> ", result);

        return result;
    },
};