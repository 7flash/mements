import path from 'path';
import { Database } from "bun:sqlite";
import Query from "uai/src/query";
import { PinataSDK } from 'pinata';

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT,
	pinataGateway: process.env.PINATA_GATEWAY_URL,
});

const agentsDbPath = path.join(process.cwd(), 'static/database', `${process.env.DATABASE_AGENTS}.sqlite`);

const agentsDb = new Database(
	path.join(agentsDbPath).trim(),
	{ readonly: true }
);
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
			console.log("updates ==> ", updates);

			if (updates.length > 0) {
				lastUpdateId = data.result[data.result.length - 1].update_id;
			}

			for (const update of updates) {
				if (update?.message?.from?.is_bot == true) continue;

				if (update?.message?.text || update?.message?.new_chat_member) {
					const userId = update.message.from.id;
					const username = update.message.from.username;
					const user = usersDb.prepare(`
            SELECT * FROM approved_users WHERE telegram_user_id = ?
          `).get(userId) as ApprovedUser | undefined;
					console.log("user ==> ", user);

					if (user && user.is_approved) {
						continue;
					}

					// todo: please fix this code, keep here in two stages define action first based if user is new or passed cooldown, then proceed accordingly, do not define any functions
					let shouldDeleteMessage = true;
					let action: 'askQuestion' | 'validateAnswer' | 'deleteMessage' = 

					if (user && user.is_approved) {
						// all good already approved
						continue;
					} else {
						const lastAttempt = new Date(user.last_verification_attempt);
						const cooldownPassed = (Date.now() - lastAttempt.getTime()) > (COOLDOWN_MINUTES * 60 * 1000);
						
						if (!cooldownPassed) {
							const remainingMinutes = Math.ceil(
								(COOLDOWN_MINUTES * 60 * 1000 - (Date.now() - lastAttempt.getTime())) / (60 * 1000)
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

							continue;
						}					}
					

					if (user ) {

					} else if (!user || ) {
						// new user just joined
					}

					if (!user?.is_approved) {
						await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								chat_id: GROUP_ID,
								message_id: update.message.message_id
							})
						});

            if (user) {
              const lastAttempt = new Date(user.last_verification_attempt);
              const cooldownPassed = (Date.now() - lastAttempt.getTime()) > (COOLDOWN_MINUTES * 60 * 1000);
              
              if (!cooldownPassed) {
                const remainingMinutes = Math.ceil(
                  (COOLDOWN_MINUTES * 60 * 1000 - (Date.now() - lastAttempt.getTime())) / (60 * 1000)
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

								continue;
              } else {
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
	
								query += ` ORDER BY RANDOM() LIMIT 1`;
	
								// todo: actually we should fetch two agents always, and send both images in the message, and then we should generate our message that kind of role plays a user entering community chat and these two agents are welcoming him asking a quesion, and then its explained he must answer the question before proceed further and before can send any other messages 
								const agent = agentsDb.prepare(query).get();
								console.log("agent ==> ", agent);
	
								if (!agent) {
									throw new Error('Unable to start verification process');
								}
	
								const imageUrl = await pinata.gateways.createSignedURL({
									cid: agent.imageCid,
									expires: 3600
								}).optimizeImage({
									width: 512,
									height: 512,
									format: 'webp',
								});
	
								const verificationData = await Query.from({
									agentName: agent.name,
									agentCommunity: agent.prompt,
								}, 'gpt-4o-mini').infer({
									finalQuestion: `Generate a short, casual question (max 15 words) that ${agent.name} would ask a new fren when they join the community`,
									expectedAnswer: 'Generate a brief, casual answer example',
								});
	
								const verificationMessage = `
	🤖 *Vibe Check Required*
	
	sup @${username}\\! 
	
	*interviewer:* ${agent.name} \\(${agent.subdomain}\\.mements\\.xyz\\)
	
	> "${verificationData.finalQuestion}"
	
	just reply to this msg w/ ur answer fren\\! one shot or ${COOLDOWN_MINUTES}min timeout ⏳
	`.trim();
	
								await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										chat_id: GROUP_ID,
										photo: imageUrl,
										caption: verificationMessage,
										parse_mode: 'MarkdownV2',
										reply_markup: {
											force_reply: true,
											selective: true
										}
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
								[new Date().toISOString(), agent.name, update.message.message_id,
								 update.message.text, verificationData.finalQuestion,
								 verificationData.expectedAnswer, userId] :
								[userId, false, new Date().toISOString(), 1, agent.name,
								 update.message.message_id, update.message.text,
								 verificationData.finalQuestion, verificationData.expectedAnswer];
	
							stmt.run(...params);


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