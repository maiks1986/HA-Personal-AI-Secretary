"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarManager = void 0;
const googleapis_1 = require("googleapis");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});
class CalendarManager {
    authManagers = new Map();
    db;
    constructor(db) {
        this.db = db;
    }
    registerGoogleInstance(instanceId, auth) {
        this.authManagers.set(instanceId, auth);
    }
    async syncAll() {
        const instances = this.db.getInstances();
        for (const inst of instances) {
            if (inst.type === 'google') {
                await this.syncGoogleInstance(inst.id);
            }
            else if (inst.type === 'ics') {
                // TODO: Implement ICS Sync
            }
        }
    }
    async listCalendars(instanceId) {
        const auth = this.authManagers.get(instanceId);
        if (!auth || !auth.isAuthorized())
            return [];
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth: auth.getClient() });
        const res = await calendar.calendarList.list();
        return res.data.items || [];
    }
    async syncGoogleInstance(instanceId) {
        const auth = this.authManagers.get(instanceId);
        if (!auth || !auth.isAuthorized())
            return;
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth: auth.getClient() });
        // 1. Sync Calendar List to update Roles
        const calList = await calendar.calendarList.list();
        for (const cal of calList.data.items || []) {
            this.db.saveCalendar({
                id: `${instanceId}_${cal.id}`,
                instance_id: instanceId,
                external_id: cal.id,
                summary: cal.summary,
                role: 'ignore', // Default
                sync_token: null,
                last_sync: new Date().toISOString()
            });
        }
        // 2. Sync Events for all active calendars
        // Note: In a future update, we can filter by role here to save API calls
        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: 100,
            singleEvents: true,
            orderBy: 'startTime',
        });
        const events = res.data.items || [];
        for (const event of events) {
            this.db.saveEvent(event, 'primary', instanceId);
        }
        logger.info(`Synced ${events.length} events for instance ${instanceId}`);
    }
    async getAvailableSlots(start, end) {
        const rawEvents = this.db.getEvents(start, end);
        return rawEvents.map((row) => ({
            id: row.id,
            calendar_id: row.calendar_id,
            summary: row.summary,
            description: row.description,
            start_time: row.start_time,
            end_time: row.end_time,
            location: row.location,
            status: row.status,
        }));
    }
    async getAggregatedPresence() {
        const presenceCalendars = this.db.getCalendarsByRole('presence');
        // Combine events from all presence-mapped calendars to determine sensor state
        return presenceCalendars;
    }
    async insertEvent(instanceId, eventDetails) {
        const auth = this.authManagers.get(instanceId);
        if (!auth || !auth.isAuthorized())
            throw new Error('Instance not authorized');
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth: auth.getClient() });
        const res = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: eventDetails,
        });
        // Save to shadow DB immediately
        this.db.saveEvent(res.data, 'primary', instanceId);
        return res.data;
    }
    // The "Adriana Shield" Logic
    async updateSocialSlots() {
        const socialCals = this.db.getCalendarsByRole('social_slots');
        if (socialCals.length === 0)
            return;
        // 1. Gather all busy blocks from Primary/Private/Fixed
        // 2. Sync to Social calendar as "Busy"
    }
}
exports.CalendarManager = CalendarManager;
