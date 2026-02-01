"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyManager = void 0;
const database_1 = require("../db/database");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)();
class KeyManager {
    /**
     * Get the next available key for a provider using a round-robin or least-error strategy.
     */
    static async getNextKey(provider = 'gemini') {
        const db = (0, database_1.getDb)();
        const key = db.prepare(`
            SELECT * FROM api_keys 
            WHERE provider = ? AND is_active = 1 
            ORDER BY error_count ASC, last_used ASC 
            LIMIT 1
        `).get(provider);
        if (!key) {
            logger.warn(`KeyManager: No active keys found for provider '${provider}'`);
            return null;
        }
        // Simplified: Just extract access token if it's a JSON blob, but no auto-refresh.
        if (key.type === 'oauth') {
            try {
                const tokens = JSON.parse(key.key_value);
                return { ...key, key_value: tokens.access_token };
            }
            catch (e) {
                return key;
            }
        }
        // Update last_used immediately to rotate
        db.prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(key.id);
        return key;
    }
    /**
     * Report a key failure. If errors exceed a threshold, disable it.
     */
    static reportFailure(keyId) {
        const db = (0, database_1.getDb)();
        const MAX_ERRORS = 5;
        const row = db.prepare('SELECT error_count FROM api_keys WHERE id = ?').get(keyId);
        if (!row)
            return;
        const newCount = row.error_count + 1;
        let isActive = 1;
        if (newCount >= MAX_ERRORS) {
            logger.error(`KeyManager: Key ID ${keyId} has exceeded max errors (${MAX_ERRORS}). Disabling.`);
            isActive = 0;
        }
        else {
            logger.warn(`KeyManager: Recorded error for Key ID ${keyId} (Count: ${newCount})`);
        }
        db.prepare('UPDATE api_keys SET error_count = ?, is_active = ? WHERE id = ?').run(newCount, isActive, keyId);
    }
    /**
     * Reset error counts for a specific key (e.g. if it works again)
     */
    static reportSuccess(keyId) {
        const db = (0, database_1.getDb)();
        db.prepare('UPDATE api_keys SET error_count = 0 WHERE id = ?').run(keyId);
    }
    // --- Management Methods ---
    static addKey(provider, keyValue, label = '', type = 'static') {
        const db = (0, database_1.getDb)();
        db.prepare(`
            INSERT INTO api_keys (provider, key_value, label, is_active, error_count, type)
            VALUES (?, ?, ?, 1, 0, ?)
        `).run(provider, keyValue, label, type);
        logger.info(`KeyManager: Added new ${provider} key (Type: ${type}).`);
    }
    static removeKey(id) {
        const db = (0, database_1.getDb)();
        db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
        logger.info(`KeyManager: Removed key ID ${id}`);
    }
    static listKeys() {
        const db = (0, database_1.getDb)();
        const keys = db.prepare('SELECT id, provider, label, is_active, error_count, last_used, key_value, type FROM api_keys').all();
        // Return masked keys for UI
        return keys.map(k => {
            let masked = '********';
            if (k.type === 'static' && k.key_value.length > 8) {
                masked = `${k.key_value.substring(0, 4)}...${k.key_value.substring(k.key_value.length - 4)}`;
            }
            else if (k.type === 'oauth') {
                masked = 'OAuth Token (Refreshable)';
            }
            return { ...k, key_value: masked };
        });
    }
}
exports.KeyManager = KeyManager;
