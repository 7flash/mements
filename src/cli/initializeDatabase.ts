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
  const migrateAgentsTable = () => {
    const data = db.query('SELECT subdomain, name, prompt, workflow, imageCid FROM agents').all();
    db.run('DROP TABLE IF EXISTS agents');
    db.run(`
      CREATE TABLE agents (
        subdomain TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prompt TEXT,
        workflow TEXT
      )
    `);
    db.run(`
      CREATE TABLE images (
        subdomain TEXT,
        imageKey TEXT,
        imageCid TEXT,
        PRIMARY KEY (subdomain, imageKey),
        FOREIGN KEY(subdomain) REFERENCES agents(subdomain) ON DELETE CASCADE
      )
    `);
    for (const row of data) {
      db.run('INSERT INTO agents (subdomain, name, prompt, workflow) VALUES (?, ?, ?, ?)', 
        [row.subdomain, row.name, row.prompt, row.workflow]);
      if (row.imageCid) {
        db.run('INSERT INTO images (subdomain, imageKey, imageCid) VALUES (?, ?, ?)', 
          [row.subdomain, 'default', row.imageCid]);
      }
    }
  };

  db.transaction(migrateAgentsTable)();
  console.log('Table "agents" and "images" initialized with migration');
} catch (error) {
  console.error('Error initializing or migrating table "agents":', error);
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
```