"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getDb = getDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)();
let db;
function initDatabase() {
    const dbPath = process.env.NODE_ENV === 'development'
        ? path_1.default.join(__dirname, '../../ai_gateway.db')
        : '/data/ai_gateway.db';
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    db = new better_sqlite3_1.default(dbPath);
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
    const info = db.prepare('PRAGMA table_info(api_keys)').all();
    if (!info.find(c => c.name === 'type')) {
        logger.info('MIGRATION: Adding type column to api_keys');
        db.prepare("ALTER TABLE api_keys ADD COLUMN type TEXT DEFAULT 'static'").run();
    }
    logger.info('DATABASE: AI Gateway initialization complete.');
}
function getDb() {
    return db;
}
