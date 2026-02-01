import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getDb } from './db/database';
import pino from 'pino';

const logger = pino();

export interface Config {
    googleClientId: string;
    googleClientSecret: string;
    internalApiKey: string;
}

const OPTIONS_PATH = '/data/options.json';

export function loadAndSyncConfig() {
    if (existsSync(OPTIONS_PATH)) {
        try {
            const options = JSON.parse(readFileSync(OPTIONS_PATH, 'utf-8'));
            const db = getDb();

            if (options.google_client_id) {
                db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
                    .run('google_client_id', options.google_client_id);
            }
            if (options.google_client_secret) {
                db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
                    .run('google_client_secret', options.google_client_secret);
            }
            
            logger.info('AI Gateway: Synced HA options to database settings.');
        } catch (e: any) {
            logger.error(`AI Gateway: Failed to sync HA options: ${e.message}`);
        }
    }
}
