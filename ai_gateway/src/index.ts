import express from 'express';
import cors from 'cors';
import pino from 'pino';
import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { initDatabase, getDb } from './db/database';
import { RegistryManager } from './manager/RegistryManager';
import { AiManager } from './manager/AiManager';
import { KeyManager } from './manager/KeyManager';
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
            
            // Sync settings table
            const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
            for (const [key, value] of Object.entries(options)) {
                stmt.run(key, String(value));
            }

            // Sync Gemini Keys to api_keys table
            if (options.gemini_api_key) {
                const keys = String(options.gemini_api_key).split(',').map(k => k.trim()).filter(k => k.length > 0);
                keys.forEach(keyValue => {
                    // Check if key already exists to avoid duplicates
                    const existing = db.prepare('SELECT id FROM api_keys WHERE key_value = ?').get(keyValue);
                    if (!existing) {
                        KeyManager.addKey('gemini', keyValue, 'HA Option Key', 'static');
                    }
                });
            }
            
            logger.info('HA Options synced to settings and api_keys tables.');
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

// Helper to get internal API key
const getInternalApiKey = () => {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('internal_api_key') as { value: string } | undefined;
    return row?.value;
};

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

// List registered add-ons
app.get('/registry/addons', requireAuth, (req, res) => {
    try {
        const addons = RegistryManager.listAddons();
        res.json({ success: true, data: addons } as ApiResponse);
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message } as ApiResponse);
    }
});

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

    try {
        const internalKey = getInternalApiKey();
        // Construct the target URL. In HA, add-ons can talk via their slug if they are in the same network, 
        // but here we use the port and assume they are reachable.
        // For HA internal network: http://[slug]:[port]/api/action
        // However, standard slug format for HA network is a0d7b954-[slug]
        const targetUrl = `http://${target}:${targetAddon.port}/api/action`;
        
        logger.info(`Forwarding to ${targetUrl}`);
        
        const response = await axios.post(targetUrl, {
            action,
            payload
        }, {
            headers: {
                'x-api-key': internalKey,
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });

        res.json({
            success: true,
            data: response.data
        } as ApiResponse);

    } catch (error: any) {
        logger.error(`Dispatch failed: ${error.message}`);
        res.status(500).json({ 
            success: false, 
            error: `Failed to dispatch to '${target}': ${error.message}` 
        } as ApiResponse);
    }
});

// Serve static frontend
app.use(express.static(join(__dirname, 'public')));

app.listen(port, '0.0.0.0', () => {
    logger.info(`AI Gateway listening at http://0.0.0.0:${port}`);
});