"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = exports.identityResolver = void 0;
const database_1 = require("../db/database");
const fs_1 = __importDefault(require("fs"));
const GlobalAuthService_1 = require("../services/GlobalAuthService");
const getOptions = () => {
    try {
        if (fs_1.default.existsSync('/data/options.json'))
            return JSON.parse(fs_1.default.readFileSync('/data/options.json', 'utf8'));
    }
    catch (e) { }
    return {};
};
const identityResolver = (req, res, next) => {
    // 0. Check Disable Auth Setting (Nuclear Option)
    const options = getOptions();
    if (options.disable_auth === true) {
        req.haUser = { id: 'admin', isAdmin: true, source: 'config_bypass' };
        return next();
    }
    // 1. API Key Auth (Native Integration)
    const apiKey = req.headers['x-api-key'];
    if (apiKey && options.internal_api_key && apiKey === options.internal_api_key) {
        req.haUser = { id: 'ha_component', isAdmin: true, source: 'api_key' };
        return next();
    }
    const userId = req.headers['x-hass-user-id'];
    const ingressPath = req.headers['x-ingress-path'];
    const isAdmin = req.headers['x-hass-is-admin'] === '1' || req.headers['x-hass-is-admin'] === 'true';
    // Debug Ingress Headers
    if (userId || ingressPath) {
        // console.log(`[Auth] Ingress request. User: ${userId}, Path: ${ingressPath}`);
    }
    // 0. Dev Token Bypass
    if (process.env.DEV_TOKEN && (req.headers['x-dev-token'] === process.env.DEV_TOKEN || req.query.dev_token === process.env.DEV_TOKEN)) {
        console.log('[Auth] Dev Token used');
        req.haUser = { id: 'dev_user', isAdmin: true, source: 'dev' };
        return next();
    }
    // 1. Check for Ingress Headers (Auto-Login)
    if (userId || ingressPath) {
        // If userId is missing but we have ingressPath, it's still a valid Ingress request.
        req.haUser = {
            id: userId || 'ingress_user',
            isAdmin: userId ? isAdmin : true,
            source: 'ingress'
        };
        return next();
    }
    // 2. Check for Session Cookie
    const cookieToken = req.headers.cookie?.split('; ').find(row => row.startsWith('direct_token='))?.split('=')[1];
    // 3. Check for Auth Header (Backwards compatibility)
    const authHeader = req.headers['authorization'];
    const token = cookieToken || authHeader?.split(' ')[1];
    if (token) {
        // A. Check Global Auth (JWT)
        const globalUser = GlobalAuthService_1.GlobalAuthService.verifyToken(token);
        if (globalUser) {
            req.haUser = globalUser;
            return next();
        }
        // B. Check Local DB
        try {
            const db = (0, database_1.getDb)();
            const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
            if (session) {
                req.haUser = { id: session.user_id, isAdmin: !!session.is_admin, source: 'direct' };
                return next();
            }
        }
        catch (e) {
            console.error('[Auth] DB Error during session check:', e);
        }
    }
    // Temporary Bypass for HA Login issues (Requested by user)
    // We assume any request that reaches here is intended to be authenticated as admin for now.
    req.haUser = { id: 'admin', isAdmin: true, source: 'temporary_bypass' };
    next();
};
exports.identityResolver = identityResolver;
const requireAuth = (req, res, next) => {
    if (!req.haUser)
        return res.status(401).json({ error: "Unauthorized" });
    next();
};
exports.requireAuth = requireAuth;
