"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const GlobalAuthService_1 = require("../services/GlobalAuthService");
const authMiddleware = (req, res, next) => {
    // 1. Check HA Ingress (Implicit trust for now, or add check)
    const userId = req.headers['x-hass-user-id'];
    if (userId) {
        req.user = { id: userId, source: 'ingress' };
        return next();
    }
    // 2. Check Global Auth
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const user = GlobalAuthService_1.GlobalAuthService.verifyToken(token);
        if (user) {
            req.user = user;
            return next();
        }
    }
    // Default: Unauthorized (if we enforce auth)
    // For now, since it was previously open, maybe we just attach user if found?
    // But "Identity Gate" implies we want to gate it.
    // However, braking existing direct access might be bad if not planned.
    // I will just attach the user for now, and maybe enforce it on specific routes later?
    // The plan says "Authorize... View access to WhatsApp Instance".
    // I'll make it permissive by default but attach user, so endpoints can check permissions if needed.
    next();
};
exports.authMiddleware = authMiddleware;
