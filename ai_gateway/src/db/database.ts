import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import pino from 'pino';

const logger = pino();
let db: Database.Database;

export function initDatabase() {
    const dbPath = process.env.NODE_ENV === 'development' 
        ? path.join(__dirname, '../../ai_gateway.db')
        : '/data/ai_gateway.db';

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // 1. Registered Add-ons Registry
    db.prepare(`
        CREATE TABLE IF NOT EXISTS addons (
            slug TEXT PRIMARY KEY,
            port INTEGER,
            version TEXT,
            capabilities TEXT, -- JSON array
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // 2. Shared Memory / Interactions
    db.prepare(`
        CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT,
            role TEXT,
            sender_id TEXT,
            prompt TEXT,
            reply TEXT,
            metadata TEXT, -- JSON object
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // 3. Global Settings
    db.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `).run();

    // 4. API Keys Management
    db.prepare(`
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT DEFAULT 'gemini', -- gemini, openai, anthropic
            type TEXT DEFAULT 'static', -- static, oauth
            key_value TEXT NOT NULL, -- Actual key OR JSON string of tokens
            label TEXT,
            is_active INTEGER DEFAULT 1,
            error_count INTEGER DEFAULT 0,
            last_used DATETIME
        )
    `).run();

    // Migrations for existing tables
    const info = db.prepare('PRAGMA table_info(api_keys)').all() as any[];
    if (!info.find(c => c.name === 'type')) {
        logger.info('MIGRATION: Adding type column to api_keys');
        db.prepare("ALTER TABLE api_keys ADD COLUMN type TEXT DEFAULT 'static'").run();
    }

    logger.info('DATABASE: AI Gateway initialization complete.');
}

export function getDb() {
    return db;
}
