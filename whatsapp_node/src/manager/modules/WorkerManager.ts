import { WASocket, WAMessage } from '@whiskeysockets/baileys';
import { getDb } from '../../db/database';
import { normalizeJid } from '../../utils';
import { TrafficManager, Priority } from './TrafficManager';
import { MessageManager } from './MessageManager';

export class WorkerManager {
    private namingWorker: NodeJS.Timeout | null = null;
    private historyWorker: NodeJS.Timeout | null = null;
    private mediaWorker: NodeJS.Timeout | null = null;
    private nudgeTimer: NodeJS.Timeout | null = null;
    private running: boolean = false;

    constructor(
        private instanceId: number, 
        private request: <T>(execute: (sock: WASocket) => Promise<T>, priority?: Priority) => Promise<T>, 
        private status: () => string, 
        private reconnect: () => void,
        private traffic: TrafficManager,
        private messageManager: MessageManager
    ) {}

    startAll() {
        this.running = true;
        this.startNamingWorker();
        this.startDeepHistoryWorker();
        this.startMediaDownloadWorker();
        this.startAutoNudgeWorker();
    }

    stopAll() {
        this.running = false;
        if (this.namingWorker) clearInterval(this.namingWorker);
        if (this.historyWorker) clearTimeout(this.historyWorker);
        if (this.mediaWorker) clearTimeout(this.mediaWorker);
        if (this.nudgeTimer) clearInterval(this.nudgeTimer);
        this.namingWorker = null;
        this.historyWorker = null;
        this.mediaWorker = null;
        this.nudgeTimer = null;
    }

    private startNamingWorker() {
        if (this.namingWorker) return;
        this.namingWorker = setInterval(async () => {
            if (!this.running) return;
            const db = getDb();
            // 1. Find chats with missing or numbered names - LIMIT to 5 per cycle to avoid overloading WA
            const unnamed = db.prepare(`
                SELECT jid, name FROM chats 
                WHERE instance_id = ? 
                AND (
                    name IS NULL 
                    OR name = '' 
                    OR name = 'Unnamed Group' 
                    OR name LIKE '%@s.whatsapp.net' 
                    OR name GLOB '[0-9]*' -- Starts with a digit
                )
                LIMIT 2
            `).all(this.instanceId) as any[];

            for (const chat of unnamed) {
                const normalized = normalizeJid(chat.jid);
                
                // --- CASE A: Groups ---
                if (normalized.endsWith('@g.us')) {
                    try {
                        console.log(`[WorkerManager ${this.instanceId}]: Fetching group metadata for unnamed group ${normalized}`);
                        const metadata = await this.request(async (sock) => await sock.groupMetadata(normalized), Priority.LOW);
                        if (metadata?.subject) {
                            db.prepare('UPDATE chats SET name = ? WHERE instance_id = ? AND jid = ?').run(metadata.subject, this.instanceId, normalized);
                        }
                    } catch (e) {
                        console.error(`[WorkerManager ${this.instanceId}]: Failed to fetch metadata for ${normalized}`);
                    }
                } 
                
                // --- CASE B: Individuals ---
                else {
                    // Try to find a name from the contacts table (Baileys sync)
                    const contact = db.prepare('SELECT name FROM contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, normalized) as any;
                    if (contact?.name && !contact.name.match(/^[0-9]+$/)) {
                        db.prepare('UPDATE chats SET name = ? WHERE instance_id = ? AND jid = ?').run(contact.name, this.instanceId, normalized);
                        continue;
                    }

                    // Try to find a pushName from our message history
                    const msg = db.prepare(`
                        SELECT sender_name FROM messages 
                        WHERE instance_id = ? AND chat_jid = ? AND sender_name != 'Unknown' AND sender_name NOT GLOB '[0-9]*'
                        LIMIT 1
                    `).get(this.instanceId, normalized) as any;
                    if (msg?.sender_name) {
                        db.prepare('UPDATE chats SET name = ? WHERE instance_id = ? AND jid = ?').run(msg.sender_name, this.instanceId, normalized);
                        db.prepare('UPDATE contacts SET name = ? WHERE instance_id = ? AND jid = ?').run(msg.sender_name, this.instanceId, normalized);
                        continue;
                    }

                    // Try a business profile lookup (aggressive but rare)
                    try {
                        await this.request(async (sock) => await sock.getBusinessProfile(normalized), Priority.LOW);
                    } catch (e) {}
                }
            }

            // 2. Fix group messages where sender_name is the group JID or group name
            const wrongGroupSenders = db.prepare(`
                SELECT m.whatsapp_id, m.sender_jid, c.name as correct_name
                FROM messages m
                JOIN contacts c ON m.sender_jid = c.jid AND m.instance_id = c.instance_id
                WHERE m.instance_id = ? 
                AND m.chat_jid LIKE '%@g.us'
                AND (m.sender_name LIKE '%@g.us' OR m.sender_name = 'Unknown' OR m.sender_name GLOB '[0-9]*')
                AND c.name NOT LIKE '%@%'
                LIMIT 100
            `).all(this.instanceId) as any[];

            if (wrongGroupSenders.length > 0) {
                console.log(`[WorkerManager ${this.instanceId}]: Fixing ${wrongGroupSenders.length} wrong sender names in groups.`);
                for (const row of wrongGroupSenders) {
                    db.prepare('UPDATE messages SET sender_name = ? WHERE whatsapp_id = ?').run(row.correct_name, row.whatsapp_id);
                }
            }

        }, 120000); // Check every 120s (2 minutes)
    }

    private startDeepHistoryWorker() {
        if (this.historyWorker) return;
        
        const runCycle = async () => {
            if (!this.running) return;
            
            if (this.status() !== 'connected') {
                this.historyWorker = setTimeout(runCycle, 15000);
                return;
            }

            const db = getDb();
            const delaySetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('sync_delay_ms') as any;
            let baseDelay = delaySetting?.value ? parseInt(delaySetting.value) : 8000; // Increased default from 5s to 8s
            
            // Randomize cycle delay (70% to 130% of baseDelay)
            const randomDelay = Math.floor(baseDelay * (0.7 + Math.random() * 0.6));
            
            // ADAPTIVE BACKOFF: Slow down if traffic queue is long
            let nextDelay = this.traffic.getAdaptiveDelay(randomDelay);

            const chat = db.prepare(`
                SELECT jid FROM chats 
                WHERE instance_id = ? AND is_fully_synced = 0 
                ORDER BY is_pinned DESC, unread_count DESC, last_message_timestamp DESC 
                LIMIT 1
            `).get(this.instanceId) as any;

            if (!chat) {
                // Periodically check for unsynced chats in case new ones appeared
                if (this.running) this.historyWorker = setTimeout(runCycle, 60000);
                return;
            }
            
            try {
                const oldest = db.prepare('SELECT whatsapp_id, timestamp, is_from_me FROM messages WHERE instance_id = ? AND chat_jid = ? ORDER BY timestamp ASC LIMIT 1').get(this.instanceId, chat.jid) as any;
                const oldestKey = oldest ? { id: oldest.whatsapp_id, remoteJid: chat.jid, fromMe: !!oldest.is_from_me } : undefined;
                const oldestTs = oldest ? Math.floor(new Date(oldest.timestamp).getTime()/1000) : 0;

                console.log(`[Sync Worker ${this.instanceId}]: Fetching 100 messages for ${chat.jid} (Queue: ${this.traffic.getQueueSize()})`);
                
                const result = await this.request(async (sock) => await sock.fetchMessageHistory(100, oldestKey as any, oldestTs), Priority.LOW);
                
                if (!this.running) return; // Exit if stopped while waiting for request

                if (!result || (Array.isArray(result) && result.length === 0) || (typeof result === 'string' && result === '')) {
                    console.log(`[Sync Worker ${this.instanceId}]: ${chat.jid} is now fully synced (Reached beginning or empty response).`);
                    db.prepare('UPDATE chats SET is_fully_synced = 1 WHERE instance_id = ? AND jid = ?').run(this.instanceId, chat.jid);
                    nextDelay = 1000; // Faster transition to next chat
                } else if (Array.isArray(result)) {
                    console.log(`[Sync Worker ${this.instanceId}]: Received ${result.length} historical messages for ${chat.jid}`);
                    for (const msg of result) {
                        await this.messageManager.saveMessageToDb(msg, true); // Always skip media during deep sync
                    }
                }
            } catch (e: any) {
                if (this.running) console.error(`[Sync Worker ${this.instanceId}]: Error during sync for ${chat.jid}:`, e.message);
                nextDelay = 30000; // 30s backoff on error
            }

            if (this.running) this.historyWorker = setTimeout(runCycle, nextDelay);
        };

        runCycle();
    }

    private startMediaDownloadWorker() {
        if (this.mediaWorker) return;

        const runCycle = async () => {
            if (!this.running) return;

            if (this.status() !== 'connected') {
                this.mediaWorker = setTimeout(runCycle, 20000);
                return;
            }

            const db = getDb();
            const pending = db.prepare(`
                SELECT * FROM messages 
                WHERE instance_id = ? AND media_download_status = 'pending'
                ORDER BY timestamp DESC
                LIMIT 1
            `).get(this.instanceId) as any;

            if (!pending) {
                // No pending media, check again in 2 minutes
                if (this.running) this.mediaWorker = setTimeout(runCycle, 120000);
                return;
            }

            let nextDelay = 10000 + Math.random() * 10000; // 10-20s between background media downloads

            try {
                if (!pending.raw_message) {
                    db.prepare("UPDATE messages SET media_download_status = 'failed' WHERE id = ?").run(pending.id);
                    if (this.running) this.mediaWorker = setTimeout(runCycle, 1000);
                    return;
                }

                const msgObj = JSON.parse(pending.raw_message) as WAMessage;
                console.log(`[Media Worker]: Downloading deferred media for ${pending.whatsapp_id}...`);
                
                const path = await this.messageManager.downloadMedia(msgObj);
                
                if (path) {
                    db.prepare("UPDATE messages SET media_path = ?, media_download_status = 'success', raw_message = NULL WHERE id = ?")
                        .run(path, pending.id);
                } else {
                    db.prepare("UPDATE messages SET media_download_status = 'failed' WHERE id = ?").run(pending.id);
                }

            } catch (e) {
                console.error(`[Media Worker]: Failed to process ${pending.whatsapp_id}`, e);
                db.prepare("UPDATE messages SET media_download_status = 'failed' WHERE id = ?").run(pending.id);
            }

            if (this.running) this.mediaWorker = setTimeout(runCycle, nextDelay);
        };

        runCycle();
    }

    private startAutoNudgeWorker() {
        if (this.nudgeTimer) clearInterval(this.nudgeTimer);
        this.nudgeTimer = setInterval(async () => {
            const db = getDb();
            const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('auto_nudge_enabled') as any;
            if (setting?.value === 'false') return;

            const chatCount = db.prepare('SELECT COUNT(*) as count FROM chats WHERE instance_id = ?').get(this.instanceId) as any;
            if (chatCount?.count === 0 && this.status() === 'connected') {
                console.log(`[Instance ${this.instanceId}]: Auto-Nudge triggered.`);
                this.reconnect();
            }
        }, 600000);
    }
}
