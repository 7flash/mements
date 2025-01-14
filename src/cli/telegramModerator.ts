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

async function sendTelegramMessage(text: string, parseMode: 'Markdown' | 'MarkdownV2' = 'MarkdownV2') {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: GROUP_ID,
        text,
        parse_mode: parseMode
      })
    });
    if (!response.ok) throw new Error(`Telegram API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error;
  }
}

async function updateUserPermissions(userId: string, canMessage: boolean, duration?: number) {
  try {
    const permissions = {
      can_send_messages: canMessage,
      can_send_media_messages: canMessage,
      can_send_other_messages: canMessage,
    };

    const body: any = {
      chat_id: GROUP_ID,
      user_id: userId,
      permissions
    };

    if (duration) {
      body.until_date = Math.floor(Date.now() / 1000) + (duration * 60);
    }

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/restrictChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`Failed to update permissions: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Failed to update permissions for user ${userId}:`, error);
    throw error;
  }
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
        
				/* todo: improve logging in our program, everything happens in the program, it should be following with statement  for example like this:

            console.log(userId, ":validationInput ==> ", validationInput);
				*/
				if (user) {
          const lastAttempt = new Date(user.last_verification_attempt);
          const cooldown = calculateCooldown(user.verification_count);
          const cooldownPassed = (Date.now() - lastAttempt.getTime()) > (cooldown * 60 * 1000);
          
					// todo: this should probably never happen, how could have user sent a message until cooldown passed if we restricted him for that period, we should indicate an error here 
          if (!cooldownPassed) {
            const remainingMinutes = Math.ceil(
              (cooldown * 60 * 1000 - (Date.now() - lastAttempt.getTime())) / (60 * 1000)
            );
            
            console.log(`⏳ User ${userId} in cooldown, ${remainingMinutes}m remaining`);
            await updateUserPermissions(userId, false, remainingMinutes);
            await sendTelegramMessage(
              `⏳ *yo @${username}* \\- gotta wait ${remainingMinutes}m before trying again ser`
            );
            continue;
          }

          if (user.verification_question) {
            console.log(`🤔 Validating answer from user ${userId}`);
            const agent = agentsDb.prepare(`
              SELECT * FROM agents WHERE name = ?
            `).get(user.verification_agent);

            const validationInput = {
              agentName: agent.name,
              question: user.verification_question,
              answer: update.message.text,
              agentPersonality: agent.prompt,
            };
            console.log("validationInput ==> ", validationInput);

            const validation = await Query.from(validationInput, 'gpt-4o-mini').infer({
              correctness: 'Rate from 1-10 how well the answer addresses the question (1-3 means answer is totally unrelated to the given context of question, 4-6 means answer is relevant but might be incomplete or incorrect, 7-10 means answer resonates to the questioners own opinion)',
            });
            console.log("validation ==> ", validation);

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

/*
currently the message looks like this:

🌟 New Fren Vibe Check 🌟
          
          
santagga: Hey ghost, check out @mementsxyz! They just joined our community. I wonder what they're all about.  
ghost: Oh, nice! I’m always curious about new members. Do you think they’ll fit in with our vibe?  
santagga: I hope so! I love how diverse our group is. It could be great to see what they bring to the table.  
ghost: Totally agree! Maybe we should ask them something to get a feel for their vibe?  

          
          santagga: "
What’s your favorite way to blend tradition with modern creativity?  
"
          
          > @mementsxyz - time to prove ur vibe! 
          > one shot to answer | 15min timeout ⏳
          > make it count fren ✨

todo: we should improve it, first of all we should separate into two messages. first message with two images as its now only have a short conversation between main and helper agent, it should consist exactly of two lines:

> main agent is asking his helper to welcome new user and ask him a validation question in regards to our shared values
> helper agent is tagging the user inside of his question addressing to him

then, we send additional message in reply to this one tagging user again and explaining the rules why its necessary for verification to fight off spam and check the vibe, all in very casual degen language
*/
          const verificationData = await Query.from({
            mainAgentName: mainAgent.name,
            supportAgentName: supportAgent.name,
            username: username,
            agentCommunity: mainAgent.prompt,
            mainAgentPersonality: mainAgent.personality || 'friendly and welcoming',
            supportAgentPersonality: supportAgent.personality || 'supportive and curious'
          }, 'gpt-4o-mini').infer({
            roleplayDialog: `
              Create a natural, casual dialogue where ${mainAgent.name} and ${supportAgent.name} are 
              discussing whether to welcome @${username} to their community. Include:
              - ${mainAgent.name} notices the new user first
              - ${supportAgent.name} shares their thoughts
              - Both agents show their unique personalities
              - Keep it friendly but make it feel like they're genuinely evaluating @${username}
              - Max 3-4 lines of dialogue total
              - End with ${mainAgent.name} deciding to ask a question
            `,
            finalQuestion: `
              Create a clever but casual question (max 12 words) that:
              - Fits naturally with ${mainAgent.name}'s personality
              - Tests if @${username} vibes with the community
              - Encourages a creative or thoughtful response
              - Feels like a natural continuation of the dialogue
            `,
            expectedAnswer: 'Generate a brief example answer that would show good community fit'
          });

          const escapeMarkdown = (text: string) => {
            return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
          };

          const verificationMessage = `
          🌟 *New Fren Vibe Check* 🌟
          
          ${escapeMarkdown(verificationData.roleplayDialog)}
          
          *${escapeMarkdown(mainAgent.name)}:* "${escapeMarkdown(verificationData.finalQuestion)}"
          
          \\> @${username} \\- time to prove ur vibe\\! 
          \\> ⚠️ You have ${VALIDATION_TIMEOUT} seconds to answer\\!
          \\> one shot to answer \\| exponential cooldown on fails
          \\> make it count fren ✨
          `.trim();

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: GROUP_ID,
              media: [
                {
                  type: 'photo',
                  media: mainImageUrl,
                },
                {
                  type: 'photo',
                  media: supportImageUrl,
                  caption: verificationMessage,
                  parse_mode: 'MarkdownV2'
                }
              ]
            })
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
      }
    }, 'Update processing');
  } catch (error) {
    console.error('Polling error:', error);
  }

  await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
}