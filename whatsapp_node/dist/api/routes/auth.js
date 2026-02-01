"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const axios_1 = __importDefault(require("axios"));
const database_1 = require("../../db/database");
// Removed in-memory Map. Using DB 'sessions' table instead.
const authRouter = (getAddonConfig) => {
    const router = (0, express_1.Router)();
    router.get('/status', (req, res) => {
        const user = req.haUser;
        let newToken;
        // Auto-create session for Ingress users if they don't have a token
        if (user && user.source === 'ingress') {
            const db = (0, database_1.getDb)();
            // Check if we already have a session for this user (optional optimization, but simplified for now: just create a new one if requested)
            // Actually, we want to give the frontend a token so it can persist it.
            newToken = (0, uuid_1.v4)();
            try {
                db.prepare('INSERT INTO sessions (token, user_id, is_admin) VALUES (?, ?, ?)').run(newToken, user.id, user.isAdmin ? 1 : 0);
                // Set cookie for convenience
                res.cookie('direct_token', newToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false });
            }
            catch (e) {
                console.error("Failed to persist auto-session", e);
            }
        }
        res.json({
            authenticated: !!user,
            source: user?.source || null,
            isAdmin: user?.isAdmin || false,
            needsPassword: !user && getAddonConfig().password !== "",
            token: newToken // Return the token so frontend can save it
        });
    });
    router.post('/login', (req, res) => {
        const { password } = req.body;
        const config = getAddonConfig();
        if (config.password && password === config.password) {
            const token = (0, uuid_1.v4)();
            const db = (0, database_1.getDb)();
            db.prepare('INSERT INTO sessions (token, user_id, is_admin) VALUES (?, ?, ?)').run(token, 'direct_admin', 1);
            res.cookie('direct_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false });
            return res.json({ success: true, token });
        }
        res.status(401).json({ error: "Invalid password" });
    });
    router.post('/ha_login', async (req, res) => {
        const { haUrl, haToken } = req.body;
        try {
            const response = await axios_1.default.get(`${haUrl}/api/config`, {
                headers: { 'Authorization': `Bearer ${haToken}` }
            });
            if (response.data && response.data.version) {
                const token = (0, uuid_1.v4)();
                const db = (0, database_1.getDb)();
                db.prepare('INSERT INTO sessions (token, user_id, is_admin) VALUES (?, ?, ?)').run(token, `ha_${response.data.location_name || 'user'}`, 1);
                res.cookie('direct_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false });
                return res.json({ success: true, token });
            }
        }
        catch (e) { }
        res.status(401).json({ error: "Invalid HA Credentials" });
    });
    return router;
};
exports.authRouter = authRouter;
