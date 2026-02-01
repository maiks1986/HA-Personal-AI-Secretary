import { WASocket } from '@whiskeysockets/baileys';
import { getDb } from '../../db/database';
import { Priority } from './TrafficManager';

export class StealthManager {
    private interval: NodeJS.Timeout | null = null;
    private lastAppliedMode: string | null = null;

    constructor(
        private instanceId: number, 
        private request: <T>(execute: (sock: WASocket) => Promise<T>, priority?: Priority) => Promise<T>
    ) {}

    public start() {
        if (this.interval) return;
        // Check every minute
        this.interval = setInterval(() => this.checkSchedules(), 60 * 1000);
        console.log(`[StealthManager ${this.instanceId}]: Started scheduler.`);
        this.checkSchedules(); // Run immediately on start
    }

    public stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
    }

    private async checkSchedules() {
        const db = getDb();
        const now = new Date();
        const currentDay = now.getDay(); // 0 (Sun) to 6 (Sat)
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        // Get active schedules for this instance
        const schedules = db.prepare('SELECT * FROM stealth_schedules WHERE instance_id = ? AND is_enabled = 1').all(this.instanceId) as any[];

        let activeMode: 'GLOBAL_NOBODY' | 'SPECIFIC_CONTACTS' | null = null;
        let activeSchedule: any = null;

        for (const schedule of schedules) {
            const days = JSON.parse(schedule.days || '[]');
            if (days.length > 0 && !days.includes(currentDay)) continue;

            const isInRange = this.isTimeInRange(currentTime, schedule.start_time, schedule.end_time);
            if (isInRange) {
                activeMode = schedule.mode;
                activeSchedule = schedule;
                break; // Use the first matching schedule
            }
        }

        if (activeMode !== this.lastAppliedMode) {
            await this.applyStealthMode(activeMode, activeSchedule);
            this.lastAppliedMode = activeMode;
        }
    }

    private isTimeInRange(current: string, start: string, end: string): boolean {
        if (start <= end) {
            return current >= start && current <= end;
        } else {
            // Overnights (e.g. 22:00 to 06:00)
            return current >= start || current <= end;
        }
    }

    private async applyStealthMode(mode: 'GLOBAL_NOBODY' | 'SPECIFIC_CONTACTS' | null, schedule: any) {
        try {
            if (!mode) {
                console.log(`[StealthManager ${this.instanceId}]: Reverting to default privacy (Everyone).`);
                await this.request(async (sock: any) => await sock.updatePrivacySetting('lastSeen', 'all'), Priority.MEDIUM);
                await this.request(async (sock: any) => await sock.updatePrivacySetting('online', 'all'), Priority.MEDIUM);
                return;
            }

            if (mode === 'GLOBAL_NOBODY') {
                console.log(`[StealthManager ${this.instanceId}]: Applying Global Stealth Mode (Nobody).`);
                await this.request(async (sock: any) => await sock.updatePrivacySetting('lastSeen', 'none'), Priority.MEDIUM);
                await this.request(async (sock: any) => await sock.updatePrivacySetting('online', 'match_last_seen'), Priority.MEDIUM);
            } 
            
            if (mode === 'SPECIFIC_CONTACTS') {
                console.log(`[StealthManager ${this.instanceId}]: Applying Specific Stealth Mode for ${schedule.name}.`);
                const db = getDb();
                const targets = db.prepare('SELECT contact_jid FROM stealth_targets WHERE schedule_id = ?').all(schedule.id) as any[];
                const jids = targets.map(t => t.contact_jid);

                await this.request(async (sock: any) => await sock.updatePrivacySetting('lastSeen', 'contact_blacklist'), Priority.MEDIUM);
                await this.request(async (sock: any) => await sock.updatePrivacySetting('online', 'match_last_seen'), Priority.MEDIUM);
                
                console.log(`[StealthManager]: Targets for exclusion: ${jids.join(', ')}`);
            }
        } catch (e) {
            console.error(`[StealthManager ${this.instanceId}]: Failed to apply privacy settings`, e);
        }
    }
}
