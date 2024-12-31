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

const fetchTokenPrice = async (tokenMint: string) => {
    try {
        const response = await fetch(
            `https://solana-gateway.moralis.io/token/mainnet/${tokenMint}/price`,
            {
                headers: {
                    'accept': 'application/json',
                    'X-API-Key': process.env.MORALIS_API_KEY
                }
            }
        );
        const priceData = await response.json();
        return priceData.usdPrice || 0;
    } catch (error) {
        console.error("Error fetching token price:", error);
        return 0;
    }
};

const calculateOwnershipPercentage = (token: any, metadata: any) => {
    if (!metadata?.totalSupplyFormatted) return "0.00";
    const totalSupply = parseFloat(metadata.totalSupplyFormatted);
    const userAmount = parseFloat(token.amount);
    return (userAmount / totalSupply * 100).toFixed(2);
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
        // todo: if walletAddress does not look like valid something like 7FLjAK6BWGyHnF3czh3wEj1Wm3P1Na6JX443qRLPvMq8 then we should immediately return success false along with thinking that contains explanation that its not a wallet, and also if wallet does not have any tokens, same

        const tokens = await fetchWalletTokens(walletAddress);
        
        // todo: since tokens are not sorted by their actual price the amount does not mean anything here so what we should do to find at least three tokens which are worth something, we should probably apply algorithm like this: try to request prices of first three tokens and if any of them have price of zero then (keeping those which are not zero) we request some more until no more or we have at least three so we kind of trying to replace that worthless one but if we dont find any its fine we proceed with those worthless ones, and then we proceed to make tokenTags

        const totalTokenCount = tokens.length;
        const topTokens = tokens
            .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
            .slice(0, 3);

        const tokenDetails = await Promise.all(
            topTokens.map(token => fetchTokenMetadata(token.mint))
        );

        const tokenPrices = await Promise.all(
            topTokens.map(token => fetchTokenPrice(token.mint))
        );

        const tokenTags = topTokens.map((token, index) => {
            const metadata = tokenDetails[index];
            const price = tokenPrices[index];
            const value = price * parseFloat(token.amount);
            const percentage = calculateOwnershipPercentage(token, metadata);
            
            return (
                <token key={index}>
                    <name>{token.name}</name>
                    <symbol>{token.symbol}</symbol>
                    <amount>{token.amount}</amount>
                    <price>{price.toFixed(6)} USD</price>
                    <value>{value.toFixed(2)} USD</value>
                    <description>{metadata?.details?.description || "No description available"}</description>
                    <ownershipPercentage>{percentage}%</ownershipPercentage>
                </token>
            );
        });

        const tagsOfFromFields = <portfolio>
            <totalTokens>{totalTokenCount}</totalTokens>
            {...tokenTags}
        </portfolio>;

        // todo: required fields should be more like funny analysis in twitter post and final verdict which we then concatenate them analysis and verdict and we also prefix it with wallet address to respond with object that has answer field and success field equal true
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
                        Consider token values, ownership percentages, and the total variety of tokens held.
                    </thinking>
                    <requiredFields>
                        <success>TRUE or FALSE indicating if the wallet analysis was successful</success>
                        <answer>A funny Santa-style Twitter post analyzing the wallet contents and determining if the owner is naughty or nice. No hashtags or special characters.</answer>
                    </requiredFields>
                </responseFormat>
            </system>
            <user>
                <context>
                    {tagsOfFromFields}
                </context>
            </user>
        </>;

        const result = await executePrompt(prompt);
        return result;
    },
};