import fs from 'fs';
import path from 'path';

export interface AppConfig {
  google_client_id: string;
  google_client_secret: string;
  internal_token: string;
  debug_logging: boolean;
}

export function loadConfig(): AppConfig {
  const optionsPath = process.env.OPTIONS_PATH || '/data/options.json';
  
  if (fs.existsSync(optionsPath)) {
    try {
      return JSON.parse(fs.readFileSync(optionsPath, 'utf8'));
    } catch (err) {
      console.error('Failed to parse options.json', err);
    }
  }

  // Fallback for development
  return {
    google_client_id: process.env.GOOGLE_CLIENT_ID || '',
    google_client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    internal_token: process.env.INTERNAL_TOKEN || 'change-me-for-security',
    debug_logging: process.env.DEBUG_LOGGING === 'true'
  };
}
