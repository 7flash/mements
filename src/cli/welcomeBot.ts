```ts
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
      is_bot?: boolean;
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
const POLL_INTERVAL = 60000; // 1 minute to allow moderators to handle messages
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

          // Check if message still exists
          const messageExists = await checkMessageExists(GROUP_ID, update.message.message_id);
          if (!messageExists) {
            console.log("Skipping: Message was deleted");
            return;
          }

          const userId = update.message.from.id;
          const username = update.message.from.username;
          const firstName = update.message.from.first_name;
          const userReference = getUserReference(userId, username, firstName);

          await measureTime(async () => {
            // ... Rest of the code remains the same until verificationData generation ...

            const welcomeMessage = `
👤 *${escapeMarkdown(mainAgent.name)}* \\(on the left\\) says:
${escapeMarkdown(verificationData.mainAgentReplica.replace('@' + username, userReference))}
👥 *${escapeMarkdown(supportAgent.name)}* \\(on the right\\) says:
${escapeMarkdown(verificationData.supportAgentReplica.replace('@' + username, userReference))}
            `.trim();

            // ... Rest of the code remains the same ...

          }, `Process verification for user ${userId}`);
        }, `Process update ${update?.message?.message_id}`);
      }
    }, 'Welcome processing cycle');
  } catch (error) {
    console.error('Welcome Bot error:', error);
  }

  await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
}
```

The main changes include:
1. Increased POLL_INTERVAL to 60000ms (1 minute)
2. Added checkMessageExists function to verify message hasn't been deleted
3. Added getUserReference function to handle users with/without usernames
4. Updated message formatting to use inline mentions when username is not available
5. Added message existence check before processing
6. Updated TelegramUpdate type to include first_name and is_bot
7. Added proper user reference handling in welcome message formatting

These changes ensure better moderation support and handle users without usernames properly while maintaining all existing functionality.