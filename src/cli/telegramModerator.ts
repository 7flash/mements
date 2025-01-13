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
				if (update?.message?.text || update?.message?.new_chat_member) {
					const userId = update.message.from.id;
					const username = update.message.from.username;
					const user = usersDb.prepare(`
            SELECT * FROM approved_users WHERE telegram_user_id = ?
          `).get(userId) as ApprovedUser | undefined;
					console.log("user ==> ", user);

					// todo: fix it seems we are missing to check cooldown has passed otherwise we just delete message, but if cooldown has passed and user sends a new message, so in this case we ask user a new question

					if (!user?.is_approved) {
						await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								chat_id: GROUP_ID,
								message_id: update.message.message_id
							})
						});

						if (!user) {
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
								finalQuestion: `Generate a question that agent "${agent.name}" would ask interviewing a new member who wants to join his community`,
								expectedAnswer: 'Generate a sample correct answer to this question',
							});

							const verificationMessage = `
🤖 *Verification Required*

👋 Hey @${username}!

*Interviewer:* ${agent.name} (${agent.subdomain}.mements.xyz)

> "${verificationData.finalQuestion}"

⚠️ *Instructions:*
• Reply directly to this message with your answer
• Be genuine and thoughtful
• You have one attempt before a ${COOLDOWN_MINUTES}-minute cooldown

Good luck! 🍀
`.trim();

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
                  original_message,
                  verification_question,
                  expected_answer
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
								userId,
								false,
								new Date().toISOString(),
								1,
								agent.name,
								update.message.message_id,
								update.message.text,
								verificationData.finalQuestion,
								verificationData.expectedAnswer
							);
						} else {
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
								exampleAnswer: 'Provide a brief example of a better answer to this question'
							});
							console.log("validation ==> ", validation);

							const score = parseInt(validation.correctness);

							if (validation.passed || score > 3) {
								usersDb.prepare(`
										UPDATE approved_users 
										SET is_approved = TRUE
										WHERE telegram_user_id = ?
									`).run(userId);

// todo: should improve this message based on the score
								const successMessage = `
✅ *Welcome to the community!*

${validation.score > 7 ? "Excellent response! " : "Good answer! "}*${validation.thinking}*

${user.original_message ? '\n📝 Your original message was:\n' + user.original_message : ''}
`.trim();

								await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										chat_id: GROUP_ID,
										text: successMessage,
										parse_mode: 'Markdown'
									})
								});
							} else  {
// todo: should respond properly based on the score where 1-3 kinda means perhaps user is spammer and thats why we are here verification is failed because sus,

// todo: also messages should be less formal using simple casual language of degen crypto community culture
								const failureMessage = `
❌ *Verification Failed*

@${username}, your answer needs improvement:
${validation.feedback}

Here's an example of a better response:
"${validation.exampleAnswer}"

⏳ Please wait ${COOLDOWN_MINUTES} minutes before trying again.
`.trim();

								await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										chat_id: GROUP_ID,
										text: failureMessage,
										parse_mode: 'Markdown'
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