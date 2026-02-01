"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pino_1 = __importDefault(require("pino"));
const utils_1 = require("./utils");
const GoogleAuthManager_1 = require("./manager/GoogleAuthManager");
const CalendarDatabase_1 = require("./db/CalendarDatabase");
const CalendarManager_1 = require("./manager/CalendarManager");
const GlobalAuthService_1 = require("./services/GlobalAuthService");
const auth_1 = require("./middleware/auth");
const shared_schemas_1 = require("./shared_schemas");
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5003;
const config = (0, utils_1.loadConfig)();
// Initialize Managers
const db = new CalendarDatabase_1.CalendarDatabase();
const calendarManager = new CalendarManager_1.CalendarManager(db);
// Main Google Instance Initialization
const MAIN_INSTANCE_ID = 'main_google';
const authManager = new GoogleAuthManager_1.GoogleAuthManager(config.google_client_id, config.google_client_secret, process.env.REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob');
// Register the main instance
calendarManager.registerGoogleInstance(MAIN_INSTANCE_ID, authManager);
// Log Last Fix Information
try {
    const lastFixesPath = path_1.default.join(__dirname, 'last_fixes.json');
    if (fs_1.default.existsSync(lastFixesPath)) {
        const lastFixes = JSON.parse(fs_1.default.readFileSync(lastFixesPath, 'utf8'));
        logger.info(`[SYSTEM] Last Fix: ${lastFixes.description}`);
    }
}
catch (err) {
    logger.warn('Could not load last_fixes.json');
}
// Initialize Global Auth
GlobalAuthService_1.GlobalAuthService.init().catch(err => {
    logger.error(err, 'GlobalAuthService initialization failed');
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(auth_1.authMiddleware);
// Initialize Auth
authManager.loadTokens().then(loaded => {
    if (loaded) {
        logger.info('Google Calendar tokens loaded');
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
            calendarManager.syncAll().catch((err) => logger.error(err, 'Initial sync failed'));
        }
        catch (dbErr) {
            logger.error(dbErr, 'Failed to save initial instance to DB');
        }
    }
    else {
        logger.warn('No Google Calendar tokens found. Authentication required.');
    }
}).catch(err => {
    logger.error(err, 'Failed to load tokens');
});
// Basic Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.0.0010',
        authorized: authManager.isAuthorized()
    });
});
// Auth Endpoints
app.get('/api/auth/url', (req, res) => {
    const url = authManager.getAuthUrl();
    res.json({ url });
});
app.post('/api/auth/token', async (req, res) => {
    const validationResult = shared_schemas_1.TokenExchangeRequestSchema.safeParse(req.body);
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
        calendarManager.syncAll().catch((err) => logger.error(err, 'Post-auth sync failed'));
        res.json({ success: true });
    }
    catch (err) {
        logger.error(err, 'Failed to exchange code');
        res.status(500).json({ success: false, error: err.message });
    }
});
// Calendar API Endpoints
app.get('/api/calendar/list', async (req, res) => {
    try {
        const calendars = await calendarManager.listCalendars(MAIN_INSTANCE_ID);
        const mapped = calendars.map((cal) => ({
            id: cal.id,
            summary: cal.summary || 'Unknown',
            description: cal.description,
            primary: cal.primary,
            backgroundColor: cal.backgroundColor,
            foregroundColor: cal.foregroundColor
        }));
        res.json(mapped);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/calendar/events', async (req, res) => {
    const { start, end } = req.query;
    try {
        const events = await calendarManager.getAvailableSlots(start || new Date().toISOString(), end || new Date(Date.now() + 86400000).toISOString());
        res.json(events);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/calendar/check', async (req, res) => {
    const validationResult = shared_schemas_1.CalendarCheckRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
        return res.status(400).json({ error: validationResult.error.errors[0].message });
    }
    const { start, end } = validationResult.data;
    try {
        const events = await calendarManager.getAvailableSlots(start, end);
        res.json(events);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/calendar/insert', async (req, res) => {
    const validationResult = shared_schemas_1.CalendarInsertRequestSchema.safeParse(req.body);
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/calendar/sync', async (req, res) => {
    try {
        await calendarManager.syncAll();
        res.json({ success: true, count: 0 });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
    const publicPath = path_1.default.join(__dirname, 'public');
    if (fs_1.default.existsSync(publicPath)) {
        app.use(express_1.default.static(publicPath));
        app.get('*', (req, res) => {
            res.sendFile(path_1.default.join(publicPath, 'index.html'));
        });
    }
}
app.listen(PORT, () => {
    logger.info(`Calendar Master running on port ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Please check other add-ons.`);
    }
    else {
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
