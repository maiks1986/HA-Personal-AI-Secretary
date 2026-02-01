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
  dataDir: './data',
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
  if (!fs.existsSync(config.dataDir)) {
      // In dev mode (Windows), ./data might not exist
      if (process.platform === 'win32') {
          // Use local dir
          if (!fs.existsSync('./data')) fs.mkdirSync('./data');
          config.dataDir = './data';
      } else {
          // On Linux/HA, /data should exist. If not, we can't do much.
          console.warn('/data directory missing!');
      }
  }

  return config;
}

export const CONFIG = loadConfig();
