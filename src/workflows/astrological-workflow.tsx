// @ts-nocheck

import React from "react";
import executePrompt from "uai/src/uai.ts";

const ASTRO_API_URL = 'https://astrologer.p.rapidapi.com/api/v4/now';
const ASTRO_API_OPTIONS = {
    method: 'GET',
    headers: {
        'x-rapidapi-key': '77e249f32amsh380b401cb9d8c04p160950jsnbf4f37e0d756',
        'x-rapidapi-host': 'astrologer.p.rapidapi.com'
    }
};

let astroCache = {
    data: null,
    timestamp: 0
};

async function fetchAstrologicalData() {
    const currentTime = Date.now();
    const twelveHours = 12 * 60 * 60 * 1000;

    if (astroCache.data && (currentTime - astroCache.timestamp < twelveHours)) {
        return astroCache.data;
    }

    try {
        const response = await fetch(ASTRO_API_URL, ASTRO_API_OPTIONS);
        const result = await response.json();
        astroCache = {
            data: result,
            timestamp: currentTime
        };
        return result;
    } catch (error) {
        console.error("Error fetching astrological data:", error);
        return null;
    }
}

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

        const astroData = await fetchAstrologicalData();
        const sunData = astroData?.data?.sun || {};
        const moonData = astroData?.data?.moon || {};

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
                    <Sun>
                        <Sign>{sunData.sign}</Sign>
                        <Element>{sunData.element}</Element>
                        <Quality>{sunData.quality}</Quality>
                        <Emoji>{sunData.emoji}</Emoji>
                    </Sun>
                    <Moon>
                        <Sign>{moonData.sign}</Sign>
                        <Element>{moonData.element}</Element>
                        <Quality>{moonData.quality}</Quality>
                        <Emoji>{moonData.emoji}</Emoji>
                    </Moon>
                </context>
            </user>
        </>);
        console.log("result ==> ", result);

        return result;
    },
};