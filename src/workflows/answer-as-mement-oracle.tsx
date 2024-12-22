// @ts-nocheck

import React from "react";
import executePrompt from "uai/src/uai.ts";

// todo: in respond we should use today astrology which is updated daily so if its outdated then respond invocation will update it first
const todayAstrology = ``;
const dateAstrologyUpdate = '';

export default function() {
    return {
        task: "",
        question: "",

        withTask(task: string) {
            this.task = task;
            return this;
        },

        withQuestion(question: string) {
            this.question = question;
            return this;
        },

        async respond(fields) {
            const formatFields = Object.keys(fields).map((it) => {
                return {
                    tagName: it,
                    fieldDescription: fields[it],
                };
            });

            const tagsOfFormatFields = formatFields.map((it) => {
                const TagName = it.tagName;
                return <TagName>{it.fieldDescription}</TagName>;
              });            

            const result = await executePrompt(<>
                <settings temperature={0.0} model="gpt-4o" enablesPrediction={false} />
                <system>
                    <instruction>Think about response to the question in described situation, then make a twitter post from the first person and return the result in following exact response format, avoid using hashtags, yet make it personal message to the audience.</instruction>
                    <responseFormat>
                        <thinking>THINK carefully before responding.</thinking>
                        <requiredFields>
                            {tagsOfFormatFields}
                        </requiredFields>
                    </responseFormat>
                </system>
                <user>
                    <situation>{this.task}</situation>
                    <question>{this.question}</question>
                </user>
            </>);
            console.log("result ==> ", result);

            return result;
        },
    };
};