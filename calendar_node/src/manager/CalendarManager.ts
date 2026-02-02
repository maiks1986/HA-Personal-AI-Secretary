import { google } from 'googleapis';
import { GoogleAuthManager } from './GoogleAuthManager';
import { CalendarDatabase } from '../db/CalendarDatabase';
import { CalendarEvent } from '../shared_schemas';
import { GlobalAuthService } from '../services/GlobalAuthService';
import { AppConfig } from '../utils';
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
  private config: AppConfig;

  constructor(db: CalendarDatabase, config: AppConfig) {
    this.db = db;
    this.config = config;
  }

  public registerGoogleInstance(instanceId: string, auth: GoogleAuthManager) {
    this.authManagers.set(instanceId, auth);
  }

  public async syncAll() {
    const instances = this.db.getInstances() as any[];
    for (const inst of instances) {
      if (inst.type === 'google') {
        // Attempt to re-authorize if needed before sync
        await this.ensureAuthorized(inst);
        await this.syncGoogleInstance(inst.id);
      } else if (inst.type === 'ics') {
        // TODO: Implement ICS Sync
      }
    }
  }

  private async ensureAuthorized(inst: any) {
    const auth = this.authManagers.get(inst.id);
    if (!auth) return;

    if (!auth.isAuthorized()) {
      logger.info(`Instance ${inst.id} not authorized. Attempting background refresh...`);
      try {
        const instConfig = JSON.parse(inst.config);
        if (instConfig.owner_id && this.config.internal_token) {
          const googleTokens = await GlobalAuthService.getInternalOAuthToken('google', instConfig.owner_id, this.config.internal_token);
          if (googleTokens) {
            auth.setExternalTokens(googleTokens);
            logger.info(`Successfully refreshed background tokens for instance ${inst.id}`);
          }
        }
      } catch (err) {
        logger.error(err, `Failed to refresh background tokens for ${inst.id}`);
      }
    }
  }

  public async listCalendars(instanceId: string) {
    const auth = this.authManagers.get(instanceId);
    if (!auth || !auth.isAuthorized()) return [];

    const calendar = google.calendar({ version: 'v3', auth: auth.getClient() });
    const res = await calendar.calendarList.list();
    return res.data.items || [];
  }

  private async syncGoogleInstance(instanceId: string) {
    const auth = this.authManagers.get(instanceId);
    if (!auth || !auth.isAuthorized()) return;

    const calendar = google.calendar({ version: 'v3', auth: auth.getClient() });
    
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

  public async getAvailableSlots(start: string, end: string): Promise<CalendarEvent[]> {
    const rawEvents = this.db.getEvents(start, end) as any[];
    
    return rawEvents.map((row: any) => ({
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

  public async getAggregatedPresence() {
    const presenceCalendars = this.db.getCalendarsByRole('presence');
    // Combine events from all presence-mapped calendars to determine sensor state
    return presenceCalendars;
  }

  public async insertEvent(instanceId: string, eventDetails: any) {
    const auth = this.authManagers.get(instanceId);
    if (!auth || !auth.isAuthorized()) throw new Error('Instance not authorized');

    const calendar = google.calendar({ version: 'v3', auth: auth.getClient() });
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventDetails,
    });
    
    // Save to shadow DB immediately
    this.db.saveEvent(res.data, 'primary', instanceId);
    
    return res.data;
  }

  // The "Adriana Shield" Logic
  public async updateSocialSlots() {
    const socialCals = this.db.getCalendarsByRole('social_slots');
    if (socialCals.length === 0) return;

    // 1. Gather all busy blocks from Primary/Private/Fixed
    // 2. Sync to Social calendar as "Busy"
  }
}