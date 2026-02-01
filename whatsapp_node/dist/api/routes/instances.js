"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.instancesRouter = void 0;
const express_1 = require("express");
const database_1 = require("../../db/database");
const EngineManager_1 = require("../../manager/EngineManager");
const authMiddleware_1 = require("../authMiddleware");
const instancesRouter = () => {
    const router = (0, express_1.Router)();
    const db = (0, database_1.getDb)();
    router.get('/', authMiddleware_1.requireAuth, (req, res) => {
        const user = req.haUser;
        let instances;
        if (user.isAdmin) {
            instances = db.prepare('SELECT * FROM instances').all();
        }
        else {
            instances = db.prepare('SELECT * FROM instances WHERE ha_user_id = ?').all(user.id);
        }
        const instancesWithQr = instances.map((inst) => {
            const activeInstance = EngineManager_1.engineManager.getInstance(inst.id);
            return {
                ...inst,
                qr: activeInstance ? activeInstance.qr : null,
                status: activeInstance ? activeInstance.status : inst.status
            };
        });
        console.log('[API] GET /instances response:', JSON.stringify(instancesWithQr.map(i => ({ id: i.id, status: i.status, hasQr: !!i.qr }))));
        res.json(instancesWithQr);
    });
    router.post('/', authMiddleware_1.requireAuth, async (req, res) => {
        const { name } = req.body;
        const user = req.haUser;
        const result = db.prepare('INSERT INTO instances (name, ha_user_id) VALUES (?, ?)').run(name, user.id);
        const newId = result.lastInsertRowid;
        await EngineManager_1.engineManager.startInstance(newId, name);
        res.json({ id: newId, name });
    });
    router.delete('/:id', authMiddleware_1.requireAuth, async (req, res) => {
        const { id } = req.params;
        const user = req.haUser;
        const instanceId = parseInt(id);
        const instanceData = db.prepare('SELECT ha_user_id FROM instances WHERE id = ?').get(instanceId);
        if (!user.isAdmin && instanceData?.ha_user_id !== user.id)
            return res.status(403).json({ error: "Access Denied" });
        const instance = EngineManager_1.engineManager.getInstance(instanceId);
        if (instance) {
            await instance.deleteAuth();
            await EngineManager_1.engineManager.stopInstance(instanceId);
        }
        db.prepare('DELETE FROM contacts WHERE instance_id = ?').run(instanceId);
        db.prepare('DELETE FROM status_updates WHERE instance_id = ?').run(instanceId);
        db.prepare('DELETE FROM reactions WHERE instance_id = ?').run(instanceId);
        db.prepare('DELETE FROM messages WHERE instance_id = ?').run(instanceId);
        db.prepare('DELETE FROM chats WHERE instance_id = ?').run(instanceId);
        db.prepare('DELETE FROM instances WHERE id = ?').run(instanceId);
        res.json({ success: true });
    });
    router.post('/:id/reconnect', authMiddleware_1.requireAuth, async (req, res) => {
        const instance = EngineManager_1.engineManager.getInstance(parseInt(req.params.id));
        if (!instance)
            return res.status(404).json({ error: "Not found" });
        await instance.reconnect();
        res.json({ success: true });
    });
    router.post('/:id/presence', authMiddleware_1.requireAuth, async (req, res) => {
        const { presence } = req.body;
        const instance = EngineManager_1.engineManager.getInstance(parseInt(req.params.id));
        if (!instance)
            return res.status(404).json({ error: "Not found" });
        await instance.setPresence(presence);
        res.json({ success: true });
    });
    return router;
};
exports.instancesRouter = instancesRouter;
