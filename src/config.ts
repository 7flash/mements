import { type IConfig } from "./index";

type ConfigKeys = 'DB_NAME' | 'BUN_PORT';

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

  static init(requiredEnvVars: any): Config {
    try {
      return new Config(requiredEnvVars);
    } catch (error) {
      console.error("Configuration initialization failed:", error);
      process.exit(1);
    }
  }

  get(key: ConfigKeys): string {
    if (!(key in this.config)) {
      throw new Error(`Configuration key ${key.toString()} is not available.`);
    }
    return this.config[key];
  }
}

export default function(envVariables: any) {
  return Config.init(envVariables);
}