import { Router } from 'express';
import { getDb } from '../../db/database';
import { engineManager } from '../../manager/EngineManager';
import { requireAuth } from './auth';

export const socialRouter = () => {
    const router = Router();
    const db = getDb();

    router.get('/status/:instanceId', requireAuth, (req, res) => {
        const { instanceId } = req.params;
        const updates = db.prepare('SELECT * FROM status_updates WHERE instance_id = ? ORDER BY timestamp DESC LIMIT 100').all(instanceId);
        res.json(updates);
    });

    router.post('/groups/:instanceId', requireAuth, async (req, res) => {
        const { instanceId } = req.params;
        const { title, participants } = req.body;
        const inst = engineManager.getInstance(parseInt(instanceId));
        if (!inst) return res.status(404).json({ error: "Not found" });
        const group = await inst.createGroup(title, participants);
        res.json(group);
    });

    router.patch('/groups/:instanceId/:jid/participants', requireAuth, async (req, res) => {
        const { instanceId, jid } = req.params;
        const { action, participants } = req.body;
        const inst = engineManager.getInstance(parseInt(instanceId));
        if (!inst) return res.status(404).json({ error: "Not found" });
        await inst.updateGroupParticipants(jid, participants, action);
        res.json({ success: true });
    });

    router.patch('/groups/:instanceId/:jid/metadata', requireAuth, async (req, res) => {
        const { instanceId, jid } = req.params;
        const { subject, description } = req.body;
        const inst = engineManager.getInstance(parseInt(instanceId));
        if (!inst) return res.status(404).json({ error: "Not found" });
        await inst.updateGroupMetadata(jid, { subject, description });
        res.json({ success: true });
    });

    return router;
};
