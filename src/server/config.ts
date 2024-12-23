 class Config implements IConfig {
  private config: Record<ConfigKeys, string>;

  private constructor(requiredEnvVars: ConfigKeys[]) {
    this.config = {} as Record<ConfigKeys, string>;
    for (const varName of requiredEnvVars) {
      const value = process.env[varName];
      if (!value) {
        throw new Error(`Environment variable ${varName} is required but not set.`);
      }
      this.config[varName] = value;
    }
  }

  static init(requiredEnvVars: ConfigKeys[]): Config {
    try {
      return new Config(requiredEnvVars);
    } catch (error) {
      console.error("Configuration initialization failed:", error);
      process.exit(1);
    }
  }

  get(key: ConfigKeys): string {
    if (!(key in this.config)) {
      throw new Error(`Configuration key ${key} is not defined in required variables and therefore not available.`);
    }
    return this.config[key];
  }
}

export default Config.init([
'DB_NAME', 'BUN_PORT', 'OPENAI_API_KEY', 'PINATA_JWT', 'PINATA_GATEWAY_URL', 'TWITTER_API_KEY', 'TWITTER_API_SECRET', 'CREATE_AGENT_SECRET', 'DALLE_API_KEY'
]);
