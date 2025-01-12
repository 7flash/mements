import path from 'path';
import { Database } from "bun:sqlite";
import Files from "../server/files";

const agentsDb = new Database(
    path.join(process.cwd(), 'static/database', `${process.env.DATABASE_NAME}.sqlite`).trim(), 
    { readonly: true }
);

const usersDb = new Database(
    path.join(process.cwd(), 'static/database', `telegram.sqlite`).trim()
);

usersDb.exec(`
  CREATE TABLE IF NOT EXISTS approved_users (
    telegram_user_id TEXT PRIMARY KEY,
    is_approved INTEGER DEFAULT 0,
    last_verification_attempt TEXT,
    verification_count INTEGER DEFAULT 0,
    verification_agent TEXT,
    original_message_id INTEGER,
    original_message TEXT
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
};

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const POLL_INTERVAL = 1000;
const COOLDOWN_MINUTES = 15;

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

// todo: rewrite our full program to be more of Procedural Programming with Minimal Abstraction, ie never define a function if its only being used in one place, instead just inline it, for example we dont need sendTelegramRequest function we can just call fetch every time

async function sendTelegramRequest(method: string, body: any) {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}

// Database operations
function getApprovedUser(userId: string): ApprovedUser | undefined {
  return usersDb.prepare(`
    SELECT * FROM approved_users WHERE telegram_user_id = ?
  `).get(userId) as ApprovedUser | undefined;
}

function saveVerificationAttempt(userId: string, agentName: string, originalMessageId?: number, originalMessage?: string) {
  usersDb.prepare(`
    INSERT INTO approved_users (
      telegram_user_id,
      is_approved,
      last_verification_attempt,
      verification_count,
      verification_agent,
      original_message_id,
      original_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(telegram_user_id) DO UPDATE SET
      last_verification_attempt = excluded.last_verification_attempt,
      verification_count = verification_count + 1,
      verification_agent = excluded.verification_agent,
      original_message_id = excluded.original_message_id,
      original_message = excluded.original_message
  `).run(
    userId,
    false,
    new Date().toISOString(),
    1,
    agentName,
    originalMessageId,
    originalMessage
  );
}

function getRandomAgent() {
  return agentsDb.prepare(`
    SELECT a.*, i.imageCid 
    FROM agents a
    LEFT JOIN images i ON i.subdomain = a.subdomain AND i.image_key = 'default'
    ORDER BY RANDOM()
    LIMIT 1
  `).get();
}

// Core verification logic
async function handleVerification(userId: string, username: string, messageId?: number, messageText?: string) {
  const user = getApprovedUser(userId);
  
  if (user && user.last_verification_attempt) {
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;
    const timeSinceLastAttempt = new Date().getTime() - new Date(user.last_verification_attempt).getTime();
    
    if (timeSinceLastAttempt < cooldownMs) {
      throw new Error(`Please wait ${COOLDOWN_MINUTES} minutes before trying verification again`);
    }
  }

  const agent = getRandomAgent();
  if (!agent) {
    throw new Error('Unable to start verification process');
  }

  const files = new Files();
  const imageUrl = agent.imageCid ? await files.getUrl(agent.imageCid, 3600) : '';

  const verificationMessage = `
🔒 User Verification Required
@${username}

To interact with our agents, please answer this question:

${agent.prompt}

Reply with the name of the AI agent shown in the image to get verified.
  `;

  await sendTelegramRequest('sendPhoto', {
    chat_id: GROUP_ID,
    photo: imageUrl,
    caption: verificationMessage,
    reply_markup: {
      force_reply: true,
      selective: true
    }
  });

  await saveVerificationAttempt(userId, agent.name, messageId, messageText);
}

async function checkAnswer(userId: string, answer: string): Promise<boolean> {
  const user = getApprovedUser(userId);
  if (!user) return false;

  const isCorrect = answer.toLowerCase() === user.verification_agent.toLowerCase();
  
  if (isCorrect) {
    usersDb.prepare(`
      UPDATE approved_users 
      SET is_approved = TRUE
      WHERE telegram_user_id = ?
    `).run(userId);

    // Restore original message using MTProto API
    if (user.original_message_id) {
      try {
        await sendTelegramRequest('messages.restoreMessages', {
          id: [user.original_message_id]
        });
      } catch (error) {
        console.error('Failed to restore message:', error);
      }
    }

    const successMessage = `✅ Verification successful! You can now interact with our agents.${
      user.original_message ? 
      '\n\nYour original message was:\n' + user.original_message :
      ''
    }`;
    
    await sendTelegramRequest('sendMessage', {
      chat_id: GROUP_ID,
      text: successMessage
    });
  }

  return isCorrect;
}

let lastUpdateId = 0;

async function startPolling() {
  while (true) {
    try {
      await measureTime(async () => {
        const updates = await getUpdates();
        
        for (const update of updates) {
          if (update.new_chat_member) {
            await handleVerification(
              update.new_chat_member.id,
              update.new_chat_member.username
            );
          } else if (update.message) {
            const user = getApprovedUser(update.message.from.id);
            
            if (!user?.is_approved) {
              await sendTelegramRequest('deleteMessage', {
                chat_id: GROUP_ID,
                message_id: update.message.message_id
              });

              if (!user) {
                await handleVerification(
                  update.message.from.id,
                  update.message.from.username,
                  update.message.message_id,
                  update.message.text
                );
              } else {
                const isCorrect = await checkAnswer(update.message.from.id, update.message.text);
                if (!isCorrect) {
                  await sendTelegramRequest('sendMessage', {
                    chat_id: GROUP_ID,
                    text: '❌ Incorrect answer - please try again in 15 minutes'
                  });
                }
              }
            }
          }
        }
      }, 'Update processing');

    } catch (error) {
      console.error('Polling error:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

async function getUpdates(): Promise<TelegramUpdate[]> {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`
  );
  const data = await response.json();
  if (data.ok && data.result.length > 0) {
    lastUpdateId = data.result[data.result.length - 1].update_id;
    return data.result;
  }
  return [];
}

console.log('Starting Telegram moderator bot...');
startPolling();