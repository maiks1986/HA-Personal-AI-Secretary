import { Router, Request, Response } from 'express';
import { db } from '../../db/database';
import { LoginRequestSchema, LoginResponse } from '../../shared_schemas';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../../config';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
    try {
        const body = LoginRequestSchema.parse(req.body);
        const user = db.getUserByUsername(body.username);

        if (!user || !bcrypt.compareSync(body.password, user.password_hash)) {
            const response: LoginResponse = { success: false, error: "Invalid credentials" };
            return res.status(401).json(response);
        }

        // Generate Token
        const token = jwt.sign(
            { 
                sub: user.id, 
                username: user.username, 
                role: user.role,
                permissions: [] // TODO: Add permissions logic
            },
            CONFIG.jwtSecret,
            { expiresIn: '1h' }
        );

        // Remove sensitive hash before returning
        const { password_hash, ...safeUser } = user;

        // Set Cookie (Optional, if we want browser automagic)
        res.cookie('auth_token', token, { 
            httpOnly: true, 
            secure: false, // Set true in production with HTTPS
            sameSite: 'lax' 
        });

        const response: LoginResponse = {
            success: true,
            token,
            user: safeUser
        };

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
        const decoded = jwt.verify(token, CONFIG.jwtSecret);
        res.json({ success: true, user: decoded });
    } catch (e) {
        res.status(403).json({ success: false, error: "Invalid token" });
    }
});

export default router;
