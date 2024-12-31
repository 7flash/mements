// @ts-nocheck
import React from "react";
import executePrompt from "uai/src/uai.ts";

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

        // Fetch wallet data
        const walletAddress = this.fromFields.question;
        const tokens = await fetchWalletTokens(walletAddress);

        // Sort tokens by value and get top 5
        const topTokens = tokens
          .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
          .slice(0, 5);

        // Fetch metadata for top tokens
        const tokenDetails = await Promise.all(
          topTokens.map(token => fetchTokenMetadata(token.mint))
        );

        // Format token information for the prompt
        const tokenContexts = topTokens.map((token, index) => ({
          name: token.name,
          symbol: token.symbol,
          amount: token.amount,
          metadata: tokenDetails[index]?.details?.description || "No description available"
        }));

        const formatFromFields = [
          {
            tagName: "walletAddress",
            fieldDescription: walletAddress
          },
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

        const tagsOfToFields = formatToFields.map((it) => {
            const TagName = it.tagName;
            return <TagName>{it.fieldDescription}</TagName>;
        });

        const result = await executePrompt(<>
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
        </>);
        console.log("result ==> ", result);

        return result;
    },
};