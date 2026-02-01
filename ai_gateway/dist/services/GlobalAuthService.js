"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalAuthService = void 0;
const axios_1 = __importDefault(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Detect HA environment for internal DNS
const isProduction = !!process.env.SUPERVISOR_TOKEN;
// Note: In a real HA add-on, the hostname is [repo_hash]-[slug]
// For now, we allow the user to override via AUTH_PROVIDER_URL
const AUTH_URL = process.env.AUTH_PROVIDER_URL || (isProduction ? 'http://a0d7b954-auth-node:5006' : 'http://localhost:5006');
class GlobalAuthService {
    static publicKey = null;
    static async init() {
        if (this.publicKey)
            return;
        try {
            console.log(`[GlobalAuth] Fetching Public Key from ${AUTH_URL}...`);
            const res = await axios_1.default.get(`${AUTH_URL}/api/auth/public-key`);
            if (res.data) {
                this.publicKey = res.data;
                console.log('[GlobalAuth] Public Key loaded successfully.');
            }
        }
        catch (e) {
            console.warn(`[GlobalAuth] Failed to fetch Public Key from ${AUTH_URL}. Global Auth will be disabled.`);
            console.warn(`[GlobalAuth] Reason: ${e.message}`);
        }
    }
    static verifyToken(token) {
        if (!this.publicKey)
            return null;
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.publicKey, { algorithms: ['RS256'] });
            return {
                id: decoded.sub,
                isAdmin: decoded.role === 'admin',
                source: 'global_auth'
            };
        }
        catch (e) {
            return null;
        }
    }
}
exports.GlobalAuthService = GlobalAuthService;
