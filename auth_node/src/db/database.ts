import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config';
import { User, UserRole, OAuthProvider, OAuthToken } from '../shared_schemas';
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
                password_hash TEXT,
                role TEXT NOT NULL DEFAULT 'user',
                created_at INTEGER NOT NULL,
                last_login INTEGER,
                totp_secret TEXT,
                is_totp_enabled INTEGER DEFAULT 0,
                auth_source TEXT NOT NULL DEFAULT 'local',
                external_id TEXT
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS oauth_providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                client_id TEXT NOT NULL,
                client_secret TEXT NOT NULL,
                authorize_url TEXT NOT NULL,
                token_url TEXT NOT NULL,
                redirect_uri TEXT NOT NULL,
                scope TEXT NOT NULL
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS oauth_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                expires_at INTEGER,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(provider_id) REFERENCES oauth_providers(id)
            )
        `);
        
        // Migration for existing tables (Idempotent)
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT");
        } catch (e) {}
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN is_totp_enabled INTEGER DEFAULT 0");
        } catch (e) {}
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN auth_source TEXT NOT NULL DEFAULT 'local'");
        } catch (e) {}
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN external_id TEXT");
        } catch (e) {}
        try {
            this.db.exec("ALTER TABLE users ALTER COLUMN password_hash TEXT"); // Allow null for OAuth/HA users
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

    getUserByUsername(username: string): (User & { password_hash?: string, totp_secret?: string }) | undefined {
        const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
        const user = stmt.get(username) as any;
        if (!user) return undefined;
        return user;
    }

    findUserByExternalId(source: string, externalId: string): (User & { password_hash?: string, totp_secret?: string }) | undefined {
        const stmt = this.db.prepare('SELECT * FROM users WHERE auth_source = ? AND external_id = ?');
        const user = stmt.get(source, externalId) as any;
        if (!user) return undefined;
        return user;
    }

    createUser(username: string, password?: string, role: UserRole = 'user', source: 'local' | 'ha' | 'oauth' = 'local', externalId?: string): User {
        const id = uuidv4();
        const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;
        const createdAt = Date.now();

        const stmt = this.db.prepare(`
            INSERT INTO users (id, username, password_hash, role, created_at, auth_source, external_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(id, username, hashedPassword, role, createdAt, source, externalId);

        return {
            id,
            username,
            role,
            created_at: createdAt,
            auth_source: source,
            external_id: externalId
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

    // OAuth Provider Methods
    createOAuthProvider(provider: Omit<OAuthProvider, 'id'>): OAuthProvider {
        const id = uuidv4();
        const stmt = this.db.prepare(`
            INSERT INTO oauth_providers (id, name, type, client_id, client_secret, authorize_url, token_url, redirect_uri, scope)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, provider.name, provider.type, provider.client_id, provider.client_secret, provider.authorize_url, provider.token_url, provider.redirect_uri, provider.scope);
        return { ...provider, id };
    }

    getOAuthProvider(idOrSlug: string): OAuthProvider | undefined {
        const stmt = this.db.prepare('SELECT * FROM oauth_providers WHERE id = ? OR name = ?');
        return stmt.get(idOrSlug, idOrSlug) as OAuthProvider | undefined;
    }

    listOAuthProviders(): OAuthProvider[] {
        const stmt = this.db.prepare('SELECT * FROM oauth_providers');
        return stmt.all() as OAuthProvider[];
    }

    deleteOAuthProvider(id: string) {
        const stmt = this.db.prepare('DELETE FROM oauth_providers WHERE id = ?');
        stmt.run(id);
    }

    // OAuth Token Methods
    saveOAuthToken(token: Omit<OAuthToken, 'id' | 'created_at'>): OAuthToken {
        const id = uuidv4();
        const createdAt = Date.now();
        const stmt = this.db.prepare(`
            INSERT INTO oauth_tokens (id, user_id, provider_id, access_token, refresh_token, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, token.user_id, token.provider_id, token.access_token, token.refresh_token, token.expires_at, createdAt);
        return { ...token, id, created_at: createdAt };
    }

    getOAuthTokensForUser(userId: string): OAuthToken[] {
        const stmt = this.db.prepare('SELECT * FROM oauth_tokens WHERE user_id = ?');
        return stmt.all() as OAuthToken[];
    }

    updateOAuthToken(id: string, accessToken: string, expiresAt?: number) {
        const stmt = this.db.prepare('UPDATE oauth_tokens SET access_token = ?, expires_at = ? WHERE id = ?');
        stmt.run(accessToken, expiresAt, id);
    }

    linkExternalId(userId: string, source: string, externalId: string) {
        const stmt = this.db.prepare('UPDATE users SET auth_source = ?, external_id = ? WHERE id = ?');
        stmt.run(source, externalId, userId);
    }
}

export const db = new AuthDatabase();
