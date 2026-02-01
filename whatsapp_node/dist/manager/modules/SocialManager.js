"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialManager = void 0;
const database_1 = require("../../db/database");
const utils_1 = require("../../utils");
const axios_1 = __importDefault(require("axios"));
class SocialManager {
    instanceId;
    activeSessions = new Map(); // JID -> StartTimestamp
    constructor(instanceId) {
        this.instanceId = instanceId;
    }
    async handlePresenceUpdate(jid, presence) {
        const db = (0, database_1.getDb)();
        const normalized = (0, utils_1.normalizeJid)(jid);
        // Check if tracked
        const tracked = db.prepare('SELECT * FROM tracked_contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, normalized);
        if (!tracked)
            return;
        // Presence structure: { 'jid': { lastKnownPresence: 'available' } }
        // The event usually comes as { id: '...', presences: { ... } }
        // Here we receive the specific JID and its presence data
        // Wait, WhatsAppInstance calls this with: 
        // emit('presence_update', { ..., presence: update.presences })
        // update.presences is the map.
        // Let's assume the caller passes the specific status for this JID?
        // No, let's parse the map.
        const participant = presence[normalized] || presence[Object.keys(presence)[0]];
        const status = participant?.lastKnownPresence;
        if (status === 'available') {
            if (!this.activeSessions.has(normalized)) {
                this.activeSessions.set(normalized, Date.now());
                await this.updateHASensor(normalized, 'on', { status: 'online' });
            }
        }
        else {
            // Offline / Unavailable / Composing (ignored)
            // Actually 'composing' means they are online.
            // But 'available' is the main online status.
            // If they were active and now 'unavailable' or missing
            const start = this.activeSessions.get(normalized);
            if (start && status !== 'composing' && status !== 'recording') {
                const duration = Math.floor((Date.now() - start) / 1000); // seconds
                this.activeSessions.delete(normalized);
                // Update DB stats
                db.prepare('UPDATE tracked_contacts SET last_online = ?, today_duration = today_duration + ? WHERE instance_id = ? AND jid = ?')
                    .run(new Date().toISOString(), duration, this.instanceId, normalized);
                const updated = db.prepare('SELECT * FROM tracked_contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, normalized);
                await this.updateHASensor(normalized, 'off', {
                    last_seen: new Date().toISOString(),
                    session_duration: duration,
                    today_duration_seconds: updated.today_duration
                });
            }
        }
    }
    trackContact(jid) {
        const db = (0, database_1.getDb)();
        db.prepare('INSERT OR IGNORE INTO tracked_contacts (instance_id, jid) VALUES (?, ?)').run(this.instanceId, (0, utils_1.normalizeJid)(jid));
        console.log(`[SocialManager]: Tracking ${jid}`);
    }
    untrackContact(jid) {
        const db = (0, database_1.getDb)();
        db.prepare('DELETE FROM tracked_contacts WHERE instance_id = ? AND jid = ?').run(this.instanceId, (0, utils_1.normalizeJid)(jid));
        console.log(`[SocialManager]: Untracking ${jid}`);
    }
    async updateHASensor(jid, state, attributes) {
        if (!process.env.SUPERVISOR_TOKEN) {
            // console.warn('[SocialManager]: No Supervisor Token, skipping HA update');
            return;
        }
        const cleanName = jid.split('@')[0];
        const entityId = `binary_sensor.wa_social_${cleanName}`;
        try {
            await axios_1.default.post(`http://supervisor/core/api/states/${entityId}`, {
                state: state,
                attributes: {
                    friendly_name: `WA ${cleanName}`,
                    icon: 'mdi:whatsapp',
                    ...attributes
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.SUPERVISOR_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
        }
        catch (e) {
            console.error(`[SocialManager] Failed to update HA sensor ${entityId}: ${e.message}`);
        }
    }
}
exports.SocialManager = SocialManager;
