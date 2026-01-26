import express from 'express';
import { Server as SocketServer } from 'socket.io';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import db, { initDatabase } from './db/database';
import { engineManager } from './manager/EngineManager';
import { aiService } from './services/AiService';

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Serve static React files
const PUBLIC_PATH = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_PATH));

const PORT = 5002;

async function bootstrap() {
    // 1. Init Database
    initDatabase();

    // 2. Start Engine Manager
    await engineManager.init();

    // 3. API Endpoints
    
    // Get all instances
    app.get('/api/instances', (req, res) => {
        const instances = db.prepare('SELECT * FROM instances').all();
        res.json(instances);
    });

    // Create new instance
    app.post('/api/instances', async (req, res) => {
        const { name } = req.body;
        const result = db.prepare('INSERT INTO instances (name) VALUES (?)').run(name);
        const newId = result.lastInsertRowid as number;
        await engineManager.startInstance(newId, name);
        res.json({ id: newId, name });
    });

    // Get messages for a specific chat
    app.get('/api/messages/:instanceId/:jid', (req, res) => {
        const { instanceId, jid } = req.params;
        const messages = db.prepare('SELECT * FROM messages WHERE instance_id = ? AND chat_jid = ? ORDER BY id ASC').all(instanceId, jid);
        res.json(messages);
    });

    // Send message
    app.post('/api/send_message', async (req, res) => {
        const { instanceId, contact, message } = req.body;
        const instance = engineManager.getInstance(instanceId);
        if (!instance) return res.status(404).json({ error: "Instance not found" });
        
        try {
            await instance.sendMessage(contact, message);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Settings management
    app.post('/api/settings', (req, res) => {
        const { key, value } = req.body;
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
        if (key === 'gemini_api_key') aiService.reset();
        res.json({ success: true });
    });

    app.get('/api/settings/:key', (req, res) => {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key) as any;
        res.json({ value: row?.value || "" });
    });

    // AI Analysis
    app.post('/api/ai/analyze', async (req, res) => {
        const { messages } = req.body;
        const intent = await aiService.analyzeIntent(messages);
        res.json({ intent });
    });

    // AI Draft
    app.post('/api/ai/draft', async (req, res) => {
        const { messages, steer } = req.body;
        const draft = await aiService.generateDraft(messages, steer);
        res.json({ draft });
    });

    // 4. WebSocket for real-time status/messages
    io.on('connection', (socket) => {
        console.log('Client connected to WebSocket');
        
        // Push status updates periodically
        const interval = setInterval(() => {
            const status = engineManager.getAllInstances().map(i => ({
                id: i.id,
                status: i.status,
                qr: i.qr
            }));
            socket.emit('instances_status', status);
        }, 3000);

        socket.on('disconnect', () => clearInterval(interval));
    });

    // Fallback to index.html
    app.get('*', (req, res) => {
        if (fs.existsSync(path.join(PUBLIC_PATH, 'index.html'))) {
            res.sendFile(path.join(PUBLIC_PATH, 'index.html'));
        } else {
            res.send("<h1>WhatsApp Pro System</h1><p>Frontend loading...</p>");
        }
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`WhatsApp Pro Backend listening on port ${PORT}`);
    });
}

bootstrap().catch(err => {
    console.error('Fatal bootstrap error:', err);
});
