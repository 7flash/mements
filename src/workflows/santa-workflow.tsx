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

const findValuableTokens = async (tokens: Token[], startIndex: number = 0, valuableTokens: Token[] = [], maxAttempts: number = 10) => {
    if (valuableTokens.length >= 3 || startIndex >= tokens.length || startIndex >= maxAttempts) {
        return valuableTokens;
    }

    const currentBatch = tokens.slice(startIndex, startIndex + 3 - valuableTokens.length);
    const prices = await Promise.all(currentBatch.map(token => fetchTokenPrice(token.mint)));
    
    const newValuableTokens = currentBatch.filter((_, index) => prices[index] > 0);
    const combinedValuableTokens = [...valuableTokens, ...newValuableTokens];

    if (combinedValuableTokens.length >= 3) {
        return combinedValuableTokens.slice(0, 3);
    }

    return findValuableTokens(
        tokens,
        startIndex + currentBatch.length,
        combinedValuableTokens,
        maxAttempts
    );
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
        
        // Validate wallet address format
        const isValidWallet = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress);
        if (!isValidWallet) {
            return {
                success: false,
                thinking: "This doesn't look like a valid Solana wallet address. Santa needs a proper wallet address to check if you've been naughty or nice!",
                answer: "Invalid wallet address provided"
            };
        }

        const tokens = await fetchWalletTokens(walletAddress);
        
        if (!tokens || tokens.length === 0) {
            return {
                success: false,
                thinking: "Ho ho ho! This wallet seems to be empty. Santa can't analyze an empty wallet!",
                answer: "No tokens found in this wallet"
            };
        }

        if (tokens.error) throw `${tokens.error.name}`

        const valuableTokens = await findValuableTokens(tokens);
        const tokenDetails = await Promise.all(
            valuableTokens.map(token => fetchTokenMetadata(token.mint))
        );

        const tokenPrices = await Promise.all(
            valuableTokens.map(token => fetchTokenPrice(token.mint))
        );

        const tokenTags = valuableTokens.map((token, index) => {
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
            <walletAddress>{walletAddress}</walletAddress>
            <totalTokens>{tokens.length}</totalTokens>
            {...tokenTags}
        </portfolio>;

        const prompt = <>
            <settings temperature={0.7} enablesPrediction={false} />
            <system>
                <instruction>
                    You are Santa Claus analyzing a crypto wallet to determine if its owner has been naughty or nice.
                    Based on the tokens they hold and their quantities, create a funny and witty response about their behavior.
                    Provide two parts: 1) A humorous analysis of their portfolio 2) A final verdict (naughty or nice).
                    Keep the tone jolly and festive!
                </instruction>
                <responseFormat>
                    <thinking>
                        THINK about the types of tokens, their values, and what they might indicate about the wallet owner's behavior.
                        Consider if they're a long-term holder, trader, or collector.
                        Look for signs of community participation and investment behavior.
                    </thinking>
                    <requiredFields>
                        <analysis>A witty analysis of the wallet's contents (max 180 characters)</analysis>
                        <verdict>Final judgment: NAUGHTY or NICE with a brief reason</verdict>
                    </requiredFields>
                </responseFormat>
            </system>
            <user>
                <context>
                    {tagsOfFromFields}
                </context>
            </user>
        </>;

//   answer: "HyYNVYmnFmi87NsQqWzLJhUTPBKQUfgfhdbBa554nMFF\n\n\nSanta's shocked! This wallet's full of Shart and Butt—and that's no bull!\n\n\nNaughty! They've been trading lumps of coal, not gold.\n",

        const result = await executePrompt(prompt);
        console.log("result ==> ", result);

        const shortenedWalletAddress = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;

        return {
            success: true,
            answer: `${walletAddress}\n\n${result.analysis}\n\n${result.verdict}`
        };
    },
};