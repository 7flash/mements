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
const POLL_INTERVAL = 1000;
const COOLDOWN_MINUTES = 15;
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

async function msg(method: string, body: any) {
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

async function restrictUser(userId: string, canMessage: boolean, duration?: number) {
  const permissions = {
    can_send_messages: canMessage,
    can_send_media_messages: canMessage,
    can_send_other_messages: canMessage,
    can_send_polls: canMessage,
    can_send_web_page_previews: canMessage,
    can_add_web_page_previews: canMessage
  };

  const body = {
    chat_id: GROUP_ID,
    user_id: userId,
    permissions,
    until_date: duration ? Math.floor(Date.now() / 1000) + (duration * 60) : undefined
  };

  return msg('restrictChatMember', body);
}

// Add constants for timeouts
const VALIDATION_TIMEOUT = 60; // 1 minute for validation
const BASE_COOLDOWN = 15; // Base cooldown in minutes

// Helper for exponential cooldown calculation
function calculateCooldown(attempts: number): number {
  return Math.min(BASE_COOLDOWN * Math.pow(2, attempts - 1), 24 * 60); // Max 24 hours
}

// Helper to schedule message deletion
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
        console.log(`👤 Processing update for user ${userId} (@${username})`);

        if (user?.is_approved) {
          console.log(`✅ User ${userId} is already approved`);
          continue;
        }

        let action: 'askQuestion' | 'validateAnswer' = 'askQuestion';
        
				if (user) {
					const lastAttempt = new Date(user.last_verification_attempt);
					const cooldown = calculateCooldown(user.verification_count);
					const cooldownPassed = (Date.now() - lastAttempt.getTime()) > (cooldown * 60 * 1000);
					
					logAction(userId, 'cooldownCheck', { cooldownPassed, lastAttempt, cooldown });
					
					if (!cooldownPassed) {
						// This is an anomaly - user shouldn't be able to send messages during cooldown
						const remainingMinutes = Math.ceil(
							(cooldown * 60 * 1000 - (Date.now() - lastAttempt.getTime())) / (60 * 1000)
						);
						
						logAction(userId, 'anomalyCooldownMessage', { remainingMinutes });
						console.error(`⚠️ Security anomaly: User ${userId} somehow posted during cooldown period`);
						
						await updateUserPermissions(userId, false, remainingMinutes);
						await sendTelegramMessage(
							`⚠️ *Whoa @${username}* \\- you shouldn't be able to send messages yet\\. ${remainingMinutes}m remaining on cooldown\\!`
						);
						continue;
					}
				
					if (user.verification_question) {
						logAction(userId, 'validatingAnswer');
						const agent = agentsDb.prepare(`
							SELECT * FROM agents WHERE name = ?
						`).get(user.verification_agent);
				
						const validationInput = {
							agentName: agent.name,
							question: user.verification_question,
							answer: update.message.text,
							agentPersonality: agent.prompt,
						};
						logAction(userId, 'validationInput', validationInput);
				
						const validation = await Query.from(validationInput, 'gpt-4o-mini').infer({
							correctness: 'Rate from 1-10 how well the answer addresses the question'
						});
						logAction(userId, 'validationResult', validation);
				
            const score = parseInt(validation.correctness);

            if (score >= 4) {
              console.log(`🎉 User ${userId} passed verification with score ${score}`);
              usersDb.prepare(`
                UPDATE approved_users 
                SET is_approved = 1
                WHERE telegram_user_id = ?
              `).run(userId);
              
              const successMessage = `
🎉 *Welcome to the community @${username}\\!*

Your answer showed you understand the vibe\\ (${score} out of 10). You're now free to participate\\!

Remember to keep it real and have fun\\! 🌟
              `.trim();

              await sendTelegramMessage(successMessage);
              await updateUserPermissions(userId, true);
            } else {
              const newCooldown = calculateCooldown(user.verification_count + 1);
              console.log(`❌ User ${userId} failed verification with score ${score}`);
              usersDb.prepare(`
                UPDATE approved_users 
                SET last_verification_attempt = ?,
                    verification_count = verification_count + 1
                WHERE telegram_user_id = ?
              `).run(new Date().toISOString(), userId);

              const failureMessage = `
❌ *Not quite there @${username}*

Your answer didn't quite match the vibe we're looking for\\. 
Try again in ${COOLDOWN_MINUTES} minutes with a fresh perspective\\!
              `.trim();

              await sendTelegramMessage(failureMessage);
              await updateUserPermissions(userId, false, newCooldown);
            }
            continue;
          }          
          
          action = user.verification_question ? 'validateAnswer' : 'askQuestion';
        } else {
          action = 'askQuestion';
        }

        setTimeout(async () => {
          const userStatus = usersDb.prepare(`
            SELECT is_approved FROM approved_users WHERE telegram_user_id = ?
          `).get(userId);

          if (!userStatus?.is_approved) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: GROUP_ID,
                message_id: update.message.message_id
              })
            });
            
            const cooldown = calculateCooldown(user?.verification_count || 1);
            await updateUserPermissions(userId, false, cooldown);
            await sendTelegramMessage(
              `⚠️ *Time's up @${username}* \\- verification failed\\. Try again in ${cooldown}m\\!`
            );
          }
        }, VALIDATION_TIMEOUT * 1000);

        if (action === 'askQuestion') {
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

          // Fallback to random selection if no invite link or main agent not found
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
						welcomeDialog: `
							Create a 2-line casual dialogue where:
							1. ${mainAgent.name} asks ${supportAgent.name} to help welcome @${username} and check their vibe
							2. ${supportAgent.name} directly addresses @${username} with the verification question
						`,
						verificationQuestion: `
							Create a casual but meaningful question that:
							- Tests understanding of community values
							- Max 15 words
							- Feels natural and conversational
						`,
						expectedAnswer: 'Brief example of a good answer showing community understanding'
					});
				
					logAction(userId, 'verificationData', verificationData);
				
					const welcomeMessage = `
						👤 *${escapeMarkdown(mainAgent.name)}*:
						${escapeMarkdown(verificationData.welcomeDialog.split('\n')[0])}

						👥 *${escapeMarkdown(supportAgent.name)}*:
						${escapeMarkdown(verificationData.welcomeDialog.split('\n')[1])}
					`.trim();

          await msg('sendMediaGroup', {
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

					await Bun.sleep(1000);

					const rulesMessage = `
				yo @${username}\\! 🔥
				
				we gotta make sure ur not a bot & check ur vibe\\. here's the deal:
				
				\\> ⏰ *${VALIDATION_TIMEOUT} seconds* to answer the question
				\\> 🎯 one shot only \\- make it count
				\\> ⚠️ fail = exponential timeout \\(${BASE_COOLDOWN}m \\-> ${BASE_COOLDOWN*2}m \\-> ${BASE_COOLDOWN*4}m\\)
				\\> 🤝 be real, show ur personality
				
				*ready\\? let's go\\!* 💫
					`.trim();

          await msg('sendMessage', {
            chat_id: GROUP_ID,
            text: rulesMessage,
            parse_mode: 'MarkdownV2'
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

          await restrictUser(userId, false, VALIDATION_TIMEOUT);
				}

        setTimeout(async () => {
          const userStatus = usersDb.prepare(`
            SELECT is_approved FROM approved_users WHERE telegram_user_id = ?
          `).get(userId);

          if (!userStatus?.is_approved) {
            await msg('deleteMessage', {
              chat_id: GROUP_ID,
              message_id: update.message.message_id
            });
            
            const cooldown = calculateCooldown(user?.verification_count || 1);
            await restrictUser(userId, false, cooldown);
            
            await msg('sendMessage', {
              chat_id: GROUP_ID,
              text: `⚠️ *Time's up @${username}* \\- verification failed\\. Try again in ${cooldown}m\\!`,
              parse_mode: 'MarkdownV2'
            });
          }
        }, VALIDATION_TIMEOUT * 1000);
      }
    }, 'Update processing');
  } catch (error) {
    console.error('Polling error:', error);
  }

  await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
}