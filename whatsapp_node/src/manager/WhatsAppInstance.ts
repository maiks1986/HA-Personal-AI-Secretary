import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    WASocket,
    ConnectionState,
    Browsers,
    Contact
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import db from '../db/database';
import path from 'path';
import fs from 'fs';
import pino from 'pino';

export class WhatsAppInstance {
    public id: number;
    public name: string;
    public sock: WASocket | null = null;
    public qr: string | null = null;
    public status: string = 'disconnected';
    private authPath: string;

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
        this.authPath = process.env.NODE_ENV === 'development'
            ? path.join(__dirname, `../../auth_info_${id}`)
            : `/data/auth_info_${id}`;
    }

    async init() {
        const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
        const { version } = await fetchLatestBaileysVersion();

        const logger = pino({ level: 'info' });

        this.sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            syncFullHistory: true,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 120000,
            logger: logger as any
        });

        this.sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log(`Instance ${this.id}: New QR Code generated`);
                this.qr = await qrcode.toDataURL(qr);
                this.status = 'qr_ready';
            }

            if (connection === 'open') {
                console.log(`Instance ${this.id}: Connected`);
                this.status = 'connected';
                this.qr = null;
                db.prepare('UPDATE instances SET status = ? WHERE id = ?').run('connected', this.id);
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                this.status = 'disconnected';
                db.prepare('UPDATE instances SET status = ? WHERE id = ?').run('disconnected', this.id);
                
                if (statusCode !== DisconnectReason.loggedOut) {
                    setTimeout(() => this.init(), 5000);
                }
            }
        });

        this.sock.ev.on('creds.update', saveCreds);

        const upsertChat = db.prepare(`
            INSERT INTO chats (instance_id, jid, name, unread_count) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(instance_id, jid) DO UPDATE SET
            name = CASE WHEN excluded.name IS NOT NULL AND excluded.name != '' THEN excluded.name ELSE chats.name END,
            unread_count = excluded.unread_count
        `);

        // Use any to bypass map limitations for discovery events
        const evAny = this.sock.ev as any;

        // History Sync
        this.sock.ev.on('messaging-history.set', (payload: any) => {
            const { chats } = payload;
            if (chats) {
                console.log(`Instance ${this.id}: [HistorySet] Found ${chats.length} chats`);
                db.transaction(() => {
                    for (const chat of chats) {
                        upsertChat.run(this.id, chat.id, chat.name || chat.id.split('@')[0], chat.unreadCount || 0);
                    }
                })();
            }
        });

        // Alternative sync paths
        evAny.on('chats.set', (payload: any) => {
            const { chats } = payload;
            if (chats) {
                console.log(`Instance ${this.id}: [ChatsSet] Found ${chats.length} chats`);
                db.transaction(() => {
                    for (const chat of chats) {
                        upsertChat.run(this.id, chat.id, chat.name || chat.id.split('@')[0], chat.unreadCount || 0);
                    }
                })();
            }
        });

        evAny.on('chats.upsert', (chats: any[]) => {
            for (const chat of chats) {
                upsertChat.run(this.id, chat.id, chat.name || chat.id.split('@')[0], 0);
            }
        });

        evAny.on('contacts.upsert', (contacts: any[]) => {
            for (const contact of contacts) {
                upsertChat.run(this.id, contact.id, contact.name || contact.notify || contact.id.split('@')[0], 0);
            }
        });

        // Messages
        this.sock.ev.on('messages.upsert', async m => {
            if (m.type === 'notify') {
                for (const msg of m.messages) {
                    const text = msg.message?.conversation || 
                                 msg.message?.extendedTextMessage?.text || 
                                 msg.message?.imageMessage?.caption || "";
                    
                    if (text) {
                        const jid = msg.key.remoteJid!;
                        db.prepare(`
                            INSERT OR IGNORE INTO messages 
                            (instance_id, chat_jid, sender_jid, sender_name, text, is_from_me) 
                            VALUES (?, ?, ?, ?, ?, ?)
                        `).run(this.id, jid, msg.key.participant || jid, msg.pushName || "Unknown", text, msg.key.fromMe ? 1 : 0);

                        db.prepare(`
                            INSERT INTO chats (instance_id, jid, last_message_text, last_message_timestamp)
                            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                            ON CONFLICT(instance_id, jid) DO UPDATE SET
                            last_message_text = excluded.last_message_text,
                            last_message_timestamp = CURRENT_TIMESTAMP
                        `).run(this.id, jid, text);
                    }
                }
            }
        });
    }

    async sendMessage(jid: string, text: string) {
        if (!this.sock || this.status !== 'connected') throw new Error("Instance not connected");
        await this.sock.sendMessage(jid, { text });
        
        db.prepare(`
            INSERT OR IGNORE INTO messages 
            (instance_id, chat_jid, sender_jid, sender_name, text, is_from_me) 
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(this.id, jid, 'me', 'Me', text, 1);

        db.prepare(`
            UPDATE chats SET last_message_text = ?, last_message_timestamp = CURRENT_TIMESTAMP
            WHERE instance_id = ? AND jid = ?
        `).run(text, this.id, jid);
    }

    async deleteAuth() {
        if (this.sock) {
            try { await this.sock.logout(); } catch (e) {}
            this.sock = null;
        }
        if (fs.existsSync(this.authPath)) {
            fs.rmSync(this.authPath, { recursive: true, force: true });
        }
    }

    async close() {
        if (this.sock) {
            this.sock.end(undefined);
            this.sock = null;
        }
    }
}