import path from 'path';
import { Database } from "bun:sqlite";
import Query from "uai/src/query";
import { PinataSDK } from 'pinata';

// Initialize Pinata SDK for handling images
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY_URL,
});

// Database paths and initialization
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

// Type definitions
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
      username: string;
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

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const POLL_INTERVAL = 1000;
const COOLDOWN_MINUTES = 15;
let lastUpdateId = 0;

// Utility functions
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

async function updateUserPermissions(userId: string, canMessage: boolean, duration?: number) {
  const permissions = {
    can_send_messages: canMessage,
    can_send_media_messages: canMessage,
    can_send_other_messages: canMessage,
    can_send_polls: canMessage,
    can_send_web_page_previews: canMessage,
    can_add_web_page_previews: canMessage
  };

  return tg('restrictChatMember', {
    chat_id: GROUP_ID,
    user_id: userId,
    permissions,
    until_date: duration ? Math.floor(Date.now() / 1000) + (duration * 60) : undefined
  });
}

async function sendTelegramMessage(text: string, options: any = {}) {
  return tg('sendMessage', {
    chat_id: GROUP_ID,
    text: text,
    parse_mode: 'MarkdownV2',
    ...options
  });
}

const VALIDATION_TIMEOUT = 60;
const BASE_COOLDOWN = 15;

function calculateCooldown(attempts: number): number {
  return Math.min(BASE_COOLDOWN * Math.pow(2, attempts - 1), 24 * 60);
}

async function scheduleMessageDeletion(messageId: number, userId: string, delay: number) {
  await new Promise(resolve => setTimeout(resolve, delay * 1000));
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: GROUP_ID,
        message_id: messageId
      })
    });
    logAction(userId, 'MessageDeleted', { messageId });
  } catch (error) {
    logAction(userId, 'MessageDeletionFailed', { messageId, error });
  }
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
        console.log("update ==> ", update);
        if (update?.message?.from?.is_bot) continue;
        if (!update?.message?.text && !update?.message?.new_chat_member) continue;

        const userId = update.message.from.id;
        const username = update.message.from.username;

        const user = usersDb.prepare(`
            SELECT * FROM approved_users WHERE telegram_user_id = ?
          `).get(userId) as ApprovedUser | undefined;
        console.log(`👤 Processing update for user ${userId} (@${username})`);

        if (user?.is_approved) {
          console.log(`✅  ${username} is already approved`);
          continue;
        }

        if (user?.verification_count > 0) {
          console.log(`skip ${username} not approved but we have a pending verification`);
          continue;

          // todo: should actually delete message from user if pending verification
        }

        let agents = [];
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

            agents = [mainAgent, supportAgent];
          }
        }

        if (agents.length < 2) {
          agents = agentsDb.prepare(`
              SELECT a.*, i.imageCid 
              FROM agents a
              LEFT JOIN images i ON i.subdomain = a.subdomain AND i.image_key = 'default'
              ORDER BY RANDOM() 
              LIMIT 2
            `).all();
        }

        if (agents.length < 2) {
          throw new Error('Unable to start verification process - insufficient agents');
        }

        const [mainAgent, supportAgent] = agents;

        const [mainImageUrl, supportImageUrl] = await Promise.all([
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

        const verificationData = await Query.from({
          mainAgentName: mainAgent.name,
          supportAgentName: supportAgent.name,
          username: username,
          agentCommunity: mainAgent.prompt,
          mainAgentPersonality: mainAgent.personality || 'friendly and welcoming',
          supportAgentPersonality: supportAgent.personality || 'supportive and curious'
        }, 'gpt-4o-mini').infer({
          mainAgentReplica: `Create a casual greeting where ${mainAgent.name} asks ${supportAgent.name} to help welcome @${username}`,
          supportAgentReplica: `Create a friendly response where ${supportAgent.name} addresses @${username} with a verification question`,
          verificationQuestion: `Create a casual but meaningful question that tests community values (max 15 words)`,
          expectedAnswer: 'Brief example of a good answer showing community understanding'
        });

        logAction(userId, 'verificationData', verificationData);

        const welcomeMessage = `
👤 *${escapeMarkdown(mainAgent.name)}* \\(on the left\\) says:
${escapeMarkdown(verificationData.mainAgentReplica)}
👥 *${escapeMarkdown(supportAgent.name)}* \\(on the right\\)says:
${escapeMarkdown(verificationData.supportAgentReplica)}
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
          update.message.text, verificationData.finalQuestion,
          verificationData.expectedAnswer, userId] :
          [userId, false, new Date().toISOString(), 1, mainAgent.name,
            update.message.message_id, update.message.text,
            verificationData.finalQuestion, verificationData.expectedAnswer];

        stmt.run(...params);
      }
    }, 'Welcome processing');
  } catch (error) {
    console.error('Welcome Bot error:', error);
  }

  await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
}