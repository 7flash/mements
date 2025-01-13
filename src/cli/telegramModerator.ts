import path from 'path';
import { Database } from "bun:sqlite";

const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY_URL,
  });

const agentsDb = new Database(
    path.join(process.cwd(), 'static/database', `${process.env.DATABASE_NAME}.sqlite`).trim(), 
    { readonly: true }
);

const usersDb = new Database(
    path.join(process.cwd(), 'static/database', `telegram.sqlite`).trim()
);

/*

todo: it should not just ask about agent, but instead use Query to generate a question from agent but his topic and then let agent decide if thats a valid opinion and actually respond to it as well.

example of query is like this:

const result = await Query.from({
    // here we define input fields like agent name etc
}, 'gpt-4o-mini').infer({
    finalQuestion: `here we instruct llm to produce a question for user`,
})

and then we send this result.finalQuestion to the chat

then we similarly construct our validation

const result = await Query.from({
    question, answer
}, 'gpt-4o-mini').infer({
    correctness: 'level from 1 to 10, where 1 the answer is not related to the question at all, and 5 it responds wrong, and 10 is actually correct answer',
    commentOnTheAnswer: 'in the style of the agent...',
})

*/

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
let lastUpdateId = 0;

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

console.log('Starting Telegram moderator bot...');
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
        if (update.new_chat_member || update.message) {
          const userId = update.new_chat_member?.id || update.message.from.id;
          const username = update.new_chat_member?.username || update.message.from.username;
          const user = usersDb.prepare(`
            SELECT * FROM approved_users WHERE telegram_user_id = ?
          `).get(userId) as ApprovedUser | undefined;

          if (update.message && !user?.is_approved) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: GROUP_ID,
                message_id: update.message.message_id
              })
            });

            if (!user) {
              const agent = agentsDb.prepare(`
                SELECT a.*, i.imageCid 
                FROM agents a
                LEFT JOIN images i ON i.subdomain = a.subdomain AND i.image_key = 'default'
                ORDER BY RANDOM()
                LIMIT 1
              `).get();

              if (!agent) {
                throw new Error('Unable to start verification process');
              }

              const imageUrl = agent.imageCid ? await pinata.gateways.createSignedURL({ cid: agent.imageCid, expires: 3600 }).optimizeImage() : '';

              const verificationMessage = `
🔒 User Verification Required
@${username}

To interact with our agents, please answer this question:

${agent.prompt}

Reply with the name of the AI agent shown in the image to get verified.
              `;

              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: GROUP_ID,
                  photo: imageUrl,
                  caption: verificationMessage,
                  reply_markup: {
                    force_reply: true,
                    selective: true
                  }
                })
              });

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
              `).run(
                userId,
                false,
                new Date().toISOString(),
                1,
                agent.name,
                update.message.message_id,
                update.message.text
              );
            } else {
=              const isCorrect = update.message.text.toLowerCase() === user.verification_agent.toLowerCase();
              
              if (isCorrect) {
                usersDb.prepare(`
                  UPDATE approved_users 
                  SET is_approved = TRUE
                  WHERE telegram_user_id = ?
                `).run(userId);

                if (user.original_message_id) {
                  try {
                    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/messages.restoreMessages`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        id: [user.original_message_id]
                      })
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

                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: GROUP_ID,
                    text: successMessage
                  })
                });
              } else {
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: GROUP_ID,
                    text: '❌ Incorrect answer - please try again in 15 minutes'
                  })
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