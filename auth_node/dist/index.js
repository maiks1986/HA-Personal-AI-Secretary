"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const api_1 = __importDefault(require("./api"));
const config_1 = require("./config");
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
// API Routes
app.use('/api', api_1.default);
// Serve Frontend
app.use(express_1.default.static(path_1.default.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
    // If not an API call, serve index.html
    if (!req.path.startsWith('/api')) {
        const index = path_1.default.join(__dirname, '../frontend/dist/index.html');
        res.sendFile(index);
    }
});
app.listen(config_1.CONFIG.port, () => {
    console.log(`Identity Gate running on port ${config_1.CONFIG.port}`);
    console.log(`Environment: ${config_1.CONFIG.jwtSecret === 'dev-secret-change-me' ? 'DEVELOPMENT' : 'PRODUCTION'}`);
});
