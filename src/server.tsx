import { dirname, join } from "path";
import { $, serve, type BunFile } from "bun";
import ShortUniqueId from "short-unique-id";
import { Database } from "bun:sqlite";
import React from 'react';

const { default: prompt } = await import("uai/src/uai.ts");

export interface IAssets {
  build(): Promise<void>;
  getAsset(name: AssetName): BunFile;
  getLink(name: AssetName): string;
  getAssetByPath(path: string): BunFile;
  getAssetByName(name: string): BunFile;
}

export const assets = {
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
    source: join(import.meta.dir, "../frontend/App.css"),
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
}

import Assets from './assets';

export type AssetName = keyof typeof assets; 

export const envVariables = ['DB_NAME', 'BUN_PORT'] as const;

export interface IConfig {
  get(key: (typeof envVariables)[number]): string;
}

import config from "./config";

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
    suggestionsLeft TEXT,
    suggestionsRight TEXT,
    links TEXT,
    prompt TEXT,
    workflow TEXT
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
  CREATE TABLE IF NOT EXISTS contexts (
    agent_id TEXT,
    question TEXT,
    context TEXT,
    PRIMARY KEY (agent_id, question),
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
            src: url(${Assets.getLink('fontMono')}) format("truetype");
            font-display: swap;
        }
        @font-face {
            font-family: "Geist";
            src: url(${Assets.getLink('fontSans')}) format("truetype");
            font-display: swap;
        }
      </style>
      <link rel="stylesheet" href="${Assets.getLink('style')}">
      <link rel="shortcut icon" href="${Assets.getLink('favicon')}" type="image/x-icon">
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

const server = serve({
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const host = req.headers.get("host");

    const subdomain = host ? host.split(".")[0] : "";

    const agentStmt = db.prepare("SELECT * FROM agents WHERE subdomain = ?");
    const agentData = agentStmt.get(subdomain);

    if (req.method === "GET") {
      if (path === "/") {
        if (!subdomain) {
          return new Response(htmlTemplate(Assets.getLink('createAgentApp')), {
            headers: { "content-type": "text/html" },
          });
        } else if (agentData) {
          const serverData = {
            mintAddress: process.env.MINT_ADDRESS,
            botName: agentData.name,
            alternativeBotTitles: JSON.parse(agentData.titles),
            botTag: `@${agentData.name.replace(/\s+/g, '')}`,
            scrollItemsLeft: JSON.parse(agentData.suggestionsLeft),
            scrollItemsRight: JSON.parse(agentData.suggestionsRight),
            socialMediaLinks: JSON.parse(agentData.links),
          };
          return new Response(htmlTemplate(Assets.getLink('askAgentApp'), JSON.stringify(serverData)), {
            headers: { "content-type": "text/html" },
          });
        } else {
          return new Response("Subdomain not found", { status: 404 });
        }
      }

      if (path.startsWith("/chat") && agentData) {
        const chatId = path.split("/")[2];
        if (chatId) {
          const chatStmt = db.prepare("SELECT * FROM chats WHERE id = ?");
          const chatResponse = chatStmt.get(chatId);

          if (chatResponse) {
            const serverDataWithChat = {
              mintAddress: process.env.MINT_ADDRESS,
              botName: agentData.name,
              alternativeBotTitles: JSON.parse(agentData.titles),
              botTag: `@${agentData.name.replace(/\s+/g, '')}`,
              scrollItemsLeft: JSON.parse(agentData.suggestionsLeft),
              scrollItemsRight: JSON.parse(agentData.suggestionsRight),
              socialMediaLinks: JSON.parse(agentData.links),
              chatId: chatResponse.id,
              question: encodeURIComponent(chatResponse.question.replaceAll('%', 'percent')),
              content: encodeURIComponent(chatResponse.response.replaceAll('%', 'percent')),
              timestamp: chatResponse.timestamp,
            };

            return new Response(htmlTemplate(Assets.getLink('askAgentApp'), JSON.stringify(serverDataWithChat)), {
              headers: { "content-type": "text/html" }
            });
          }
        }
        return new Response("Chat not found", { status: 404 });
      }

      try {
        return new Response(Assets.getAssetByPath(path));
      } catch (error) {
        console.error(`Error serving ${path}:`, error);
        return new Response("Not Found", { status: 404 });
      }
    }

    if (req.method === "POST") {
      if (path === "/api/ask-agent" && agentData) {
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
            // Simulate posting to Twitter and returning a link
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

          return new Response(JSON.stringify(responseData), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("Error generating response:", err);
          return new Response("Error generating response", { status: 500 });
        }
      }

      if (path === "/api/create-agent") {
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

          const agentEntry = {
            id: randomUUIDForAgent(),
            subdomain: `${result.name.toLowerCase().replace(/\s+/g, '-')}-${Math.floor(1000 + Math.random() * 9000)}`,
            name: result.name,
            titles: JSON.stringify(result.titles),
            suggestionsLeft: JSON.stringify(result.suggestions),
            suggestionsRight: JSON.stringify(result.suggestions.reverse()),
            links: JSON.stringify({}),
            prompt: result.prompt,
            workflow: "",
          };

          db.run(
            "INSERT INTO agents (id, subdomain, name, titles, suggestionsLeft, suggestionsRight, links, prompt, workflow) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            agentEntry.id,
            agentEntry.subdomain,
            agentEntry.name,
            agentEntry.titles,
            agentEntry.suggestionsLeft,
            agentEntry.suggestionsRight,
            agentEntry.links,
            agentEntry.prompt,
            agentEntry.workflow,
          );

          return new Response(JSON.stringify(agentEntry), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("Error creating agent:", err);
          return new Response("Error creating agent", { status: 500 });
        }
      }
    }

    return new Response("four-zero-four", { status: 404 });
  },
});

console.log(`🌐 Server is running on http://localhost:${server.port} 🚀`);