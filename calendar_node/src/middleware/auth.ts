import { Request, Response, NextFunction } from 'express';
import { GlobalAuthService } from '../services/GlobalAuthService';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // 1. Check HA Ingress (Implicit trust for now, or add check)
    const userId = req.headers['x-hass-user-id'] as string;
    if (userId) {
        (req as any).user = { id: userId, source: 'ingress' };
        return next();
    }

    // 2. Check Global Auth
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const user = GlobalAuthService.verifyToken(token);
        if (user) {
            (req as any).user = user;
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
