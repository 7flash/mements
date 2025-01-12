type ApprovedUser = {
    telegram_user_id: string;
    is_approved: boolean;
    last_verification_attempt: string;
    verification_count: number;
  };
  

  // todo: this should not happen on request but instead polling telegram bot group updates
      if (req.method === "POST" && path === "/api/ask-agent") {
        try {
          const data = await req.json();
          console.log(requestId, "Received question", data.content);
  
          const telegramUserId = data.telegramUserId;
          if (telegramUserId) {
            const approvedUserQuery = db.query<ApprovedUser>(`
              SELECT * FROM approved_users 
              WHERE telegram_user_id = ?
            `);
            const approvedUser = approvedUserQuery.get(telegramUserId);
  
            if (!approvedUser?.is_approved) {
              const lastAttempt = approvedUser?.last_verification_attempt ? 
                new Date(approvedUser.last_verification_attempt) : 
                new Date(0);
              const cooldownMinutes = 15;
              const cooldownMs = cooldownMinutes * 60 * 1000;
              
              if ((new Date().getTime() - lastAttempt.getTime()) < cooldownMs) {
                throw `Please wait ${cooldownMinutes} minutes before trying verification again`;
              }
  
              const randomAgentQuery = db.query(`
                SELECT a.*, i.imageCid 
                FROM agents a
                LEFT JOIN images i ON i.subdomain = a.subdomain AND i.image_key = 'default'
                ORDER BY RANDOM()
                LIMIT 1
              `);
              const verificationAgent = randomAgentQuery.get();
  
              if (!verificationAgent) {
                throw "Unable to start verification process";
              }

              // todo: dont need a random bot always use the same one with group_id/bot_token from process.env
              const telegramBotQuery = db.query<TelegramBot>(`
                SELECT * FROM telegram_bots 
                WHERE subdomain = ?
              `);
              const telegramBot = telegramBotQuery.get(agentData.subdomain);
  
              if (!telegramBot) {
                throw "Telegram bot configuration not found";
              }
  
              let imageUrl = '';
              if (verificationAgent.imageCid) {
                imageUrl = await files.getUrl(verificationAgent.imageCid, 3600);
              }
  
              const verificationMessage = `
  🔒 User Verification Required
  @${data.telegramUsername}
  
  To interact with our agents, please answer this question:
  
  ${verificationAgent.prompt}
  
  Reply with the name of the AI agent shown in the image to get verified.
              `;
  
              const telegramApiUrl = `https://api.telegram.org/bot${telegramBot.bot_token}/sendPhoto`;
              await fetch(telegramApiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: telegramBot.group_id,
                  photo: imageUrl,
                  caption: verificationMessage,
                  reply_to_message_id: data.messageId, // todo: ensure its not a message from user but its that notification that someone joined a chat
                  reply_markup: {
                    force_reply: true,
                    selective: true
                  }    
                })
              });
  
             db.run(`
                INSERT INTO approved_users (
                  telegram_user_id, 
                  is_approved, 
                  last_verification_attempt,
                  verification_count,
                  verification_agent
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(telegram_user_id) DO UPDATE SET
                  last_verification_attempt = excluded.last_verification_attempt,
                  verification_count = verification_count + 1,
                  verification_agent = excluded.verification_agent
              `, 
              telegramUserId,
              false,
              new Date().toISOString(),
              1,
              verificationAgent.name
              );
  
              throw "Verification required - please check the bot's message";
            }
          }
    
          // todo: again its not an endpoint but a function which can be triggered from our stream where we poll new messages in tg chat
      if (req.method === "POST" && path === "/api/verify-user") {
        try {
          const { telegramUserId, answer } = await req.json();
  
          const approvedUserQuery = db.query<ApprovedUser>(`
            SELECT * FROM approved_users 
            WHERE telegram_user_id = ?
          `);
          const approvedUser = approvedUserQuery.get(telegramUserId);
  
          if (!approvedUser) {
            throw "No verification in progress";
          }
  
          // todo: it should notify user that he's allowed to send messages now and also it should have remembered his original message and can include it in the notification message, because when verification starts, original messages should have been deleted from chat please
          if (answer.toLowerCase() === approvedUser.verification_agent.toLowerCase()) {
            db.run(`
              UPDATE approved_users 
              SET is_approved = TRUE
              WHERE telegram_user_id = ?
            `, telegramUserId);
  
            return new Response(JSON.stringify({ 
              success: true,
              message: "User verified successfully"
            }), {
              headers: { "Content-Type": "application/json" }
            });
          } else {
            throw "Incorrect answer - please try again in 15 minutes";
          }

// todo: ensure tables initialized synced with structure we actually use
```sql
CREATE TABLE IF NOT EXISTS user_approvals (
  user_id TEXT PRIMARY KEY,
  approved INTEGER DEFAULT 0,
  last_attempt TEXT
);

CREATE TABLE IF NOT EXISTS user_verifications (
  user_id TEXT PRIMARY KEY,
  agent_subdomain TEXT,
  timestamp TEXT,
  FOREIGN KEY(agent_subdomain) REFERENCES agents(subdomain)
);
```
