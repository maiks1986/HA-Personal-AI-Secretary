"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../../db/database");
const shared_schemas_1 = require("../../shared_schemas");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const KeyManager_1 = require("../../manager/KeyManager");
const router = (0, express_1.Router)();
// Middleware to ensure user is logged in (for setup)
const ensureAuth = (req, res, next) => {
    const token = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: "Unauthorized" });
    try {
        const decoded = jsonwebtoken_1.default.verify(token, KeyManager_1.keyManager.getPublicKey(), { algorithms: ['RS256'] });
        req.user = decoded;
        next();
    }
    catch (e) {
        return res.status(403).json({ error: "Invalid token" });
    }
};
const ensureAdmin = (req, res, next) => {
    ensureAuth(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: "Admin access required" });
        }
        next();
    });
};
router.post('/login', (req, res) => {
    try {
        const body = shared_schemas_1.LoginRequestSchema.parse(req.body);
        const user = database_1.db.getUserByUsername(body.username);
        if (!user || !user.password_hash || !bcrypt_1.default.compareSync(body.password, user.password_hash)) {
            const response = { success: false, error: "Invalid credentials" };
            return res.status(401).json(response);
        }
        // 2FA Check
        if (user.is_totp_enabled) {
            if (!body.totp_code) {
                return res.json({ success: false, requires_2fa: true });
            }
            // Verify TOTP
            if (!user.totp_secret) {
                // Should not happen if enabled, but safe check
                return res.status(500).json({ success: false, error: "2FA enabled but no secret found" });
            }
            const verified = speakeasy_1.default.totp.verify({
                secret: user.totp_secret,
                encoding: 'base32',
                token: body.totp_code
            });
            if (!verified) {
                return res.status(401).json({ success: false, error: "Invalid 2FA Code" });
            }
        }
        // Generate Token
        const token = jsonwebtoken_1.default.sign({
            sub: user.id,
            username: user.username,
            role: user.role,
            permissions: [] // TODO: Add permissions logic
        }, KeyManager_1.keyManager.getPrivateKey(), {
            algorithm: 'RS256',
            expiresIn: '1h'
        });
        // Remove sensitive hash before returning
        const { password_hash, totp_secret, ...safeUser } = user;
        // Set Cookie (Optional, if we want browser automagic)
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: false, // Set true in production with HTTPS
            sameSite: 'lax'
        });
        const response = {
            success: true,
            token,
            user: { ...safeUser, is_totp_enabled: !!user.is_totp_enabled }
        };
        const returnTo = req.query.return_to;
        if (returnTo) {
            // If it's a browser request, we might want to redirect
            // But usually this is an AJAX call from our frontend.
            // So we return the URL in the response.
            response.redirect = `${returnTo}${returnTo.includes('?') ? '&' : '?'}token=${token}`;
        }
        res.json(response);
    }
    catch (e) {
        console.error(e);
        res.status(400).json({ success: false, error: "Invalid request format" });
    }
});
router.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true });
});
router.get('/me', (req, res) => {
    // Basic verification middleware placeholder
    const token = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, KeyManager_1.keyManager.getPublicKey(), { algorithms: ['RS256'] });
        res.json({ success: true, user: decoded });
    }
    catch (e) {
        res.status(403).json({ success: false, error: "Invalid token" });
    }
});
router.get('/public-key', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(KeyManager_1.keyManager.getPublicKey());
});
// --- 2FA Endpoints ---
router.post('/2fa/setup', ensureAuth, async (req, res) => {
    const user = req.user;
    const secret = speakeasy_1.default.generateSecret({ name: `Identity Gate (${user.username})` });
    // Save secret temporarily (or permanently but disabled)
    // We need to update DB to store secret.
    // For simplicity, we update the user row immediately but keep enabled=0 until verified.
    // We need a db method for this.
    // Hack: direct DB access via exposed db instance (not ideal but quick)
    // Better: Add updateTotpSecret to db class.
    // db.updateTotpSecret(user.sub, secret.base32);
    // For now, I'll assume we add that method or use raw SQL here?
    // Let's rely on adding the method to DB class in next step.
    database_1.db.updateTotpSecret(user.sub, secret.base32);
    const qr = await qrcode_1.default.toDataURL(secret.otpauth_url);
    res.json({
        secret: secret.base32,
        otpauth_url: secret.otpauth_url,
        qr_code: qr
    });
});
router.post('/2fa/verify', ensureAuth, (req, res) => {
    const user = req.user;
    const { token } = shared_schemas_1.Verify2FARequestSchema.parse(req.body);
    // Fetch secret from DB
    const dbUser = database_1.db.getUserByUsername(user.username);
    if (!dbUser || !dbUser.totp_secret) {
        return res.status(400).json({ error: "2FA setup not initiated" });
    }
    const verified = speakeasy_1.default.totp.verify({
        secret: dbUser.totp_secret,
        encoding: 'base32',
        token: token
    });
    if (verified) {
        database_1.db.enableTotp(user.sub);
        res.json({ success: true });
    }
    else {
        res.status(400).json({ success: false, error: "Invalid code" });
    }
});
// --- Admin User Management ---
router.get('/users', ensureAdmin, (req, res) => {
    try {
        const users = database_1.db.listUsers();
        res.json({ success: true, users });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/users', ensureAdmin, (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: "Username and password required" });
    }
    try {
        const user = database_1.db.createUser(username, password, role || 'user', 'local');
        res.json({ success: true, user });
    }
    catch (e) {
        if (e.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, error: "Username already exists" });
        }
        res.status(500).json({ success: false, error: e.message });
    }
});
router.delete('/users/:id', ensureAdmin, (req, res) => {
    const { id } = req.params;
    if (id === req.user.sub) {
        return res.status(400).json({ success: false, error: "Cannot delete yourself" });
    }
    try {
        database_1.db.deleteUser(id);
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
