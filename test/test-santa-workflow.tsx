import workflowFn from "../src/workflows/santa-workflow";

const resp = await workflowFn.from({
    question: "HyYNVYmnFmi87NsQqWzLJhUTPBKQUfgfhdbBa554nMFF",
    // question: "7FLjAK6BWGyHnF3czh3wEj1Wm3P1Na6JX443qRLPvMq8"
}).to({

}).exec()

console.log("resp ==> ", resp);