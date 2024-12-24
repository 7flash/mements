// @ts-nocheck

import React from "react";
import executePrompt from "uai/src/uai.ts";

/*
todo: implement this workflow to be more astrological

every time we should retrieve astrological data like this

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
	const result = await response.text();
	console.log(result);
} catch (error) {
	console.error(error);
}

and response json body is like this:

status:"OK"
data:
name:"Now"
year:2024
month:3
day:31
hour:17
minute:14
city:"GMT"
nation:"UK"
lng:-0.001545
lat:51.477928
tz_str:"GMT"
zodiac_type:"Tropic"
local_time:17.233333333333334
utc_time:17.233333333333334
julian_day:2460401.2180555556
sun:
name:"Sun"
quality:"Cardinal"
element:"Fire"
sign:"Ari"
sign_num:0
position:11.473315438969095
abs_pos:11.473315438969095
emoji:"♈️"
point_type:"Planet"
house:"Seventh_House"
retrograde:false
moon:
name:"Moon"
quality:"Mutable"
element:"Fire"
sign:"Sag"
sign_num:8
position:24.068937038977367
abs_pos:264.06893703897737
emoji:"♐️"
point_type:"Planet"
house:"Third_House"
retrograde:false

we should parse this json and insert as jsx tags for sun and moon into context of our prompt

also we should not do this fetch request every time but we can store it in cache in mapping daily so only after 12 hours since last fetch request we do it again otherwise take it from cache mapping
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