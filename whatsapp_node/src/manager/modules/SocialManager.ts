import { getDb } from '../../db/database';
import { normalizeJid } from '../../utils';
import axios from 'axios';

export class SocialManager {
    private activeSessions: Map<string, number> = new Map(); // JID -> StartTimestamp

    constructor(private instanceId: number) {}

    private getName(jid: string): string {
        try {
            const db = getDb();
            const contact = db.prepare('SELECT name FROM contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, jid) as any;
            return contact?.name || jid.split('@')[0];
        } catch (e) {
            return jid.split('@')[0];
        }
    }

    public getSessionStart(jid: string): number | undefined {
        return this.activeSessions.get(normalizeJid(jid));
    }

    public async handlePresenceUpdate(jid: string, presence: any) {
        const db = getDb();
        const normalized = normalizeJid(jid);
        
        // Check if tracked
        const tracked = db.prepare('SELECT * FROM tracked_contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, normalized);
        if (!tracked) return;

        const participant = presence[normalized] || presence[Object.keys(presence)[0]];
        const status = participant?.lastKnownPresence;
        const name = this.getName(normalized);
        const nowIso = new Date().toISOString();

        if (status === 'available') {
            if (!this.activeSessions.has(normalized)) {
                const now = Date.now();
                this.activeSessions.set(normalized, now);
                
                db.prepare('UPDATE tracked_contacts SET status_since = ? WHERE instance_id = ? AND jid = ?')
                    .run(nowIso, this.instanceId, normalized);

                await this.updateHASensor(normalized, 'on', { 
                    status: 'online',
                    since: nowIso,
                    contact_name: name,
                    friendly_name: `${name} Online`
                }, true);
            }
        } else {
            const start = this.activeSessions.get(normalized);
            if (start && status !== 'composing' && status !== 'recording') {
                const duration = Math.floor((Date.now() - start) / 1000); // seconds
                this.activeSessions.delete(normalized);
                
                // Update DB stats
                db.prepare('UPDATE tracked_contacts SET last_online = ?, status_since = ?, today_duration = today_duration + ? WHERE instance_id = ? AND jid = ?')
                    .run(nowIso, nowIso, duration, this.instanceId, normalized);
                
                const updated = db.prepare('SELECT * FROM tracked_contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, normalized) as any;
                
                await this.updateHASensor(normalized, 'off', { 
                    last_seen: nowIso,
                    status_since: nowIso,
                    session_duration: duration,
                    today_duration_seconds: updated.today_duration,
                    contact_name: name,
                    friendly_name: `${name} Online`
                }, true);
            }
        }
    }

    /**
     * Records a message timestamp (sent or received) and updates HA sensors.
     */
    public async recordMessageActivity(jid: string, direction: 'sent' | 'received') {
        const db = getDb();
        const normalized = normalizeJid(jid);
        const now = new Date().toISOString();
        const name = this.getName(normalized);

        // Only update if the contact is in our tracked list
        const tracked = db.prepare('SELECT * FROM tracked_contacts WHERE instance_id = ? AND jid = ?').get(this.instanceId, normalized);
        if (!tracked) return;

        if (direction === 'sent') {
            db.prepare('UPDATE tracked_contacts SET last_outbound_timestamp = ? WHERE instance_id = ? AND jid = ?')
                .run(now, this.instanceId, normalized);
        } else {
            db.prepare('UPDATE tracked_contacts SET last_inbound_timestamp = ? WHERE instance_id = ? AND jid = ?')
                .run(now, this.instanceId, normalized);
        }

        // Update the specific sensor for the direction
        await this.updateHASensor(normalized, now, {
            jid: normalized,
            contact_name: name,
            friendly_name: direction === 'sent' ? `Last Sent to ${name}` : `Last Received from ${name}`,
            timestamp: now
        }, false, direction);
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

    private async updateHASensor(jid: string, state: string, attributes: any, isBinary: boolean = true, typeSuffix: string = '') {
        if (!process.env.SUPERVISOR_TOKEN) {
            return;
        }
        
        const cleanName = jid.split('@')[0];
        const domain = isBinary ? 'binary_sensor' : 'sensor';
        let suffix = isBinary ? 'social' : 'last_message';
        
        if (!isBinary && typeSuffix) {
            suffix = `last_message_${typeSuffix}`; // last_message_sent or last_message_received
        }
        
        const entityId = `${domain}.wa_${suffix}_${cleanName}`;
        
        try {
            await axios.post(`http://supervisor/core/api/states/${entityId}`, {
                state: state,
                attributes: {
                    icon: isBinary ? 'mdi:whatsapp' : (typeSuffix === 'sent' ? 'mdi:message-arrow-right' : 'mdi:message-arrow-left'),
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
