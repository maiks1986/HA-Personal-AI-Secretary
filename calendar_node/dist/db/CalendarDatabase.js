"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarDatabase = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});
const DB_PATH = process.env.DB_PATH || '/data/calendar.db';
class CalendarDatabase {
    db;
    constructor() {
        const dir = path_1.default.dirname(DB_PATH);
        console.log(`[DB] Using database path: ${DB_PATH}`);
        if (!fs_1.default.existsSync(dir)) {
            console.log(`[DB] Creating directory: ${dir}`);
            try {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            catch (err) {
                console.error(`[DB] Failed to create directory ${dir}:`, err);
            }
        }
        try {
            this.db = new better_sqlite3_1.default(DB_PATH);
            this.init();
        }
        catch (err) {
            console.error(`[DB] CRITICAL: Failed to open database at ${DB_PATH}:`, err);
            throw err;
        }
    }
    init() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        config TEXT, -- JSON
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS calendars (
        id TEXT PRIMARY KEY,
        instance_id TEXT,
        external_id TEXT, -- Google ID or Feed URL
        summary TEXT,
        role TEXT DEFAULT 'ignore',
        sync_token TEXT,
        last_sync TEXT,
        FOREIGN KEY(instance_id) REFERENCES instances(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        calendar_id TEXT,
        instance_id TEXT,
        summary TEXT,
        description TEXT,
        start_time TEXT,
        end_time TEXT,
        location TEXT,
        status TEXT,
        updated TEXT,
        raw_json TEXT,
        FOREIGN KEY(calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
        FOREIGN KEY(instance_id) REFERENCES instances(id) ON DELETE CASCADE
      );
    `);
        logger.info('Calendar database initialized with multi-instance support');
    }
    saveInstance(instance) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO instances (id, name, type, config, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(instance.id, instance.name, instance.type, JSON.stringify(instance.config), instance.is_active ? 1 : 0);
    }
    getInstances() {
        return this.db.prepare('SELECT * FROM instances').all();
    }
    saveCalendar(cal) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO calendars (id, instance_id, external_id, summary, role, sync_token, last_sync)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(cal.id, cal.instance_id, cal.external_id, cal.summary, cal.role, cal.sync_token, cal.last_sync);
    }
    saveEvent(event, calendarId, instanceId) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO events (id, calendar_id, instance_id, summary, description, start_time, end_time, location, status, updated, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(event.id, calendarId, instanceId, event.summary || '', event.description || '', event.start?.dateTime || event.start?.date || '', event.end?.dateTime || event.end?.date || '', event.location || '', event.status || '', event.updated || '', JSON.stringify(event));
    }
    getCalendarsByRole(role) {
        return this.db.prepare('SELECT * FROM calendars WHERE role = ?').all(role);
    }
    getEvents(startTime, endTime) {
        const stmt = this.db.prepare(`
      SELECT * FROM events 
      WHERE start_time < ? AND end_time > ?
      ORDER BY start_time ASC
    `);
        return stmt.all(endTime, startTime);
    }
    close() {
        this.db.close();
    }
}
exports.CalendarDatabase = CalendarDatabase;
