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

async function restrictUser(userId: string, duration: number) {
  console.log(`🔒 Restricting user ${userId} for ${duration} minutes`);
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/restrictChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: GROUP_ID,
        user_id: userId,
        permissions: {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
        },
        until_date: Math.floor(Date.now() / 1000) + (duration * 60)
      })
    });
  } catch (error) {
    console.error(`Failed to restrict user ${userId}:`, error);
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
        console.log(`👤 Processing message from user ${userId} (@${username})`, user);

        if (user?.is_approved) {
          console.log(`✅ User ${userId} is already approved`);
          continue;
        }

        let action: 'askQuestion' | 'validateAnswer' = user?.verification_question ? 'validateAnswer' : 'askQuestion';
        
        if (user) {
          const lastAttempt = new Date(user.last_verification_attempt);
          const cooldownPassed = (Date.now() - lastAttempt.getTime()) > (COOLDOWN_MINUTES * 60 * 1000);
          
          if (!cooldownPassed) {
            const remainingMinutes = Math.ceil(
              (COOLDOWN_MINUTES * 60 * 1000 - (Date.now() - lastAttempt.getTime())) / (60 * 1000)
            );

            console.log(`⏳ User ${userId} in cooldown for ${remainingMinutes} minutes`);
            await restrictUser(userId, remainingMinutes);
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: GROUP_ID,
                text: `⏳ *yo @${username}* - gotta wait ${remainingMinutes}m before trying again ser`,
                parse_mode: 'MarkdownV2'
              })
            });
            continue;
          }
          
          action = user.verification_question ? 'validateAnswer' : 'askQuestion';
        } else {
          action = 'askQuestion';
        }

        if (action === 'validateAnswer' && user?.verification_question) {
          console.log(`🤔 Validating answer from user ${userId}`);
          const score = await validateAnswer(update.message.text, user.expected_answer || '');
          
          if (score > 5) {
            console.log(`🎉 User ${userId} passed verification`);
            usersDb.prepare(`
              UPDATE approved_users 
              SET is_approved = 1
              WHERE telegram_user_id = ?
            `).run(userId);
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: GROUP_ID,
                text: `✨ *Welcome @${username}!* You've proven your vibe\\!`,
                parse_mode: 'MarkdownV2'
              })
            });
          } else {
            console.log(`❌ User ${userId} failed verification`);
            const restrictDuration = score <= 3 ? COOLDOWN_MINUTES * 2 : COOLDOWN_MINUTES;
            await restrictUser(userId, restrictDuration);
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: GROUP_ID,
                text: `😅 *Not quite @${username}* - try again in ${restrictDuration}m`,
                parse_mode: 'MarkdownV2'
              })
            });
          }
          continue;
        } else if (action === 'askQuestion') {
          let agents = [];
          const inviteLinkName = update?.new_chat_member && update?.invite_link?.name;

          if (inviteLinkName) {
            // Try to get the main agent based on invite link
            const mainAgent = agentsDb.prepare(`
              SELECT a.*, i.imageCid 
              FROM agents a
              LEFT JOIN images i ON i.subdomain = a.subdomain AND i.image_key = 'default'
              WHERE a.subdomain = ?
              LIMIT 1
            `).get(inviteLinkName);

            if (mainAgent) {
              // Get a random support agent excluding the main agent
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
          \\> one shot to answer \\| ${COOLDOWN_MINUTES}min timeout ⏳
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