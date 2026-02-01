"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAndSyncConfig = loadAndSyncConfig;
const fs_1 = require("fs");
const database_1 = require("./db/database");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)();
const OPTIONS_PATH = '/data/options.json';
function loadAndSyncConfig() {
    if ((0, fs_1.existsSync)(OPTIONS_PATH)) {
        try {
            const options = JSON.parse((0, fs_1.readFileSync)(OPTIONS_PATH, 'utf-8'));
            const db = (0, database_1.getDb)();
            if (options.google_client_id) {
                db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
                    .run('google_client_id', options.google_client_id);
            }
            if (options.google_client_secret) {
                db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
                    .run('google_client_secret', options.google_client_secret);
            }
            if (options.google_redirect_uri) {
                db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
                    .run('google_redirect_uri', options.google_redirect_uri);
            }
            logger.info('AI Gateway: Synced HA options to database settings.');
        }
        catch (e) {
            logger.error(`AI Gateway: Failed to sync HA options: ${e.message}`);
        }
    }
}
