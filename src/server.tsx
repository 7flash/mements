import { dirname, join } from "path";
import { $, serve, type BunFile } from "bun";
import ShortUniqueId from "short-unique-id";
import { Database } from "bun:sqlite";
import React from 'react';
// todo: can do normal import because we dont have extensions for sqlite below
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

// todo: ensure keyof properly includes a union of all keys of assets object here
export type AssetName = keyof typeof assets; 

export const envVariables = ['DB_NAME', 'BUN_PORT'];

// todo ensure keyof properly working here
export interface IConfig {
  get(key: keyof typeof envVariables): string;
}

// todo: random uuid should be 4 symbols for agent because it also includes an agent name, and chatid still needs 10 symbols
const randomUUID = new ShortUniqueId({ length: 10 });

// todo: avoid using separate abstraction class, remove CustomDatabase just make calls directly and init tables in main function
class CustomDatabase {
  constructor(private dbName: string) {
    this.db = new Database(`${dbName}.sqlite`, { create: true });
    this.initializeTables();
  }

  private db: Database;

  private initializeTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        response TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);

    this.db.run(`
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

    // todo: define a new table to save twitter bots associated by id of agent, so some agents can have associated twitter bot, and the row contains its handle and api key,so that it can send tweets on its behalf
  }

  run(query: string, ...params: any[]) {
    return this.db.run(query, ...params);
  }

  prepare(query: string) {
    return this.db.prepare(query);
  }
}

const dbHelper = new CustomDatabase(process.env.DB_NAME);

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

    // todo: dont use "default" subdomain, instead when we are on root domain theen we show "create-agent" app otherwise we show "ask-agent" if we find corresponding agent by subdomain and if not then we show 404 error message (these are for GET requests and we also support two POST requests: create-agent and ask-agent accordingly)
    const subdomain = host ? host.split(".")[0] : "default";

    const agentStmt = dbHelper.prepare("SELECT * FROM agents WHERE subdomain = ?");
    const agentData = agentStmt.get(subdomain);

    if (!agentData) {
      return new Response("Subdomain not found", { status: 404 });
    }

    // todo: this serverData we provide in our ask-agent page
    const serverData = {
      mintAddress: process.env.MINT_ADDRESS,
      botName: agentData.name,
      alternativeBotTitles: JSON.parse(agentData.titles),
      botTag: agentData.name,
      scrollItemsLeft: JSON.parse(agentData.suggestionsLeft),
      scrollItemsRight: JSON.parse(agentData.suggestionsRight),
      socialMediaLinks: JSON.parse(agentData.links),
    };

    if (req.method === "GET") {
      if (path === "/") {
        // todo: should invoke htmlTemplate helper function in all get requests
        const indexPage = `<html>
          <head>
            <link rel="stylesheet" href="${assets.style.href}">
            <link rel="shortcut icon" href="${assets.favicon.href}" type="image/x-icon">
          </head>
          <body>
            <div id="root"></div>
            <script>
              window.serverData = ${JSON.stringify(serverData)};
            </script>
            <script type="module" src="${assets.script.href}"></script>
          </body>
        </html>`;
        return new Response(indexPage, {
          headers: { "content-type": "text/html" },
        });
      }

      // todo: we still have both / and /chat endpoints pointing to ask-agent app but remember only when there is a valid agent associated with subdomain 
      if (path.startsWith("/chat")) {
        const chatId = path.split("/")[2];
        if (chatId) {
          const chatStmt = dbHelper.prepare("SELECT * FROM chats WHERE id = ?");
          const chatResponse = chatStmt.get(chatId);

          if (chatResponse) {
            const serverDataWithChat = {
              ...serverData,
              chatId: chatResponse.id,
              question: encodeURIComponent(chatResponse.question.replaceAll('%', 'percent')),
              content: encodeURIComponent(chatResponse.response.replaceAll('%', 'percent')),
              timestamp: chatResponse.timestamp,
            };

            const chatPage = `<html>
              <head>
                <link rel="stylesheet" href="${assets.style.href}">
                <link rel="shortcut icon" href="${assets.favicon.href}" type="image/x-icon">
              </head>
              <body>
                <div id="root"></div>
                <script>
                  window.serverData = ${JSON.stringify(serverDataWithChat)};
                </script>
                <script type="module" src="${assets.script.href}"></script>
              </body>
            </html>`;
            return new Response(chatPage, { headers: { "content-type": "text/html" } });
          }
        }
        return new Response("Chat not found", { status: 404 });
      }

      if (hrefToPath[path]) {
        const resource = Bun.file(hrefToPath[path]);
        if (await resource.exists()) {
          return new Response(resource);
        }
      }
    }

    if (req.method === "POST") {
      if (path === "/api/ask-agent") {
        try {
          const data = await req.json();
          const systemPromptStmt = dbHelper.prepare("SELECT prompt FROM agents WHERE subdomain = ?");
          const systemPromptRow = systemPromptStmt.get(subdomain);
          const systemPrompt = systemPromptRow ? systemPromptRow.prompt : "You are an AI expert. Provide guidance and advice.";

          // todo: improve instruction and example to make it more focused on persona-based answering the question, todo: implement context fetching it from a new table we define scoped for every agent subdomain to find relevant context based on user question
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

          // todo: when we have a twitter bot associated with agent by its id then it should make a post to its own twitter and in responseData it should return a link to the post its made
          const responseData = {
            id: randomUUID(),
            question: data.content,
            response: result.content,
            timestamp: new Date().toISOString(),
          };

          dbHelper.run(
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

      // todo: dont generate links, only generate shared list of suggestions and then just make right suggestions a reverse list of left ones, also dont generate bot tag just derive it from bot name
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
                    <botTag>Tag for the bot</botTag>
                    <suggestionsLeft>List of items to scroll on the left</suggestionsLeft>
                    <suggestionsRight>List of items to scroll on the right</suggestionsRight>
                    <links>Links to social media profiles</links>
                    <prompt>System prompt for the bot</prompt>
                  </fields>
                </responseFormat>
                <example>
                  <name>AI Guide</name>
                  <titles>["Guide", "Counselor"]</titles>
                  <botTag>@AIGuide</botTag>
                  <suggestionsLeft>["Incorporate practices", "Balance modern life"]</suggestionsLeft>
                  <suggestionsRight>["Ethical living", "Investment principles"]</suggestionsRight>
                  <links>{"telegram": "https://t.me/aiguide", "twitter": "https://x.com/aiguide"}</links>
                  <prompt>You are an AI expert. Provide guidance and advice.</prompt>
                </example>
              </system>
              <user>
                {data.idea}
              </user>
            </>,
          );

          if (!result.name || !result.titles || !result.botTag || !result.suggestionsLeft || !result.suggestionsRight || !result.links || !result.prompt) {
            throw new Error("missing response fields");
          }

          const agentEntry = {
            id: randomUUID(),
            subdomain: `${result.name.toLowerCase().replace(/\s+/g, '-')}-${Math.floor(1000 + Math.random() * 9000)}`,
            name: result.name,
            titles: JSON.stringify(result.titles),
            suggestionsLeft: JSON.stringify(result.suggestionsLeft),
            suggestionsRight: JSON.stringify(result.suggestionsRight),
            links: JSON.stringify(result.links),
            prompt: result.prompt,
            workflow: "",
          };

          dbHelper.run(
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
