import path from 'path';
import { parseArgs } from 'util';

async function main() {
  const args = parseArgs({
    args: Bun.argv,
    options: {
      filePath: {
        type: 'string',
      },
    },
    strict: true,
    allowPositionals: true,
  });

  const filePath = path.join(process.cwd(), args.values.filePath!);
  console.log("filePath ==> ", filePath);

  const fileContent = await Bun.file(filePath).text();

  let parsedData;
  if (filePath.endsWith('.toml')) {
    parsedData = (await import(filePath)).default;
  } else {
    console.error('Unsupported file format. Please provide a .toml or .md file.');
    process.exit(1);
  }

  console.log("parsedData ==> ", parsedData);

  try {
      const response = await fetch(`http://localhost:${process.env.BUN_PORT}/createAgent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CREATE_AGENT_SECRET}`
        },
        body: JSON.stringify(parsedData),
      });
      console.log("response ==> ", await response.text());
    } catch (error) {
    console.error('Error creating agent:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error in main function:', err);
  process.exit(1);
});
