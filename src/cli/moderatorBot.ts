import { Database } from "bun:sqlite";
import Query from "uai/src/query";

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

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const POLL_INTERVAL = 1000;
const VALIDATION_TIMEOUT = 60;
const BASE_COOLDOWN = 15;
let lastUpdateId = 0;

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

function calculateCooldown(attempts: number): number {
  return Math.min(BASE_COOLDOWN * Math.pow(2, attempts - 1), 24 * 60);
}

console.log('Starting Telegram Verification and Rules Bot...');
while (true) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`
    );
    const data = await response.json();
    const updates = data.ok && data.result.length > 0 ? data.result : [];
    
    if (updates.length > 0) {
      lastUpdateId = data.result[data.result.length - 1].update_id;
    }

    for (const update of updates) {
      if (update?.message?.from?.is_bot) continue;
      if (!update?.message?.text) continue;

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

      if (user) {
        const lastAttempt = new Date(user.last_verification_attempt);
        const cooldown = calculateCooldown(user.verification_count);
        const cooldownPassed = (Date.now() - lastAttempt.getTime()) > (cooldown * 60 * 1000);
        
        if (!cooldownPassed) {
          const remainingMinutes = Math.ceil(
            (cooldown * 60 * 1000 - (Date.now() - lastAttempt.getTime())) / (60 * 1000)
          );
          
          console.error(`⚠️ Security anomaly: User ${userId} somehow posted during cooldown period`);
          
          await updateUserPermissions(userId, false, remainingMinutes);
          await sendTelegramMessage(
            `⚠️ *Whoa @${username}* \\- you shouldn't be able to send messages yet\\. ${remainingMinutes}m remaining on cooldown\\!`
          );
          continue;
        }
      
        if (user.verification_question) {
          const agent = agentsDb.prepare(`
            SELECT * FROM agents WHERE name = ?
          `).get(user.verification_agent);
      
          const validationInput = {
            agentName: agent.name,
            question: user.verification_question,
            answer: update.message.text,
            agentPersonality: agent.prompt,
          };
      
          const validation = await Query.from(validationInput, 'gpt-4o-mini').infer({
            correctness: 'Rate from 1-10 how well the answer addresses the question'
          });
      
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
Try again in ${newCooldown} minutes with a fresh perspective\\!
            `.trim();

            await sendTelegramMessage(failureMessage);
            await updateUserPermissions(userId, false, newCooldown);
          }
          continue;
        }
      }

      const rulesMessage = `
yo @${escapeMarkdown(username)}\\! 🔥
      
      we gotta make sure ur not a bot & check ur vibe\\. here's the deal:
      
      \\> ⏰ *${VALIDATION_TIMEOUT} seconds* to answer the question
      \\> 🎯 one shot only \\- make it count
      \\> ⚠️ fail = exponential timeout \\(${BASE_COOLDOWN}m \\-> ${BASE_COOLDOWN*2}m \\-> ${BASE_COOLDOWN*4}m\\)
      \\> 🤝 be real, show ur personality
      
      *ready\\? let's go\\!* 💫
      `.trim();

      await sendTelegramMessage(rulesMessage);

      const stmt = user ? 
        usersDb.prepare(`
          UPDATE approved_users 
          SET last_verification_attempt = ?, verification_count = verification_count + 1
          WHERE telegram_user_id = ?
        `) :
        usersDb.prepare(`
          INSERT INTO approved_users (
            telegram_user_id, is_approved, last_verification_attempt, verification_count
          ) VALUES (?, ?, ?, ?)
        `);

      const params = user ? 
        [new Date().toISOString(), userId] :
        [userId, false, new Date().toISOString(), 1];

      stmt.run(...params);

      await updateUserPermissions(userId, false, VALIDATION_TIMEOUT);
    }
  } catch (error) {
    console.error('Polling error:', error);
  }

  await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
}