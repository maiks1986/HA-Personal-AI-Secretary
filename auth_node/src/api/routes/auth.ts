import { Router, Request, Response } from 'express';
import { db } from '../../db/database';
import { LoginRequestSchema, LoginResponse, Setup2FAResponseSchema, Verify2FARequestSchema } from '../../shared_schemas';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { CONFIG } from '../../config';
import { keyManager } from '../../manager/KeyManager';

const router = Router();

// Middleware to ensure user is logged in (for setup)
const ensureAuth = (req: Request, res: Response, next: Function) => {
    const token = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
        const decoded = jwt.verify(token, keyManager.getPublicKey(), { algorithms: ['RS256'] }) as any;
        (req as any).user = decoded;
        next();
    } catch (e) {
        return res.status(403).json({ error: "Invalid token" });
    }
};

const ensureAdmin = (req: Request, res: Response, next: Function) => {
    ensureAuth(req, res, () => {
        if ((req as any).user.role !== 'admin') {
            return res.status(403).json({ error: "Admin access required" });
        }
        next();
    });
};

router.post('/login', (req: Request, res: Response) => {
    try {
        const body = LoginRequestSchema.parse(req.body);
        const user = db.getUserByUsername(body.username);

        if (!user || !user.password_hash || !bcrypt.compareSync(body.password, user.password_hash as string)) {
            const response: LoginResponse = { success: false, error: "Invalid credentials" };
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

            const verified = speakeasy.totp.verify({
                secret: user.totp_secret,
                encoding: 'base32',
                token: body.totp_code
            });

            if (!verified) {
                return res.status(401).json({ success: false, error: "Invalid 2FA Code" });
            }
        }

        // Generate Token
        const token = jwt.sign(
            { 
                sub: user.id, 
                username: user.username, 
                role: user.role,
                permissions: [] // TODO: Add permissions logic
            },
            keyManager.getPrivateKey(),
            { 
                algorithm: 'RS256',
                expiresIn: '1h' 
            }
        );

        // Remove sensitive hash before returning
        const { password_hash, totp_secret, ...safeUser } = user;

        // Set Cookie (Optional, if we want browser automagic)
        res.cookie('auth_token', token, { 
            httpOnly: true, 
            secure: false, // Set true in production with HTTPS
            sameSite: 'lax' 
        });

        const response: LoginResponse = {
            success: true,
            token,
            user: { ...safeUser, is_totp_enabled: !!user.is_totp_enabled }
        };

        const returnTo = req.query.return_to as string;
        if (returnTo) {
            // If it's a browser request, we might want to redirect
            // But usually this is an AJAX call from our frontend.
            // So we return the URL in the response.
            (response as any).redirect = `${returnTo}${returnTo.includes('?') ? '&' : '?'}token=${token}`;
        }

        res.json(response);

    } catch (e) {
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
        const decoded = jwt.verify(token, keyManager.getPublicKey(), { algorithms: ['RS256'] });
        res.json({ success: true, user: decoded });
    } catch (e) {
        res.status(403).json({ success: false, error: "Invalid token" });
    }
});

router.get('/public-key', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(keyManager.getPublicKey());
});

// Utility for admins to generate secure tokens (e.g., for config.yaml)
router.get('/generate-secret', ensureAdmin, (req, res) => {
    const secret = crypto.randomBytes(32).toString('hex');
    res.json({ success: true, secret });
});

// --- 2FA Endpoints ---

router.post('/2fa/setup', ensureAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    
    const secret = speakeasy.generateSecret({ name: `Identity Gate (${user.username})` });
    
    // Save secret temporarily (or permanently but disabled)
    // We need to update DB to store secret.
    // For simplicity, we update the user row immediately but keep enabled=0 until verified.
    
    // We need a db method for this.
    // Hack: direct DB access via exposed db instance (not ideal but quick)
    // Better: Add updateTotpSecret to db class.
    // db.updateTotpSecret(user.sub, secret.base32);
    
    // For now, I'll assume we add that method or use raw SQL here?
    // Let's rely on adding the method to DB class in next step.
    (db as any).updateTotpSecret(user.sub, secret.base32);

    const qr = await QRCode.toDataURL(secret.otpauth_url!);
    
    res.json({
        secret: secret.base32,
        otpauth_url: secret.otpauth_url,
        qr_code: qr
    });
});

router.post('/2fa/verify', ensureAuth, (req: Request, res: Response) => {
    const user = (req as any).user;
    const { token } = Verify2FARequestSchema.parse(req.body);

    // Fetch secret from DB
    const dbUser = db.getUserByUsername(user.username);
    if (!dbUser || !dbUser.totp_secret) {
        return res.status(400).json({ error: "2FA setup not initiated" });
    }

    const verified = speakeasy.totp.verify({
        secret: dbUser.totp_secret,
        encoding: 'base32',
        token: token
    });

    if (verified) {
        (db as any).enableTotp(user.sub);
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, error: "Invalid code" });
    }
});

// --- Admin User Management ---

router.get('/users', ensureAdmin, (req, res) => {
    try {
        const users = db.listUsers();
        res.json({ success: true, users });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/users', ensureAdmin, (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: "Username and password required" });
    }

    try {
        const user = db.createUser(username, password, role || 'user', 'local');
        res.json({ success: true, user });
    } catch (e: any) {
        if (e.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, error: "Username already exists" });
        }
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/users/:id', ensureAdmin, (req, res) => {
    const { id } = req.params;
    if (id === (req as any).user.sub) {
        return res.status(400).json({ success: false, error: "Cannot delete yourself" });
    }

    try {
        db.deleteUser(id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
