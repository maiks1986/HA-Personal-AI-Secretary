import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import { loadConfig } from './utils';
import { GoogleAuthManager } from './manager/GoogleAuthManager';
import { CalendarDatabase } from './db/CalendarDatabase';
import { CalendarManager } from './manager/CalendarManager';
import { GlobalAuthService } from './services/GlobalAuthService';
import { authMiddleware } from './middleware/auth';
import { 
  HealthResponse, 
  AuthUrlResponse, 
  TokenExchangeRequest, 
  TokenExchangeResponse,
  CalendarListEntry,
  CalendarEvent,
  SyncResponse,
  TokenExchangeRequestSchema,
  CalendarCheckRequestSchema,
  CalendarInsertRequestSchema
} from './shared_schemas';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

const app = express();
const PORT = process.env.PORT || 5003;
const config = loadConfig();

// Initialize Managers
const db = new CalendarDatabase();
const calendarManager = new CalendarManager(db, config);

// Main Google Instance Initialization
const MAIN_INSTANCE_ID = 'main_google';
const authManager = new GoogleAuthManager(
  config.google_client_id,
  config.google_client_secret,
  process.env.REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
);

// Register the main instance
calendarManager.registerGoogleInstance(MAIN_INSTANCE_ID, authManager);

// Log Last Fix Information
try {
  const lastFixesPath = path.join(__dirname, 'last_fixes.json');
  if (fs.existsSync(lastFixesPath)) {
    const lastFixes = JSON.parse(fs.readFileSync(lastFixesPath, 'utf8'));
    logger.info(`[SYSTEM] Last Fix: ${lastFixes.description}`);
  }
} catch (err) {
  logger.warn('Could not load last_fixes.json');
}

// Initialize Global Auth
GlobalAuthService.init().catch(err => {
  logger.error(err, 'GlobalAuthService initialization failed');
});

app.use(cors());
app.use(express.json());
app.use(authMiddleware);

// Initialize Auth
authManager.loadTokens().then(async (loaded) => {
  if (loaded) {
    logger.info('Google Calendar tokens loaded from local storage');
    // Ensure instance is in DB
    try {
      db.saveInstance({
        id: MAIN_INSTANCE_ID,
        name: 'Main Google Account',
        type: 'google',
        config: {},
        is_active: true
      });
      // Initial sync
      calendarManager.syncAll().catch((err: any) => logger.error(err, 'Initial sync failed'));
    } catch (dbErr) {
      logger.error(dbErr, 'Failed to save initial instance to DB');
    }
  } else {
    logger.warn('No Google Calendar tokens found locally. Attempting background sync via Auth Node...');
    
    // Check if we have a saved instance with an owner_id to try internal sync
    const instances = db.getInstances() as any[];
    const mainInst = instances.find(i => i.id === MAIN_INSTANCE_ID);
    
    if (mainInst && mainInst.config) {
      try {
        const instConfig = JSON.parse(mainInst.config);
        if (instConfig.owner_id && config.internal_token) {
           const googleTokens = await GlobalAuthService.getInternalOAuthToken('google', instConfig.owner_id, config.internal_token);
           if (googleTokens) {
             logger.info(`Successfully retrieved background tokens for user ${instConfig.owner_id}`);
             authManager.setExternalTokens(googleTokens);
             calendarManager.syncAll().catch((err: any) => logger.error(err, 'Background initial sync failed'));
           }
        }
      } catch (err) {
        logger.error('Failed to process saved instance config for background sync');
      }
    }
  }
}).catch(err => {
  logger.error(err, 'Failed to load tokens');
});

// Basic Health Check
app.get('/health', (req: Request, res: Response<HealthResponse>) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0.0012',
    authorized: authManager.isAuthorized()
  });
});

// Auth Endpoints
app.get('/api/auth/url', (req: Request, res: Response<AuthUrlResponse>) => {
  const url = authManager.getAuthUrl();
  res.json({ url });
});

app.post('/api/auth/sync-provider', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const user = GlobalAuthService.verifyToken(token);
    const googleTokens = await GlobalAuthService.getOAuthToken('google', token);
    if (!googleTokens) {
      return res.status(400).json({ error: 'Failed to retrieve Google tokens from Auth Node. Ensure account is linked.' });
    }

    // Update the auth manager with the tokens from Auth Node
    authManager.setExternalTokens(googleTokens);
    
    db.saveInstance({
      id: MAIN_INSTANCE_ID,
      name: 'Main Google Account (Sync)',
      type: 'google',
      config: { 
        synced_from: 'auth_node',
        owner_id: user?.id 
      },
      is_active: true
    });

    calendarManager.syncAll().catch((err: any) => logger.error(err, 'Post-sync-provider sync failed'));

    res.json({ success: true });
  } catch (err: any) {
    logger.error(err, 'Failed to sync with Auth Node provider');
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/token', async (req: Request, res: Response<TokenExchangeResponse>) => {
  const validationResult = TokenExchangeRequestSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    return res.status(400).json({ 
      success: false, 
      error: validationResult.error.errors[0].message 
    });
  }

  const { code } = validationResult.data;

  try {
    await authManager.setTokens(code);
    logger.info('Successfully authorized with Google');
    
    db.saveInstance({
      id: MAIN_INSTANCE_ID,
      name: 'Main Google Account',
      type: 'google',
      config: {},
      is_active: true
    });

    calendarManager.syncAll().catch((err: any) => logger.error(err, 'Post-auth sync failed'));
    
    res.json({ success: true });
  } catch (err: any) {
    logger.error(err, 'Failed to exchange code');
    res.status(500).json({ success: false, error: err.message });
  }
});

// Calendar API Endpoints
app.get('/api/calendar/list', async (req: Request, res: Response<CalendarListEntry[] | { error: string }>) => {
  try {
    const calendars = await calendarManager.listCalendars(MAIN_INSTANCE_ID);
    const mapped: CalendarListEntry[] = calendars.map((cal: any) => ({
      id: cal.id,
      summary: cal.summary || 'Unknown',
      description: cal.description,
      primary: cal.primary,
      backgroundColor: cal.backgroundColor,
      foregroundColor: cal.foregroundColor
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/calendar/events', async (req: Request, res: Response<CalendarEvent[] | { error: string }>) => {
  const { start, end } = req.query;
  try {
    const events = await calendarManager.getAvailableSlots(
      (start as string) || new Date().toISOString(),
      (end as string) || new Date(Date.now() + 86400000).toISOString()
    );
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/calendar/check', async (req: Request, res: Response<CalendarEvent[] | { error: string }>) => {
  const validationResult = CalendarCheckRequestSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({ error: validationResult.error.errors[0].message });
  }

  const { start, end } = validationResult.data;
  try {
    const events = await calendarManager.getAvailableSlots(start, end);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/calendar/insert', async (req: Request, res: Response<any | { error: string }>) => {
  const validationResult = CalendarInsertRequestSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({ error: validationResult.error.errors[0].message });
  }

  const { subject, start, duration_minutes, description } = validationResult.data;
  const endTime = new Date(new Date(start).getTime() + (duration_minutes || 60) * 60000).toISOString();

  try {
    const event = await calendarManager.insertEvent(MAIN_INSTANCE_ID, {
      summary: subject,
      description: description,
      start: { dateTime: start },
      end: { dateTime: endTime },
    });
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/calendar/sync', async (req: Request, res: Response<SyncResponse | { error: string }>) => {
  try {
    await calendarManager.syncAll();
    res.json({ success: true, count: 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }
}

app.listen(PORT, () => {
  logger.info(`Calendar Master running on port ${PORT}`);
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Please check other add-ons.`);
  } else {
    logger.error(err, 'Server failed to start');
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ promise, reason }, 'Unhandled Rejection at Promise');
});

process.on('uncaughtException', (err) => {
  logger.error(err, 'Uncaught Exception thrown');
  process.exit(1);
});
