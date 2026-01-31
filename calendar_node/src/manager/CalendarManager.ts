import { google } from 'googleapis';
import { GoogleAuthManager } from './GoogleAuthManager';
import { CalendarDatabase } from '../db/CalendarDatabase';
import { CalendarEvent } from '../shared_schemas';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export class CalendarManager {
  private authManagers: Map<string, GoogleAuthManager> = new Map();
  private db: CalendarDatabase;

  constructor(db: CalendarDatabase) {
    this.db = db;
  }

  public registerGoogleInstance(instanceId: string, auth: GoogleAuthManager) {
    this.authManagers.set(instanceId, auth);
  }

  public async syncAll() {
    const instances = this.db.getInstances();
    for (const inst of instances) {
      if (inst.type === 'google') {
        await this.syncGoogleInstance(inst.id);
      } else if (inst.type === 'ics') {
        // TODO: Implement ICS Sync
      }
    }
  }

  private async syncGoogleInstance(instanceId: string) {
    const auth = this.authManagers.get(instanceId);
    if (!auth || !auth.isAuthorized()) return;

    const calendar = google.calendar({ version: 'v3', auth: auth.getClient() });
    
    // 1. Sync Calendar List to update Roles
    const calList = await calendar.calendarList.list();
    for (const cal of calList.data.items || []) {
       // We don't overwrite role if it already exists in DB
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

    // 2. Sync Events for non-ignored calendars
    // ... logic to follow
  }

  public async getAggregatedPresence() {
    const presenceCalendars = this.db.getCalendarsByRole('presence');
    // Combine events from all presence-mapped calendars to determine sensor state
  }

  // The "Adriana Shield" Logic
  public async updateSocialSlots() {
    const socialCals = this.db.getCalendarsByRole('social_slots');
    if (socialCals.length === 0) return;

    // 1. Gather all busy blocks from Primary/Private/Fixed
    // 2. Sync to Social calendar as "Busy"
  }
}
