import { dirname, join } from "path";
import { $, serve, type BunFile } from "bun";
import ShortUniqueId from "short-unique-id";
import { Database } from "bun:sqlite";
import Files from "./files";

export interface IFiles {
  upload(file: File): Promise<string>;
  getUrl(cid: string, expires: number): Promise<string>;
  createTemporaryAdminKey(): Promise<any>;
}

const { default: prompt } = await import("uai/src/uai.ts");

export interface IAssets {
  build(): Promise<void>;
  getAsset(name: AssetName): BunFile;
  getLink(name: AssetName): string;
  getAssetByPath(path: string): BunFile;
  getAssetByName(name: string): BunFile;
}

import buildAssets from './assets';

const assets = await buildAssets({
  logo: {
    href: "/assets/logo.png",
    path: join(process.cwd(), "static/images", "logo.png"),
  },
  favicon: {
    href: "/assets/favicon.ico",
    path: join(process.cwd(), "static/images", "favicon.ico"),
  },
  style: {
    href: "/assets/main.css",
    source: join(import.meta.dir, "./App.css"),
  },
  createAgentApp: {
    href: "/assets/create-agent.js",
    source: join(import.meta.dir, "./create-agent/index.tsx"),
  },
  askAgentApp: {
    href: "/assets/ask-agent.js",
    source: join(import.meta.dir, "./ask-agent/index.tsx"),
  },
  fontSans: {
    href: "/assets/Geist.ttf",
    path: join(process.cwd(), "static/fonts", "Geist.ttf"),
  },
  fontMono: {
    href: "/assets/JetBrainsMono.ttf",
    path: join(process.cwd(), "static/fonts", "JetBrainsMono.ttf"),
  },
})

export type AssetName = keyof typeof assets; 

export type IConstants = { BASE_URL: string };

import config from './config';

export interface IConfig {
  get(key: ConfigKeys): string;
}

export type ConfigKeys = 'DB_NAME' | 'BUN_PORT' | 'OPENAI_API_KEY' | 'PINATA_JWT' | 'PINATA_GATEWAY_URL ';

const { randomUUID: randomUUIDForAgent }  = new ShortUniqueId({ length: 4 });
const { randomUUID: randomUUIDForChat } = new ShortUniqueId({ length: 10 });

const db = new Database(`${config.get('DB_NAME')}.sqlite`, { create: true });

db.run(`
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    response TEXT NOT NULL,
    timestamp TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    subdomain TEXT UNIQUE,
    name TEXT,
    titles TEXT,
    suggestions TEXT,
    prompt TEXT,
    workflow TEXT,
    imageCid TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    type TEXT,
    value TEXT,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS twitter_bots (
    agent_id TEXT PRIMARY KEY,
    handle TEXT,
    api_key TEXT,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS telegram_bots (
    agent_id TEXT PRIMARY KEY,
    bot_token TEXT,
    group_id TEXT,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS contexts (
    agent_id TEXT,
    question TEXT,
    context TEXT,
    PRIMARY KEY (agent_id, question),
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS domains (
    domain TEXT PRIMARY KEY,
    agent_id TEXT,
    custom_script_path TEXT,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )
`);

function htmlTemplate(scriptLink: string, serverData: string = '{}'): string {
  return `
  <html>
    <head>
      <style>
        @font-face {
            font-family: "JetBrainsMono";
            src: url(${assets.getLink('fontMono')}) format("truetype");
            font-display: swap;
        }
        @font-face {
            font-family: "Geist";
            src: url(${assets.getLink('fontSans')}) format("truetype");
            font-display: swap;
        }
      </style>
      <link rel="stylesheet" href="${assets.getLink('style')}">
      <link rel="shortcut icon" href="${assets.getLink('favicon')}" type="image/x-icon">
      <script type="importmap">
        {
          "imports": {
            "react": "https://esm.sh/react@19.0.0/?dev",
            "react-dom/client": "https://esm.sh/react-dom@19.0.0/client/?dev"
          }
        }
      </script>
    </head>
    <body>
      <div id="root"></div>
      <script type="module">
        window.serverData = ${serverData};
      </script>
      <script type="module" src="${scriptLink}"></script>
    </body>
  </html>
  `;
}

async function createAgentEntry(options: {
  subdomain?: string;
  name: string;
  titles: string[];
  suggestions: string[];
  prompt: string;
  workflow: string;
  imageField?: string;
}): Promise<any> {
  let imageCid: string;

  if (options.imageField) {
    if (/^[a-f0-9]{40,}$/.test(options.imageField)) {
      // If it's a CID
      imageCid = options.imageField;
    } else if (/^.+\.(png|jpg|jpeg|gif)$/.test(options.imageField)) {
      // If it's a file path
      const file = await Bun.file(options.imageField).read();
      imageCid = await Files.upload(new File([file], "agent-image.png", { type: "image/png" }));
    } else {
      // Assume it's a prompt text
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: options.imageField || `image of artificial agent representing ${options.titles.join(' ')}`,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        }),
      });

      const imageData = await response.json();
      const base64Image = imageData.data[0].b64_json;
      const file = new File([Buffer.from(base64Image, 'base64')], "agent-image.png", { type: "image/png" });
      imageCid = await Files.upload(file);
    }
  } else {
    imageCid = "";
  }

  const subdomain = options.subdomain ?? `${options.name.toLowerCase().replace(/\s+/g, '-')}-${Math.floor(1000 + Math.random() * 9000)}`

  const agentEntry = {
    id: randomUUIDForAgent(),
    subdomain: subdomain,
    name: options.name,
    titles: options.titles.join(','),
    suggestions: options.suggestions.join(','),
    prompt: options.prompt,
    workflow: options.workflow,
    imageCid: imageCid
  };

  db.run(
    "INSERT INTO agents (id, subdomain, name, titles, suggestions, prompt, workflow, imageCid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    agentEntry.id,
    agentEntry.subdomain,
    agentEntry.name,
    agentEntry.titles,
    agentEntry.suggestions,
    agentEntry.prompt,
    agentEntry.workflow,
    agentEntry.imageCid
  );

  return agentEntry;
}

const server = serve({
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (assets.hasAssetByPath(path)) {
      return new Response(assets.getAssetByPath(path));
    }

    const host = req.headers.get("host");

    const subdomain = host ? host.split(".")[0] : "";
    const domainStmt = db.prepare("SELECT agent_id, custom_script_path FROM domains WHERE domain = ?");
    const domainData = domainStmt.get(host);
    const agentWithItsOwnDomain = domainData ? true : false;

    let itsRootCreationDomain = false;
    if (path === "/" && !subdomain && !agentWithItsOwnDomain) itsRootCreationDomain = true;
    if (path === "/" && host?.includes('localhost:')) itsRootCreationDomain = true;

    console.log("itsRootCreationDomain ==> ", itsRootCreationDomain);
    console.log("agentWithItsOwnDomain ==> ", agentWithItsOwnDomain);
    console.log("subdomain ==> ", subdomain);

    if (!itsRootCreationDomain && (subdomain || agentWithItsOwnDomain)) {
      const agentId = agentWithItsOwnDomain ? domainData.agent_id : null;
      const agentStmt = db.prepare("SELECT * FROM agents WHERE subdomain = ? OR id = ?");
      const agentData = agentStmt.get(subdomain, agentId);

      if (!agentData)
        return new Response("Agent not found", { status: 404 });
      
      if (req.method === "GET") {
        if (agentData) {
          if (path == "/") {
            const serverData = {
              mintAddress: process.env.MINT_ADDRESS,
              botName: agentData.name,
              alternativeBotTitles: agentData.titles.split(','),
              botTag: `@${agentData.name.replace(/\s+/g, '')}`,
              scrollItemsLeft: agentData.suggestions.split(','),
              scrollItemsRight: agentData.suggestions.split(',').reverse(),
              socialMediaLinks: db.prepare("SELECT type, value FROM links WHERE agent_id = ?").all(agentData.id),
              agentImage: await Files.getUrl(agentData.imageCid, 3600),
            };

            if (agentWithItsOwnDomain && domainData.custom_script_path) {
              const customScriptPath = join(import.meta.dir, domainData.custom_script_path);
              return new Response(htmlTemplate(customScriptPath, JSON.stringify(serverData)), {
                headers: { "content-type": "text/html" },
              });
            } else {
              return new Response(htmlTemplate(assets.getLink('askAgentApp'), JSON.stringify(serverData)), {
                headers: { "content-type": "text/html" },
              });
            }
          } else if (path.startsWith("/chat") && agentData) {
            const chatId = path.split("/")[2];
            if (chatId) {
              const chatStmt = db.prepare("SELECT * FROM chats WHERE id = ?");
              const chatResponse = chatStmt.get(chatId);
      
              if (chatResponse) {
                const serverDataWithChat = {
                  mintAddress: process.env.MINT_ADDRESS,
                  botName: agentData.name,
                  alternativeBotTitles: agentData.titles.split(','),
                  botTag: `@${agentData.name.replace(/\s+/g, '')}`,
                  scrollItemsLeft: agentData.suggestions.split(','),
                  scrollItemsRight: agentData.suggestions.split(',').reverse(),
                  socialMediaLinks: db.prepare("SELECT type, value FROM links WHERE agent_id = ?").all(agentData.id),
                  chatId: chatResponse.id,
                  question: encodeURIComponent(chatResponse.question.replaceAll('%', 'percent')),
                  content: encodeURIComponent(chatResponse.response.replaceAll('%', 'percent')),
                  timestamp: chatResponse.timestamp,
                };
      
                return new Response(htmlTemplate(assets.getLink('askAgentApp'), JSON.stringify(serverDataWithChat)), {
                  headers: { "content-type": "text/html" }
                });
              }
            }
            return new Response("Chat not found", { status: 404 });
          }

        }
      }

      if (req.method === "POST" && path === "/api/ask-agent") {
        try {
          const data = await req.json();
          const systemPromptStmt = db.prepare("SELECT prompt FROM agents WHERE subdomain = ?");
          const systemPromptRow = systemPromptStmt.get(subdomain);
          const systemPrompt = systemPromptRow ? systemPromptRow.prompt : "You are an AI expert. Provide guidance and advice.";

          const contextStmt = db.prepare("SELECT context FROM contexts WHERE agent_id = ? AND question LIKE ?");
          const contextRow = contextStmt.get(agentData.id, `%${data.content}%`);
          const context = contextRow ? contextRow.context : "";

          const result = await prompt(
            <>
              <output content="response" />
              <settings temperature={0.5} model="gpt-4o" />
              <system>
                <instruction>
                  {systemPrompt}
                  Ensure clarity and shortness of your response in one paragraph, must fit in a tweet message. Ensure wrapping your response with "content" tag.
                </instruction>
                <responseFormat>
                  <thinking>THINK carefully before responding.</thinking>
                  <response>
                    <content>Provide responses with thoughtful insights based on teachings.</content>
                  </response>
                </responseFormat>
                <example>
                  <content>Consider ethical investments and risk-sharing as alternatives.</content>
                </example>
              </system>
              <user>
                <context>{context}</context>
                <question>{data.content}</question>
              </user>
            </>,
          );

          if (!result.content) {
            throw new Error("missing response fields");
          }

          const twitterBotStmt = db.prepare("SELECT handle, api_key FROM twitter_bots WHERE agent_id = ?");
          const twitterBotData = twitterBotStmt.get(agentData.id);

          const responseData = {
            id: randomUUIDForChat(),
            question: data.content,
            response: result.content,
            timestamp: new Date().toISOString(),
          };

          if (twitterBotData) {
            // todo: should actually send message with twitter api
            const twitterPostLink = `https://twitter.com/${twitterBotData.handle}/status/${responseData.id}`;
            responseData.twitterPostLink = twitterPostLink;
          }

          db.run(
            "INSERT INTO chats (id, question, response, timestamp) VALUES (?, ?, ?, ?)",
            responseData.id,
            responseData.question,
            responseData.response,
            responseData.timestamp,
          );

          // Find telegram bot details
          const telegramBotStmt = db.prepare("SELECT bot_token, group_id FROM telegram_bots WHERE agent_id = ?");
          const telegramBotData = telegramBotStmt.get(agentData.id);

          if (telegramBotData && telegramBotData.group_id) {
            // Example to send a message via Telegram API (using bot token and group ID)
            const telegramApiUrl = `https://api.telegram.org/bot${telegramBotData.bot_token}/sendMessage`;
            const messageBody = {
              chat_id: telegramBotData.group_id,
              text: `New response from bot ${agentData.name}: ${responseData.response}`
            };

            await fetch(telegramApiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(messageBody)
            });
          }

          return new Response(JSON.stringify(responseData), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("Error generating response:", err);
          return new Response("Error generating response", { status: 500 });
        }
      }
    } else if (itsRootCreationDomain) {
      if (req.method === "GET" && path === "/") {
        return new Response(htmlTemplate(assets.getLink('createAgentApp')), {
          headers: { "content-type": "text/html" },
        });
      }

      if (req.method === "POST" && path === "/api/create-agent") {
        try {
          const data = await req.json();
          const result = await prompt(
            <>
              <output content="fields" />
              <settings temperature={0.5} model="gpt-4o" />
              <system>
                <instruction>
                  Generate fields for an agent entry based on the provided idea.
                </instruction>
                <responseFormat>
                  <thinking>THINK carefully before responding.</thinking>
                  <fields>
                    <name>Name of the bot</name>
                    <titles>List of alternative titles for the bot</titles>
                    <suggestions>List of items to scroll</suggestions>
                    <prompt>System prompt for the bot</prompt>
                  </fields>
                </responseFormat>
                <example>
                  <name>AI Guide</name>
                  <titles>["Guide", "Counselor"]</titles>
                  <suggestions>["Incorporate practices", "Balance modern life"]</suggestions>
                  <prompt>You are an AI expert. Provide guidance and advice.</prompt>
                </example>
              </system>
              <user>
                {data.idea}
              </user>
            </>,
          );

          if (!result.name || !result.titles || !result.suggestions || !result.prompt) {
            throw new Error("missing response fields");
          }

          const entry = await createAgentEntry({
            name: result.name,
            titles: result.titles,
            suggestions: result.suggestions,
            prompt: result.prompt,
            workflow: "",
          });

          return new Response(null, {
            status: 302,
            headers: { "Location": `http://${entry.subdomain}.${host}` },
          });
        } catch (err) {
          console.error("Error creating agent:", err);
          return new Response("Error creating agent", { status: 500 });
        }
      }
    }
// todo: implement /api/create-agent-from-toml similar method which parses toml file simply with await import(path) which gives json and then proceed similarly
    if (req.method === "POST" && path === "/api/create-agent-from-markdown") {
      try {
        const data = await req.json();
        const markdownPath = data.path;
        const markdownContent = await Bun.file(markdownPath).text();
        
        const lines = markdownContent.split('\n');
        let name = '';
        let titles = [];
        let suggestions = [];
        let prompt = '';
        let workflow = '';
        let imageField = '';
        let currentSection = '';
        let newAgentSubdomain = '';

        let domains = [];
        let links = [];
        let twitterBot = {};
        let telegramBot = {};

        for (const line of lines) {
          if (line.startsWith('# name')) {
            currentSection = 'name';
          } else if (line.startsWith('# titles')) {
            currentSection = 'titles';
          } else if (line.startsWith('# suggestions')) {
            currentSection = 'suggestions';
          } else if (line.startsWith('# prompt')) {
            currentSection = 'prompt';
          } else if (line.startsWith('# workflow')) {
            currentSection = 'workflow';
          } else if (line.startsWith('# image')) {
            currentSection = 'image';
          } else if (line.startsWith('# subdomain')) {
            currentSection = 'subdomain';
          } else if (line.startsWith('# domains')) {
            currentSection = 'domains';
          } else if (line.startsWith('# links')) {
            currentSection = 'links';
          } else if (line.startsWith('# twitter_bots')) {
            currentSection = 'twitter_bots';
          } else if (line.startsWith('# telegram_bots')) {
            currentSection = 'telegram_bots';
          } else if (line.trim()) {
            if (currentSection === 'name') {
              name = line.trim();
            } else if (currentSection === 'titles') {
              titles.push(line.trim());
            } else if (currentSection === 'suggestions') {
              suggestions.push(line.trim());
            } else if (currentSection === 'prompt') {
              prompt = line.trim();
            } else if (currentSection === 'workflow') {
              workflow = line.trim();
            } else if (currentSection === 'image') {
              imageField = line.trim();
            } else if (currentSection === 'subdomain') {
              newAgentSubdomain = line.trim();
            } else if (currentSection === 'domains') {
              const [domain, customScriptPath] = line.split('||');
              domains.push({ domain: domain.trim(), customScriptPath: customScriptPath?.trim() });
            } else if (currentSection === 'links') {
              const [type, value] = line.split('||');
              links.push({ type: type.trim(), value: value.trim() });
            } else if (currentSection === 'twitter_bot') {
              const [handle, apiKey] = line.split('||');
              twitterBot = { handle: handle.trim(), api_key: apiKey.trim() };
            } else if (currentSection === 'telegram_bot') {
              const [botToken, groupId] = line.split('||');
              telegramBot = { bot_token: botToken.trim(), group_id: groupId.trim() };
            }
          }
        }

        const agentEntry = await createAgentEntry({
          subdomain: newAgentSubdomain,
          name,
          titles,
          suggestions,
          prompt: prompt || "You are an AI expert. Provide guidance and advice.",
          workflow: workflow || "",
          imageField,
        });

        domains.forEach(({ domain, customScriptPath }) => {
          db.run("INSERT INTO domains (domain, agent_id, custom_script_path) VALUES (?, ?, ?)", domain, agentEntry.id, customScriptPath);
        });

        links.forEach(({ type, value }) => {
          db.run("INSERT INTO links (id, agent_id, type, value) VALUES (?, ?, ?, ?)", randomUUIDForAgent(), agentEntry.id, type, value);
        });

        if (twitterBot) {
          db.run(
            "INSERT INTO twitter_bots (agent_id, handle, api_key) VALUES (?, ?, ?)",
            agentEntry.id,
            twitterBot.handle,
            twitterBot.api_key,
          );
        }

        if (telegramBot) {
          db.run(
            "INSERT INTO telegram_bots (agent_id, bot_token, group_id) VALUES (?, ?, ?)",
            agentEntry.id,
            telegramBot.bot_token,
            telegramBot.group_id,
          );
        }

        // todo: if it has a telegram bot defined, then since it might not have a group id, so if its missing group id, then it should start polling messages for that bot, and the first channel it has received message in, that one we assign as a group id, and only then we call createAgentEntry and give response

        return new Response(JSON.stringify({ name, titles, suggestions, prompt, workflow }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Error processing markdown:", err);
        return new Response("Error processing markdown", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🌐 Server is running on http://localhost:${server.port} 🚀`);