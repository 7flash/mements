import path from 'path';
import { Database } from "bun:sqlite";
import Query from "uai/src/query";
import { PinataSDK } from 'pinata';

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY_URL,
});

const agentsDbPath = path.join(process.cwd(), 'static/database', `${process.env.DATABASE_AGENTS}.sqlite`);
const agentsDb = new Database(path.join(agentsDbPath).trim(), { readonly: true });
console.log("agentsDb ==> ", agentsDb.filename);

const usersDb = new Database(
  path.join(process.cwd(), 'static/database', `${process.env.DATABASE_USERS}.sqlite`).trim()
);
console.log("usersDb ==> ", usersDb.filename);

usersDb.exec(`
  CREATE TABLE IF NOT EXISTS approved_users (
    telegram_user_id TEXT PRIMARY KEY,
    is_approved INTEGER DEFAULT 0,
    last_verification_attempt TEXT,
    verification_count INTEGER DEFAULT 0,
    verification_agent TEXT,
    original_message_id INTEGER,
    original_message TEXT,
    verification_question TEXT,
    expected_answer TEXT
  );
`);

type ApprovedUser = {
  telegram_user_id: string;
  is_approved: boolean;
  last_verification_attempt: string;
  verification_count: number;
  verification_agent: string;
  original_message_id?: number;
  original_message?: string;
  verification_question?: string;
  expected_answer?: string;
};

type TelegramUpdate = {
  message: {
    message_id: number;
    from: {
      id: string;
      username?: string;
      first_name?: string;
    };
    text: string;
    chat: {
      id: string;
    };
  };
  new_chat_member?: {
    id: string;
    username: string;
  };
  invite_link?: {
    name: string;
  };
};

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
console.log("GROUP_ID ==> ", GROUP_ID);
const POLL_INTERVAL = 60000;
let lastUpdateId = 0;

const escapeMarkdown = (text: string) => {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
};

async function measureTime<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`${label} took ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    console.error(`${label} failed after ${(performance.now() - start).toFixed(2)}ms:`, error);
    throw error;
  }
}

async function tg(method: string, body: any) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`Telegram API error (${method}):`, data);
      throw new Error(`${method} failed: ${response.status} - ${data.description || 'Unknown error'}`);
    }

    return data;
  } catch (error) {
    console.error(`Failed to execute ${method}:`, error);
    throw error;
  }
}

async function checkMessageExists(chatId: string, messageId: number): Promise<boolean> {
  try {
    const result = await tg('forwardMessage', {
      chat_id: chatId,
      from_chat_id: chatId,
      message_id: messageId
    });
    return !!result;
  } catch {
    return false;
  }
}

async function checkUserStatus(chatId: string, userId: string): Promise<boolean> {
  try {
    const result = await tg('getChatMember', {
      chat_id: chatId,
      user_id: userId
    });
    console.log("result ==> ", result);
    return ['creator', 'administrator', 'member'].includes(result.result.status);
  } catch {
    return false;
  }
}

function getUserReference(userId: string, username?: string, firstName?: string): string {
  if (username) {
    return `@${username}`;
  }
  return `[${escapeMarkdown(firstName || 'User')}](tg://user?id=${userId})`;
}

function logAction(userId: string, action: string, details?: any) {
  console.log(`${userId}:${action} ==> `, details || '');
}

console.log('Starting Welcome Bot...');
while (true) {
  try {
    await measureTime(async () => {
      const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`
      );
      const data = await response.json();
      const updates: TelegramUpdate[] = data.ok && data.result.length > 0 ? data.result : [];

      if (updates.length > 0) {
        lastUpdateId = data.result[data.result.length - 1].update_id;
      }

      for (const update of updates) {
        await measureTime(async () => {
          console.log("Processing update:", {
            messageId: update?.message?.message_id,
            chatId: update?.message?.chat?.id,
            userId: update?.message?.from?.id,
            username: update?.message?.from?.username,
            firstName: update?.message?.from?.first_name,
            isNewMember: !!update?.new_chat_member,
            hasText: !!update?.message?.text
          });

          if (!update?.message?.chat?.id || `${update.message.chat.id}` !== GROUP_ID) {
            console.log("Skipping: Invalid chat ID or not matching GROUP_ID");
            return;
          }
          
          if (update?.message?.from?.is_bot) {
            console.log("Skipping: Message from bot");
            return;
          }
          
          if (!update?.message?.text && !update?.message?.new_chat_member) {
            console.log("Skipping: No text message or new member");
            return;
          }

          const userIsValid = await checkUserStatus(GROUP_ID, update.message.from.id);
          if (!userIsValid) {
            console.log("Skipping: User is not valid group member");
            return;
          }

          const userId = update.message.from.id;
          const username = update.message.from.username;
          const firstName = update.message.from.first_name;
          const userReference = getUserReference(userId, username, firstName);

          await measureTime(async () => {
            const user = usersDb.prepare(`
              SELECT * FROM approved_users WHERE telegram_user_id = ?
            `).get(userId) as ApprovedUser | undefined;
            console.log(`👤 Processing update for user ${userId} (@${username})`);

            if (user?.is_approved) {
              console.log(`✅ User ${userId} (@${username}) is already approved`);
              return;
            }

            if (user?.verification_count > 0) {
              console.log(`⏳ Skip user ${userId} (@${username}): pending verification`);
              return;
            }

            const agents = await measureTime(async () => {
              let selectedAgents = [];
              const inviteLinkName = update?.new_chat_member && update?.invite_link?.name;

              if (inviteLinkName) {
                const mainAgent = agentsDb.prepare(`
                  SELECT a.*, i.imageCid 
                  FROM agents a
                  LEFT JOIN images i ON i.subdomain = a.subdomain AND i.image_key = 'default'
                  WHERE a.subdomain = ?
                  LIMIT 1
                `).get(inviteLinkName);

                if (mainAgent) {
                  const supportAgent = agentsDb.prepare(`
                    SELECT a.*, i.imageCid 
                    FROM agents a
                    LEFT JOIN images i ON i.subdomain = a.subdomain AND i.image_key = 'default'
                    WHERE a.subdomain != ?
                    ORDER BY RANDOM()
                    LIMIT 1
                  `).get(inviteLinkName);

                  selectedAgents = [mainAgent, supportAgent];
                }
              }

              if (selectedAgents.length < 2) {
                selectedAgents = agentsDb.prepare(`
                  SELECT a.*, i.imageCid 
                  FROM agents a
                  LEFT JOIN images i ON i.subdomain = a.subdomain AND i.image_key = 'default'
                  ORDER BY RANDOM() 
                  LIMIT 2
                `).all();
              }

              return selectedAgents;
            }, `Select agents for user ${userId}`);

            if (agents.length < 2) {
              throw new Error('Unable to start verification process - insufficient agents');
            }

            const [mainAgent, supportAgent] = agents;

            const [mainImageUrl, supportImageUrl] = await measureTime(async () => {
              return Promise.all([
                pinata.gateways.createSignedURL({
                  cid: mainAgent.imageCid,
                  expires: 3600
                }).optimizeImage({
                  width: 512,
                  height: 512,
                  format: 'webp',
                }),
                pinata.gateways.createSignedURL({
                  cid: supportAgent.imageCid,
                  expires: 3600
                }).optimizeImage({
                  width: 512,
                  height: 512,
                  format: 'webp',
                })
              ]);
            }, `Generate image URLs for user ${userId}`);

            const verificationData = await measureTime(async () => {
              return Query.from({
                mainAgentName: mainAgent.name,
                supportAgentName: supportAgent.name,
                username: username,
                agentCommunity: mainAgent.prompt,
                mainAgentPersonality: mainAgent.personality || 'friendly and welcoming',
                supportAgentPersonality: supportAgent.personality || 'supportive and curious'
              }, 'gpt-4o-mini').infer({
                mainAgentReplica: `Speaking as ${mainAgent.name} with ${mainAgent.personality || 'friendly'} personality, create a greeting asking ${supportAgent.name} to help welcome @${username}. Include specific personality traits and mannerisms.`,
                supportAgentReplica: `Speaking as ${supportAgent.name} with ${supportAgent.personality || 'supportive'} personality, create a response to ${mainAgent.name} and address @${username} with a verification question. Show distinct personality.`,
                verificationQuestion: `Create a question (max 15 words) that reflects ${mainAgent.name}'s values and community principles`,
                expectedAnswer: `Create an example answer that shows understanding of ${mainAgent.name}'s community values`
              });
            }, `Generate verification data for user ${userId}`);

            logAction(userId, 'verificationData', verificationData);

            await measureTime(async () => {
              const welcomeMessage = `
              👤 *${escapeMarkdown(mainAgent.name)}* \\(on the left\\) says:
              ${verificationData.mainAgentReplica.replaceAll('@' + username, userReference)}
              👥 *${escapeMarkdown(supportAgent.name)}* \\(on the right\\) says:
              ${verificationData.supportAgentReplica.replaceAll('@' + username, userReference)}
                          `.trim();
              
              await tg('sendMediaGroup', {
                chat_id: GROUP_ID,
                media: [
                  {
                    type: 'photo',
                    media: mainImageUrl,
                  },
                  {
                    type: 'photo',
                    media: supportImageUrl,
                    caption: welcomeMessage,
                    parse_mode: 'MarkdownV2'
                  }
                ]
              });
            }, `Send welcome message for user ${userId}`);

            await measureTime(async () => {
              const stmt = user ?
                usersDb.prepare(`
                UPDATE approved_users 
                SET last_verification_attempt = ?, verification_count = verification_count + 1,
                    verification_agent = ?, original_message_id = ?, original_message = ?,
                    verification_question = ?, expected_answer = ?
                WHERE telegram_user_id = ?
              `) :
                usersDb.prepare(`
                INSERT INTO approved_users (
                  telegram_user_id, is_approved, last_verification_attempt, verification_count,
                  verification_agent, original_message_id, original_message, verification_question,
                  expected_answer
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);

              const params = user ?
                [new Date().toISOString(), mainAgent.name, update.message.message_id,
                update.message.text, verificationData.verificationQuestion,
                verificationData.expectedAnswer, userId] :
                [userId, false, new Date().toISOString(), 1, mainAgent.name,
                  update.message.message_id, update.message.text,
                  verificationData.verificationQuestion, verificationData.expectedAnswer];

              stmt.run(...params);
            }, `Update database for user ${userId}`);

          }, `Process verification for user ${userId}`);
        }, `Process update ${update?.message?.message_id}`);
      }
    }, 'Welcome processing cycle');
  } catch (error) {
    console.error('Welcome Bot error:', error);
  }

  await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
}