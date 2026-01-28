import { Request, Response, NextFunction } from 'express';
import { AuthUser } from '../types';
import { sessions } from './routes/auth';

export const identityResolver = (req: Request, res: Response, next: NextFunction) => {
    const userId = req.headers['x-hass-user-id'] as string;
    const isAdmin = req.headers['x-hass-is-admin'] === '1' || req.headers['x-hass-is-admin'] === 'true';
    
    // 1. Check for Ingress Headers (Auto-Login)
    if (userId) {
        (req as any).haUser = { id: userId, isAdmin, source: 'ingress' } as AuthUser;
        return next();
    }

    // 2. Check for Session Cookie
    const cookieToken = req.headers.cookie?.split('; ').find(row => row.startsWith('direct_token='))?.split('=')[1];
    
    // 3. Check for Auth Header (Backwards compatibility)
    const authHeader = req.headers['authorization'];
    const token = cookieToken || authHeader?.split(' ')[1];

    if (token && sessions.has(token)) {
        const session = sessions.get(token);
        (req as any).haUser = { id: session!.id, isAdmin: session!.isAdmin, source: 'direct' } as AuthUser;
        return next();
    }

    (req as any).haUser = null;
    next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).haUser) return res.status(401).json({ error: "Unauthorized" });
    next();
};
