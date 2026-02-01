"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Add timestamp to console logs IMMEDIATELY
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => originalLog(`[${new Date().toISOString()}]`, ...args);
console.error = (...args) => originalError(`[${new Date().toISOString()}]`, ...args);
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = require("./db/database");
const EngineManager_1 = require("./manager/EngineManager");
// Auth Middleware
const authMiddleware_1 = require("./api/authMiddleware");
// Routes
const auth_1 = require("./api/routes/auth");
const instances_1 = require("./api/routes/instances");
const messaging_1 = require("./api/routes/messaging");
const social_1 = require("./api/routes/social");
const system_1 = require("./api/routes/system");
process.on('uncaughtException', (err) => console.error('CRITICAL Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('CRITICAL Rejection:', promise, 'reason:', reason));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, { cors: { origin: "*" } });
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PUBLIC_PATH = path_1.default.join(__dirname, 'public');
app.use(express_1.default.static(PUBLIC_PATH));
const MEDIA_PATH = process.env.NODE_ENV === 'development' ? path_1.default.join(__dirname, '../media') : '/data/media';
app.use('/media', express_1.default.static(MEDIA_PATH));
const OPTIONS_PATH = '/data/options.json';
const getAddonConfig = () => {
    try {
        if (fs_1.default.existsSync(OPTIONS_PATH))
            return JSON.parse(fs_1.default.readFileSync(OPTIONS_PATH, 'utf8'));
    }
    catch (e) { }
    return { password: "" };
};
const GlobalAuthService_1 = require("./services/GlobalAuthService");
async function bootstrap() {
    console.log('--- STARTING BOOTSTRAP ---');
    try {
        const fixes = require('./last_fixes.json');
        console.log('--- BUILD VERSION INFO ---');
        console.log(`Timestamp: ${fixes.timestamp}`);
        console.log(`Description: ${fixes.description}`);
        console.log('--------------------------');
    }
    catch (e) {
        console.log('Build version info not found.');
    }
    // Initialize Global Auth (Fetch Keys)
    await GlobalAuthService_1.GlobalAuthService.init();
    await new Promise(r => setTimeout(r, 5000));
    const config = getAddonConfig();
    (0, database_1.initDatabase)();
    const debugEnabled = config.debug_logging === true || config.debug_logging === 'true';
    await EngineManager_1.engineManager.init(io, debugEnabled);
    // Global Identity Resolver
    app.use(authMiddleware_1.identityResolver);
    // Mount Routes
    app.use('/api/auth', (0, auth_1.authRouter)(getAddonConfig));
    app.use('/api/instances', (0, instances_1.instancesRouter)());
    app.use('/api', (0, messaging_1.messagingRouter)());
    app.use('/api', (0, social_1.socialRouter)());
    app.use('/api', (0, system_1.systemRouter)());
    io.on('connection', (socket) => {
        socket.on('subscribe_raw_events', () => socket.raw_debug = true);
        const interval = setInterval(() => {
            const all = EngineManager_1.engineManager.getAllInstances();
            if (all.length > 0)
                socket.emit('instances_status', all.map(i => ({ id: i.id, status: i.status, presence: i.presence, qr: i.qr })));
        }, 2000);
        socket.on('disconnect', () => clearInterval(interval));
    });
    app.get('*', (req, res) => {
        const file = path_1.default.join(PUBLIC_PATH, 'index.html');
        if (fs_1.default.existsSync(file))
            res.sendFile(file);
        else
            res.send("<h1>WhatsApp Pro</h1><p>Frontend loading...</p>");
    });
    server.listen(5002, '0.0.0.0', () => console.log(`WhatsApp Pro Backend listening on port 5002`));
    // Graceful Shutdown
    const shutdown = async (signal) => {
        console.log(`Received ${signal}. Shutting down gracefully...`);
        // Stop all instances
        const instances = EngineManager_1.engineManager.getAllInstances();
        for (const inst of instances) {
            console.log(`Stopping Instance ${inst.id}...`);
            await inst.close();
        }
        // Close Server
        server.close(() => {
            console.log('HTTP/Socket Server closed.');
            process.exit(0);
        });
        // Force exit if hanging
        setTimeout(() => {
            console.error('Force shutdown after timeout.');
            process.exit(1);
        }, 10000);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
bootstrap().catch(err => console.error('Fatal bootstrap error:', err));
