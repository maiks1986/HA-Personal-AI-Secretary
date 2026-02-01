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
let db;
function initDatabase() {
    const dbPath = process.env.NODE_ENV === 'development'
        ? path_1.default.join(__dirname, '../../whatsapp.db')
        : '/data/whatsapp.db';
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    db = new better_sqlite3_1.default(dbPath);
    db.pragma('journal_mode = WAL');
    // 1. Core Tables
    db.prepare(`
        CREATE TABLE IF NOT EXISTS instances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            ha_user_id TEXT,
            status TEXT DEFAULT 'disconnected',
            presence TEXT DEFAULT 'available',
            qr TEXT,
            last_seen DATETIME
        )
    `).run();
    db.prepare(`
        CREATE TABLE IF NOT EXISTS chats (
            instance_id INTEGER,
            jid TEXT NOT NULL,
            name TEXT,
            unread_count INTEGER DEFAULT 0,
            last_message_text TEXT,
            last_message_timestamp DATETIME,
            is_archived INTEGER DEFAULT 0,
            is_pinned INTEGER DEFAULT 0,
            is_fully_synced INTEGER DEFAULT 0,
            PRIMARY KEY (instance_id, jid)
        )
    `).run();
    db.prepare(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            instance_id INTEGER,
            whatsapp_id TEXT UNIQUE,
            chat_jid TEXT,
            sender_jid TEXT,
            sender_name TEXT,
            text TEXT,
            type TEXT DEFAULT 'text',
            media_path TEXT,
            latitude REAL,
            longitude REAL,
            vcard_data TEXT,
            status TEXT DEFAULT 'sent',
            timestamp DATETIME,
            is_from_me INTEGER DEFAULT 0,
            parent_message_id TEXT
        )
    `).run();
    db.prepare(`
        CREATE TABLE IF NOT EXISTS contacts (
            instance_id INTEGER,
            jid TEXT NOT NULL,
            name TEXT,
            PRIMARY KEY (instance_id, jid)
        )
    `).run();
    db.prepare(`
        CREATE TABLE IF NOT EXISTS status_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            instance_id INTEGER,
            sender_jid TEXT,
            sender_name TEXT,
            type TEXT,
            text TEXT,
            media_path TEXT,
            timestamp DATETIME
        )
    `).run();
    db.prepare(`
        CREATE TABLE IF NOT EXISTS reactions (
            instance_id INTEGER,
            message_whatsapp_id TEXT,
            sender_jid TEXT,
            emoji TEXT,
            PRIMARY KEY (instance_id, message_whatsapp_id, sender_jid)
        )
    `).run();
    // Settings Table Migration (Handle Legacy Global)
    const settingsInfo = db.prepare("PRAGMA table_info(settings)").all();
    if (!settingsInfo.find(c => c.name === 'instance_id')) {
        console.log('MIGRATION: Upgrading settings table to support instances...');
        db.transaction(() => {
            db.prepare('ALTER TABLE settings RENAME TO settings_old').run();
            db.prepare(`
                CREATE TABLE settings (
                    instance_id INTEGER DEFAULT 0,
                    key TEXT,
                    value TEXT,
                    PRIMARY KEY (instance_id, key)
                )
            `).run();
            // Migrate old settings as Global (ID 0)
            db.prepare('INSERT INTO settings (instance_id, key, value) SELECT 0, key, value FROM settings_old').run();
            db.prepare('DROP TABLE settings_old').run();
        })();
    }
    else {
        // Ensure table exists if fresh install
        db.prepare(`
            CREATE TABLE IF NOT EXISTS settings (
                instance_id INTEGER DEFAULT 0,
                key TEXT,
                value TEXT,
                PRIMARY KEY (instance_id, key)
            )
        `).run();
    }
    db.prepare(`
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT,
            is_admin INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
    db.prepare(`
        CREATE TABLE IF NOT EXISTS stealth_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            instance_id INTEGER,
            name TEXT,
            start_time TEXT,
            end_time TEXT,
            days TEXT,
            mode TEXT,
            is_enabled INTEGER DEFAULT 1
        )
    `).run();
    db.prepare(`
        CREATE TABLE IF NOT EXISTS stealth_targets (
            schedule_id INTEGER,
            contact_jid TEXT,
            PRIMARY KEY (schedule_id, contact_jid)
        )
    `).run();
    db.prepare(`
        CREATE TABLE IF NOT EXISTS tracked_contacts (
            instance_id INTEGER,
            jid TEXT,
            last_online DATETIME,
            today_duration INTEGER DEFAULT 0,
            PRIMARY KEY (instance_id, jid)
        )
    `).run();
    // 2. MIGRATIONS (Ensure columns exist for legacy databases)
    const tables = ['chats', 'messages', 'instances'];
    // Helper to add column if it doesn't exist
    const ensureColumn = (table, column, definition) => {
        const info = db.prepare(`PRAGMA table_info(${table})`).all();
        if (!info.find(c => c.name === column)) {
            console.log(`MIGRATION: Adding column '${column}' to table '${table}'`);
            db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
        }
    };
    // Chat Migrations
    ensureColumn('chats', 'is_archived', 'INTEGER DEFAULT 0');
    ensureColumn('chats', 'is_pinned', 'INTEGER DEFAULT 0');
    ensureColumn('chats', 'is_fully_synced', 'INTEGER DEFAULT 0');
    // Message Migrations
    ensureColumn('messages', 'whatsapp_id', 'TEXT');
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_whatsapp_id ON messages(whatsapp_id)').run();
    ensureColumn('messages', 'type', "TEXT DEFAULT 'text'");
    ensureColumn('messages', 'media_path', 'TEXT');
    ensureColumn('messages', 'latitude', 'REAL');
    ensureColumn('messages', 'longitude', 'REAL');
    ensureColumn('messages', 'vcard_data', 'TEXT');
    ensureColumn('messages', 'parent_message_id', 'TEXT');
    ensureColumn('messages', 'status', "TEXT DEFAULT 'sent'");
    // Contact Migrations
    ensureColumn('contacts', 'lid', 'TEXT');
    ensureColumn('contacts', 'profile_picture', 'TEXT');
    // Ephemeral Message Migrations
    ensureColumn('chats', 'ephemeral_mode', 'INTEGER DEFAULT 0');
    ensureColumn('chats', 'ephemeral_timer', 'INTEGER DEFAULT 60'); // Minutes
    ensureColumn('chats', 'ephemeral_start_timestamp', 'DATETIME');
    ensureColumn('messages', 'deleted_on_device', 'INTEGER DEFAULT 0');
    // Default Settings for Ephemeral Triggers
    const ensureSetting = (key, value) => {
        db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    };
    ensureSetting('ephemeral_trigger_start', '👻');
    ensureSetting('ephemeral_trigger_stop', '🛑');
    // Profile Picture Migrations
    ensureColumn('chats', 'profile_picture', 'TEXT');
    ensureColumn('chats', 'profile_picture_timestamp', 'DATETIME');
    ensureColumn('contacts', 'profile_picture_timestamp', 'DATETIME');
    console.log('DATABASE: Initialization and Migrations complete.');
}
function getDb() {
    return db;
}
