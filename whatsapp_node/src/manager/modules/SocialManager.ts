import { getDb } from '../../db/database';
import { normalizeJid } from '../../utils';
import axios from 'axios';

export class SocialManager {
    private activeSessions: Map<string, number> = new Map(); // JID -> StartTimestamp

    constructor(private instanceId: number) {}

    public async handlePresenceUpdate(jid: string, presence: any) {
        const db = getDb();
        const normalized = normalizeJid(jid);
        
        // Check if tracked
        const tracked = db.prepare('SELECT * FROM tracked_contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, normalized);
        if (!tracked) return;

        const participant = presence[normalized] || presence[Object.keys(presence)[0]];
        const status = participant?.lastKnownPresence;

        if (status === 'available') {
            if (!this.activeSessions.has(normalized)) {
                this.activeSessions.set(normalized, Date.now());
                await this.updateHASensor(normalized, 'on', { status: 'online' }, true);
            }
        } else {
            const start = this.activeSessions.get(normalized);
            if (start && status !== 'composing' && status !== 'recording') {
                const duration = Math.floor((Date.now() - start) / 1000); // seconds
                this.activeSessions.delete(normalized);
                
                // Update DB stats
                db.prepare('UPDATE tracked_contacts SET last_online = ?, today_duration = today_duration + ? WHERE instance_id = ? AND jid = ?')
                    .run(new Date().toISOString(), duration, this.instanceId, normalized);
                
                const updated = db.prepare('SELECT * FROM tracked_contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, normalized) as any;
                
                await this.updateHASensor(normalized, 'off', { 
                    last_seen: new Date().toISOString(),
                    session_duration: duration,
                    today_duration_seconds: updated.today_duration 
                }, true);
            }
        }
    }

    /**
     * Records an outbound message timestamp and updates HA sensor.
     */
    public async recordOutboundMessage(jid: string) {
        const db = getDb();
        const normalized = normalizeJid(jid);
        const now = new Date().toISOString();

        // Only update if the contact is in our tracked list
        const tracked = db.prepare('SELECT * FROM tracked_contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, normalized);
        if (!tracked) return;

        db.prepare('UPDATE tracked_contacts SET last_outbound_timestamp = ? WHERE instance_id = ? AND jid = ?')
            .run(now, this.instanceId, normalized);

        await this.updateHASensor(normalized, now, {
            jid: normalized,
            friendly_name: `Last Messaged ${normalized.split('@')[0]}`
        }, false);
    }

    public trackContact(jid: string) {
        const db = getDb();
        db.prepare('INSERT OR IGNORE INTO tracked_contacts (instance_id, jid) VALUES (?, ?)').run(this.instanceId, normalizeJid(jid));
        console.log(`[SocialManager]: Tracking ${jid}`);
    }

    public untrackContact(jid: string) {
        const db = getDb();
        db.prepare('DELETE FROM tracked_contacts WHERE instance_id = ? AND jid = ?').run(this.instanceId, normalizeJid(jid));
        console.log(`[SocialManager]: Untracking ${jid}`);
    }

    private async updateHASensor(jid: string, state: string, attributes: any, isBinary: boolean = true) {
        if (!process.env.SUPERVISOR_TOKEN) {
            return;
        }
        
        const cleanName = jid.split('@')[0];
        const domain = isBinary ? 'binary_sensor' : 'sensor';
        const suffix = isBinary ? 'social' : 'last_messaged';
        const entityId = `${domain}.wa_${suffix}_${cleanName}`;
        
        try {
            await axios.post(`http://supervisor/core/api/states/${entityId}`, {
                state: state,
                attributes: {
                    friendly_name: isBinary ? `WA Online ${cleanName}` : `WA Last Messaged ${cleanName}`,
                    icon: isBinary ? 'mdi:whatsapp' : 'mdi:history',
                    ...attributes
                }
            }, {
                headers: { 
                    'Authorization': `Bearer ${process.env.SUPERVISOR_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (e: any) {
            console.error(`[SocialManager] Failed to update HA sensor ${entityId}: ${e.message}`);
        }
    }
}
