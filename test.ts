import { parseArgs } from "util";

const args = parseArgs({
    args: Bun.argv,
    options: {
        filePath: {
            type: 'string',
        },
    },
    strict: true,
    allowPositionals: false,
});

const filePath = args.values.filePath!;
console.log("filePath ==> ", filePath);