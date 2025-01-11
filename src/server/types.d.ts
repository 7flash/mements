type OptimizeImageOptions = {
  width?: number;
  height?: number;
  dpr?: number;
  fit?: "scaleDown" | "contain" | "cover" | "crop" | "pad";
  gravity?: "auto" | "side" | string;
  quality?: number;
  format?: "auto" | "webp";
  animation?: boolean;
  sharpen?: number;
  onError?: boolean;
  metadata?: "keep" | "copyright" | "none";
};

interface IFiles {
  upload(file: File): Promise<string>;
  getUrl(cid: string, expires: number, options?: OptimizeImageOptions): Promise<string>;
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

type IConstants = { BASE_URL: string, TWITTER_ACCOUNT: string, CONTRACT_ADDRESS: string, TELEGRAM_ACCOUNT: string };

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
  prompt: string;
  workflow: string;
};

type Image = {
  subdomain: string;
  image_key: string;
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

type CustomInfo = {
  subdomain: string;
  info: string;
};