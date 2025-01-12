import path from 'path';
import { Database } from "bun:sqlite";
import Files from "../server/files";

const dbPath = ;

// todo: use separate database instance here for read-only of agents table
const agentsDb = new Database(
    path.join(process.cwd(), 'static/database', `${process.env.DATABASE_NAME}.sqlite`).trim()
);

// todo: and in this database we can read/write to approved_users table
const usersDb = new Database(
    path.join(process.cwd(), 'static/database', `telegram.sqlite`).trim()
);

type ApprovedUser = {
  telegram_user_id: string;
  is_approved: boolean;
  last_verification_attempt: string;
  verification_count: number;
  verification_agent: string;
  original_message_id?: number;
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

export class TelegramModerator {
  private db: Database;
  private files: Files;
  private botToken: string;
  private groupId: string;
  private lastUpdateId = 0;
  private pollInterval = 1000;

  constructor(db: Database, files: Files) {
    this.db = db;
    this.files = files;
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.groupId = process.env.TELEGRAM_GROUP_ID;
    
    this.initializeTables();
    this.startPolling();
  }

  private initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS approved_users (
        telegram_user_id TEXT PRIMARY KEY,
        is_approved INTEGER DEFAULT 0,
        last_verification_attempt TEXT,
        verification_count INTEGER DEFAULT 0,
        verification_agent TEXT,
        original_message_id INTEGER
      );
    `);
  }

  // todo: rewrite this script in more of a procedural style aka avoiding classes and avoiding functions unless necessary to encapsulate repeating logic, ensure detailed logging with benchmarking how long it took to answer question to every user etc
  private async startPolling() {
    while (true) {
      try {
        const updates = await this.getUpdates();
        for (const update of updates) {
          await this.handleUpdate(update);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
    }
  }

  private async getUpdates(): Promise<TelegramUpdate[]> {
    const response = await fetch(
      `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}`
    );
    const data = await response.json();
    if (data.ok && data.result.length > 0) {
      this.lastUpdateId = data.result[data.result.length - 1].update_id;
      return data.result;
    }
    return [];
  }

  private async handleUpdate(update: TelegramUpdate) {
    if (update.new_chat_member) {
      await this.handleNewMember(update);
    } else if (update.message) {
      await this.handleMessage(update.message);
    }
  }

  private async handleNewMember(update: TelegramUpdate) {
    const userId = update.new_chat_member.id;
    await this.startVerification(userId, update.new_chat_member.username);
  }

  private async handleMessage(message: TelegramUpdate['message']) {
    const userId = message.from.id;
    const approvedUser = this.getApprovedUser(userId);

    if (!approvedUser?.is_approved) {
      await this.deleteMessage(message.message_id);
      
      if (!approvedUser) {
        await this.startVerification(userId, message.from.username, message.message_id);
      } else {
        const isCorrectAnswer = message.text.toLowerCase() === approvedUser.verification_agent.toLowerCase();
        if (isCorrectAnswer) {
          await this.approveUser(userId);
          if (approvedUser.original_message_id) {
            await this.sendSuccessMessage(userId, approvedUser.original_message_id);
          }
        } else {
          await this.handleFailedVerification(userId);
        }
      }
    }
  }

  private async startVerification(userId: string, username: string, originalMessageId?: number) {
    const lastAttempt = this.getLastVerificationAttempt(userId);
    if (lastAttempt && this.isOnCooldown(lastAttempt)) {
      throw new Error('Please wait 15 minutes before trying verification again');
    }

    const verificationAgent = this.getRandomAgent();
    if (!verificationAgent) {
      throw new Error('Unable to start verification process');
    }

    const imageUrl = verificationAgent.imageCid ? 
      await this.files.getUrl(verificationAgent.imageCid, 3600) : 
      '';

    const verificationMessage = `
🔒 User Verification Required
@${username}

To interact with our agents, please answer this question:

${verificationAgent.prompt}

Reply with the name of the AI agent shown in the image to get verified.
    `;

    await this.sendVerificationMessage(imageUrl, verificationMessage);
    await this.saveVerificationAttempt(userId, verificationAgent.name, originalMessageId);
  }

  private async approveUser(userId: string) {
    this.db.run(`
      UPDATE approved_users 
      SET is_approved = TRUE
      WHERE telegram_user_id = ?
    `, userId);
  }

  private async sendSuccessMessage(userId: string, originalMessageId: number) {
    const message = `✅ Verification successful! Your original message has been restored.`;
    await this.sendMessage(message);
  }

  private async handleFailedVerification(userId: string) {
    const message = `❌ Incorrect answer - please try again in 15 minutes`;
    await this.sendMessage(message);
  }

  private getApprovedUser(userId: string): ApprovedUser | undefined {
    return this.db.prepare(`
      SELECT * FROM approved_users WHERE telegram_user_id = ?
    `).get(userId);
  }

  private getLastVerificationAttempt(userId: string): string | null {
    const result = this.db.prepare(`
      SELECT last_verification_attempt FROM approved_users WHERE telegram_user_id = ?
    `).get(userId);
    return result?.last_verification_attempt || null;
  }

  private isOnCooldown(lastAttempt: string): boolean {
    const cooldownMinutes = 15;
    const cooldownMs = cooldownMinutes * 60 * 1000;
    return (new Date().getTime() - new Date(lastAttempt).getTime()) < cooldownMs;
  }

  private getRandomAgent() {
    return this.db.prepare(`
      SELECT a.*, i.imageCid 
      FROM agents a
      LEFT JOIN images i ON i.subdomain = a.subdomain AND i.image_key = 'default'
      ORDER BY RANDOM()
      LIMIT 1
    `).get();
  }

  private async sendVerificationMessage(imageUrl: string, message: string) {
    await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.groupId,
        photo: imageUrl,
        caption: message,
        reply_markup: {
          force_reply: true,
          selective: true
        }
      })
    });
  }

  private async deleteMessage(messageId: number) {
    await fetch(`https://api.telegram.org/bot${this.botToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.groupId,
        message_id: messageId
      })
    });
  }

  private async sendMessage(text: string) {
    await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.groupId,
        text
      })
    });
  }

  private saveVerificationAttempt(userId: string, agentName: string, originalMessageId?: number) {
    this.db.prepare(`
      INSERT INTO approved_users (
        telegram_user_id,
        is_approved,
        last_verification_attempt,
        verification_count,
        verification_agent,
        original_message_id
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(telegram_user_id) DO UPDATE SET
        last_verification_attempt = excluded.last_verification_attempt,
        verification_count = verification_count + 1,
        verification_agent = excluded.verification_agent,
        original_message_id = excluded.original_message_id
    `).run(
      userId,
      false,
      new Date().toISOString(),
      1,
      agentName,
      originalMessageId
    );
  }
}