"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StealthManager = void 0;
const database_1 = require("../../db/database");
const TrafficManager_1 = require("./TrafficManager");
class StealthManager {
    instanceId;
    request;
    interval = null;
    lastAppliedMode = null;
    constructor(instanceId, request) {
        this.instanceId = instanceId;
        this.request = request;
    }
    start() {
        if (this.interval)
            return;
        // Check every minute
        this.interval = setInterval(() => this.checkSchedules(), 60 * 1000);
        console.log(`[StealthManager ${this.instanceId}]: Started scheduler.`);
        this.checkSchedules(); // Run immediately on start
    }
    stop() {
        if (this.interval)
            clearInterval(this.interval);
        this.interval = null;
    }
    async checkSchedules() {
        const db = (0, database_1.getDb)();
        const now = new Date();
        const currentDay = now.getDay(); // 0 (Sun) to 6 (Sat)
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        // Get active schedules for this instance
        const schedules = db.prepare('SELECT * FROM stealth_schedules WHERE instance_id = ? AND is_enabled = 1').all(this.instanceId);
        let activeMode = null;
        let activeSchedule = null;
        for (const schedule of schedules) {
            const days = JSON.parse(schedule.days || '[]');
            if (days.length > 0 && !days.includes(currentDay))
                continue;
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
    isTimeInRange(current, start, end) {
        if (start <= end) {
            return current >= start && current <= end;
        }
        else {
            // Overnights (e.g. 22:00 to 06:00)
            return current >= start || current <= end;
        }
    }
    async applyStealthMode(mode, schedule) {
        try {
            if (!mode) {
                console.log(`[StealthManager ${this.instanceId}]: Reverting to default privacy (Everyone).`);
                await this.request(async (sock) => await sock.updatePrivacySetting('lastSeen', 'all'), TrafficManager_1.Priority.MEDIUM);
                await this.request(async (sock) => await sock.updatePrivacySetting('online', 'all'), TrafficManager_1.Priority.MEDIUM);
                return;
            }
            if (mode === 'GLOBAL_NOBODY') {
                console.log(`[StealthManager ${this.instanceId}]: Applying Global Stealth Mode (Nobody).`);
                await this.request(async (sock) => await sock.updatePrivacySetting('lastSeen', 'none'), TrafficManager_1.Priority.MEDIUM);
                await this.request(async (sock) => await sock.updatePrivacySetting('online', 'match_last_seen'), TrafficManager_1.Priority.MEDIUM);
            }
            if (mode === 'SPECIFIC_CONTACTS') {
                console.log(`[StealthManager ${this.instanceId}]: Applying Specific Stealth Mode for ${schedule.name}.`);
                const db = (0, database_1.getDb)();
                const targets = db.prepare('SELECT contact_jid FROM stealth_targets WHERE schedule_id = ?').all(schedule.id);
                const jids = targets.map(t => t.contact_jid);
                await this.request(async (sock) => await sock.updatePrivacySetting('lastSeen', 'contact_blacklist'), TrafficManager_1.Priority.MEDIUM);
                await this.request(async (sock) => await sock.updatePrivacySetting('online', 'match_last_seen'), TrafficManager_1.Priority.MEDIUM);
                console.log(`[StealthManager]: Targets for exclusion: ${jids.join(', ')}`);
            }
        }
        catch (e) {
            console.error(`[StealthManager ${this.instanceId}]: Failed to apply privacy settings`, e);
        }
    }
}
exports.StealthManager = StealthManager;
