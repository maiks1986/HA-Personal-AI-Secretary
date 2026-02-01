import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { GlobalAuthService, AuthUser } from '../services/GlobalAuthService';

const getOptions = () => {
    try {
        if (fs.existsSync('/data/options.json')) return JSON.parse(fs.readFileSync('/data/options.json', 'utf8'));
    } catch (e) {}
    return {};
};

export const identityResolver = (req: Request, res: Response, next: NextFunction) => {
    const options = getOptions();
    
    // 0. API Key Auth
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey && options.internal_api_key && apiKey === options.internal_api_key) {
        (req as any).haUser = { id: 'ha_component', isAdmin: true, source: 'api_key' } as AuthUser;
        return next();
    }

    // 1. Ingress Auth
    const userId = req.headers['x-hass-user-id'] as string;
    const isAdmin = req.headers['x-hass-is-admin'] === '1' || req.headers['x-hass-is-admin'] === 'true';
    if (userId) {
        (req as any).haUser = { id: userId, isAdmin, source: 'ingress' } as AuthUser;
        return next();
    }

    // 2. Global Auth (JWT)
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (token) {
        const globalUser = GlobalAuthService.verifyToken(token);
        if (globalUser) {
            (req as any).haUser = globalUser;
            return next();
        }
    }

    (req as any).haUser = null;
    next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).haUser) return res.status(401).json({ success: false, error: "Unauthorized" });
    next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).haUser as AuthUser;
    if (!user || !user.isAdmin) return res.status(403).json({ success: false, error: "Forbidden: Admin access required" });
    next();
};
