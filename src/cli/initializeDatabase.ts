import { Database as BunDatabase } from "bun:sqlite";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    path: {
      type: 'string',
    },
  },
  strict: true,
  allowPositionals: true,
});

if (!values.path) {
  throw new Error("Database path is required. Please provide a valid path using --path");
}

const db = new BunDatabase(values.path, { create: true });

try {
  db.run(`
    CREATE TABLE wallets (
      subdomain TEXT PRIMARY KEY,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      FOREIGN KEY(subdomain) REFERENCES agents(subdomain) ON DELETE CASCADE
    )
  `);
  console.log('Table "wallets" initialized');
} catch (error) {
  console.error('Error initializing table "wallets":', error);
}

try {
  db.run(`
    CREATE TABLE chats (
      id TEXT PRIMARY KEY,
      subdomain TEXT NOT NULL,
      question TEXT NOT NULL,
      response TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      twitter_post_link TEXT
    )
  `);
  console.log('Table "chats" initialized');
} catch (error) {
  console.error('Error initializing table "chats":', error);
}

try {
  // Migration step
  const transaction = db.transaction(() => {
    // Step 1: Backup existing 'agents' data
    const agentsData = db.query(`
      SELECT subdomain, name, prompt, workflow, imageCid FROM agents
    `).all();
    console.log("agentsDsata ==> ", agentsData);

    // Step 2: Drop the old 'agents' table
    db.run(`DROP TABLE IF EXISTS agents`);

    // Step 3: Create the new 'agents' table
    db.run(`
      CREATE TABLE agents (
        subdomain TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prompt TEXT,
        workflow TEXT
      )
    `);

    // Step 4: Reinsert the data back into the new 'agents' table
    for (const agent of agentsData) {
      db.run(
        `INSERT INTO agents (subdomain, name, prompt, workflow) VALUES (?, ?, ?, ?)`,
        agent.subdomain, agent.name, agent.prompt, agent.workflow
      );
    }

    // Step 5: Create the new 'images' table for storing image CIDs separately
    db.run(`
      CREATE TABLE images (
        subdomain TEXT,
        image_key TEXT NOT NULL,
        imageCid TEXT NOT NULL,
        PRIMARY KEY (subdomain, image_key),
        FOREIGN KEY(subdomain) REFERENCES agents(subdomain) ON DELETE CASCADE
      )
    `);

    // Step 6: Insert image CID data into the new 'images' table
    for (const agent of agentsData) {
      if (agent.imageCid) {
        db.run(
          `INSERT INTO images (subdomain, image_key, imageCid) VALUES (?, ?, ?)`,
          agent.subdomain, 'default', agent.imageCid
        );
      }
    }
  });

  transaction();

  console.log('Tables "agents" and "images" initialized and data migrated');
} catch (error) {
  console.error('Error during migration and initializing table "agents":', error);
}

try {
  db.run(`
    CREATE TABLE custom_info (
      subdomain TEXT PRIMARY KEY,
      info TEXT,
      FOREIGN KEY(subdomain) REFERENCES agents(subdomain) ON DELETE CASCADE
    )
  `);
  console.log('Table "custom_info" initialized');
} catch (error) {
  console.error('Error initializing table "custom_info":', error);
}

try {
  db.run(`
    CREATE TABLE links (
      subdomain TEXT,
      type TEXT,
      value TEXT,
      PRIMARY KEY (subdomain, type),
      FOREIGN KEY(subdomain) REFERENCES agents(subdomain) ON DELETE CASCADE
    )
  `);
  console.log('Table "links" initialized');
} catch (error) {
  console.error('Error initializing table "links":', error);
}

try {
  db.run(`
    CREATE TABLE twitter_bots (
      subdomain TEXT PRIMARY KEY,
      oauth_token TEXT NOT NULL,
      oauth_token_secret TEXT NOT NULL,
      user_id TEXT NOT NULL,
      screen_name TEXT NOT NULL,
      FOREIGN KEY(subdomain) REFERENCES agents(subdomain) ON DELETE CASCADE
    )
  `);
  console.log('Table "twitter_bots" initialized');
} catch (error) {
  console.error('Error initializing table "twitter_bots":', error);
}

try {
  db.run(`
    CREATE TABLE telegram_bots (
      subdomain TEXT PRIMARY KEY,
      bot_token TEXT NOT NULL,
      group_id TEXT NOT NULL,
      FOREIGN KEY(subdomain) REFERENCES agents(subdomain) ON DELETE CASCADE
    )
  `);
  console.log('Table "telegram_bots" initialized');
} catch (error) {
  console.error('Error initializing table "telegram_bots":', error);
}

try {
  db.run(`
    CREATE TABLE contexts (
      subdomain TEXT,
      question TEXT,
      context TEXT,
      PRIMARY KEY (subdomain, question),
      FOREIGN KEY(subdomain) REFERENCES agents(subdomain) ON DELETE CASCADE
    )
  `);
  console.log('Table "contexts" initialized');
} catch (error) {
  console.error('Error initializing table "contexts":', error);
}

try {
  db.run(`
    CREATE TABLE domains (
      domain TEXT PRIMARY KEY,
      subdomain TEXT,
      custom_script_path TEXT,
      FOREIGN KEY(subdomain) REFERENCES agents(subdomain) ON DELETE SET NULL
    )
  `);
  console.log('Table "domains" initialized');
} catch (error) {
  console.error('Error initializing table "domains":', error);
}

console.log('Database initialized at path:', values.path);