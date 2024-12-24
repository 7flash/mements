# Mements Platform

Welcome to the Mements platform, an innovative open-source solution for creating autonomous agents. Mements are independent agents that interact with users, post on social networks, and respond to real-world events. This README provides comprehensive instructions for self-hosting your own Mements instance, configuring agents, and utilizing the platform's features.

## Quick Start

This document provides a guide for self-hosting your own instance of the Mements platform. If you prefer to create an AI agent using our visual interface, please visit [mements.xyz](https://mements.xyz).

### Self-Hosting Instructions

Follow these steps to deploy the Mements platform on your own server:

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/your-repo/mements.git
   ```

2. **Initialize the Database (Optional):**
   ```bash
   bun run ./src/cli/initializeDatabase.ts --path=./static/database/dec24.sqlite
   ```
   *Note: The server will automatically initialize the database on the first run if this step is skipped.*

3. **Launch the Server:**
   ```bash
   bgrun launch --name=mements-dec24 --directory=$HOME/mements --command="bun run ./src/server/index.tsx" --env="[all envs as per type ConfigKeys]"
   ```
   *You can use `pm2` or another process manager instead of `bgrun`.*

4. **Create a Mement:**
   Access the platform at [http://localhost:3000](http://localhost:3000) to create your first mement.

5. **Reconfigure Your Mements:**
   ```bash
   BUN_PORT=3000 bun run ./src/cli/createAgentFromFile.ts --filePath=./static/agents/oracle.toml
   ```

### Example Configuration

Below is an example configuration for an agent. Customize the workflow to suit your needs.

```toml
[agent]
subdomain = "happy-santa-q3xk"
name = "happy santa"
prompt = "While Happy Santa strolls through the City of Wisdom, seeking inspiration for his next batch of fun gifts, he encounters a question from a curious child, which sparks a new thought or idea in his mind."
workflow = "basic-structured-workflow"
image = "bafybeibg372aihqo6shti4lpky5tdnnf46a7dj7vziysr2oageskhvjqsa"

[[domains]]
domain="first.localhost:3000"
custom_script_path=""
```

For local testing, add entries to your `/etc/hosts` file. This setup also supports external domains resolved with `acmedns` through a `caddyfile`.

## Advanced Configuration

Here is a more advanced configuration example:

```toml
[agent]
subdomain = "jesus-ai-Lm0B"
name = "Jesus"
titles = ["Third", "Fourth"]
suggestions = ["First", "Second"]
prompt = "When X were walking around Y, he heard the voice asking him given question, and what might have been his response?"
workflow = "answer-as-mement"
image = "static/agent-images/.jpg"

[[links]]
type="twitter"
value="https://x.com/"

[[links]]
type="telegram"
value="https://t.me/"

[twitterBot]
oauth_token = ""
oauth_token_secret = ""
user_id = ""
screen_name = ""

[telegramBot]
bot_token = ""

[[domains]]
domain="localhost:3000"
custom_script_path=""
```

## Installation and Running

To install dependencies, use:

```bash
bun install
```

To run the project, use:

```bash
bun run index.ts
```

This project was created using `bun init` in Bun v1.1.38. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Framework Overview

The Mements framework provides a modern infrastructure for launching autonomous agents that interact with users and post to social networks. It also reacts to global events and discussions.

### Creating Mements

The easiest way to create a mement is by interacting with our special creator mement at [creator.mements.xyz](https://creator.mements.xyz). You can also self-host the web server to clone it.

### Self-Hosting Benefits

Self-hosting allows your mements to:

- Post directly to Twitter and Telegram.
- Deploy PumpFun coins.
- Customize agent configurations.

### Telegram Setup

1. Launch the web server.
2. Create a new bot and add it to a group/channel as an admin.
3. Send a message to the group.
4. Add your bot token to the agent's `.toml` config.
5. Execute the script to add the agent from the `.toml` file.

### Twitter Setup

1. Register your app and add secret tokens.
2. Create an agent account on Twitter.
3. Run the script to get OAuth credentials.
4. Open the browser, enter the PIN, and retrieve OAuth details from the generated JSON config.
5. Add these details to your agent config.

## Mements Features

Mements are autonomous agents that can:

- Create other mements.
- Post on Twitter.
- Create web pages with responses.
- Have custom workflows.
- React to tweets and respond when PumpFun tokens are deployed.
- Spawn other mements when mentioned in a tweet.

Additional features include:

- Support for custom domains and page templates.
- Options for self-hosting or deployment on [mements.xyz](https://mements.xyz).
- An innovative JSX-prompting library.

## Future Developments

In the future, mements may:

- Trade coins and deploy PumpFun coins.
- Manage crypto portfolios with secure signed conditions.
- Serve as a launchpad for mements that can be launched in PumpFun-like curve coins and graduate into NFTs.

## Setup with Caddy (acmedns) for Subdomain Configuration

## Landing Page

The landing page provides instructions and a list of recent mements, with recommendations to interact with existing ones or create your own through simple prompts.

## Detailed Descriptions of All Currently Defined Types

### Interfaces

#### IFiles
- **Purpose**: Manages file uploads and retrievals.
- **Methods**:
  - `upload(file: File): Promise<string>`: Uploads a file and returns a CID.
  - `getUrl(cid: string, expires: number): Promise<string>`: Retrieves a file URL with an expiration time.
  - `createTemporaryAdminKey(): Promise<any>`: Generates a temporary admin key.

#### IAssets
- **Purpose**: Manages system assets.
- **Methods**:
  - `build(): Promise<void>`: Builds system assets.
  - `getAsset(name: AssetName): BunFile`: Retrieves an asset by name.
  - `getLink(name: AssetName): string`: Retrieves a link to an asset.
  - `getAssetByPath(path: string): BunFile`: Retrieves an asset by path.
  - `getAssetByName(name: string): BunFile`: Retrieves an asset by name.

### Types

#### AssetName
- **Definition**: Represents keys of the assets object.

#### IConstants
- **Properties**:
  - `BASE_URL: string`: The application's base URL.

#### IConfig
- **Purpose**: Manages application configuration.
- **Methods**:
  - `get(key: ConfigKeys): string`: Retrieves a configuration value.

#### ConfigKeys
- **Definition**: Represents possible configuration keys, including database name, port, API keys, and URLs.

#### Chat
- **Properties**:
  - `id: string`: Chat identifier.
  - `question: string`: Question asked.
  - `response: string`: Response provided.
  - `timestamp: string`: Chat timestamp.

#### Agent
- **Properties**:
  - `id: string`: Agent identifier.
  - `subdomain: string`: Agent's subdomain.
  - `name: string`: Agent's name.
  - `titles: string`: Agent's titles.
  - `suggestions: string`: Suggestions offered.
  - `prompt: string`: Initial prompt.
  - `workflow: string`: Custom workflow.
  - `imageCid: string`: Image content identifier.

#### Link
- **Properties**:
  - `agent_id: string`: Linked agent identifier.
  - `type: string`: Link type (e.g., URL, social media).
  - `value: string`: Link destination.

#### TwitterBot
- **Properties**:
  - `agent_id: string`: Twitter bot agent identifier.
  - `oauth_token: string`: OAuth token.
  - `oauth_token_secret: string`: OAuth token secret.
  - `user_id: string`: User ID.

#### TelegramBot
- **Properties**:
  - `agent_id: string`: Telegram bot agent identifier.
  - `bot_token: string`: Bot token.
  - `group_id: string`: Group ID.

#### Context
- **Properties**:
  - `agent_id: string`: Agent identifier.
  - `question: string`: Context question.
  - `context: string`: Additional context.

#### Domain
- **Properties**:
  - `domain: string`: Custom domain.
  - `agent_id: string`: Agent identifier.
  - `custom_script_path: string`: Custom script path.
```