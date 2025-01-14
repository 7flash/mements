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
      username: string;
    };
    text: string;
    chat: {
      id: string;
    };
    reply_to_message?: {
      message_id: number;
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
        if (update?.message?.from?.is_bot) continue;
        if (!update?.message?.text && !update?.message?.new_chat_member) continue;

        const userId = update.message.from.id;
        const username = update.message.from.username;
        const user = usersDb.prepare(`
          SELECT * FROM approved_users WHERE telegram_user_id = ?
        `).get(userId) as ApprovedUser | undefined;

        if (user?.is_approved) continue;

        // Determine action based on user state and cooldown
        let action: 'askQuestion' | 'validateAnswer' | 'deleteMessage' = 'deleteMessage';
        
        if (user) {
          const lastAttempt = new Date(user.last_verification_attempt);
          const cooldownPassed = (Date.now() - lastAttempt.getTime()) > (COOLDOWN_MINUTES * 60 * 1000);
          
          if (cooldownPassed) {
            action = update.message.reply_to_message ? 'validateAnswer' : 'askQuestion';
          }
        } else {
          action = 'askQuestion';
        }

        // Delete any message from unapproved user
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: GROUP_ID,
            message_id: update.message.message_id
          })
        });

        if (action === 'deleteMessage') {
          if (user) {
            const remainingMinutes = Math.ceil(
              (COOLDOWN_MINUTES * 60 * 1000 - (Date.now() - new Date(user.last_verification_attempt).getTime())) / (60 * 1000)
            );
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: GROUP_ID,
                text: `⏳ *yo @${username}* - gotta wait ${remainingMinutes}m before trying again ser`,
                parse_mode: 'MarkdownV2'
              })
            });
          }
          continue;
        }

        if (action === 'askQuestion') {
/*
todo:

if we have invite link then one of the agents should be taken based on its name if its present otherwise still random

								const inviteLinkName = update?.new_chat_member ? update?.invite_link?.name : null;

								let query = `
										SELECT a.*, i.imageCid 
										FROM agents a
										LEFT JOIN images i ON i.subdomain = a.subdomain AND i.image_key = 'default'
									`;
	
								if (inviteLinkName) {
									query += ` WHERE a.subdomain = ? LIMIT 1`;
									return agentsDb.prepare(query).get(inviteLinkName);
								}
								
*/

					const agents = agentsDb.prepare(`
            SELECT a.*, i.imageCid 
            FROM agents a
            LEFT JOIN images i ON i.subdomain = a.subdomain AND i.image_key = 'default'
            ORDER BY RANDOM() LIMIT 2
          `).all();

          if (agents.length < 2) {
            throw new Error('Unable to start verification process - insufficient agents');
          }

          // Get signed URLs for both agent images
          const imageUrls = await Promise.all(agents.map(agent => 
            pinata.gateways.createSignedURL({
              cid: agent.imageCid,
              expires: 3600
            }).optimizeImage({
              width: 512,
              height: 512,
              format: 'webp',
            })
          ));

          // Generate verification data using both agents
          const verificationData = await Query.from({
            agent1Name: agents[0].name,
            agent2Name: agents[1].name,
            communityContext: agents[0].prompt,
          }, 'gpt-4o-mini').infer({
            welcomeDialog: `Generate a brief, casual welcome dialog between ${agents[0].name} and ${agents[1].name} greeting @${username}`,
            verificationQuestion: `Generate a casual verification question (max 15 words)`,
            expectedAnswer: 'Generate a brief, casual answer example',
          });

          const verificationMessage = `
🤖 *Welcome to the Community*

${verificationData.welcomeDialog}

*Verification Question:*
> "${verificationData.verificationQuestion}"

Reply to this message with your answer to continue\\! \\(${COOLDOWN_MINUTES}min timeout\\)
`.trim();

          // Send media group with both images
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: GROUP_ID,
              media: imageUrls.map((url, i) => ({
                type: 'photo',
                media: url,
                caption: i === 0 ? verificationMessage : '',
                parse_mode: 'MarkdownV2'
              }))
            })
          });

          // Update or insert user record
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
            [new Date().toISOString(), `${agents[0].name} & ${agents[1].name}`, 
             update.message.message_id, update.message.text, 
             verificationData.verificationQuestion, verificationData.expectedAnswer, userId] :
            [userId, false, new Date().toISOString(), 1, 
             `${agents[0].name} & ${agents[1].name}`, update.message.message_id,
             update.message.text, verificationData.verificationQuestion, 
             verificationData.expectedAnswer];

          stmt.run(...params);
        }
      }
    }, 'Update processing');
  } catch (error) {
    console.error('Polling error:', error);
  }

  await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
}