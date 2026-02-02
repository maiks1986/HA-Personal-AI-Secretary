"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilePictureManager = void 0;
const database_1 = require("../../db/database");
const utils_1 = require("../../utils");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const TrafficManager_1 = require("./TrafficManager");
class ProfilePictureManager {
    instanceId;
    request;
    traffic;
    queue = new Set();
    interval = null;
    processing = false;
    avatarDir;
    constructor(instanceId, request, traffic) {
        this.instanceId = instanceId;
        this.request = request;
        this.traffic = traffic;
        this.avatarDir = process.env.NODE_ENV === 'development'
            ? path_1.default.join(__dirname, '../../../../media/avatars')
            : '/data/media/avatars';
        this.ensureDir();
    }
    ensureDir() {
        if (!fs_1.default.existsSync(this.avatarDir)) {
            fs_1.default.mkdirSync(this.avatarDir, { recursive: true });
        }
    }
    start() {
        if (this.interval)
            return;
        const runNext = async () => {
            await this.processNext();
            const baseDelay = 5000;
            const nextDelay = this.traffic.getAdaptiveDelay(baseDelay);
            this.interval = setTimeout(runNext, nextDelay);
        };
        runNext();
        console.log(`[ProfilePictureManager ${this.instanceId}]: Started worker.`);
    }
    stop() {
        if (this.interval)
            clearTimeout(this.interval);
        this.interval = null;
    }
    enqueue(jids) {
        const db = (0, database_1.getDb)();
        const now = Date.now();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
        for (const jid of jids) {
            if (jid.includes('@broadcast') || jid === 'status@broadcast')
                continue;
            const normalized = (0, utils_1.normalizeJid)(jid);
            // Skip if updated in the last 24h
            const row = db.prepare('SELECT profile_picture_timestamp FROM contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, normalized);
            if (row?.profile_picture_timestamp && row.profile_picture_timestamp > oneDayAgo)
                continue;
            this.queue.add(normalized);
        }
        if (!this.interval)
            this.start();
    }
    async processNext() {
        if (this.processing || this.queue.size === 0)
            return;
        this.processing = true;
        const rawJid = this.queue.values().next().value;
        if (!rawJid) {
            this.processing = false;
            return;
        }
        this.queue.delete(rawJid);
        try {
            const db = (0, database_1.getDb)();
            // Canonicalize JID for the API call (LIDs usually don't work for avatars)
            let jid = rawJid;
            if (rawJid.endsWith('@lid')) {
                const row = db.prepare('SELECT jid FROM contacts WHERE instance_id = ? AND lid = ? AND jid NOT LIKE \'%@lid\'').get(this.instanceId, rawJid);
                if (row?.jid)
                    jid = row.jid;
            }
            // TRY PREVIEW FIRST (Much more likely to succeed for individuals)
            let url = null;
            try {
                url = await this.request(async (sock) => await sock.profilePictureUrl(jid, 'preview'), TrafficManager_1.Priority.LOW);
            }
            catch (e) {
                // If preview fails, try high-res just in case
                try {
                    url = await this.request(async (sock) => await sock.profilePictureUrl(jid, 'image'), TrafficManager_1.Priority.LOW);
                }
                catch (e2) { }
            }
            if (url) {
                const response = await axios_1.default.get(url, { responseType: 'arraybuffer' });
                const fileName = `${jid.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
                const filePath = path_1.default.join(this.avatarDir, fileName);
                fs_1.default.writeFileSync(filePath, response.data);
                const now = new Date().toISOString();
                const relativePath = `avatars/${fileName}`;
                db.prepare('UPDATE contacts SET profile_picture = ?, profile_picture_timestamp = ? WHERE instance_id = ? AND jid = ?').run(relativePath, now, this.instanceId, rawJid);
                if (jid !== rawJid)
                    db.prepare('UPDATE contacts SET profile_picture = ?, profile_picture_timestamp = ? WHERE instance_id = ? AND jid = ?').run(relativePath, now, this.instanceId, jid);
                db.prepare('UPDATE chats SET profile_picture = ?, profile_picture_timestamp = ? WHERE instance_id = ? AND jid = ?').run(relativePath, now, this.instanceId, rawJid);
                if (jid !== rawJid)
                    db.prepare('UPDATE chats SET profile_picture = ?, profile_picture_timestamp = ? WHERE instance_id = ? AND jid = ?').run(relativePath, now, this.instanceId, jid);
            }
            else {
                // No URL = Privacy restricted or no pic
                const now = new Date().toISOString();
                db.prepare('UPDATE contacts SET profile_picture_timestamp = ? WHERE instance_id = ? AND jid = ?').run(now, this.instanceId, rawJid);
            }
        }
        catch (e) {
            const db = (0, database_1.getDb)();
            const now = new Date().toISOString();
            db.prepare('UPDATE contacts SET profile_picture_timestamp = ? WHERE instance_id = ? AND jid = ?').run(now, this.instanceId, rawJid);
        }
        finally {
            this.processing = false;
        }
    }
}
exports.ProfilePictureManager = ProfilePictureManager;
