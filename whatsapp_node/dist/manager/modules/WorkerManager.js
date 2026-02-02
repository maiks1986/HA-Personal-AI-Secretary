"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerManager = void 0;
const database_1 = require("../../db/database");
const utils_1 = require("../../utils");
const TrafficManager_1 = require("./TrafficManager");
class WorkerManager {
    instanceId;
    request;
    status;
    reconnect;
    traffic;
    namingWorker = null;
    historyWorker = null;
    nudgeTimer = null;
    running = false;
    constructor(instanceId, request, status, reconnect, traffic) {
        this.instanceId = instanceId;
        this.request = request;
        this.status = status;
        this.reconnect = reconnect;
        this.traffic = traffic;
    }
    startAll() {
        this.running = true;
        this.startNamingWorker();
        this.startDeepHistoryWorker();
        this.startAutoNudgeWorker();
    }
    stopAll() {
        this.running = false;
        if (this.namingWorker)
            clearInterval(this.namingWorker);
        if (this.historyWorker)
            clearTimeout(this.historyWorker);
        if (this.nudgeTimer)
            clearInterval(this.nudgeTimer);
        this.namingWorker = null;
        this.historyWorker = null;
        this.nudgeTimer = null;
    }
    startNamingWorker() {
        if (this.namingWorker)
            return;
        this.namingWorker = setInterval(async () => {
            if (!this.running)
                return;
            const db = (0, database_1.getDb)();
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
                LIMIT 5
            `).all(this.instanceId);
            for (const chat of unnamed) {
                const normalized = (0, utils_1.normalizeJid)(chat.jid);
                // --- CASE A: Groups ---
                if (normalized.endsWith('@g.us')) {
                    try {
                        console.log(`[WorkerManager ${this.instanceId}]: Fetching group metadata for unnamed group ${normalized}`);
                        const metadata = await this.request(async (sock) => await sock.groupMetadata(normalized), TrafficManager_1.Priority.LOW);
                        if (metadata?.subject) {
                            db.prepare('UPDATE chats SET name = ? WHERE instance_id = ? AND jid = ?').run(metadata.subject, this.instanceId, normalized);
                        }
                    }
                    catch (e) {
                        console.error(`[WorkerManager ${this.instanceId}]: Failed to fetch metadata for ${normalized}`);
                    }
                }
                // --- CASE B: Individuals ---
                else {
                    // Try to find a name from the contacts table (Baileys sync)
                    const contact = db.prepare('SELECT name FROM contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, normalized);
                    if (contact?.name && !contact.name.match(/^[0-9]+$/)) {
                        db.prepare('UPDATE chats SET name = ? WHERE instance_id = ? AND jid = ?').run(contact.name, this.instanceId, normalized);
                        continue;
                    }
                    // Try to find a pushName from our message history
                    const msg = db.prepare(`
                        SELECT sender_name FROM messages 
                        WHERE instance_id = ? AND chat_jid = ? AND sender_name != 'Unknown' AND sender_name NOT GLOB '[0-9]*'
                        LIMIT 1
                    `).get(this.instanceId, normalized);
                    if (msg?.sender_name) {
                        db.prepare('UPDATE chats SET name = ? WHERE instance_id = ? AND jid = ?').run(msg.sender_name, this.instanceId, normalized);
                        db.prepare('UPDATE contacts SET name = ? WHERE instance_id = ? AND jid = ?').run(msg.sender_name, this.instanceId, normalized);
                        continue;
                    }
                    // Try a business profile lookup (aggressive but rare)
                    try {
                        await this.request(async (sock) => await sock.getBusinessProfile(normalized), TrafficManager_1.Priority.LOW);
                    }
                    catch (e) { }
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
            `).all(this.instanceId);
            if (wrongGroupSenders.length > 0) {
                console.log(`[WorkerManager ${this.instanceId}]: Fixing ${wrongGroupSenders.length} wrong sender names in groups.`);
                for (const row of wrongGroupSenders) {
                    db.prepare('UPDATE messages SET sender_name = ? WHERE whatsapp_id = ?').run(row.correct_name, row.whatsapp_id);
                }
            }
        }, 60000); // Check every 60s
    }
    startDeepHistoryWorker() {
        if (this.historyWorker)
            return;
        const runCycle = async () => {
            if (!this.running)
                return;
            if (this.status() !== 'connected') {
                this.historyWorker = setTimeout(runCycle, 10000);
                return;
            }
            const db = (0, database_1.getDb)();
            const delaySetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('sync_delay_ms');
            let baseDelay = delaySetting?.value ? parseInt(delaySetting.value) : 5000;
            // ADAPTIVE BACKOFF: Slow down if traffic queue is long
            let nextDelay = this.traffic.getAdaptiveDelay(baseDelay);
            const chat = db.prepare(`
                SELECT jid FROM chats 
                WHERE instance_id = ? AND is_fully_synced = 0 
                ORDER BY is_pinned DESC, unread_count DESC, last_message_timestamp DESC 
                LIMIT 1
            `).get(this.instanceId);
            if (!chat) {
                // Periodically check for unsynced chats in case new ones appeared
                if (this.running)
                    this.historyWorker = setTimeout(runCycle, 60000);
                return;
            }
            try {
                const oldest = db.prepare('SELECT whatsapp_id, timestamp, is_from_me FROM messages WHERE instance_id = ? AND chat_jid = ? ORDER BY timestamp ASC LIMIT 1').get(this.instanceId, chat.jid);
                const oldestKey = oldest ? { id: oldest.whatsapp_id, remoteJid: chat.jid, fromMe: !!oldest.is_from_me } : undefined;
                const oldestTs = oldest ? Math.floor(new Date(oldest.timestamp).getTime() / 1000) : 0;
                console.log(`[Sync Worker ${this.instanceId}]: Fetching 100 messages for ${chat.jid} (Queue: ${this.traffic.getQueueSize()})`);
                const result = await this.request(async (sock) => await sock.fetchMessageHistory(100, oldestKey, oldestTs), TrafficManager_1.Priority.LOW);
                if (!this.running)
                    return; // Exit if stopped while waiting for request
                if (!result || (Array.isArray(result) && result.length === 0) || (typeof result === 'string' && result === '')) {
                    console.log(`[Sync Worker ${this.instanceId}]: ${chat.jid} is now fully synced (Reached beginning or empty response).`);
                    db.prepare('UPDATE chats SET is_fully_synced = 1 WHERE instance_id = ? AND jid = ?').run(this.instanceId, chat.jid);
                    nextDelay = 1000; // Faster transition to next chat
                }
                else if (Array.isArray(result)) {
                    console.log(`[Sync Worker ${this.instanceId}]: Received ${result.length} historical messages for ${chat.jid}`);
                }
            }
            catch (e) {
                if (this.running)
                    console.error(`[Sync Worker ${this.instanceId}]: Error during sync for ${chat.jid}:`, e.message);
                nextDelay = 30000; // 30s backoff on error
            }
            if (this.running)
                this.historyWorker = setTimeout(runCycle, nextDelay);
        };
        runCycle();
    }
    startAutoNudgeWorker() {
        if (this.nudgeTimer)
            clearInterval(this.nudgeTimer);
        this.nudgeTimer = setInterval(async () => {
            const db = (0, database_1.getDb)();
            const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('auto_nudge_enabled');
            if (setting?.value === 'false')
                return;
            const chatCount = db.prepare('SELECT COUNT(*) as count FROM chats WHERE instance_id = ?').get(this.instanceId);
            if (chatCount?.count === 0 && this.status() === 'connected') {
                console.log(`[Instance ${this.instanceId}]: Auto-Nudge triggered.`);
                this.reconnect();
            }
        }, 600000);
    }
}
exports.WorkerManager = WorkerManager;
