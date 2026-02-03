import { Request, Response, NextFunction } from 'express';
import { GlobalAuthService, AuthUser } from '../services/GlobalAuthService';
import { getDb } from '../db/database';

export const identityResolver = (req: Request, res: Response, next: NextFunction) => {
    const db = getDb();
    
    // 0. API Key Auth
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('internal_api_key') as { value: string } | undefined;
        if (row && apiKey === row.value) {
            (req as any).haUser = { id: 'ha_component', isAdmin: true, source: 'api_key' } as AuthUser;
            return next();
        }
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
