import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config';
import { User, UserRole } from '../shared_schemas';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

const DB_PATH = path.join(CONFIG.dataDir, 'auth.db');

export class AuthDatabase {
    private db: Database.Database;

    constructor() {
        // Extra safety: Ensure directory exists
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            console.log(`Creating directory for database: ${dir}`);
            try {
                fs.mkdirSync(dir, { recursive: true });
            } catch (err) {
                console.error(`FAILED to create directory ${dir}:`, err);
            }
        }

        console.log(`Initializing Database at ${DB_PATH}`);
        try {
            this.db = new Database(DB_PATH);
            this.init();
        } catch (err) {
            console.error(`CRITICAL: Failed to open database at ${DB_PATH}:`, err);
            throw err;
        }
    }

    private init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at INTEGER NOT NULL,
                last_login INTEGER,
                totp_secret TEXT,
                is_totp_enabled INTEGER DEFAULT 0
            )
        `);
        
        // Migration for existing tables (Idempotent)
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT");
        } catch (e) {}
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN is_totp_enabled INTEGER DEFAULT 0");
        } catch (e) {}

        // Check if admin exists, if not create default
        const admin = this.getUserByUsername('admin');
        if (!admin) {
            console.log('No admin user found. Creating default admin...');
            // In a real scenario, we might print a one-time setup token
            // For now, hardcoded dev password 'admin123'
            this.createUser('admin', 'admin123', 'admin');
        }
    }

    getUserByUsername(username: string): (User & { password_hash: string, totp_secret?: string }) | undefined {
        const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
        const user = stmt.get(username) as any;
        if (!user) return undefined;
        return user;
    }

    createUser(username: string, password: string, role: UserRole = 'user'): User {
        const id = uuidv4();
        const hashedPassword = bcrypt.hashSync(password, 10);
        const createdAt = Date.now();

        const stmt = this.db.prepare(`
            INSERT INTO users (id, username, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        stmt.run(id, username, hashedPassword, role, createdAt);

        return {
            id,
            username,
            role,
            created_at: createdAt
        };
    }

    updateTotpSecret(userId: string, secret: string) {
        const stmt = this.db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?');
        stmt.run(secret, userId);
    }

    enableTotp(userId: string) {
        const stmt = this.db.prepare('UPDATE users SET is_totp_enabled = 1 WHERE id = ?');
        stmt.run(userId);
    }

    listUsers(): User[] {
        const stmt = this.db.prepare('SELECT id, username, role, created_at, last_login, is_totp_enabled FROM users');
        const rows = stmt.all() as any[];
        return rows.map(r => ({
            ...r,
            is_totp_enabled: !!r.is_totp_enabled
        }));
    }

    deleteUser(id: string) {
        const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
        stmt.run(id);
    }
}

export const db = new AuthDatabase();
