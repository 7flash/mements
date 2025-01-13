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
							// todo: if invited by special link should invoke a corresponding agent
							const agent = agentsDb.prepare(`
                SELECT a.*, i.imageCid 
                FROM agents a
                LEFT JOIN images i ON i.subdomain = a.subdomain AND i.image_key = 'default'
                ORDER BY RANDOM()
                LIMIT 1
              `).get();
							console.log("agent ==> ", agent);

							if (!agent) {
								throw new Error('Unable to start verification process');
							}

							const imageUrl = agent.imageCid ? await pinata.gateways.createSignedURL({ cid: agent.imageCid, expires: 3600 }).optimizeImage({
								width: 512,
								height: 512,
								format: 'webp',
							}) : '';

							const verificationData = await Query.from({
								agentName: agent.name,
								agentCommunity: agent.prompt,
							}, 'gpt-4o-mini').infer({
								finalQuestion: `Generate a question that agent "${agent.name}" would ask interviewing a new member who wants to join his community`,
								expectedAnswer: 'Generate a sample correct answer to this question',
							});

// todo: improve this message to be more consise as we have emoji for title and then emoji and subtitle like Interviewer: ${agent.name}.mements.xyz then question itself focused like in a quote and then warning what to do and explanation should be clear
							const verificationMessage = `
🔒 Proof of Humanity is Required
@${username}

Meet our agent "${agent.name}" for interview, and here is his question for you:

${verificationData.finalQuestion}

Your next message should be answering to this question. Otherwise you'll be blocked.
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

/*
todo: improve validation here, for example

currently we get this

validation ==>  {
  thinking: "\nThe response given is quite vague and lacks detail. While it does mention using humor by making a remark about the weather, it does not provide a clear example of how this connected with someone or the context in which it happened. This makes it difficult to gauge the person's approach to humor and roasting in social settings. I would rate this answer a 4 for being somewhat related but ultimately lacking depth and clarity. \n",
  correctness: "\n4\n",
  commentOnTheAnswer: "\nxxx would likely respond with a nod, acknowledging the attempt at humor but might express the need for a more engaging example. \"I appreciate your answer about the weather remark, but could you share a specific instance where your humor really helped you connect with someone? That would give me a better insight into your approach!\"",
}

it seems like thinking is already enough and it should be used in the message where we indicate why attempt has failed, so i mean it looks like something we can just send in chat, because commentOnTheAnswer is opposite its wrong, its speaking from a third person which is wrong
*/

							const validationInput = {
								agentName: agent.name,
								question: user.verification_question,
								answer: update.message.text,
								agentPersonality: agent.prompt,
							};

							const validation = await Query.from(validationInput, 'gpt-4o-mini').infer({
								correctness: 'a single number value, from 1 to 10, where 1 the answer is not related to the question at all, and 5 it responds wrong, and 10 is actually correct answer',
								commentOnTheAnswer: `Respond as ${agent.name} would to this answer completing the interviewing and making conclusion on whether user accepted based on his answer or not. (correctness of 5 and higher is enough to be accepted)`,
							});
							console.log("validation ==> ", validation);

							const isCorrect = parseInt(validation.correctness) >= 5;

							if (isCorrect) {
								usersDb.prepare(`
										UPDATE approved_users 
										SET is_approved = TRUE
										WHERE telegram_user_id = ?
									`).run(userId);

								// if (user.original_message_id) {
								// 	try {
								// 		await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/messages.restoreMessages`, {
								// 			method: 'POST',
								// 			headers: { 'Content-Type': 'application/json' },
								// 			body: JSON.stringify({
								// 				id: [user.original_message_id]
								// 			})
								// 		});
								// 	} catch (error) {
								// 		console.error('Failed to restore message:', error);
								// 	}
								// }

								const successMessage = `✅ Verification successful! Welcome to our community. ${user.original_message ?
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