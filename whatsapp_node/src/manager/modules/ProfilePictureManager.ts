import { WASocket } from '@whiskeysockets/baileys';
import { getDb } from '../../db/database';
import { normalizeJid } from '../../utils';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Priority, TrafficManager } from './TrafficManager';

export class ProfilePictureManager {
    private queue: Set<string> = new Set();
    private interval: NodeJS.Timeout | null = null;
    private processing = false;
    private avatarDir: string;

    constructor(
        private instanceId: number, 
        private request: <T>(execute: (sock: WASocket) => Promise<T>, priority?: Priority) => Promise<T>,
        private traffic: TrafficManager
    ) {
        this.avatarDir = process.env.NODE_ENV === 'development' 
            ? path.join(__dirname, '../../../../media/avatars') 
            : '/data/media/avatars';
        this.ensureDir();
    }

    private ensureDir() {
        if (!fs.existsSync(this.avatarDir)) {
            fs.mkdirSync(this.avatarDir, { recursive: true });
        }
    }

    public start() {
        if (this.interval) return;
        const runNext = async () => {
            await this.processNext();
            const baseDelay = 5000;
            const nextDelay = this.traffic.getAdaptiveDelay(baseDelay);
            this.interval = setTimeout(runNext, nextDelay);
        };
        runNext();
        console.log(`[ProfilePictureManager ${this.instanceId}]: Started worker.`);
    }

    public stop() {
        if (this.interval) clearTimeout(this.interval);
        this.interval = null;
    }

    public enqueue(jids: string[]) {
        const db = getDb();
        const now = Date.now();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

        for (const jid of jids) {
            if (jid.includes('@broadcast') || jid === 'status@broadcast') continue;
            const normalized = normalizeJid(jid);

            // Skip if updated in the last 24h
            const row = db.prepare('SELECT profile_picture_timestamp FROM contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, normalized) as any;
            if (row?.profile_picture_timestamp && row.profile_picture_timestamp > oneDayAgo) continue;

            this.queue.add(normalized);
        }
        if (!this.interval) this.start();
    }

    private async processNext() {
        if (this.processing || this.queue.size === 0) return;
        this.processing = true;

        const rawJid = this.queue.values().next().value;
        if (!rawJid) {
            this.processing = false;
            return;
        }
        this.queue.delete(rawJid);

        try {
            const db = getDb();
            // Canonicalize JID for the API call (LIDs usually don't work for avatars)
            let jid = rawJid;
            if (rawJid.endsWith('@lid')) {
                const row = db.prepare('SELECT jid FROM contacts WHERE instance_id = ? AND lid = ? AND jid NOT LIKE \'%@lid\'').get(this.instanceId, rawJid) as any;
                if (row?.jid) jid = row.jid;
            }

            // TRY PREVIEW FIRST (Much more likely to succeed for individuals)
            let url = null;
            try {
                url = await this.request(async (sock) => await sock.profilePictureUrl(jid, 'preview'), Priority.LOW);
            } catch (e) {
                // If preview fails, try high-res just in case
                try {
                    url = await this.request(async (sock) => await sock.profilePictureUrl(jid, 'image'), Priority.LOW);
                } catch (e2) {}
            }
            
            if (url) {
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                const fileName = `${jid.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
                const filePath = path.join(this.avatarDir, fileName);
                
                fs.writeFileSync(filePath, response.data);
                
                const now = new Date().toISOString();
                const relativePath = `avatars/${fileName}`;

                db.prepare('UPDATE contacts SET profile_picture = ?, profile_picture_timestamp = ? WHERE instance_id = ? AND jid = ?').run(relativePath, now, this.instanceId, rawJid);
                if (jid !== rawJid) db.prepare('UPDATE contacts SET profile_picture = ?, profile_picture_timestamp = ? WHERE instance_id = ? AND jid = ?').run(relativePath, now, this.instanceId, jid);
                
                db.prepare('UPDATE chats SET profile_picture = ?, profile_picture_timestamp = ? WHERE instance_id = ? AND jid = ?').run(relativePath, now, this.instanceId, rawJid);
                if (jid !== rawJid) db.prepare('UPDATE chats SET profile_picture = ?, profile_picture_timestamp = ? WHERE instance_id = ? AND jid = ?').run(relativePath, now, this.instanceId, jid);
            } else {
                // No URL = Privacy restricted or no pic
                const now = new Date().toISOString();
                db.prepare('UPDATE contacts SET profile_picture_timestamp = ? WHERE instance_id = ? AND jid = ?').run(now, this.instanceId, rawJid);
            }
        } catch (e: any) {
            const db = getDb();
            const now = new Date().toISOString();
            db.prepare('UPDATE contacts SET profile_picture_timestamp = ? WHERE instance_id = ? AND jid = ?').run(now, this.instanceId, rawJid);
        } finally {
            this.processing = false;
        }
    }
}
