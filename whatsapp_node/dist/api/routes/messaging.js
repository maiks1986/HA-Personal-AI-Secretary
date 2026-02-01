"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagingRouter = void 0;
const express_1 = require("express");
const database_1 = require("../../db/database");
const EngineManager_1 = require("../../manager/EngineManager");
const utils_1 = require("../../utils");
const authMiddleware_1 = require("../authMiddleware");
const messagingRouter = () => {
    const router = (0, express_1.Router)();
    const db = (0, database_1.getDb)();
    router.get('/chats/:instanceId', authMiddleware_1.requireAuth, (req, res) => {
        const { instanceId } = req.params;
        const user = req.haUser;
        const instanceData = db.prepare('SELECT ha_user_id FROM instances WHERE id = ?').get(instanceId);
        if (!user.isAdmin && instanceData?.ha_user_id !== user.id)
            return res.status(403).json({ error: "Access Denied" });
        const chats = db.prepare(`
            SELECT 
                c.jid, 
                COALESCE(co.name, c.name, c.jid) as name, 
                SUM(c.unread_count) as unread_count, 
                c.last_message_text, 
                c.last_message_timestamp,
                MAX(c.is_archived) as is_archived,
                MAX(c.is_pinned) as is_pinned,
                MAX(c.ephemeral_mode) as ephemeral_mode,
                MAX(c.ephemeral_timer) as ephemeral_timer,
                COALESCE(c.profile_picture, co.profile_picture) as profile_picture
            FROM chats c
            LEFT JOIN contacts co ON c.jid = co.jid AND c.instance_id = co.instance_id
            WHERE c.instance_id = ? 
              AND c.jid NOT LIKE '%@broadcast'
              AND (c.last_message_timestamp IS NOT NULL OR c.is_pinned = 1 OR c.unread_count > 0)
            GROUP BY COALESCE(co.lid, c.jid)
            ORDER BY MAX(c.is_pinned) DESC, c.last_message_timestamp DESC
        `).all(instanceId);
        res.json(chats);
    });
    router.get('/contacts/:instanceId', authMiddleware_1.requireAuth, (req, res) => {
        const { instanceId } = req.params;
        const user = req.haUser;
        const instanceData = db.prepare('SELECT ha_user_id FROM instances WHERE id = ?').get(instanceId);
        if (!user.isAdmin && instanceData?.ha_user_id !== user.id)
            return res.status(403).json({ error: "Access Denied" });
        // Explicitly select columns or * is fine if we added it
        const contacts = db.prepare('SELECT instance_id, jid, name, lid, profile_picture FROM contacts WHERE instance_id = ? ORDER BY name ASC').all(instanceId);
        res.json(contacts);
    });
    router.get('/messages/:instanceId/:jid', authMiddleware_1.requireAuth, (req, res) => {
        const { instanceId } = req.params;
        const jid = (0, utils_1.normalizeJid)(req.params.jid);
        const user = req.haUser;
        const instanceData = db.prepare('SELECT ha_user_id FROM instances WHERE id = ?').get(instanceId);
        if (!user.isAdmin && instanceData?.ha_user_id !== user.id)
            return res.status(403).json({ error: "Access Denied" });
        // 1. Fetch latest 100 messages (Fast initial load)
        const messages = db.prepare(`
            SELECT m.* 
            FROM messages m
            WHERE m.instance_id = ? 
              AND (
                m.chat_jid = ? 
                OR m.chat_jid = (SELECT lid FROM contacts WHERE jid = ? AND instance_id = ?)
                OR m.chat_jid = (SELECT jid FROM contacts WHERE lid = ? AND instance_id = ?)
              )
            ORDER BY m.timestamp DESC
            LIMIT 100
        `).all(instanceId, jid, jid, instanceId, jid, instanceId);
        // Reverse to maintain chronological order in UI
        messages.reverse();
        if (messages.length > 0) {
            // 2. Optimized Reaction Fetch: Get ALL reactions for these messages in ONE query
            const messageIds = messages.map(m => m.whatsapp_id);
            const placeholders = messageIds.map(() => '?').join(',');
            const allReactions = db.prepare(`
                SELECT message_whatsapp_id, sender_jid, emoji 
                FROM reactions 
                WHERE instance_id = ? AND message_whatsapp_id IN (${placeholders})
            `).all(instanceId, ...messageIds);
            // 3. Map reactions to messages in memory
            const reactionMap = {};
            for (const r of allReactions) {
                if (!reactionMap[r.message_whatsapp_id])
                    reactionMap[r.message_whatsapp_id] = [];
                reactionMap[r.message_whatsapp_id].push({ sender_jid: r.sender_jid, emoji: r.emoji });
            }
            for (const msg of messages) {
                msg.reactions = reactionMap[msg.whatsapp_id] || [];
            }
        }
        res.json(messages);
    });
    router.get('/messages/:instanceId/search', authMiddleware_1.requireAuth, (req, res) => {
        const { instanceId } = req.params;
        const { query, type, jid } = req.query;
        let sql = 'SELECT * FROM messages WHERE instance_id = ?';
        const params = [instanceId];
        if (jid) {
            sql += ' AND chat_jid = ?';
            params.push((0, utils_1.normalizeJid)(jid));
        }
        if (query) {
            sql += ' AND text LIKE ?';
            params.push(`%${query}%`);
        }
        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }
        sql += ' ORDER BY timestamp DESC LIMIT 100';
        res.json(db.prepare(sql).all(...params));
    });
    router.post('/send_message', authMiddleware_1.requireAuth, async (req, res) => {
        const { instanceId, contact, message } = req.body;
        const jid = (0, utils_1.normalizeJid)(contact);
        const instance = EngineManager_1.engineManager.getInstance(instanceId);
        if (!instance)
            return res.status(404).json({ error: "Instance not found" });
        try {
            await instance.sendMessage(jid, message);
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/chats/:instanceId/:jid/modify', authMiddleware_1.requireAuth, async (req, res) => {
        const { instanceId, jid } = req.params;
        const normalized = (0, utils_1.normalizeJid)(jid);
        const { action } = req.body;
        const inst = EngineManager_1.engineManager.getInstance(parseInt(instanceId));
        if (!inst)
            return res.status(404).json({ error: "Not found" });
        await inst.modifyChat(normalized, action);
        res.json({ success: true });
    });
    router.post('/chats/:instanceId/:jid/ephemeral', authMiddleware_1.requireAuth, async (req, res) => {
        const { instanceId, jid } = req.params;
        const { enabled, timer } = req.body;
        const inst = EngineManager_1.engineManager.getInstance(parseInt(instanceId));
        if (!inst || !inst.ephemeralManager)
            return res.status(404).json({ error: "Not found" });
        if (enabled) {
            await inst.ephemeralManager.enableForChat(jid, timer || 60);
        }
        else {
            await inst.ephemeralManager.disableForChat(jid);
        }
        res.json({ success: true });
    });
    return router;
};
exports.messagingRouter = messagingRouter;
