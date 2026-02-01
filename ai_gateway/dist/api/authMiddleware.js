"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireAuth = exports.identityResolver = void 0;
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
    const options = getOptions();
    // 0. API Key Auth
    const apiKey = req.headers['x-api-key'];
    if (apiKey && options.internal_api_key && apiKey === options.internal_api_key) {
        req.haUser = { id: 'ha_component', isAdmin: true, source: 'api_key' };
        return next();
    }
    // 1. Ingress Auth
    const userId = req.headers['x-hass-user-id'];
    const isAdmin = req.headers['x-hass-is-admin'] === '1' || req.headers['x-hass-is-admin'] === 'true';
    if (userId) {
        req.haUser = { id: userId, isAdmin, source: 'ingress' };
        return next();
    }
    // 2. Global Auth (JWT)
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (token) {
        const globalUser = GlobalAuthService_1.GlobalAuthService.verifyToken(token);
        if (globalUser) {
            req.haUser = globalUser;
            return next();
        }
    }
    req.haUser = null;
    next();
};
exports.identityResolver = identityResolver;
const requireAuth = (req, res, next) => {
    if (!req.haUser)
        return res.status(401).json({ success: false, error: "Unauthorized" });
    next();
};
exports.requireAuth = requireAuth;
const requireAdmin = (req, res, next) => {
    const user = req.haUser;
    if (!user || !user.isAdmin)
        return res.status(403).json({ success: false, error: "Forbidden: Admin access required" });
    next();
};
exports.requireAdmin = requireAdmin;
