import fs from 'fs';
import path from 'path';

export interface Config {
  port: number;
  dataDir: string;
  jwtSecret: string; // Temporary for now, later RSA keys
  logLevel: string;
  internalToken: string;
}

const OPTIONS_PATH = '/data/options.json';
const DEFAULT_CONFIG: Config = {
  port: 5006,
  dataDir: process.platform === 'win32' ? './data' : '/data',
  jwtSecret: 'dev-secret-change-me',
  logLevel: 'info',
  internalToken: 'change-me-for-security',
};

export function loadConfig(): Config {
  let config = { ...DEFAULT_CONFIG };

  // 1. Try to load from HA options.json
  if (fs.existsSync(OPTIONS_PATH)) {
    try {
      const options = JSON.parse(fs.readFileSync(OPTIONS_PATH, 'utf-8'));
      console.log('Loaded options from HA:', options);
      // Map generic HA options if needed
      if (options.log_level) config.logLevel = options.log_level;
      if (options.internal_token) config.internalToken = options.internal_token;
    } catch (e) {
      console.error('Failed to parse options.json', e);
    }
  }

  // 2. Environment variables override
  if (process.env.PORT) config.port = parseInt(process.env.PORT);
  if (process.env.DATA_DIR) config.dataDir = process.env.DATA_DIR;
  if (process.env.JWT_SECRET) config.jwtSecret = process.env.JWT_SECRET;
  if (process.env.INTERNAL_TOKEN) config.internalToken = process.env.INTERNAL_TOKEN;
  
  // Ensure data dir exists
  if (!fs.existsSync(config.dataDir)) {
      console.log(`Creating data directory: ${config.dataDir}`);
      try {
          fs.mkdirSync(config.dataDir, { recursive: true });
      } catch (e) {
          console.error(`Failed to create data directory ${config.dataDir}:`, e);
      }
  }

  return config;
}

export const CONFIG = loadConfig();
