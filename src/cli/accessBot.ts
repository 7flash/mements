import path from 'path';
import { Database } from "bun:sqlite";
import Query from "uai/src/query";
import { PinataSDK } from 'pinata';

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY_URL,
});

const WELCOME_BOT_USERNAME = process.env.WELCOME_BOT_USERNAME;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const POLL_INTERVAL = 60000;
const VALIDATION_TIMEOUT = 60;
const BASE_COOLDOWN = 15;

let lastUpdateId = 0;

// Database setup
const agentsDbPath = path.join(process.cwd(), 'static/database', `${process.env.DATABASE_AGENTS}.sqlite`);
const agentsDb = new Database(path.join(agentsDbPath).trim(), { readonly: true });
console.log("agentsDb ==> ", agentsDb.filename);

const usersDb = new Database(
  path.join(process.cwd(), 'static/database', `${process.env.DATABASE_USERS}.sqlite`).trim()
);
console.log("usersDb ==> ", usersDb.filename);

// Create tables
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
    expected_answer TEXT,
    is_muted INTEGER DEFAULT 0
  );
`);

// Types
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
  is_muted: boolean;
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
    reply_to_message?: {
      message_id: number;
      from: {
        username?: string;
      };
    };
  };
};

// Helper functions
const escapeMarkdown = (text: string) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');

function calculateCooldown(attempts: number): number {
  return Math.min(BASE_COOLDOWN * Math.pow(2, attempts - 1), 24 * 60);
}

async function tg(method: string, body: any) {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${method} failed: ${data.description || 'Unknown error'}`);
  return data;
}

async function updateUserPermissions(userId: string, canMessage: boolean, duration?: number) {
  const permissions = {
    can_send_messages: canMessage,
    can_send_media_messages: canMessage,
    can_send_other_messages: canMessage,
    can_send_polls: canMessage,
    can_send_web_page_previews: canMessage,
  };

  await tg('restrictChatMember', {
    chat_id: GROUP_ID,
    user_id: userId,
    permissions,
    until_date: duration ? Math.floor(Date.now() / 1000) + (duration * 60) : undefined
  });

  if (!canMessage) {
    usersDb.prepare(`
      UPDATE approved_users 
      SET is_muted = 1 
      WHERE telegram_user_id = ?
    `).run(userId);
  }
}

console.log('Starting Telegram moderator bot...');
while (true) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`
    );
    const data = await response.json();
    if (!data.ok) continue;

    const updates: TelegramUpdate[] = data.result || [];
    if (updates.length > 0) lastUpdateId = updates[updates.length - 1].update_id;

    for (const update of updates) {
      if (!update?.message?.from) continue;

      const isModeratorMessage = update.message.from.username === WELCOME_BOT_USERNAME;
      const userId = update.message.from.id;
      const username = update.message.from.username;
      const messageId = update.message.message_id;

      if (isModeratorMessage) {
        // Fetch existing user data instead of inserting
        const user = usersDb.prepare(`
          SELECT * FROM approved_users WHERE telegram_user_id = ?
        `).get(userId) as ApprovedUser;

        if (!user) continue;

        const rulesMessage = `
Hey @${escapeMarkdown(username)}\\! 🎯

The moderator just asked you a question\\. Here's what you need to know:

\\- ⏰ You have *${VALIDATION_TIMEOUT} seconds* to respond
\\- 🎯 This is your one shot \\- make it count\\!
\\- ⚠️ Failed attempt = timeout \\(${BASE_COOLDOWN}m \\-> ${BASE_COOLDOWN*2}m \\-> ${BASE_COOLDOWN*4}m\\)
\\- 🤝 Be authentic and thoughtful

Your time starts now\\! Send your answer in the chat\\.
        `.trim();

        await tg('sendMessage', {
          chat_id: GROUP_ID,
          text: rulesMessage,
          reply_to_message_id: messageId,
          parse_mode: 'MarkdownV2'
        });

        await updateUserPermissions(userId, true, VALIDATION_TIMEOUT);

      } else {
        // Check if user is in verification process
        const user = usersDb.prepare(`
          SELECT * FROM approved_users 
          WHERE telegram_user_id = ? 
          AND is_approved = 0 
          AND is_muted = 0
          AND last_verification_attempt > datetime('now', '-${VALIDATION_TIMEOUT} seconds')
        `).get(userId) as ApprovedUser;

        if (!user) continue;

        const validation = await Query.from({
          question: user.verification_question,
          answer: update.message.text,
        }, 'gpt-4o-mini').infer({
          score: 'Rate from 1-10 how well this answer addresses the question'
        });

        const score = parseInt(validation.score);
        const passed = score >= 3;

        if (user.original_message_id) {
          await tg('deleteMessage', {
            chat_id: GROUP_ID,
            message_id: user.original_message_id
          });
        }

        if (passed) {
          usersDb.prepare(`
            UPDATE approved_users 
            SET is_approved = 1
            WHERE telegram_user_id = ?
          `).run(userId);

          await tg('sendMessage', {
            chat_id: GROUP_ID,
            text: `
✅ *Welcome aboard @${escapeMarkdown(username)}\\!*

Great answer \\(${score}/10\\)\\! You've shown you understand our community's vibe\\.

You now have full access to participate\\. Enjoy\\! 🎉
            `.trim(),
            parse_mode: 'MarkdownV2'
          });

          await updateUserPermissions(userId, true);

        } else {
          const cooldown = calculateCooldown(user.verification_count + 1);
          
          // Delete user's failed response
          await tg('deleteMessage', {
            chat_id: GROUP_ID,
            message_id: messageId
          });

          usersDb.prepare(`
            UPDATE approved_users 
            SET verification_count = verification_count + 1,
                last_verification_attempt = ?
            WHERE telegram_user_id = ?
          `).run(new Date().toISOString(), userId);

          await tg('sendMessage', {
            chat_id: GROUP_ID,
            text: `
❌ *Not quite right @${escapeMarkdown(username)}*

We were looking for something more like:
${escapeMarkdown(user.expected_answer || "A more thoughtful response")}

Try again in ${cooldown} minutes\\!
            `.trim(),
            parse_mode: 'MarkdownV2'
          });

          if (!user.is_muted) {
            await updateUserPermissions(userId, false, cooldown);
          }
        }
      }
    }

  } catch (error) {
    console.error('Polling error:', error);
  }

  await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
}