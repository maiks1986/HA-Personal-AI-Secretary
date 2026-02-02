"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAuthManager = void 0;
const googleapis_1 = require("googleapis");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: { colorize: true }
    } : undefined
});
const TOKEN_PATH = process.env.TOKEN_PATH || '/data/tokens.json';
class GoogleAuthManager {
    oauth2Client;
    clientId;
    clientSecret;
    redirectUri;
    constructor(clientId, clientSecret, redirectUri) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        this.oauth2Client = new googleapis_1.google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
    }
    getAuthUrl() {
        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
        ];
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });
    }
    async setTokens(code) {
        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);
        this.saveTokens(tokens);
        return tokens;
    }
    setExternalTokens(tokens) {
        this.oauth2Client.setCredentials(tokens);
        this.saveTokens(tokens);
    }
    async loadTokens() {
        if (fs_1.default.existsSync(TOKEN_PATH)) {
            const tokens = JSON.parse(fs_1.default.readFileSync(TOKEN_PATH, 'utf8'));
            this.oauth2Client.setCredentials(tokens);
            // Handle token expiration
            this.oauth2Client.on('tokens', (newTokens) => {
                if (newTokens.refresh_token) {
                    // Merge with old tokens to keep refresh_token
                    const mergedTokens = { ...tokens, ...newTokens };
                    this.saveTokens(mergedTokens);
                }
                else {
                    this.saveTokens({ ...tokens, ...newTokens });
                }
            });
            return true;
        }
        return false;
    }
    saveTokens(tokens) {
        const dir = path_1.default.dirname(TOKEN_PATH);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        logger.info('Tokens saved to ' + TOKEN_PATH);
    }
    getClient() {
        return this.oauth2Client;
    }
    isAuthorized() {
        const creds = this.oauth2Client.credentials;
        if (!creds.access_token)
            return false;
        // If we have an expiry date, check if it's already passed
        if (creds.expiry_date && creds.expiry_date <= Date.now()) {
            return false;
        }
        return true;
    }
}
exports.GoogleAuthManager = GoogleAuthManager;
