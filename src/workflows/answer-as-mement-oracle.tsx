// @ts-nocheck

import React, { useState, useEffect } from "react";
import executePrompt from "uai/src/uai.ts";

// Function to fetch today's astrology data
async function fetchTodayAstrology() {
    // Placeholder for fetching logic
    // This should be replaced with actual logic to fetch astrology data
    return {
        astrology: "Today is a great day to start new ventures.",
        updateDate: new Date().toISOString().split('T')[0] // returns YYYY-MM-DD
    };
}

export default function() {
    const [todayAstrology, setTodayAstrology] = useState("");
    const [dateAstrologyUpdate, setDateAstrologyUpdate] = useState("");

    // Effect to fetch astrology data if outdated
    useEffect(() => {
        const checkAndUpdateAstrology = async () => {
            const currentDate = new Date().toISOString().split('T')[0];
            if (dateAstrologyUpdate !== currentDate) {
                const astrologyData = await fetchTodayAstrology();
                setTodayAstrology(astrologyData.astrology);
                setDateAstrologyUpdate(astrologyData.updateDate);
            }
        };
        checkAndUpdateAstrology();
    }, [dateAstrologyUpdate]);

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
            // Ensure astrology data is up-to-date before proceeding
            const currentDate = new Date().toISOString().split('T')[0];
            if (dateAstrologyUpdate !== currentDate) {
                const astrologyData = await fetchTodayAstrology();
                setTodayAstrology(astrologyData.astrology);
                setDateAstrologyUpdate(astrologyData.updateDate);
            }

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
                    <astrology>{todayAstrology}</astrology>
                </user>
            </>);
            console.log("result ==> ", result);

            return result;
        },
    };
};