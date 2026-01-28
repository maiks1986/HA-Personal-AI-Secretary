import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { AuthUser } from '../../types';

export const sessions = new Map<string, { id: string, isAdmin: boolean }>();

export const authRouter = (getAddonConfig: () => any) => {
    const router = Router();

    // Middleware to resolve user identity
    router.use((req, res, next) => {
        const userId = req.headers['x-hass-user-id'] as string;
        const isAdmin = req.headers['x-hass-is-admin'] === '1' || req.headers['x-hass-is-admin'] === 'true';
        
        if (userId) {
            (req as any).haUser = { id: userId, isAdmin, source: 'ingress' } as AuthUser;
            return next();
        }

        const cookieToken = req.headers.cookie?.split('; ').find(row => row.startsWith('direct_token='))?.split('=')[1];
        const authHeader = req.headers['authorization'];
        const token = cookieToken || authHeader?.split(' ')[1];

        if (token && sessions.has(token)) {
            const session = sessions.get(token);
            (req as any).haUser = { id: session!.id, isAdmin: session!.isAdmin, source: 'direct' } as AuthUser;
            return next();
        }

        (req as any).haUser = null;
        next();
    });

    router.get('/status', (req, res) => {
        const user = (req as any).haUser as AuthUser | null;
        res.json({ 
            authenticated: !!user,
            source: user?.source || null,
            isAdmin: user?.isAdmin || false,
            needsPassword: !user && getAddonConfig().password !== ""
        });
    });

    router.post('/login', (req, res) => {
        const { password } = req.body;
        const config = getAddonConfig();
        if (config.password && password === config.password) {
            const token = uuidv4();
            sessions.set(token, { id: 'direct_admin', isAdmin: true });
            res.cookie('direct_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false });
            return res.json({ success: true, token });
        }
        res.status(401).json({ error: "Invalid password" });
    });

    router.post('/ha_login', async (req, res) => {
        const { haUrl, haToken } = req.body;
        try {
            const response = await axios.get(`${haUrl}/api/config`, {
                headers: { 'Authorization': `Bearer ${haToken}` }
            });
            if (response.data && response.data.version) {
                const token = uuidv4();
                sessions.set(token, { id: `ha_${response.data.location_name || 'user'}`, isAdmin: true });
                res.cookie('direct_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false });
                return res.json({ success: true, token });
            }
        } catch (e) {}
        res.status(401).json({ error: "Invalid HA Credentials" });
    });

    return router;
};

export const requireAuth = (req: any, res: any, next: any) => {
    if (!req.haUser) return res.status(401).json({ error: "Unauthorized" });
    next();
};
