"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
exports.loadConfig = loadConfig;
const fs_1 = __importDefault(require("fs"));
const OPTIONS_PATH = '/data/options.json';
const DEFAULT_CONFIG = {
    port: 5006,
    dataDir: process.platform === 'win32' ? './data' : '/data',
    jwtSecret: 'dev-secret-change-me',
    logLevel: 'info',
};
function loadConfig() {
    let config = { ...DEFAULT_CONFIG };
    // 1. Try to load from HA options.json
    if (fs_1.default.existsSync(OPTIONS_PATH)) {
        try {
            const options = JSON.parse(fs_1.default.readFileSync(OPTIONS_PATH, 'utf-8'));
            console.log('Loaded options from HA:', options);
            // Map generic HA options if needed
            if (options.log_level)
                config.logLevel = options.log_level;
        }
        catch (e) {
            console.error('Failed to parse options.json', e);
        }
    }
    // 2. Environment variables override
    if (process.env.PORT)
        config.port = parseInt(process.env.PORT);
    if (process.env.DATA_DIR)
        config.dataDir = process.env.DATA_DIR;
    if (process.env.JWT_SECRET)
        config.jwtSecret = process.env.JWT_SECRET;
    // Ensure data dir exists
    if (!fs_1.default.existsSync(config.dataDir)) {
        console.log(`Creating data directory: ${config.dataDir}`);
        try {
            fs_1.default.mkdirSync(config.dataDir, { recursive: true });
        }
        catch (e) {
            console.error(`Failed to create data directory ${config.dataDir}:`, e);
        }
    }
    return config;
}
exports.CONFIG = loadConfig();
