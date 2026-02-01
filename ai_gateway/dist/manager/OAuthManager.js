"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthManager = void 0;
const google_auth_library_1 = require("google-auth-library");
const database_1 = require("../db/database");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)();
class OAuthManager {
    static getClient() {
        const db = (0, database_1.getDb)();
        const settings = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?)').all('google_client_id', 'google_client_secret');
        const clientId = settings.find(s => s.key === 'google_client_id')?.value;
        const clientSecret = settings.find(s => s.key === 'google_client_secret')?.value;
        if (!clientId || !clientSecret) {
            return null;
        }
        // Redirect URI should be the callback endpoint of the addon
        // In HA Addons, this is usually strictly defined or localhost
        // For Ingress, we might need to be clever, but standard OOB or postmessage works best if we can't control the domain.
        // However, for standard web flow:
        // Users might need to add `https://my-ha-instance.com/api/hassio_ingress/.../auth/google/callback` to GCP.
        // Or we use `postmessage` flow.
        // Let's assume standard web flow with a fixed callback path relative to window location.
        // But server-side needs a redirect_uri to match.
        // We'll require the user to configure the redirect URI in settings if it differs from default.
        const redirectUri = settings.find(s => s.key === 'google_redirect_uri')?.value || 'http://localhost:5005/auth/google/callback';
        return new google_auth_library_1.OAuth2Client(clientId, clientSecret, redirectUri);
    }
    static getAuthUrl() {
        const client = this.getClient();
        if (!client)
            throw new Error('Google Client ID/Secret not configured.');
        const scopes = [
            'https://www.googleapis.com/auth/cloud-platform', // For Vertex AI
            'https://www.googleapis.com/auth/generative-language.retriever' // For Gemini API if available
        ];
        return client.generateAuthUrl({
            access_type: 'offline', // Get Refresh Token
            scope: scopes,
            prompt: 'consent' // Force refresh token
        });
    }
    static async exchangeCode(code) {
        const client = this.getClient();
        if (!client)
            throw new Error('Google Client ID/Secret not configured.');
        const { tokens } = await client.getToken(code);
        return tokens;
    }
    static async refreshAccessToken(tokens) {
        const client = this.getClient();
        if (!client)
            throw new Error('Google Client ID/Secret not configured.');
        client.setCredentials(tokens);
        // Check if expired
        if (tokens.expiry_date && Date.now() < tokens.expiry_date) {
            return tokens.access_token;
        }
        logger.info('OAuthManager: Refreshing access token...');
        const { credentials } = await client.refreshAccessToken();
        return credentials.access_token || '';
    }
}
exports.OAuthManager = OAuthManager;
