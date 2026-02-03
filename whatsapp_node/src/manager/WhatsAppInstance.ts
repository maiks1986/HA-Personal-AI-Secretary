import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    WASocket,
    Browsers,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import NodeCache from 'node-cache';
import { getDb } from '../db/database';
import { normalizeJid } from '../utils';

// Modules
import { MessageManager } from './modules/MessageManager';
import { WorkerManager } from './modules/WorkerManager';
import { ChatManager } from './modules/ChatManager';
import { QRManager } from './modules/QRManager';
import { EphemeralManager } from './modules/EphemeralManager';
import { StealthManager } from './modules/StealthManager';
import { ProfilePictureManager } from './modules/ProfilePictureManager';
import { SocialManager } from './modules/SocialManager';
import { TrafficManager, Priority } from './modules/TrafficManager';

export class WhatsAppInstance {
    public id: number;
    public name: string;
    public sock: WASocket | null = null;
    // public qr: string | null = null; // Removed in favor of getter
    public status: string = 'disconnected';
    public presence: 'available' | 'unavailable' = 'available';
    private authPath: string;
    private logPath: string;
    private isReconnecting: boolean = false;
    private debugEnabled: boolean;
    private io: any;
    private logger: any;
    private msgRetryCounterCache: NodeCache;

    // Managers
    private messageManager: MessageManager | null = null;
    private workerManager: WorkerManager | null = null;
    private chatManager: ChatManager | null = null;
    public ephemeralManager: EphemeralManager | null = null;
    public stealthManager: StealthManager | null = null;
    public profilePictureManager: ProfilePictureManager | null = null;
    public socialManager: SocialManager | null = null;
    private qrManager: QRManager;
    private trafficManager: TrafficManager;
    
            // Health Monitor
    
            private errorCount: number = 0;
    
            private lastErrorTime: number = 0;
    
            private decryptionErrorCount: number = 0;
    
            private onlineTimeout: NodeJS.Timeout | null = null;
    
        
    
            constructor(id: number, name: string, io: any, debugEnabled: boolean = false, initialPresence: 'available' | 'unavailable' = 'unavailable') {
    
                this.id = id;
    
                this.name = name;
    
                this.io = io;
    
                this.debugEnabled = debugEnabled;
    
                this.presence = initialPresence;
    
                this.authPath = process.env.NODE_ENV === 'development'
    
                    ? path.join(__dirname, `../../auth_info_${id}`)
    
                    : `/data/auth_info_${id}`;
    
                this.logPath = process.env.NODE_ENV === 'development' ? path.join(__dirname, '../../raw_events.log') : '/data/logs/raw_events.log';
    
                this.logger = pino({ level: this.debugEnabled ? 'debug' : 'info' });
    
                this.qrManager = new QRManager();
                this.trafficManager = new TrafficManager(id);
    
                this.msgRetryCounterCache = new NodeCache();
    
                
    
                console.log(`[WhatsAppInstance ${this.id}]: Log Path set to: ${this.logPath}`);
    
                const baseLogger = pino({ level: this.debugEnabled ? 'debug' : 'info' });
                this.logger = new Proxy(baseLogger, {
                    get: (target, prop: string) => {
                        const val = (target as any)[prop];
                        if (typeof val === 'function' && (prop === 'error' || prop === 'warn')) {
                            return (...args: any[]) => {
                                const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
                                if (msg.includes('Bad MAC') || msg.includes('No matching sessions') || msg.includes('SessionError')) {
                                    this.handleDecryptionError();
                                }
                                return val.apply(target, args);
                            };
                        }
                        return val;
                    }
                });

                try {
                    fs.appendFileSync(this.logPath, `[${new Date().toISOString()}] Instance ${this.id} initialized.\n`);
                } catch (e) {
                    console.error(`[WhatsAppInstance ${this.id}]: FAILED TO WRITE TO LOG FILE!`, e);
                }
            }
    
            private lastRepairTime: number = 0;
    
            private handleDecryptionError() {
                this.decryptionErrorCount++;
                if (this.decryptionErrorCount % 5 === 1) { // Log every 5th or first
                    console.warn(`[Instance ${this.id}]: Decryption Error Detected! Count: ${this.decryptionErrorCount}/20`);
                }
        
                if (this.decryptionErrorCount >= 20) { 
                    const now = Date.now();
                    if (now - this.lastRepairTime < 600000) { // 10 minute cooldown
                        console.warn(`[Instance ${this.id}]: High Decryption Errors, but repair is on cooldown. Waiting for stability...`);
                        return;
                    }

                    console.error(`[Instance ${this.id}]: CRITICAL - Zombie Session Detected (20+ Bad MACs). Triggering Soft Repair.`);
                    this.decryptionErrorCount = 0;
                    this.lastRepairTime = now;
                    this.softWipeSyncState().then(() => this.reconnect());
                }
                
                // Auto-reset counter after 2 mins if no more errors
                setTimeout(() => { if (this.decryptionErrorCount > 0) this.decryptionErrorCount--; }, 120000);
            }
    
            get qr(): string | null {
    
                return this.qrManager.getQr();
    
            }

            /**
             * Queues a request to the WhatsApp socket.
             */
            public async request<T>(execute: (sock: WASocket) => Promise<T>, priority: Priority = Priority.LOW): Promise<T> {
                if (!this.sock) throw new Error("Socket not initialized");
                const currentSock = this.sock;
                return this.trafficManager.enqueue(async () => {
                    if (!this.sock || this.sock !== currentSock) {
                        throw new Error("Socket changed or closed during request queueing");
                    }
                    return execute(this.sock);
                }, priority);
            }
    
        
    
            async init() {
    
                if (this.sock) return;
    
                try {
    
                    const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
    
                    const { version } = await fetchLatestBaileysVersion();
    
                    const dbInstance = getDb();
    
        
    
                    this.sock = makeWASocket({
    
                        version,
    
                        auth: {
    
                            creds: state.creds,
    
                            keys: makeCacheableSignalKeyStore(state.keys, this.logger),
    
                        },
    
                        printQRInTerminal: false,
    
                        browser: Browsers.ubuntu('Chrome'),
    
                        syncFullHistory: true,
    
                        markOnlineOnConnect: this.presence === 'available',
    
                        connectTimeoutMs: 120000, // Increased to 2m
    
                        defaultQueryTimeoutMs: 120000,
    
                        generateHighQualityLinkPreview: true,
    
                        logger: this.logger,
    
                        msgRetryCounterCache: this.msgRetryCounterCache
    
                    });
    
        
    
                    // 1. ATTACH ROBUST EVENT LOGGING
    
                    const trackedEvents: any[] = [
    
                        'connection.update', 'creds.update', 'messaging-history.set',
    
                        'chats.upsert', 'chats.update', 'chats.delete',
    
                        'presence.update', 'contacts.upsert', 'contacts.update',
    
                        'messages.delete', 'messages.update', 'messages.upsert',
    
                        'message-receipt.update', 'groups.update', 'group-participants.update'
    
                    ];
    
        
    
                    for (const eventName of trackedEvents) {
    
                        this.sock.ev.on(eventName, (data) => {
    
                            const eventData = { 
    
                                timestamp: new Date().toISOString(), 
    
                                instanceId: this.id, 
    
                                type: eventName, 
    
                                payload: data 
    
                            };
    
                            
    
                            // Emit live
    
                            this.io.emit('raw_whatsapp_event', eventData);
    
                            
    
                                                        // Save to file
    
                            
    
                                                        try {
    
                            
    
                                                            fs.appendFileSync(this.logPath, JSON.stringify(eventData) + '\n');
    
                            
    
                                                        } catch (e) {}
    
                            
    
                                    
    
                            
    
                                                        // Special Case: Auto-Reset on Bad MAC/Session Errors in Disconnect
    
                            
    
                                                        if (eventName === 'connection.update' && data.lastDisconnect?.error) {
    
                            
    
                            
                                const errMessage = data.lastDisconnect.error.toString();
                                if (errMessage.includes('Bad MAC') || errMessage.includes('SessionError')) {
                                    console.error(`[Instance ${this.id}]: CRITICAL - Detected Session Corruption in Disconnect. Deleting Auth.`);
                                    this.deleteAuth().then(() => {
                                        this.status = 'disconnected';
                                        this.emitStatusUpdate();
                                    });
                                }
                            }
                        });
                    }
    
    
    
                // Initialize Managers
    
                this.messageManager = new MessageManager(
                    this.id, 
                    this.sock, 
                    this.io, 
                    this.logger, 
                    (jids) => this.profilePictureManager?.enqueue(jids),
                    (jid) => this.socialManager?.recordOutboundMessage(jid)
                );
                
                this.workerManager = new WorkerManager(
                    this.id, 
                    this.request.bind(this), 
                    () => this.status, 
                    () => this.reconnect(),
                    this.trafficManager,
                    this.messageManager
                );
                
                this.chatManager = new ChatManager(this.id, this.request.bind(this), this.io);
                
                this.ephemeralManager = new EphemeralManager(this.id, this.sock, this.io);
                this.ephemeralManager.start();
                
                this.stealthManager = new StealthManager(this.id, this.request.bind(this));
                this.stealthManager.start();
                
                this.profilePictureManager = new ProfilePictureManager(this.id, this.request.bind(this), this.trafficManager);
                this.socialManager = new SocialManager(this.id);
                // ProfilePictureManager starts on demand via enqueue
    
    
    
                // Connection Updates
    
                this.sock.ev.on('connection.update', async (update) => {
    
                    const { connection, lastDisconnect, qr } = update;
    
                    if (qr) {
    
                        await this.qrManager.processUpdate(qr);
    
                        this.emitStatusUpdate();
    
                    }
    
                    
    
                    if (connection === 'open') {
    
                        this.status = 'connected';
    
                        this.qrManager.clear();
    
                        dbInstance.prepare('UPDATE instances SET status = ? WHERE id = ?').run('connected', this.id);
    
                        this.workerManager?.startAll();
    
                        this.emitStatusUpdate();
    
                    }
    
    
    
                    if (connection === 'close') {
    
                        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
    
                        this.status = 'disconnected';
    
                        this.sock = null;
    
                        this.qrManager.clear();
    
                        dbInstance.prepare('UPDATE instances SET status = ? WHERE id = ?').run('disconnected', this.id);
    
                        this.emitStatusUpdate();
    
                        
    
                        if (statusCode === DisconnectReason.loggedOut) {
    
                            await this.deleteAuth();
    
                        } else {
    
                            if (!this.isReconnecting) {
    
                                console.log(`[Instance ${this.id}]: Connection closed (${statusCode}), reconnecting in 5s...`);
    
                                setTimeout(() => this.reconnect(), 5000);
    
                            }
    
                        }
    
                    }
    
                });
    
    
    
                this.sock.ev.on('creds.update', saveCreds);
    
    
    
                // Sync Listeners
    
                this.sock.ev.on('messaging-history.set', (payload) => this.messageManager?.handleHistorySet(payload));
    
                this.sock.ev.on('chats.upsert', (chats) => this.messageManager?.handleChatsUpsert(chats));
    
                this.sock.ev.on('chats.update', (updates) => this.messageManager?.handleChatsUpdate(updates));
    
                this.sock.ev.on('contacts.upsert', (contacts) => this.messageManager?.handleContactsUpsert(contacts));
    
                this.sock.ev.on('contacts.update', (updates) => this.messageManager?.handleContactsUpdate(updates));
    
    
    
                this.sock.ev.on('messages.upsert', async (m) => {
    
                    this.messageManager?.handleIncomingMessages(m);
    
                    
    
                    // Ephemeral Trigger Check
    
                    if (m.messages[0].message) {
    
                        const msg = m.messages[0];
    
                        const jid = normalizeJid(msg.key.remoteJid!);
    
                        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    
                        const isFromMe = msg.key.fromMe || false;
    
                        if (text) {
    
                            this.ephemeralManager?.handleIncomingMessage(jid, text, isFromMe);
    
                        }
    
                    }
    
                });
    
    
    
                this.sock.ev.on('message-receipt.update', (updates) => {
    
                    for (const { key, receipt } of updates) {
    
                        const status = receipt.readTimestamp ? 'read' : receipt.receiptTimestamp ? 'delivered' : 'sent';
    
                        dbInstance.prepare('UPDATE messages SET status = ? WHERE whatsapp_id = ?').run(status, key.id);
    
                    }
    
                    this.io.emit('chat_update', { instanceId: this.id });
    
                });
    
    
    
                this.sock.ev.on('presence.update', (update) => {
    
                    this.io.emit('presence_update', { instanceId: this.id, jid: normalizeJid(update.id), presence: update.presences });
    
                    this.socialManager?.handlePresenceUpdate(update.id, update.presences);
    
                });
    
    
    
            } catch (err) {
    
                console.error(`FATAL ERROR during init:`, err);
    
            }
    
        }
    
    
    
        async setPresence(presence: 'available' | 'unavailable') {
    
            const db = getDb();
    
            this.presence = presence;
    
            if (this.sock) await this.sock.sendPresenceUpdate(presence);
    
            
    
            // Persist
    
            db.prepare('UPDATE instances SET presence = ? WHERE id = ?').run(presence, this.id);
    
            this.emitStatusUpdate();
    
    
    
            // Auto-Offline Timeout
    
            if (this.onlineTimeout) {
    
                clearTimeout(this.onlineTimeout);
    
                this.onlineTimeout = null;
    
            }
    
    
    
            if (presence === 'available') {
    
                const timeoutSetting = (db.prepare('SELECT value FROM settings WHERE instance_id = ? AND key = ?').get(this.id, 'online_timeout_seconds') as any)?.value;
    
                const timeoutSec = timeoutSetting ? parseInt(timeoutSetting) : 60; // Default 60s
    
                
    
                console.log(`[Instance ${this.id}]: Set Online. Reverting to Offline in ${timeoutSec}s.`);
    
                this.onlineTimeout = setTimeout(() => {
    
                    console.log(`[Instance ${this.id}]: Auto-Offline Timeout triggered.`);
    
                    this.setPresence('unavailable');
    
                }, timeoutSec * 1000);
    
            }
    
        }

    private emitStatusUpdate() {
        if (this.io) {
            this.io.emit('instances_status', [{
                id: this.id,
                status: this.status,
                presence: this.presence,
                qr: this.qrManager.getQr()
            }]);
        }
    }

    async reconnect() {
        this.isReconnecting = true;
        this.workerManager?.stopAll();
        this.trafficManager.clearQueue(Priority.MEDIUM); // Clear all Medium and Low priority tasks
        if (this.sock) { try { this.sock.end(undefined); } catch (e) {} this.sock = null; }
        await new Promise(r => setTimeout(r, 2000));
        this.isReconnecting = false;
        await this.init();
    }

    async sendMessage(jid: string, text: string) {
        if (!this.sock || this.status !== 'connected') throw new Error("Instance not connected");
        
        const targetJid = normalizeJid(jid);

        // 1. Simulate Human-like behavior: Presence -> Composing -> Wait -> Send
        await this.request(async (sock) => {
            // Subscribe to presence (looks like we are looking at the chat)
            await sock.presenceSubscribe(targetJid);
            await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
            
            // Start typing
            await sock.sendPresenceUpdate('composing', targetJid);
            
            // Wait based on text length (simulating typing speed: ~200-300 chars per minute)
            // But with a cap to not wait too long for huge messages
            const typingTime = Math.min(Math.max(text.length * 50, 1500), 5000) + (Math.random() * 1000);
            await new Promise(r => setTimeout(r, typingTime));
            
            // Stop typing and send
            await sock.sendPresenceUpdate('paused', targetJid);
            return await sock.sendMessage(targetJid, { text });
        }, Priority.HIGH);
    }

    // Delegated methods
    async createGroup(title: string, participants: string[]) { return this.chatManager?.createGroup(title, participants); }
    async updateGroupParticipants(jid: string, p: string[], a: any) { return this.chatManager?.updateGroupParticipants(jid, p, a); }
    async updateGroupMetadata(jid: string, u: any) { return this.chatManager?.updateGroupMetadata(jid, u); }
    async modifyChat(jid: string, action: any) { return this.chatManager?.modifyChat(jid, action); }

    async deleteAuth() {
        this.workerManager?.stopAll();
        if (this.sock) { try { await this.sock.logout(); } catch (e) {} this.sock = null; }
        if (fs.existsSync(this.authPath)) fs.rmSync(this.authPath, { recursive: true, force: true });
    }

    async softWipeSyncState() {
        if (!fs.existsSync(this.authPath)) return;
        try {
            const files = fs.readdirSync(this.authPath);
            for (const file of files) {
                if (file !== 'creds.json') {
                    const fullPath = path.join(this.authPath, file);
                    fs.rmSync(fullPath, { recursive: true, force: true });
                }
            }
            console.log(`[Instance ${this.id}]: Soft-wiped sync state (preserved creds).`);
        } catch (e) {
            console.error(`[Instance ${this.id}]: Failed to soft-wipe sync state:`, e);
        }
    }

    async close() {
        this.workerManager?.stopAll();
        if (this.sock) { this.sock.end(undefined); this.sock = null; }
    }
}
