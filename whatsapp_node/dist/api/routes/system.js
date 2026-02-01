"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemRouter = void 0;
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../../db/database");
const EngineManager_1 = require("../../manager/EngineManager");
const AiService_1 = require("../../services/AiService");
const authMiddleware_1 = require("../authMiddleware");
const systemRouter = () => {
    const router = (0, express_1.Router)();
    const db = (0, database_1.getDb)();
    router.get('/settings/:key', authMiddleware_1.requireAuth, (req, res) => {
        const instanceId = parseInt(req.query.instanceId) || 0;
        const row = db.prepare('SELECT value FROM settings WHERE instance_id = ? AND key = ?').get(instanceId, req.params.key);
        // Fallback to global if instance specific not found?
        if (!row && instanceId !== 0) {
            const globalRow = db.prepare('SELECT value FROM settings WHERE instance_id = 0 AND key = ?').get(req.params.key);
            return res.json({ value: globalRow?.value || "" });
        }
        res.json({ value: row?.value || "" });
    });
    router.post('/settings', authMiddleware_1.requireAuth, (req, res) => {
        const user = req.haUser;
        if (!user.isAdmin)
            return res.status(403).json({ error: "Admin only" });
        const { key, value, instanceId } = req.body;
        const targetInstance = instanceId !== undefined ? instanceId : 0;
        db.prepare('INSERT OR REPLACE INTO settings (instance_id, key, value) VALUES (?, ?, ?)').run(targetInstance, key, value);
        if (key === 'gemini_api_key' && targetInstance === 0)
            AiService_1.aiService.reset();
        res.json({ success: true });
    });
    router.post('/system/reset', authMiddleware_1.requireAuth, async (req, res) => {
        const user = req.haUser;
        if (!user.isAdmin)
            return res.status(403).json({ error: "Admin only" });
        for (const inst of EngineManager_1.engineManager.getAllInstances()) {
            await inst.deleteAuth();
            await EngineManager_1.engineManager.stopInstance(inst.id);
        }
        db.prepare('DELETE FROM messages').run();
        db.prepare('DELETE FROM chats').run();
        db.prepare('DELETE FROM contacts').run();
        db.prepare('DELETE FROM instances').run();
        db.prepare('DELETE FROM settings').run();
        res.json({ success: true });
    });
    router.post('/system/repair', authMiddleware_1.requireAuth, async (req, res) => {
        const user = req.haUser;
        if (!user.isAdmin)
            return res.status(403).json({ error: "Admin only" });
        // 1. Capture current instances state
        const activeInstances = EngineManager_1.engineManager.getAllInstances().map(inst => ({
            id: inst.id,
            name: inst.name,
            presence: inst.presence || 'unavailable'
        }));
        // 2. Stop all instances
        for (const inst of activeInstances) {
            await EngineManager_1.engineManager.stopInstance(inst.id);
        }
        // 2b. SAFETY BACKUP: Archive the database before wiping
        try {
            const dbPath = process.env.NODE_ENV === 'development'
                ? path_1.default.join(__dirname, '../../../whatsapp.db')
                : '/data/whatsapp.db';
            const backupDir = process.env.NODE_ENV === 'development'
                ? path_1.default.join(__dirname, '../../../backups')
                : '/data/backups';
            if (!fs_1.default.existsSync(backupDir))
                fs_1.default.mkdirSync(backupDir, { recursive: true });
            if (fs_1.default.existsSync(dbPath)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = path_1.default.join(backupDir, `whatsapp_repair_${timestamp}.db`);
                fs_1.default.copyFileSync(dbPath, backupPath);
                console.log(`[System]: Database backed up to ${backupPath}`);
            }
        }
        catch (e) {
            console.error("[System]: Failed to backup database during repair:", e);
            // We continue anyway? Or abort? 
            // Abort to be safe.
            return res.status(500).json({ error: "Backup failed, aborting repair." });
        }
        // 3. Wipe volatile DB data
        db.prepare('DELETE FROM messages').run();
        db.prepare('DELETE FROM chats').run();
        db.prepare('DELETE FROM contacts').run();
        db.prepare('DELETE FROM reactions').run();
        db.prepare('DELETE FROM status_updates').run();
        // 4. Clear avatars
        const avatarDir = process.env.NODE_ENV === 'development' ? './media/avatars' : '/data/media/avatars';
        if (fs_1.default.existsSync(avatarDir)) {
            const files = fs_1.default.readdirSync(avatarDir);
            for (const file of files)
                fs_1.default.unlinkSync(path_1.default.join(avatarDir, file));
        }
        // 5. Force Deep Re-sync (Soft wipe auth files except creds)
        for (const instInfo of activeInstances) {
            const authPath = process.env.NODE_ENV === 'development'
                ? path_1.default.join(__dirname, `../../../auth_info_${instInfo.id}`)
                : `/data/auth_info_${instInfo.id}`;
            if (fs_1.default.existsSync(authPath)) {
                const files = fs_1.default.readdirSync(authPath);
                for (const file of files) {
                    if (file !== 'creds.json') {
                        fs_1.default.rmSync(path_1.default.join(authPath, file), { recursive: true, force: true });
                    }
                }
            }
            // 6. Restart instance
            await EngineManager_1.engineManager.startInstance(instInfo.id, instInfo.name, instInfo.presence);
        }
        res.json({ success: true });
    });
    router.get('/debug/stats', authMiddleware_1.requireAuth, (req, res) => {
        res.json({
            users: db.prepare('SELECT COUNT(*) as count FROM users').get(),
            instances: db.prepare('SELECT COUNT(*) as count FROM instances').get(),
            chats: db.prepare('SELECT COUNT(*) as count FROM chats').get(),
            messages: db.prepare('SELECT COUNT(*) as count FROM messages').get(),
        });
    });
    router.get('/debug/raw_logs', authMiddleware_1.requireAuth, (req, res) => {
        const limit = parseInt(req.query.limit) || 50;
        const logPath = process.env.NODE_ENV === 'development' ? './raw_events.log' : '/data/raw_events.log';
        if (!fs_1.default.existsSync(logPath))
            return res.json([]);
        try {
            const data = fs_1.default.readFileSync(logPath, 'utf8');
            const lines = data.trim().split('\n').slice(-limit);
            res.json(lines.map(l => JSON.parse(l)));
        }
        catch (e) {
            res.status(500).json({ error: "Failed to read logs" });
        }
    });
    router.get('/debug/db/:table', authMiddleware_1.requireAuth, (req, res) => {
        const { table } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const allowedTables = ['messages', 'chats', 'contacts', 'instances', 'settings'];
        if (!allowedTables.includes(table))
            return res.status(400).json({ error: "Invalid table" });
        try {
            const data = db.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC LIMIT ? OFFSET ?`).all(limit, offset);
            res.json(data);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/ai/analyze', authMiddleware_1.requireAuth, async (req, res) => {
        const intent = await AiService_1.aiService.analyzeIntent(req.body.messages);
        res.json({ intent });
    });
    router.post('/ai/draft', authMiddleware_1.requireAuth, async (req, res) => {
        const { messages, steer } = req.body;
        const draft = await AiService_1.aiService.generateDraft(messages, steer);
        res.json({ draft });
    });
    // Stealth Scheduler Routes
    router.get('/stealth/schedules/:instanceId', authMiddleware_1.requireAuth, (req, res) => {
        const { instanceId } = req.params;
        const schedules = db.prepare('SELECT * FROM stealth_schedules WHERE instance_id = ?').all(instanceId);
        for (const s of schedules) {
            s.targets = db.prepare('SELECT contact_jid FROM stealth_targets WHERE schedule_id = ?').all(s.id);
        }
        res.json(schedules);
    });
    router.post('/stealth/schedules', authMiddleware_1.requireAuth, (req, res) => {
        const { instanceId, name, start_time, end_time, days, mode, targets } = req.body;
        const info = db.prepare('INSERT INTO stealth_schedules (instance_id, name, start_time, end_time, days, mode) VALUES (?, ?, ?, ?, ?, ?)').run(instanceId, name, start_time, end_time, JSON.stringify(days), mode);
        const scheduleId = info.lastInsertRowid;
        if (targets && Array.isArray(targets)) {
            const stmt = db.prepare('INSERT INTO stealth_targets (schedule_id, contact_jid) VALUES (?, ?)');
            for (const jid of targets)
                stmt.run(scheduleId, jid);
        }
        res.json({ success: true, id: scheduleId });
    });
    router.delete('/stealth/schedules/:id', authMiddleware_1.requireAuth, (req, res) => {
        db.prepare('DELETE FROM stealth_targets WHERE schedule_id = ?').run(req.params.id);
        db.prepare('DELETE FROM stealth_schedules WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    });
    router.get('/backups', authMiddleware_1.requireAuth, (req, res) => {
        const backupDir = process.env.NODE_ENV === 'development' ? './backups' : '/data/backups';
        if (!fs_1.default.existsSync(backupDir))
            return res.json([]);
        const files = fs_1.default.readdirSync(backupDir).map(file => {
            const stats = fs_1.default.statSync(path_1.default.join(backupDir, file));
            return { name: file, size: stats.size, created: stats.birthtime };
        });
        res.json(files.sort((a, b) => b.created.getTime() - a.created.getTime()));
    });
    router.get('/backups/:filename', authMiddleware_1.requireAuth, (req, res) => {
        const { filename } = req.params;
        // Simple sanitization
        if (filename.includes('..') || !filename.endsWith('.db'))
            return res.status(403).send("Invalid filename");
        const backupDir = process.env.NODE_ENV === 'development' ? './backups' : '/data/backups';
        const filePath = path_1.default.join(backupDir, filename);
        if (!fs_1.default.existsSync(filePath))
            return res.status(404).send("File not found");
        res.download(filePath);
    });
    return router;
};
exports.systemRouter = systemRouter;
