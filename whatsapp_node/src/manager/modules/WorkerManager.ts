import { WASocket } from '@whiskeysockets/baileys';
import { getDb } from '../../db/database';
import { normalizeJid } from '../../utils';

export class WorkerManager {
    private namingWorker: NodeJS.Timeout | null = null;
    private historyWorker: NodeJS.Timeout | null = null;
    private nudgeTimer: NodeJS.Timeout | null = null;

    constructor(private instanceId: number, private sock: WASocket, private status: () => string, private reconnect: () => void) {}

    startAll() {
        this.startNamingWorker();
        this.startDeepHistoryWorker();
        this.startAutoNudgeWorker();
    }

    stopAll() {
        if (this.namingWorker) clearInterval(this.namingWorker);
        if (this.historyWorker) clearTimeout(this.historyWorker);
        if (this.nudgeTimer) clearInterval(this.nudgeTimer);
    }

    private startNamingWorker() {
        if (this.namingWorker) return;
        this.namingWorker = setInterval(async () => {
            const db = getDb();
            // 1. Find chats with missing or numbered names
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
            `).all(this.instanceId) as any[];

            for (const chat of unnamed) {
                const normalized = normalizeJid(chat.jid);
                
                // --- CASE A: Groups ---
                if (normalized.endsWith('@g.us')) {
                    try {
                        const metadata = await this.sock.groupMetadata(normalized);
                        if (metadata?.subject) {
                            db.prepare('UPDATE chats SET name = ? WHERE instance_id = ? AND jid = ?').run(metadata.subject, this.instanceId, normalized);
                        }
                    } catch (e) {}
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

                    // Try a business profile lookup (aggressive)
                    try {
                        const profile = await this.sock.getBusinessProfile(normalized);
                        if (profile?.description || profile?.category) {
                             // If it's a business, we might get a better identity later, 
                             // but for now we've triggered a metadata update.
                        }
                    } catch (e) {}
                }
            }
        }, 60000); // Check every 60s
    }

    private startDeepHistoryWorker() {
        if (this.historyWorker) return;
        
        const runCycle = async () => {
            if (this.status() !== 'connected') {
                this.historyWorker = setTimeout(runCycle, 10000);
                return;
            }

            const db = getDb();
            const delaySetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('sync_delay_ms') as any;
            let nextDelay = delaySetting?.value ? parseInt(delaySetting.value) : 2000; 

            const chat = db.prepare(`
                SELECT jid FROM chats 
                WHERE instance_id = ? AND is_fully_synced = 0 
                ORDER BY is_pinned DESC, unread_count DESC, last_message_timestamp DESC 
                LIMIT 1
            `).get(this.instanceId) as any;

            if (!chat) {
                console.log(`[Sync Worker ${this.instanceId}]: No more chats to sync.`);
                this.historyWorker = null;
                return;
            }
            
            console.log(`[Sync Worker ${this.instanceId}]: Syncing history for ${chat.jid}...`);

            try {
                const oldest = db.prepare('SELECT whatsapp_id, timestamp, is_from_me FROM messages WHERE instance_id = ? AND chat_jid = ? ORDER BY timestamp ASC LIMIT 1').get(this.instanceId, chat.jid) as any;
                const oldestKey = oldest ? { id: oldest.whatsapp_id, remoteJid: chat.jid, fromMe: !!oldest.is_from_me } : undefined;
                const oldestTs = oldest ? Math.floor(new Date(oldest.timestamp).getTime()/1000) : 0;

                const result = await this.sock.fetchMessageHistory(100, oldestKey as any, oldestTs);
                
                if (!result || (typeof result === 'string' && result === '')) {
                    db.prepare('UPDATE chats SET is_fully_synced = 1 WHERE instance_id = ? AND jid = ?').run(this.instanceId, chat.jid);
                    nextDelay = 500; 
                }
            } catch (e) {
                console.error(`[Sync Worker ${this.instanceId}]: Timeout or Error, backing off...`, e);
                nextDelay = 30000; // 30s backoff on error
            }

            this.historyWorker = setTimeout(runCycle, nextDelay);
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
