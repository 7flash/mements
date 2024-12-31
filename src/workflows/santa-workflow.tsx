// @ts-nocheck

import React from "react";
import executePrompt from "uai/src/uai.ts";

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

/*
todo: adopt this general workflow prompt into a special santa workflow prompt

it should analyze user assets available in portfolio of user wallet thats mentioned in the message and then write down a funny conclusion how good or bad is behaviour of the owner

first, it should retrieve tokens in user wallet like this

    curl --request GET --url 'https://solana-gateway.moralis.io/account/mainnet/7FLjAK6BWGyHnF3czh3wEj1Wm3P1Na6JX443qRLPvMq8/tokens' \
     --header 'accept: application/json' \
     --header 'X-API-Key: process.env.MORALIS_API_KEY' 

which gives response like this

[
  {
    "associatedTokenAddress": "BXcStB2ghH28CaxmEkYr5szBMAyn64tapuePxittub4d",
    "mint": "58ozivupyE8rahTiZhnCsNP1WaBS7CaSkNQSmbxzia6k",
    "amountRaw": "53156",
    "amount": "0.053156",
    "decimals": 6,
    "name": "SECRET SOCIETY",
    "symbol": "SECSO"
  },
  {
    "associatedTokenAddress": "9hnpCLPdeopHCKnbLLboYdbyw8kA5fPsTrLcu9CtUyrQ",
    "mint": "DKENcHjQHVMdsdRQKNjiwovvup9RAbbFF7fYhe5BJFFP",
    "amountRaw": "53156",
    "amount": "0.053156",
    "decimals": 6,
    "name": "Chilliverse",
    "symbol": "CHILL"
  },

and then for top five most valuable assets it should do this

curl --request GET \
     --url 'https://solana-gateway.moralis.io/token/mainnet/DdzssDo7p4ibxF3xPQjbnaDmuj57FgyfsTv7YXjspump/metadata' \
     --header 'accept: application/json' \
     --header 'X-API-Key: process.env.MORALIS_API_KEY' 

which gives like this

{
  "mint": "DdzssDo7p4ibxF3xPQjbnaDmuj57FgyfsTv7YXjspump",
  "standard": "metaplex",
  "name": "Chill Terminal ",
  "symbol": "CHILL",
  "logo": null,
  "decimals": "6",
  "totalSupply": "999914280591612",
  "totalSupplyFormatted": "999914280.591612",
  "metaplex": {
    "metadataUri": "https://ipfs.io/ipfs/QmbfnNiUcpTyMbEG4k1Y2SaJ2gy6cSxpJv8WdfiEVK5gBJ",
    "masterEdition": false,
    "isMutable": false,
    "primarySaleHappened": 0,
    "sellerFeeBasisPoints": 0,
    "updateAuthority": "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM"
  }
}

and from there we take metaplex.metadataUri and fetch it shows like this

{
    "name": "Chill Terminal ",
    "symbol": "CHILL",
    "description": "",
    "image": "https://ipfs.io/ipfs/QmeB9vrgyBj9bUDTFrb74Ty2ccrfKsk4HTfJGewsuB9A4P",
    "showName": true,
    "createdOn": "https://pump.fun",
    "twitter": "https://x.com/_ChillTerminal_",
    "telegram": "https://chill-terminal.gitbook.io/chillterminal.xyz",
    "website": "https://chillterminal.xyz/"
}

and so from here we can insert token description and name and how much of it supply percentage being held as jsx fields into our prompt and derive a requiredFields of conclusion so note it will be used like this

          const result = await workflowFn
          .from({
            question: data.content,
            situation: agentData.prompt,
            // context: context
          })
          .infer({
            success: 'TRUE or FALSE indicating if question is appropriate and answerable',
            answer: 'twitter post, should not contain hash tags, nor double quotes or other special symbols'
          })
          .exec("Imagine described situation in which its character triggered by appearing question would write a twitter post in its consequence");          

those fields in infer should go into requiredFields

and in .from we have .question which must be looking like this 7FLjAK6BWGyHnF3czh3wEj1Wm3P1Na6JX443qRLPvMq8 and .situation its where its instructed how the answer should be like a santa analyzing portfolio

*/

        const result = await executePrompt(<>
            <settings temperature={0.0} enablesPrediction={false} />
            <system>
                <instruction>{this.instruction}</instruction>
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
        console.log("result ==> ", result);

        return result;
    },
};