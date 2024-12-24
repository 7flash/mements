// @ts-nocheck

import React from "react";
import executePrompt from "uai/src/uai.ts";

const isCacheValid = (lastFetchTime) => {
    const now = new Date().getTime();
    const twelveHours = 12 * 60 * 60 * 1000;
    return (now - lastFetchTime) < twelveHours;
}

const fetchAstrologicalData = async () => {
    const url = 'https://astrologer.p.rapidapi.com/api/v4/now';
    const options = {
        method: 'GET',
        headers: {
            'x-rapidapi-key': '77e249f32amsh380b401cb9d8c04p160950jsnbf4f37e0d756',
            'x-rapidapi-host': 'astrologer.p.rapidapi.com'
        }
    };

    try {
        const response = await fetch(url, options);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error(error);
        return null;
    }
};

// Caching mechanism
let cachedAstrologicalData = null;
let lastFetchTime = 0;

const getAstrologicalData = async () => {
    if (cachedAstrologicalData && isCacheValid(lastFetchTime)) {
        console.log("Using cached astrological data");
        return cachedAstrologicalData;
    } else {
        console.log("Fetching new astrological data");
        const data = await fetchAstrologicalData();
        if (data) {
            cachedAstrologicalData = data;
            lastFetchTime = new Date().getTime();
        }
        return cachedAstrologicalData;
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

        const astrologicalData = await getAstrologicalData();
        const sunData = astrologicalData?.data?.sun;
        const moonData = astrologicalData?.data?.moon;

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
                    {sunData && (
                        <sun>
                            <element>{sunData.element}</element>
                            <sign>{sunData.sign}</sign>
                            <emoji>{sunData.emoji}</emoji>
                        </sun>
                    )}
                    {moonData && (
                        <moon>
                            <element>{moonData.element}</element>
                            <sign>{moonData.sign}</sign>
                            <emoji>{moonData.emoji}</emoji>
                        </moon>
                    )}
                </context>
            </user>
        </>);
        console.log("result ==> ", result);

        return result;
    },
};
