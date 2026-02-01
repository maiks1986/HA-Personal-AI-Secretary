"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const fs_1 = __importDefault(require("fs"));
function loadConfig() {
    const optionsPath = process.env.OPTIONS_PATH || '/data/options.json';
    if (fs_1.default.existsSync(optionsPath)) {
        try {
            return JSON.parse(fs_1.default.readFileSync(optionsPath, 'utf8'));
        }
        catch (err) {
            console.error('Failed to parse options.json', err);
        }
    }
    // Fallback for development
    return {
        google_client_id: process.env.GOOGLE_CLIENT_ID || '',
        google_client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        debug_logging: process.env.DEBUG_LOGGING === 'true'
    };
}
