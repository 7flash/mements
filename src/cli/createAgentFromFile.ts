import path from 'path';
import ShortUniqueId from "short-unique-id";
import { parseArgs } from 'util';
import Constants from '../server/constants';

const { randomUUID } = new ShortUniqueId({ length: 10 });

function parseMarkdown(content: string) {
  const lines = content.split('\n');
  let name = '';
  let titles: string[] = [];
  let suggestions: string[] = [];
  let prompt = '';
  let workflow = '';
  let imageField = '';
  let currentSection = '';
  let newAgentSubdomain = '';

  let domains: Domain[] = [];
  let links: Link[] = [];
  let twitterBot: Partial<TwitterBot> = {};
  let telegramBot: Partial<TelegramBot> = {};

  for (const line of lines) {
    if (line.startsWith('# name')) {
      currentSection = 'name';
    } else if (line.startsWith('# titles')) {
      currentSection = 'titles';
    } else if (line.startsWith('# suggestions')) {
      currentSection = 'suggestions';
    } else if (line.startsWith('# prompt')) {
      currentSection = 'prompt';
    } else if (line.startsWith('# workflow')) {
      currentSection = 'workflow';
    } else if (line.startsWith('# image')) {
      currentSection = 'image';
    } else if (line.startsWith('# subdomain')) {
      currentSection = 'subdomain';
    } else if (line.startsWith('# domains')) {
      currentSection = 'domains';
    } else if (line.startsWith('# links')) {
      currentSection = 'links';
    } else if (line.startsWith('# twitter_bots')) {
      currentSection = 'twitter_bots';
    } else if (line.startsWith('# telegram_bots')) {
      currentSection = 'telegram_bots';
    } else if (line.trim()) {
      if (currentSection === 'name') {
        name = line.trim();
      } else if (currentSection === 'titles') {
        titles.push(line.trim());
      } else if (currentSection === 'suggestions') {
        suggestions.push(line.trim());
      } else if (currentSection === 'prompt') {
        prompt = line.trim();
      } else if (currentSection === 'workflow') {
        workflow = line.trim();
      } else if (currentSection === 'image') {
        imageField = line.trim();
      } else if (currentSection === 'subdomain') {
        newAgentSubdomain = line.trim();
      } else if (currentSection === 'domains') {
        const [domain, customScriptPath] = line.split('||');
        domains.push({
          domain: domain.trim(), custom_script_path: customScriptPath?.trim(),
          agent_id: ''
        });
      } else if (currentSection === 'links') {
        const [type, value] = line.split('||');
        links.push({ agent_id: '', type: type.trim(), value: value.trim() });
      } else if (currentSection === 'twitter_bots') {
        const [oauthToken, oauthTokenSecret, userId] = line.split('||');
        twitterBot = { agent_id: '', oauth_token: oauthToken.trim(), oauth_token_secret: oauthTokenSecret.trim(), user_id: userId.trim() };
      } else if (currentSection === 'telegram_bots') {
        const [botToken, groupId] = line.split('||');
        telegramBot = { agent_id: '', bot_token: botToken.trim(), group_id: groupId.trim() };
      }
    }
  }

  return {
    name,
    titles,
    suggestions,
    prompt,
    workflow,
    imageField,
    subdomain: newAgentSubdomain,
    domains,
    links,
    twitterBot,
    telegramBot
  };
}

async function createAgent(parsedData: any) {
  const {
    name, titles, suggestions, prompt, workflow, imageField,
    subdomain, domains, links, twitterBot, telegramBot
  } = parsedData;

  const agent: Partial<Agent> = {
    id: randomUUID(),
    name,
    subdomain,
    titles: JSON.stringify(titles),
    suggestions: JSON.stringify(suggestions),
    prompt,
    workflow,
    image: imageField,
  };

  if (links) {
    links.forEach((link: { agent_id: string | undefined; }) => link.agent_id = agent.id);
  }
  if (twitterBot) {
    twitterBot.agent_id = agent.id;
  }
  if (telegramBot) {
    telegramBot.agent_id = agent.id;
  }
  if (domains) {
    domains.forEach((domain: Domain) => {
      domain.custom_script_path ??= "./apps/ask-agent";
      domain.agent_id = agent.id!;
    });
  }

  const body = JSON.stringify({ agent, links, twitterBot, telegramBot, domains });
  console.log("body ==> ", body);

  const response = await fetch(`${Constants.BASE_URL}/createAgent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CREATE_AGENT_TOKEN}`
    },
    body: body,
  });

  if (!response.ok) {
    throw new Error(`Failed to create agent: ${response.statusText}`);
  }

  console.log(`Agent ${name} created successfully.`);
}

async function main() {
  const args = parseArgs({
    args: Bun.argv,
    options: {
      filePath: {
        type: 'string',
      },
    },
    strict: true,
    allowPositionals: true,
  });

  const filePath = path.join(process.cwd(), args.values.filePath!);
  console.log("filePath ==> ", filePath);

  const fileContent = await Bun.file(filePath).text();

  let parsedData;
  if (filePath.endsWith('.toml')) {
    parsedData = (await import(filePath)).default;
  } else if (filePath.endsWith('.md')) {
    parsedData = parseMarkdown(fileContent);
  } else {
    console.error('Unsupported file format. Please provide a .toml or .md file.');
    process.exit(1);
  }

  console.log("parsedData ==> ", parsedData);

  try {
      const response = await fetch(`${Constants.BASE_URL}/createAgent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CREATE_AGENT_SECRET}`
        },
        body: JSON.stringify(parsedData),
      });
      console.log("response ==> ", await response.text());
    } catch (error) {
    console.error('Error creating agent:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error in main function:', err);
  process.exit(1);
});