import path, { dirname, join, resolve } from "path";
import { serve, type BunFile } from "bun";
import ShortUniqueId from "short-unique-id";
import { Database as BunDatabase } from "bun:sqlite";
import OAuth from 'oauth-1.0a';

import config from './config';
import Files from "./files";
import constants from './constants.ts';

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

const { default: uai } = await import(`../workflows/create-mement-agent.tsx`);

import buildAssets from './assets';

const assets = await buildAssets({
  logo: {
    href: "/assets/logo.png",
    path: join(process.cwd(), "static/images", "logomark.png"),
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
  fontGeohumanistSans: {
    href: "/assets/Sen.ttf",
    path: join(process.cwd(), "static/fonts", "Sen.ttf"),
  },
  fontMono: {
    href: "/assets/JetBrainsMono.ttf",
    path: join(process.cwd(), "static/fonts", "JetBrainsMono.ttf"),
  },
})

const { randomUUID: randomUUIDForAgent } = new ShortUniqueId({ length: 4, dictionary: 'alphanum_lower' });
const { randomUUID: randomUUIDForChat } = new ShortUniqueId({ length: 10, dictionary: 'alphanum_lower' });
const { randomUUID: randomUUIDForRequest } = new ShortUniqueId({ length: 6, dictionary: 'alphanum_lower' });

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
        @font-face {
            font-family: "Sen";
            src: url(${assets.getLink('fontGeohumanistSans')}) format("truetype");
            font-display: swap;
        }
      </style>
      <link rel="stylesheet" href="${assets.getLink('style')}">
      <link rel="shortcut icon" href="${assets.getLink('favicon')}" type="image/x-icon">
      <script type="importmap">
        {
          "imports": {
            "react": "https://esm.sh/react@19.0.0/?dev",
            "react-dom/client": "https://esm.sh/react-dom@19.0.0/client/?dev",
            "sonner": "https://esm.sh/sonner@1.7.1/?dev"
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
    const requestId = randomUUIDForRequest();
    console.log(requestId, "Request received"); // todo: at the beginning of request should print out here current date/time in Indonesia/makasaar timezone in the format something like "1:36 AM of 24 dec. 2024."

    const url = new URL(req.url);
    const path = url.pathname;
    console.log(requestId, "path", path);

    if (assets.hasAssetByPath(path)) {
      console.log(requestId, "Serving asset", path);
      return new Response(assets.getAssetByPath(path));
    }

    const host = req.headers.get("host");
    console.log(requestId, "host", host);

    const subdomain = host ? host.split(".")[0] : "";
    console.log(requestId, "subdomain", subdomain);

    if (req.method === "POST" && path === "/createAgent") {
      try {
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.split(' ')[1];
        console.log(requestId, "token", token);

        if (token !== process.env.CREATE_AGENT_SECRET) {
          console.log(requestId, "Unauthorized access attempt");
          return new Response("Unauthorized", { status: 403 });
        }

        const { agent, links, twitterBot, telegramBot, domains } = await req.json();
        console.log(requestId, "Received data", { agent, links, twitterBot, telegramBot, domains });

        if (telegramBot) {
          console.log(requestId, "telegramBot", telegramBot);
          if (!telegramBot.group_id) {
            const telegramApiUrl = `https://api.telegram.org/bot${telegramBot.bot_token}/getUpdates`;
            const response = await fetch(telegramApiUrl);
            const updates = await response.json();
            console.log(requestId, "Telegram updates", updates);

            if (updates.result && updates.result.length > 0) {
              const firstUpdate = updates.result[0];
              telegramBot.group_id = firstUpdate.channel_post ? firstUpdate.channel_post.chat.id : firstUpdate.message.chat.id;
            }
          }
          if (!telegramBot.group_id) throw 'missing telegram bot group id and cannot be retrieved from updates';
        }

        let imageCid;
        if (/^[a-z0-9]{59,}$/.test(agent.image)) {
          imageCid = agent.image;
        } else if (/^.+\.(png|jpg|jpeg|gif)$/.test(agent.image)) {
          const file = await Bun.file(resolve(process.cwd(), agent.image)).bytes();
          console.log(requestId, "file size", file.length);
          imageCid = await files.upload(new File([file], "agent-image.png", { type: "image/png" }));
        } else {
          throw 'missing image field (should be file path or cid)';
        }
        console.log(requestId, "imageCid", imageCid);

        const transaction = db.transaction(() => {
          const subdomain = agent.subdomain ?? `${agent.name.toLowerCase().replace(/\s+/g, '-')}-${randomUUIDForAgent()}`;
          console.log(requestId, "subdomain", subdomain);

          const agentEntry: Agent = {
            subdomain: subdomain,
            name: agent.name,
            titles: agent.titles,
            suggestions: agent.suggestions,
            prompt: agent.prompt,
            workflow: agent.workflow,
            imageCid: imageCid
          };
          console.log(requestId, "agentEntry", agentEntry);

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

          if (domains instanceof Array) {
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
            console.log(requestId, "Domain entry", { domain, subdomain: agentEntry.subdomain, custom_script_path });
          });
        }

        if (links instanceof Array) {
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
            console.log(requestId, "Link entry", { subdomain: agentEntry.subdomain, type, value });
          });
        }

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
            console.log(requestId, "Twitter bot entry", { subdomain: agentEntry.subdomain, twitterBot });
          }

          if (telegramBot) {
            console.log(requestId, "telegramBot", telegramBot);
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
            console.log(requestId, "Telegram bot entry", { subdomain: agentEntry.subdomain, telegramBot });
          }

          return agentEntry;
        });

        const agentEntry = transaction();
        console.log(requestId, "Agent created", agentEntry);

        return new Response(JSON.stringify(agentEntry), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        console.log(requestId, "Error creating agent, transaction reverted", err);
        return new Response("Error creating agent", { status: 500 });
      }
    }

    if (req.method === "POST" && path === "/api/create-agent") {
      try {
        const { name, location, purpose, type } = await req.json();
        console.log(requestId, "Received create-agent data", { name, location, purpose });

        // Clean conversion and ensure trigger field is not empty
        const result = await uai.from({
          name,
          location,
          purpose,
        }).to({
          inputIsGood: 'Either TRUE or FALSE',          
          triggerSituation: 'Example: When Jesus Artificial Replica walks around the New Digital Jerusalem, he hears a question, what might his response be, much cryptic yet in the spirit of love?',
        }).exec(`
          You are to write a "trigger" paragraph given a persona name and context of location where the persona gets an inspiration for a new thought. 
          As shown in trigger example, its important to incorporate persona name, its location, and its purpose, but avoid to mention any exact specific question, because it will be provided separately in each case.
          In case of either location or purpose are not given as descriptive values then, your thinking should reflect the reasoning of rejection, and instead of trigger, FALSE value should be switched in "inputIsGood" field.  
        `);

        console.log(requestId, "Workflow result", result);

        if (!result?.inputIsGood.toLowerCase().includes('true')) {
          throw `INVALID LOCATION/PURPOSE. ${result?.thinking}`;
        }

        const trigger = result.triggerSituation.replaceAll('\n', '');

        // Handle image processing and upload
        let imageCid = "";
        const response = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.get('DALLE_API_KEY')}`,
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: trigger,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json"
          }),
        });

        const imageData = await response.json();
        if (imageData?.error) {
          console.log("imageData ==> ", imageData);
          throw `image generation error`;
        }

        const base64Image = imageData.data[0].b64_json;
        const file = new File([Buffer.from(base64Image, 'base64')], "agent-image.png", { type: "image/png" });
        imageCid = await files.upload(file);

        console.log(requestId, "Generated image CID", imageCid);

        // Prepare data for /createAgent
        const agentPayload = {
          agent: {
            name: name,
            image: imageCid,
            prompt: trigger,
          },
        };

        // Call /createAgent endpoint
        const createAgentResponse = await fetch(`http://localhost:${config.get('BUN_PORT')}/createAgent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.CREATE_AGENT_SECRET}`,
          },
          body: JSON.stringify(agentPayload),
        });

        const createAgentData = await createAgentResponse.json();
        console.log(requestId, "Agent created successfully", createAgentData);

        return new Response(JSON.stringify(createAgentData), {
          headers: { "Content-Type": "application/json" },
        });

      } catch (err) {
        console.log(requestId, "Error creating agent via API", err);
        return new Response(JSON.stringify({ error: `${err}` }), {
          headers: { "Content-Type": "application/json" },
          status: 500
        });
      }
    }

    const agentDataQuery = db.query<Agent, { $subdomain?: string }>("SELECT * FROM agents WHERE subdomain = $subdomain");

    const domainDataQuery = db.query<Domain, { $domain: string }>("SELECT subdomain, custom_script_path FROM domains WHERE domain = $domain");
    const domainData = domainDataQuery.get({ $domain: host! });
    console.log(requestId, "domainData", domainData);

    let agentData;
    let appName;

    if (domainData) {
      agentData = agentDataQuery.get({ $subdomain: domainData.subdomain });
      appName = domainData.custom_script_path;
    } else if (subdomain) {
      agentData = agentDataQuery.get({ $subdomain: subdomain });
    }

    console.log(requestId, "agentData", agentData);

    if (agentData) {
      appName = appName || 'askAgentApp';
      console.log(requestId, "appName", appName);

      if (req.method === "GET") {
        const linksQuery = db.query<Link, { $subdomain: string }>("SELECT * FROM links WHERE subdomain = $subdomain");
        const links = linksQuery.all({ $subdomain: agentData.subdomain });

        const serverData = {
          mintAddress: links.find(it => it.type == 'pumpfun')?.value,
          botName: agentData.name,
          alternativeBotTitles: agentData.titles?.split(',').map(it => it.trim()),
          botTag: `${agentData.subdomain}.${constants.BASE_URL}`,
          scrollItemsLeft: agentData.suggestions?.split(',').map(it => it.trim()),
          scrollItemsRight: agentData.suggestions?.split(',').reverse().map(it => it.trim()),
          socialMediaLinks: links?.reduce((prev, it) => { return { ...prev, [it.type]: it.value } }, {}),
          agentImage: await files.getUrl(agentData.imageCid, 3600),
        };

        if (path == "/") {
          console.log(requestId, "Serving main page");
          return new Response(htmlTemplate(assets.getLink(appName), JSON.stringify(serverData)), {
            headers: { "content-type": "text/html" },
          });
        } else if (path.startsWith("/chat")) {
          const chatId = path.split("/")[2];
          console.log(requestId, 'chatId', chatId);
          if (chatId) {
            const chatQuery = db.query<Chat, { $id: string }>("SELECT * FROM chats WHERE id = $id");
            const chatResponse = chatQuery.get({ $id: chatId });
            console.log(requestId, 'chatResponse', chatResponse);

            if (chatResponse) {
              const serverDataWithChat = {
                ...serverData,
                chatId: chatResponse.id,
                question: encodeURIComponent(chatResponse.question.replaceAll('%', 'percent')),
                content: encodeURIComponent(chatResponse.response.replaceAll('%', 'percent')),
                timestamp: chatResponse.timestamp,
                twitterPostLink: chatResponse.twitter_post_link,
              };

              console.log(requestId, "Serving chat page");
              return new Response(htmlTemplate(assets.getLink(appName), JSON.stringify(serverDataWithChat)), {
                headers: { "content-type": "text/html" }
              });
            }
          } else {
            console.log(requestId, "Chat not found");
            return new Response("Chat not found", { status: 404 });
          }
        }
      }


      if (req.method === "POST" && path === "/api/ask-agent") {
        try {
          const data = await req.json();
          console.log(requestId, "Received question", data.content);

          const { default: workflowFn } = await import(`../workflows/${agentData.workflow || "basic-structured-workflow"}.tsx`);

          const result = await workflowFn
          .from({
            question: data.content,
            situation: agentData.prompt,
          })
          .to({
            success: 'TRUE or FALSE indicating if question is appropriate and answerable',
            answer: 'twitter post, should not contain hash tags, nor double quotes or other special symbols'
          })
          .exec("Imagine described situation in which its character triggered by appearing question would write a twitter post in its consequence");          

          console.log(requestId, "Workflow result", result);

          if (!result?.success?.toLowerCase().includes('true')) {
            return new Response(JSON.stringify({ error: result.thinking }), {
              headers: { "Content-Type": "application/json" },
              status: 422
            });
          }

          result.answer = result.answer.replaceAll('\n', '').trim();

          if (result?.answer?.length > 280) {
              const shorterResult = await uai.from({
                longerPost: result.answer
              }).to({
                shorterPost: 'shorter version of original post to ensure it fits in a twitter post',
              }).exec(`
                make shorter version of long post
              `);

            if (shorterResult?.shorterPost?.length > 0) {
              result.answer = `${shorterResult?.shorterPost}`.replaceAll('\n', '').trim();
            }
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
            console.log(requestId, "Message sent to Telegram");
          }

          let twitterPostLink = null;
          try {
            const twitterBotQuery = db.query<TwitterBot, { $subdomain: string }>("SELECT oauth_token, oauth_token_secret, user_id FROM twitter_bots WHERE subdomain = $subdomain");
            const twitterBotData = twitterBotQuery.get({ $subdomain: agentData.subdomain });

            if (!twitterBotData) {
              throw `No Twitter account associated with ${agentData.subdomain}, falling back to web post`;
            }

            const twitterEndpointURL = 'https://api.twitter.com/2/tweets';
            const tweetData = { text: result.answer };

            const token = {
              key: twitterBotData.oauth_token,
              secret: twitterBotData.oauth_token_secret
            };

            const authHeader = twitterOauth.toHeader(twitterOauth.authorize({
              url: twitterEndpointURL,
              method: 'POST',
            }, token));
            console.log(requestId, "authHeader", authHeader);

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
            console.log(requestId, "twitterResponseData", twitterResponseData);

            if (!twitterResponseData.data) {
              throw `Failed to post on Twitter, fallback to web post`;
            }

            const tweetId = twitterResponseData.data.id;
            twitterPostLink = `https://twitter.com/${twitterBotData.screen_name}/status/${tweetId}`;
            console.log(requestId, "Tweet posted successfully", twitterPostLink);
          } catch (err) {
            console.log(requestId, "Error posting to Twitter, continuing with web post", err);
          }

          const responseData: Chat = {
            chatId: randomUUIDForChat(),
            question: data.content,
            content: result.answer,
            timestamp: new Date().toISOString(),
            subdomain: subdomain,
            twitterPostLink
          };

          const chatInsertQuery = db.query(
            "INSERT INTO chats (id, question, response, subdomain, timestamp, twitter_post_link) VALUES (?, ?, ?, ?, ?, ?)"
          );
          chatInsertQuery.run(responseData.chatId, responseData.question, responseData.content, responseData.subdomain, responseData.timestamp, responseData.twitterPostLink);

          console.log(requestId, "Response stored in database", responseData);
          return new Response(JSON.stringify(responseData), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.log(requestId, "Error generating response", err);
          return new Response(JSON.stringify({ error: `${err}` }), {
            headers: { "Content-Type": "application/json" },
            status: 500
          });
        }
      }
    }

    if (path === "/" || path === "/create" || path === "/success") {
      return new Response(htmlTemplate(assets.getLink('createAgentApp'), JSON.stringify({})), {
        headers: { "content-type": "text/html" }
      });
    }

    console.log(requestId, "Not Found");
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🌐 Server is running on http://localhost:${server.port} 🚀`);