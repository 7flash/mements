// @ts-nocheck

import React from "react";
import executePrompt from "uai/src/uai.ts";

export default {
    fromFields: {},
    toFields: {},

    async exec(context) {
        const result = await executePrompt(<>
            <settings temperature={0.0} enablesPrediction={false} model={"gpt-4o"} />
            <system>
                <instruction>Imagine the character encounters given image in described situation. It must be triggered by this image to write a twitter post expressing his thoughts. Very important: this analysis should be as much specific as possible, should mention specific numbers it can see and etc. for example if its a chart of mements, it should be very positive and explain technical reason why its going to go up. it can be more negative about other charts, but still have to mention exact numbers it shows. and it should feel as a natural thought in the context of world situation.</instruction>
                <responseFormat>
                    <requiredFields>
                        <thinking>THINK carefully before responding.</thinking>
                        <success>TRUE indicates if the image is appropriate and not malicious.</success>
                        <answer>twitter post, should not contain hash tags, nor double quotes or other special symbols.</answer>
                    </requiredFields>
                </responseFormat>
            </system>
            <user>
                <file description="given image" path={context.imagePath} />
                <situation>
                    {context.agentData.prompt}
                </situation>
            </user>
        </>);
        console.log("result with image ==> ", result);

        return result;
    },
};
