"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalAuthService = void 0;
const axios_1 = __importDefault(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const AUTH_URL = process.env.AUTH_PROVIDER_URL || 'http://localhost:5006';
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
            console.warn(`[GlobalAuth] Failed to fetch Public Key from ${AUTH_URL}. Global Auth will be disabled.`, e.message);
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
            // console.debug('[GlobalAuth] Token verification failed:', (e as any).message);
            return null;
        }
    }
}
exports.GlobalAuthService = GlobalAuthService;
