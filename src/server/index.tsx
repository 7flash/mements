import path, { dirname, join, resolve } from "path";
import { serve, type BunFile } from "bun";
import ShortUniqueId from "short-unique-id";
import { Database as BunDatabase } from "bun:sqlite";
import OAuth from 'oauth-1.0a';

import config from './config';
import Files from "./files";

const files: IFiles = Files.init();

const dbPath = path.join(process.cwd(), 'static/database', `${config.get('DB_NAME')}.sqlite`).trim();
console.log("dbPath ==> ", dbPath);
try {
  await Bun.$`ls ${dbPath}`;
} catch (err) {
  const rawCmd = `bun run ${path.join(import.meta.dir, "../cli/initializeDatabase.ts")} --path=${dbPath}`;
  console.log("rawCmd ==> ", rawCmd);
  await Bun.$`${{ raw: rawCmd }}`
}

const db = new BunDatabase(dbPath);

const twitterOauth = new OAuth({
  consumer: {
    key: process.env.TWITTER_API_KEY!,
    secret: process.env.TWITTER_API_SECRET!,
  },
  signature_method: 'HMAC-SHA1',
  hash_function: (baseString, key) => {
    const hasher = new Bun.CryptoHasher('sha1', key);
    hasher.update(baseString);
    return hasher.digest('base64');
  },
});

const { default: prompt } = await import("uai/src/uai.ts");
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
    source: join(import.meta.dir, "../apps/App.css"),
  },
  createAgentApp: {
    href: "/assets/create-agent.js",
    source: join(import.meta.dir, "../apps/create-agent/index.tsx"),
  },
  askAgentApp: {
    href: "/assets/ask-agent.js",
    source: join(import.meta.dir, "../apps/ask-agent/index.tsx"),
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

const { randomUUID: randomUUIDForAgent } = new ShortUniqueId({ length: 4, dictionary: 'alphanum_lower' });
const { randomUUID: randomUUIDForChat } = new ShortUniqueId({ length: 10, dictionary: 'alphanum_lower' });

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

const server = serve({
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (assets.hasAssetByPath(path)) {
      return new Response(assets.getAssetByPath(path));
    }

    const host = req.headers.get("host");
    console.log("host ==> ", host);

    const subdomain = host ? host.split(".")[0] : "";
    console.log("subdomain ==> ", subdomain);

    if (req.method === "POST" && path === "/createAgent") {
      try {
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.split(' ')[1];
        console.log("token ==> ", token);

        if (token !== process.env.CREATE_AGENT_SECRET) {
          console.log("process.env.CREATE_AGENT_SECRET ==> ", process.env.CREATE_AGENT_SECRET);
          return new Response("Unauthorized", { status: 403 });
        }

        const { agent, links, twitterBot, telegramBot, domains } = await req.json();
        console.log("agent, links, twitterBot, telegramBot, domains ==> ", agent, links, twitterBot, telegramBot, domains);

        if (telegramBot) {
          console.log("telegramBot ==> ", telegramBot);
          if (!telegramBot.group_id) {
            const telegramApiUrl = `https://api.telegram.org/bot${telegramBot.bot_token}/getUpdates`;
            const response = await fetch(telegramApiUrl);
            const updates = await response.json();
            console.log("updates ==> ", updates);

            if (updates.result && updates.result.length > 0) {
              const firstUpdate = updates.result[0];
              telegramBot.group_id = firstUpdate.channel_post ? firstUpdate.channel_post.chat.id : firstUpdate.message.chat.id;
            }
          }
        }

        if (!telegramBot.group_id) throw 'missing telegram bot group id and cannot be retrieved from updates';

        let imageCid;
        if (/^[a-z0-9]{59,}$/.test(agent.image)) {
          imageCid = agent.image;
        } else if (/^.+\.(png|jpg|jpeg|gif)$/.test(agent.image)) {
          const file = await Bun.file(resolve(process.cwd(), agent.image)).bytes();
          console.log("file ==> ", file.length);
          imageCid = await files.upload(new File([file], "agent-image.png", { type: "image/png" }));
        } else {
          throw 'missing image field (should be file path or cid)';
        }
        console.log("imageCid ==> ", imageCid);

        const transaction = db.transaction(() => {
          const subdomain = agent.subdomain ?? `${agent.name.toLowerCase().replace(/\s+/g, '-')}-${randomUUIDForAgent()}`;
          console.log("subdomain ==> ", subdomain);

          const agentEntry: Agent = {
            subdomain: subdomain,
            name: agent.name,
            titles: agent.titles,
            suggestions: agent.suggestions,
            prompt: agent.prompt,
            workflow: agent.workflow,
            imageCid: imageCid
          };
          console.log("agentEntry ==> ", agentEntry);

          // Check if agent with this subdomain already exists
          const existingAgent = db.query("SELECT * FROM agents WHERE subdomain = ?").get(agentEntry.subdomain);
          if (existingAgent) {
            db.run(
              "UPDATE agents SET name = ?, titles = ?, suggestions = ?, prompt = ?, workflow = ?, imageCid = ? WHERE subdomain = ?",
              agentEntry.name, agentEntry.titles, agentEntry.suggestions, agentEntry.prompt, agentEntry.workflow, agentEntry.imageCid, agentEntry.subdomain
            );
          } else {
            db.run(
              "INSERT INTO agents (subdomain, name, titles, suggestions, prompt, workflow, imageCid) VALUES (?, ?, ?, ?, ?, ?, ?)",
              agentEntry.subdomain.toLowerCase(), agentEntry.name, agentEntry.titles, agentEntry.suggestions, agentEntry.prompt, agentEntry.workflow, agentEntry.imageCid
            );
          }

          domains.forEach(({ domain, custom_script_path }: Domain) => {
            const existingDomain = db.query("SELECT * FROM domains WHERE domain = ?").get(domain);
            if (existingDomain) {
              db.run(
                "UPDATE domains SET subdomain = ?, custom_script_path = ? WHERE domain = ?",
                agentEntry.subdomain, custom_script_path, domain
              );
            } else {
              db.run(
                "INSERT INTO domains (domain, subdomain, custom_script_path) VALUES (?, ?, ?)",
                domain, agentEntry.subdomain, custom_script_path
              );
            }
            console.log("domain, agentEntry.subdomain, custom_script_path ==> ", domain, agentEntry.subdomain, custom_script_path);
          });

          links.forEach(({ type, value }: Link) => {
            const existingLink = db.query("SELECT * FROM links WHERE subdomain = ? AND type = ?").get(agentEntry.subdomain, type);
            if (existingLink) {
              db.run(
                "UPDATE links SET value = ? WHERE subdomain = ? AND type = ?",
                value, agentEntry.subdomain, type
              );
            } else {
              db.run(
                "INSERT INTO links (subdomain, type, value) VALUES (?, ?, ?)",
                agentEntry.subdomain, type, value
              );
            }
            console.log("agentEntry.subdomain, type, value ==> ", agentEntry.subdomain, type, value);
          });

          if (twitterBot) {
            const existingTwitterBot = db.query("SELECT * FROM twitter_bots WHERE subdomain = ?").get(agentEntry.subdomain);
            if (existingTwitterBot) {
              db.run(
                "UPDATE twitter_bots SET oauth_token = ?, oauth_token_secret = ?, user_id = ?, screen_name = ? WHERE subdomain = ?",
                twitterBot.oauth_token, twitterBot.oauth_token_secret, twitterBot.user_id, twitterBot.screen_name, agentEntry.subdomain
              );
            } else {
              db.run(
                "INSERT INTO twitter_bots (subdomain, oauth_token, oauth_token_secret, user_id, screen_name) VALUES (?, ?, ?, ?, ?)",
                agentEntry.subdomain, twitterBot.oauth_token, twitterBot.oauth_token_secret, twitterBot.user_id, twitterBot.screen_name
              );
            }
            console.log("agentEntry.subdomain, twitterBot.oauth_token, twitterBot.oauth_token_secret, twitterBot.user_id, twitterBot.screen_name ==> ", agentEntry.subdomain, twitterBot.oauth_token, twitterBot.oauth_token_secret, twitterBot.user_id, twitterBot.screen_name);
          }

          if (telegramBot) {
            console.log("telegramBot ==> ", telegramBot);
            const existingTelegramBot = db.query("SELECT * FROM telegram_bots WHERE subdomain = ?").get(agentEntry.subdomain);
            if (existingTelegramBot) {
              db.run(
                "UPDATE telegram_bots SET bot_token = ?, group_id = ? WHERE subdomain = ?",
                telegramBot.bot_token, telegramBot.group_id, agentEntry.subdomain
              );
            } else {
              db.run(
                "INSERT INTO telegram_bots (subdomain, bot_token, group_id) VALUES (?, ?, ?)",
                agentEntry.subdomain, telegramBot.bot_token, telegramBot.group_id
              );
            }
            console.log("agentEntry.subdomain, telegramBot.bot_token, telegramBot.group_id ==> ", agentEntry.subdomain, telegramBot.bot_token, telegramBot.group_id);
          }

          return agentEntry;
        });

        const agentEntry = transaction();

        return new Response(JSON.stringify(agentEntry), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Error creating agent, transaction reverted", err);
        return new Response("Error creating agent", { status: 500 });
      }
    }

    const agentDataQuery = db.query<Agent, { $subdomain?: string }>("SELECT * FROM agents WHERE subdomain = $subdomain");

    const domainDataQuery = db.query<Domain, { $domain: string }>("SELECT subdomain, custom_script_path FROM domains WHERE domain = $domain");
    const domainData = domainDataQuery.get({ $domain: host! });
    console.log("domainData ==> ", domainData);

    let agentData;
    let appName;

    if (domainData) {
      agentData = agentDataQuery.get({ $subdomain: domainData.subdomain });
      appName = domainData.custom_script_path;
    } else if (subdomain) {
          agentData = agentDataQuery.get({ $subdomain: subdomain });
    }

    console.log("agentData ==> ", agentData);

    if (agentData) {
      appName = appName || 'askAgentApp';
      console.log("appName ==> ", appName);

      if (req.method === "GET") {
        const linksQuery = db.query<Link, { $subdomain: string }>("SELECT * FROM links WHERE subdomain = $subdomain");
        const links = linksQuery.all({ $subdomain: agentData.subdomain });

        const serverData = {
          mintAddress: links.find(it => it.type == 'pumpfun')?.value,
          botName: agentData.name,
          alternativeBotTitles: agentData.titles.split(',').map(it => it.trim()),
          botTag: `@${agentData.name.replace(/\s+/g, '')}`,
          scrollItemsLeft: agentData.suggestions.split(',').map(it => it.trim()),
          scrollItemsRight: agentData.suggestions.split(',').reverse().map(it => it.trim()),
          socialMediaLinks: links.reduce((prev, it) => { return { ...prev, [it.type]: it.value } }, {}),
          agentImage: await files.getUrl(agentData.imageCid, 3600),
        };

        if (path == "/") {
          return new Response(htmlTemplate(assets.getLink(appName), JSON.stringify(serverData)), {
            headers: { "content-type": "text/html" },
          });
        } else if (path.startsWith("/chat")) {
          const chatId = path.split("/")[2];
          console.log('chatId', chatId)
          if (chatId) {
            const chatQuery = db.query<Chat, { $id: string }>("SELECT * FROM chats WHERE id = $id");
            const chatResponse = chatQuery.get({ $id: chatId });
            console.log('chatResponse', chatResponse)

            if (chatResponse) {
              const serverDataWithChat = {
                ...serverData,
                chatId: chatResponse.id,
                question: encodeURIComponent(chatResponse.question.replaceAll('%', 'percent')),
                content: encodeURIComponent(chatResponse.response.replaceAll('%', 'percent')),
                timestamp: chatResponse.timestamp,
              };

              return new Response(htmlTemplate(assets.getLink(appName), JSON.stringify(serverDataWithChat)), {
                headers: { "content-type": "text/html" }
              });
            }
          } else {
            return new Response("Chat not found", { status: 404 });
          }
        }
      }

      if (req.method === "POST" && path === "/api/ask-agent") {
        try {
          const data = await req.json();

          const { default: workflowFn } = await import(`uai/workflows/${agentData.workflow || "answer-as-mement"}.tsx`);

          const result = await workflowFn().withTask(
            agentData.prompt || "What is appropriate answer to the following question in a twitter post format?"
          ).withQuestion(data.content).respond({
            success: 'Can be TRUE or FALSE. Signifies whether provided question is appropriate to the task and confident answer can be derived.',
            answer: 'Text of the final complete answer to the question in task context.',
          });

          if (result?.success?.toLowerCase() !== 'true') {
            throw new Error('not appropriate question: ' + JSON.stringify(result));
          }

          const telegramBotQuery = db.query<TelegramBot, { $subdomain: string }>("SELECT bot_token, group_id FROM telegram_bots WHERE subdomain = $subdomain");
          const telegramBotData = telegramBotQuery.get({ $subdomain: agentData.subdomain });

          if (telegramBotData && telegramBotData.group_id) {
            const telegramApiUrl = `https://api.telegram.org/bot${telegramBotData.bot_token}/sendMessage`;
            const messageBody = {
              chat_id: telegramBotData.group_id,
              text: `${result.answer}`
            };

            fetch(telegramApiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(messageBody)
            }).catch(console.error);
          }

          try {
            const twitterBotQuery = db.query<TwitterBot, { $subdomain: string }>("SELECT oauth_token, oauth_token_secret, user_id FROM twitter_bots WHERE subdomain = $subdomain");
            const twitterBotData = twitterBotQuery.get({ $subdomain: agentData.subdomain });

            if (!twitterBotData) {
              throw `${agentData.subdomain} does not have twitter account, fallback to web post`
            }

            const twitterEndpointURL = 'https://api.twitter.com/2/tweets';
            const tweetData = {
              text: result.answer,
            };

            const token = {
              key: twitterBotData.oauth_token,
              secret: twitterBotData.oauth_token_secret
            };

            const authHeader = twitterOauth.toHeader(twitterOauth.authorize({
              url: twitterEndpointURL,
              method: 'POST',
            }, token));
            console.log("authHeader ==> ", authHeader);

            const twitterResponse = await fetch(twitterEndpointURL, {
              method: 'POST',
              headers: {
                Authorization: authHeader["Authorization"],
                'user-agent': "v2CreateTweetJS",
                'Content-Type': "application/json",
                'Accept': "application/json"
              },
              body: JSON.stringify(tweetData)
            });

            const twitterResponseData = await twitterResponse.json();
            console.log("twitterResponseData ==> ", twitterResponseData);

            if (!twitterResponseData.data) {
              throw `failed to make twitter post, fallback to web post`;
            }

            const tweetId = twitterResponseData.data.id;
            const twitterPostLink = `https://twitter.com/${twitterBotData.screen_name}/status/${tweetId}`;

            return new Response(JSON.stringify({ twitterPostLink }), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (err) {
            console.error(err);

            const responseData: Chat = {
              chatId: randomUUIDForChat(),
              question: data.content,
              content: result.answer,
              timestamp: new Date().toISOString(),
              subdomain: subdomain,
            };

            const chatInsertQuery = db.query(
              "INSERT INTO chats (id, question, response, subdomain, timestamp) VALUES (?, ?, ?, ?, ?)"
            );
            chatInsertQuery.run(responseData.chatId, responseData.question, responseData.content, responseData.subdomain, responseData.timestamp);

            return new Response(JSON.stringify(responseData), {
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch (err) {
          console.error("Error generating response:", err);
          return new Response("Error generating response", { status: 500 });
        }
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🌐 Server is running on http://localhost:${server.port} 🚀`);
