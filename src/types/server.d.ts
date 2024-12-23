
interface IFiles {
    upload(file: File): Promise<string>;
    getUrl(cid: string, expires: number): Promise<string>;
    createTemporaryAdminKey(): Promise<any>;
}

interface IAssets {
  build(): Promise<void>;
  getAsset(name: AssetName): BunFile;
  getLink(name: AssetName): string;
  getAssetByPath(path: string): BunFile;
  getAssetByName(name: string): BunFile;
}

type AssetName = keyof typeof assets; 

type IConstants = { BASE_URL: string };

interface IConfig {
  get(key: ConfigKeys): string;
}

type ConfigKeys = 'DB_NAME' | 'BUN_PORT' | 'OPENAI_API_KEY' | 'PINATA_JWT' | 'PINATA_GATEWAY_URL' | 'TWITTER_API_KEY' | 'TWITTER_API_SECRET' | 'BASE_URL' | 'CREATE_AGENT_SECRET' | 'DALLE_API_KEY';

type Wallet = {
  subdomain: string;
  public_key: string;
  private_key: string;
};

type Chat = {
  id: string;
  question: string;
  response: string;
  subdomain: string;
  timestamp: string;
  twitter_post_link?: string;
};

type Agent = {
  subdomain: string;
  name: string;
  titles: string;
  suggestions: string;
  prompt: string;
  workflow: string;
  imageCid: string;
};

type Link = {
  subdomain: string;
  type: string;
  value: string;
};

type TwitterBot = {
  subdomain: string;
  oauth_token: string;
  oauth_token_secret: string;
  user_id: string;
  screen_name: string;
};

type TelegramBot = {
  subdomain: string;
  bot_token: string;
  group_id: string;
};

type Context = {
  subdomain: string;
  question: string;
  context: string;
};

type Domain = {
  domain: string;
  subdomain: string;
  custom_script_path: string;
};
