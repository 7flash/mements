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

async function sendTelegramMessage(text: string, options: any = {}) {
  return tg('sendMessage', {
    chat_id: GROUP_ID,
    text: text,
    parse_mode: 'MarkdownV2',
    ...options
  });
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


// todo: our bot should listen for messages of special moderator bot and explain to user the rules every time, and manage permissions and cooldowns. after user responds the message, it should delete its original rules message and send a new message with result which includes example of response it expected, and includes result whether member is accepted or not. if not, then user original message must be deleted and he must be muted by increasing cooldown timer.
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
        if (!update?.message?.from?.username != WELCOME_BOT_USERNAME) {
          continue; 
        }

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

        // todo: understand question already been asked by user bot, now we just need to explain the rules in trigger of that message
        let action: 'askQuestion' | 'validateAnswer' = 'askQuestion';
        
				if (user) {
					const lastAttempt = new Date(user.last_verification_attempt);
					const cooldown = calculateCooldown(user.verification_count);
					const cooldownPassed = (Date.now() - lastAttempt.getTime()) > (cooldown * 60 * 1000);
					
					logAction(userId, 'cooldownCheck', { cooldownPassed, lastAttempt, cooldown });
					
					if (!cooldownPassed) {
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

// todo: it should mention example response from the database which is .expected_answer field    
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
          // todo: message should be replying to the original message by moderator bot yet its addressing a user kind of saying look moderator asked you a question if you dont answer within 60 seconds you might be muted
					const rulesMessage = `
yo @${escapeMarkdown(username)}\\! 🔥
				
				we gotta make sure ur not a bot & check ur vibe\\. here's the deal:
				
				\\> ⏰ *${VALIDATION_TIMEOUT} seconds* to answer the question
				\\> 🎯 one shot only \\- make it count
				\\> ⚠️ fail = exponential timeout \\(${BASE_COOLDOWN}m \\-> ${BASE_COOLDOWN*2}m \\-> ${BASE_COOLDOWN*4}m\\)
				\\> 🤝 be real, show ur personality
				
				*ready\\? let's go\\!* 💫
					`.trim();

					await tg('sendMessage', {
						chat_id: GROUP_ID,
						text: escapeMarkdown(rulesMessage),
						parse_mode: 'MarkdownV2'
					});

          await updateUserPermissions(userId, false, VALIDATION_TIMEOUT);
				}

        // todo: so if user didnt answer then we mute him or either if he answered incorrectly but we only mute him once so need to check here if he already muted dont do it again
        setTimeout(async () => {
          const userStatus = usersDb.prepare(`
            SELECT is_approved FROM approved_users WHERE telegram_user_id = ?
          `).get(userId);

          if (!userStatus?.is_approved) {
            await tg('deleteMessage', {
              chat_id: GROUP_ID,
              message_id: update.message.message_id
            });
            
            const cooldown = calculateCooldown(user?.verification_count || 1);
            await updateUserPermissions(userId, false, cooldown);
            
            await sendTelegramMessage(
              `⚠️ *Time's up @${escapeMarkdown(username)}* \\- verification failed\\. Try again in ${cooldown}m\\!`
            );
          }
        }, VALIDATION_TIMEOUT * 1000);
      }
    }, 'Update processing');
  } catch (error) {
    console.error('Polling error:', error);
  }

  await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
}