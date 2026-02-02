"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const pino_1 = __importDefault(require("pino"));
const fs_1 = require("fs");
const path_1 = require("path");
const database_1 = require("./db/database");
const RegistryManager_1 = require("./manager/RegistryManager");
const AiManager_1 = require("./manager/AiManager");
const KeyManager_1 = require("./manager/KeyManager");
const GlobalAuthService_1 = require("./services/GlobalAuthService");
const authMiddleware_1 = require("./api/authMiddleware");
const shared_schemas_1 = require("./shared_schemas");
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
});
// --- Startup: Initialize Database & Sync HA Options ---
(0, database_1.initDatabase)();
function syncHaOptions() {
    const optionsPath = '/data/options.json';
    if ((0, fs_1.existsSync)(optionsPath)) {
        try {
            const options = JSON.parse((0, fs_1.readFileSync)(optionsPath, 'utf-8'));
            const db = (0, database_1.getDb)();
            const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
            for (const [key, value] of Object.entries(options)) {
                stmt.run(key, String(value));
            }
            logger.info('HA Options synced to settings table.');
        }
        catch (e) {
            logger.error(`Failed to sync HA options: ${e.message}`);
        }
    }
}
syncHaOptions();
GlobalAuthService_1.GlobalAuthService.init();
const app = (0, express_1.default)();
const port = 5005;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(authMiddleware_1.identityResolver);
// Helper to format Zod errors
const formatZodError = (errors) => errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
// Load last fixes for health check
let lastFixes = { timestamp: '', description: '' };
try {
    lastFixes = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'last_fixes.json'), 'utf-8'));
}
catch (e) {
    logger.warn('Could not load last_fixes.json');
}
// --- Routes ---
// Health Check (Public)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        version: process.env.npm_package_version || '0.0.1.0005',
        last_fix: lastFixes
    });
});
// --- Settings API (Contract Aligned) ---
app.get('/settings', authMiddleware_1.requireAdmin, (req, res) => {
    const db = (0, database_1.getDb)();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => {
        // Mask secrets for UI
        if (r.key.toLowerCase().includes('secret') || r.key.toLowerCase().includes('token') || r.key.toLowerCase().includes('key')) {
            settings[r.key] = '********';
        }
        else {
            settings[r.key] = r.value;
        }
    });
    res.json({ success: true, data: settings });
});
app.post('/settings', authMiddleware_1.requireAdmin, (req, res) => {
    const { key, value } = req.body;
    if (!key)
        return res.status(400).json({ success: false, error: 'Key is required' });
    const db = (0, database_1.getDb)();
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
    res.json({ success: true });
});
// --- Key Management API (Internal) ---
app.get('/keys', authMiddleware_1.requireAdmin, (req, res) => {
    try {
        const keys = KeyManager_1.KeyManager.listKeys();
        res.json({ success: true, data: keys });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
app.post('/keys', authMiddleware_1.requireAdmin, (req, res) => {
    const { provider, key, label, type } = req.body;
    if (!provider || !key) {
        return res.status(400).json({ success: false, error: 'Provider and Key are required' });
    }
    try {
        KeyManager_1.KeyManager.addKey(provider, key, label, type || 'static');
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
app.delete('/keys/:id', authMiddleware_1.requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id))
        return res.status(400).json({ success: false, error: 'Invalid ID' });
    try {
        KeyManager_1.KeyManager.removeKey(id);
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// --- Registry & AI (Contract Aligned) ---
// Registry: Add-ons check-in here
app.post('/registry/check-in', authMiddleware_1.requireAuth, (req, res) => {
    const result = shared_schemas_1.RegistrationRequestSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ success: false, error: formatZodError(result.error.errors) });
    }
    RegistryManager_1.RegistryManager.registerAddon(result.data);
    res.json({ success: true, data: { registered: result.data.slug } });
});
// Intelligence API
app.post('/v1/process', authMiddleware_1.requireAuth, async (req, res) => {
    const result = shared_schemas_1.IntelligenceRequestSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ success: false, error: formatZodError(result.error.errors) });
    }
    try {
        const response = await AiManager_1.AiManager.processRequest(result.data);
        res.json({ success: true, data: response });
    }
    catch (error) {
        logger.error(`AI Error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Bus Dispatch: Route requests between addons
app.post('/bus/dispatch', authMiddleware_1.requireAuth, async (req, res) => {
    const result = shared_schemas_1.ActionRequestSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ success: false, error: formatZodError(result.error.errors) });
    }
    const { target, action, payload } = result.data;
    logger.info(`Dispatching action '${action}' to target '${target}'`);
    const targetAddon = RegistryManager_1.RegistryManager.getAddon(target);
    if (!targetAddon) {
        return res.status(404).json({ success: false, error: `Target add-on '${target}' not found or not registered.` });
    }
    // TODO: Implement actual forwarding to targetAddon.port
    res.json({
        success: true,
        data: {
            status: 'dispatched_placeholder',
            target,
            action,
            target_port: targetAddon.port
        }
    });
});
// Serve static frontend
app.use(express_1.default.static((0, path_1.join)(__dirname, 'public')));
app.listen(port, '0.0.0.0', () => {
    logger.info(`AI Gateway listening at http://0.0.0.0:${port}`);
});
