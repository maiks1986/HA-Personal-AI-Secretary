"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppInstance = void 0;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pino_1 = __importDefault(require("pino"));
const node_cache_1 = __importDefault(require("node-cache"));
const database_1 = require("../db/database");
const utils_1 = require("../utils");
// Modules
const MessageManager_1 = require("./modules/MessageManager");
const WorkerManager_1 = require("./modules/WorkerManager");
const ChatManager_1 = require("./modules/ChatManager");
const QRManager_1 = require("./modules/QRManager");
const EphemeralManager_1 = require("./modules/EphemeralManager");
const StealthManager_1 = require("./modules/StealthManager");
const ProfilePictureManager_1 = require("./modules/ProfilePictureManager");
const SocialManager_1 = require("./modules/SocialManager");
const TrafficManager_1 = require("./modules/TrafficManager");
class WhatsAppInstance {
    id;
    name;
    sock = null;
    // public qr: string | null = null; // Removed in favor of getter
    status = 'disconnected';
    presence = 'available';
    authPath;
    logPath;
    isReconnecting = false;
    debugEnabled;
    io;
    logger;
    msgRetryCounterCache;
    // Managers
    messageManager = null;
    workerManager = null;
    chatManager = null;
    ephemeralManager = null;
    stealthManager = null;
    profilePictureManager = null;
    socialManager = null;
    qrManager;
    trafficManager;
    // Health Monitor
    errorCount = 0;
    lastErrorTime = 0;
    decryptionErrorCount = 0;
    onlineTimeout = null;
    constructor(id, name, io, debugEnabled = false, initialPresence = 'unavailable') {
        this.id = id;
        this.name = name;
        this.io = io;
        this.debugEnabled = debugEnabled;
        this.presence = initialPresence;
        this.authPath = process.env.NODE_ENV === 'development'
            ? path_1.default.join(__dirname, `../../auth_info_${id}`)
            : `/data/auth_info_${id}`;
        this.logPath = process.env.NODE_ENV === 'development' ? path_1.default.join(__dirname, '../../raw_events.log') : '/data/logs/raw_events.log';
        this.logger = (0, pino_1.default)({ level: this.debugEnabled ? 'debug' : 'info' });
        this.qrManager = new QRManager_1.QRManager();
        this.trafficManager = new TrafficManager_1.TrafficManager(id);
        this.msgRetryCounterCache = new node_cache_1.default();
        console.log(`[WhatsAppInstance ${this.id}]: Log Path set to: ${this.logPath}`);
        const baseLogger = (0, pino_1.default)({ level: this.debugEnabled ? 'debug' : 'info' });
        this.logger = new Proxy(baseLogger, {
            get: (target, prop) => {
                const val = target[prop];
                if (typeof val === 'function' && (prop === 'error' || prop === 'warn')) {
                    return (...args) => {
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
            fs_1.default.appendFileSync(this.logPath, `[${new Date().toISOString()}] Instance ${this.id} initialized.\n`);
        }
        catch (e) {
            console.error(`[WhatsAppInstance ${this.id}]: FAILED TO WRITE TO LOG FILE!`, e);
        }
    }
    handleDecryptionError() {
        this.decryptionErrorCount++;
        if (this.decryptionErrorCount % 5 === 1) { // Log every 5th or first
            console.warn(`[Instance ${this.id}]: Decryption Error Detected! Count: ${this.decryptionErrorCount}/20`);
        }
        if (this.decryptionErrorCount >= 20) { // Increased to 20 to avoid over-aggressive resets during bursts
            console.error(`[Instance ${this.id}]: CRITICAL - Zombie Session Detected (20+ Bad MACs). Triggering Soft Repair.`);
            this.decryptionErrorCount = 0;
            this.softWipeSyncState().then(() => this.reconnect());
        }
        // Auto-reset counter after 2 mins if no more errors
        setTimeout(() => { if (this.decryptionErrorCount > 0)
            this.decryptionErrorCount--; }, 120000);
    }
    get qr() {
        return this.qrManager.getQr();
    }
    /**
     * Queues a request to the WhatsApp socket.
     */
    async request(execute, priority = TrafficManager_1.Priority.LOW) {
        if (!this.sock)
            throw new Error("Socket not initialized");
        const currentSock = this.sock;
        return this.trafficManager.enqueue(async () => {
            if (!this.sock || this.sock !== currentSock) {
                throw new Error("Socket changed or closed during request queueing");
            }
            return execute(this.sock);
        }, priority);
    }
    async init() {
        if (this.sock)
            return;
        try {
            const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(this.authPath);
            const { version } = await (0, baileys_1.fetchLatestBaileysVersion)();
            const dbInstance = (0, database_1.getDb)();
            this.sock = (0, baileys_1.default)({
                version,
                auth: {
                    creds: state.creds,
                    keys: (0, baileys_1.makeCacheableSignalKeyStore)(state.keys, this.logger),
                },
                printQRInTerminal: false,
                browser: baileys_1.Browsers.ubuntu('Chrome'),
                syncFullHistory: true,
                markOnlineOnConnect: this.presence === 'available',
                connectTimeoutMs: 120000, // Increased to 2m
                defaultQueryTimeoutMs: 120000,
                generateHighQualityLinkPreview: true,
                logger: this.logger,
                msgRetryCounterCache: this.msgRetryCounterCache
            });
            // 1. ATTACH ROBUST EVENT LOGGING
            const trackedEvents = [
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
                        fs_1.default.appendFileSync(this.logPath, JSON.stringify(eventData) + '\n');
                    }
                    catch (e) { }
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
            this.messageManager = new MessageManager_1.MessageManager(this.id, this.sock, this.io, this.logger, (jids) => this.profilePictureManager?.enqueue(jids), (jid) => this.socialManager?.recordOutboundMessage(jid));
            this.workerManager = new WorkerManager_1.WorkerManager(this.id, this.request.bind(this), () => this.status, () => this.reconnect(), this.trafficManager);
            this.chatManager = new ChatManager_1.ChatManager(this.id, this.request.bind(this), this.io);
            this.ephemeralManager = new EphemeralManager_1.EphemeralManager(this.id, this.sock, this.io);
            this.ephemeralManager.start();
            this.stealthManager = new StealthManager_1.StealthManager(this.id, this.request.bind(this));
            this.stealthManager.start();
            this.profilePictureManager = new ProfilePictureManager_1.ProfilePictureManager(this.id, this.request.bind(this), this.trafficManager);
            this.socialManager = new SocialManager_1.SocialManager(this.id);
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
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    this.status = 'disconnected';
                    this.sock = null;
                    this.qrManager.clear();
                    dbInstance.prepare('UPDATE instances SET status = ? WHERE id = ?').run('disconnected', this.id);
                    this.emitStatusUpdate();
                    if (statusCode === baileys_1.DisconnectReason.loggedOut) {
                        await this.deleteAuth();
                    }
                    else {
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
                    const jid = (0, utils_1.normalizeJid)(msg.key.remoteJid);
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
                this.io.emit('presence_update', { instanceId: this.id, jid: (0, utils_1.normalizeJid)(update.id), presence: update.presences });
                this.socialManager?.handlePresenceUpdate(update.id, update.presences);
            });
        }
        catch (err) {
            console.error(`FATAL ERROR during init:`, err);
        }
    }
    async setPresence(presence) {
        const db = (0, database_1.getDb)();
        this.presence = presence;
        if (this.sock)
            await this.sock.sendPresenceUpdate(presence);
        // Persist
        db.prepare('UPDATE instances SET presence = ? WHERE id = ?').run(presence, this.id);
        this.emitStatusUpdate();
        // Auto-Offline Timeout
        if (this.onlineTimeout) {
            clearTimeout(this.onlineTimeout);
            this.onlineTimeout = null;
        }
        if (presence === 'available') {
            const timeoutSetting = db.prepare('SELECT value FROM settings WHERE instance_id = ? AND key = ?').get(this.id, 'online_timeout_seconds')?.value;
            const timeoutSec = timeoutSetting ? parseInt(timeoutSetting) : 60; // Default 60s
            console.log(`[Instance ${this.id}]: Set Online. Reverting to Offline in ${timeoutSec}s.`);
            this.onlineTimeout = setTimeout(() => {
                console.log(`[Instance ${this.id}]: Auto-Offline Timeout triggered.`);
                this.setPresence('unavailable');
            }, timeoutSec * 1000);
        }
    }
    emitStatusUpdate() {
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
        this.trafficManager.clearQueue(TrafficManager_1.Priority.MEDIUM); // Clear all Medium and Low priority tasks
        if (this.sock) {
            try {
                this.sock.end(undefined);
            }
            catch (e) { }
            this.sock = null;
        }
        await new Promise(r => setTimeout(r, 2000));
        this.isReconnecting = false;
        await this.init();
    }
    async sendMessage(jid, text) {
        if (!this.sock || this.status !== 'connected')
            throw new Error("Instance not connected");
        await this.request(async (sock) => await sock.sendMessage((0, utils_1.normalizeJid)(jid), { text }), TrafficManager_1.Priority.HIGH);
    }
    // Delegated methods
    async createGroup(title, participants) { return this.chatManager?.createGroup(title, participants); }
    async updateGroupParticipants(jid, p, a) { return this.chatManager?.updateGroupParticipants(jid, p, a); }
    async updateGroupMetadata(jid, u) { return this.chatManager?.updateGroupMetadata(jid, u); }
    async modifyChat(jid, action) { return this.chatManager?.modifyChat(jid, action); }
    async deleteAuth() {
        this.workerManager?.stopAll();
        if (this.sock) {
            try {
                await this.sock.logout();
            }
            catch (e) { }
            this.sock = null;
        }
        if (fs_1.default.existsSync(this.authPath))
            fs_1.default.rmSync(this.authPath, { recursive: true, force: true });
    }
    async softWipeSyncState() {
        if (!fs_1.default.existsSync(this.authPath))
            return;
        try {
            const files = fs_1.default.readdirSync(this.authPath);
            for (const file of files) {
                if (file !== 'creds.json') {
                    const fullPath = path_1.default.join(this.authPath, file);
                    fs_1.default.rmSync(fullPath, { recursive: true, force: true });
                }
            }
            console.log(`[Instance ${this.id}]: Soft-wiped sync state (preserved creds).`);
        }
        catch (e) {
            console.error(`[Instance ${this.id}]: Failed to soft-wipe sync state:`, e);
        }
    }
    async close() {
        this.workerManager?.stopAll();
        if (this.sock) {
            this.sock.end(undefined);
            this.sock = null;
        }
    }
}
exports.WhatsAppInstance = WhatsAppInstance;
