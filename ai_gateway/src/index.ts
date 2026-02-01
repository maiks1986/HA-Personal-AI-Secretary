import express from 'express';
import cors from 'cors';
import pino from 'pino';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { initDatabase, getDb } from './db/database';
import { RegistryManager } from './manager/RegistryManager';
import { AiManager } from './manager/AiManager';
import { KeyManager } from './manager/KeyManager';
import { OAuthManager } from './manager/OAuthManager';
import { GlobalAuthService } from './services/GlobalAuthService';
import { identityResolver, requireAuth, requireAdmin } from './api/authMiddleware';
import { 
    IntelligenceRequestSchema, 
    ActionRequestSchema, 
    RegistrationRequestSchema, 
    ApiResponse 
} from './shared_schemas';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
});

// --- Startup: Initialize Database & Sync HA Options ---
initDatabase();

function syncHaOptions() {
    const optionsPath = '/data/options.json';
    if (existsSync(optionsPath)) {
        try {
            const options = JSON.parse(readFileSync(optionsPath, 'utf-8'));
            const db = getDb();
            const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
            
            for (const [key, value] of Object.entries(options)) {
                stmt.run(key, String(value));
            }
            logger.info('HA Options synced to settings table.');
        } catch (e: any) {
            logger.error(`Failed to sync HA options: ${e.message}`);
        }
    }
}
syncHaOptions();

GlobalAuthService.init();

const app = express();
const port = 5005;

app.use(cors());
app.use(express.json());
app.use(identityResolver);

// Helper to format Zod errors
const formatZodError = (errors: any[]) => errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');

// Load last fixes for health check
let lastFixes = { timestamp: '', description: '' };
try {
    lastFixes = JSON.parse(readFileSync(join(__dirname, 'last_fixes.json'), 'utf-8'));
} catch (e) {
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

// --- Auth Routes (Contract Aligned) ---

app.get('/auth/google/url', (req, res) => {
    try {
        const url = OAuthManager.getAuthUrl();
        res.json({ success: true, data: { url } } as ApiResponse);
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message } as ApiResponse);
    }
});

// Contract requires GET /auth/google/callback
app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing code parameter');

    try {
        const tokens = await OAuthManager.exchangeCode(code as string);
        // Store the main API Key or Tokens in settings/keys
        // For simplicity and to satisfy the 'strip out' request, we'll store it as a specific key
        KeyManager.addKey('gemini', JSON.stringify(tokens), 'Google Auth Account', 'oauth');
        
        // Redirect back to dashboard or show success
        res.send('<h1>Authentication Successful</h1><p>You can close this window and return to the AI Gateway Dashboard.</p><script>setTimeout(() => window.close(), 3000)</script>');
    } catch (e: any) {
        logger.error(`Auth Callback Error: ${e.message}`);
        res.status(500).send(`Authentication Failed: ${e.message}`);
    }
});

// --- Settings API (Contract Aligned) ---

app.get('/settings', requireAdmin, (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as {key: string, value: string}[];
    const settings: Record<string, string> = {};
    rows.forEach(r => {
        // Mask secrets for UI
        if (r.key.toLowerCase().includes('secret') || r.key.toLowerCase().includes('token') || r.key.toLowerCase().includes('key')) {
            settings[r.key] = '********';
        } else {
            settings[r.key] = r.value;
        }
    });
    res.json({ success: true, data: settings } as ApiResponse);
});

app.post('/settings', requireAdmin, (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ success: false, error: 'Key is required' });
    
    const db = getDb();
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
    res.json({ success: true } as ApiResponse);
});

// --- Key Management API (Internal) ---

app.get('/keys', requireAdmin, (req, res) => {
    try {
        const keys = KeyManager.listKeys();
        res.json({ success: true, data: keys } as ApiResponse);
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message } as ApiResponse);
    }
});

app.post('/keys', requireAdmin, (req, res) => {
    const { provider, key, label, type } = req.body;
    if (!provider || !key) {
        return res.status(400).json({ success: false, error: 'Provider and Key are required' } as ApiResponse);
    }
    try {
        KeyManager.addKey(provider, key, label, type || 'static');
        res.json({ success: true } as ApiResponse);
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message } as ApiResponse);
    }
});

app.delete('/keys/:id', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
    
    try {
        KeyManager.removeKey(id);
        res.json({ success: true } as ApiResponse);
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message } as ApiResponse);
    }
});

// --- Registry & AI (Contract Aligned) ---

// Registry: Add-ons check-in here
app.post('/registry/check-in', requireAuth, (req, res) => {
    const result = RegistrationRequestSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ success: false, error: formatZodError(result.error.errors) } as ApiResponse);
    }

    RegistryManager.registerAddon(result.data);
    res.json({ success: true, data: { registered: result.data.slug } } as ApiResponse);
});

// Intelligence API
app.post('/v1/process', requireAuth, async (req, res) => {
    const result = IntelligenceRequestSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ success: false, error: formatZodError(result.error.errors) } as ApiResponse);
    }

    try {
        const response = await AiManager.processRequest(result.data);
        res.json({ success: true, data: response } as ApiResponse);
    } catch (error: any) {
        logger.error(`AI Error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
});

// Bus Dispatch: Route requests between addons
app.post('/bus/dispatch', requireAuth, async (req, res) => {
    const result = ActionRequestSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ success: false, error: formatZodError(result.error.errors) } as ApiResponse);
    }

    const { target, action, payload } = result.data;
    logger.info(`Dispatching action '${action}' to target '${target}'`);

    const targetAddon = RegistryManager.getAddon(target);
    if (!targetAddon) {
        return res.status(404).json({ success: false, error: `Target add-on '${target}' not found or not registered.` } as ApiResponse);
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
    } as ApiResponse);
});

// Serve static frontend
app.use(express.static(join(__dirname, 'public')));

app.listen(port, '0.0.0.0', () => {
    logger.info(`AI Gateway listening at http://0.0.0.0:${port}`);
});