import fs from 'fs';
import path from 'path';

export interface Config {
  port: number;
  dataDir: string;
  jwtSecret: string; // Temporary for now, later RSA keys
  logLevel: string;
}

const OPTIONS_PATH = '/data/options.json';
const DEFAULT_CONFIG: Config = {
  port: 5006,
  dataDir: process.platform === 'win32' ? './data' : '/data',
  jwtSecret: 'dev-secret-change-me',
  logLevel: 'info',
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
    } catch (e) {
      console.error('Failed to parse options.json', e);
    }
  }

  // 2. Environment variables override
  if (process.env.PORT) config.port = parseInt(process.env.PORT);
  if (process.env.DATA_DIR) config.dataDir = process.env.DATA_DIR;
  if (process.env.JWT_SECRET) config.jwtSecret = process.env.JWT_SECRET;
  
  // Ensure data dir exists
  const absoluteDataDir = path.resolve(config.dataDir);
  console.log(`Configured Data Directory: ${config.dataDir} (Absolute: ${absoluteDataDir})`);
  
  if (!fs.existsSync(absoluteDataDir)) {
      console.log(`Creating data directory: ${absoluteDataDir}`);
      try {
          fs.mkdirSync(absoluteDataDir, { recursive: true });
      } catch (e) {
          console.error(`Failed to create data directory ${absoluteDataDir}:`, e);
      }
  }

  return config;
}

export const CONFIG = loadConfig();
