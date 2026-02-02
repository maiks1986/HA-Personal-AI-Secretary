import { Router, Request, Response } from 'express';
import { db } from '../../db/database';
import { OAuthProviderSchema } from '../../shared_schemas';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { keyManager } from '../../manager/KeyManager';
import { CONFIG } from '../../config';

const router = Router();

// Middleware to ensure user is logged in
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

// Admin/User: Manage Providers
router.get('/providers', ensureAuth, (req, res) => {
    const providers = db.listOAuthProviders();
    if ((req as any).user.role === 'admin') {
        return res.json({ success: true, providers });
    }
    
    // Safe list for non-admins (hide secrets)
    const safeProviders = providers.map(({ client_secret, ...rest }) => rest);
    res.json({ success: true, providers: safeProviders });
});

// New endpoint to see what's connected for the current user
router.get('/user/connections', ensureAuth, (req, res) => {
    const tokens = db.getOAuthTokensForUser((req as any).user.sub);
    const connectedProviderIds = [...new Set(tokens.map(t => t.provider_id))];
    res.json({ success: true, connectedProviderIds });
});

router.post('/providers', ensureAdmin, (req, res) => {
    try {
        const data = req.body;
        // In a real scenario, validate with OAuthProviderSchema but without ID
        const provider = db.createOAuthProvider(data);
        res.json({ success: true, provider });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/providers/:id', ensureAdmin, (req, res) => {
    try {
        db.deleteOAuthProvider(req.params.id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.get('/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).json({ error: "Missing code or state" });

    try {
        const decodedState = JSON.parse(Buffer.from(state as string, 'base64').toString());
        const provider = db.getOAuthProvider(decodedState.providerId);
        if (!provider) return res.status(404).json({ error: "Provider not found" });

        // Exchange code for token
        const params = new URLSearchParams();
        params.append('client_id', provider.client_id);
        params.append('client_secret', provider.client_secret);
        params.append('code', code as string);
        params.append('redirect_uri', provider.redirect_uri);
        params.append('grant_type', 'authorization_code');

        const response = await axios.post(provider.token_url, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token, refresh_token, expires_in } = response.data;

        let userId = decodedState.userId;

        // SSO Flow: User is logging in
        if (decodedState.isSSO) {
            let externalId: string | undefined;
            let email: string | undefined;

            if (provider.type === 'google') {
                const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
                    headers: { Authorization: `Bearer ${access_token}` }
                });
                externalId = userRes.data.id;
                email = userRes.data.email;
            }

            if (!externalId) throw new Error("Could not retrieve user info from provider");

            // Check if user exists and is linked
            let user = db.findUserByExternalId(provider.type, externalId);
            
            if (!user) {
                // Access Denied: We no longer auto-link by email as per user request
                return res.status(403).send(`
                    <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                        <h1 style="color: #ef4444;">Access Denied</h1>
                        <p>Your Google account (<b>${email}</b>) is not linked to a local account.</p>
                        <p>Please log in with your username/password first and link your account in the dashboard.</p>
                        <button onclick="window.location.href='/'" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer;">Back to Login</button>
                    </div>
                `);
            }
            userId = user.id;

            const authToken = jwt.sign(
                { sub: user.id, username: user.username, role: user.role, permissions: [] },
                keyManager.getPrivateKey(),
                { algorithm: 'RS256', expiresIn: '1h' }
            );

            res.cookie('auth_token', authToken, { httpOnly: true, sameSite: 'lax' });
        } else {
            // Linking Flow: User is already logged in and connecting a service
            if (provider.name === 'google-sso' || provider.type === 'google') {
                 // Try to get external ID to link for future SSO
                 try {
                    const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
                        headers: { Authorization: `Bearer ${access_token}` }
                    });
                    const externalId = userRes.data.id;
                    if (externalId) {
                        (db as any).linkExternalId(userId, provider.type, externalId);
                    }
                 } catch (e) {}
            }
        }

        db.saveOAuthToken({
            user_id: userId,
            provider_id: provider.id,
            access_token,
            refresh_token,
            expires_at: expires_in ? Date.now() + (expires_in * 1000) : undefined
        });

        const html = `
            <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1 style="color: #10b981;">Successfully Connected</h1>
                <p>You have successfully linked <b>${provider.name}</b>.</p>
                <p>This window will close automatically.</p>
                <script>
                    setTimeout(() => {
                        if (window.opener) {
                            window.opener.location.reload();
                            window.close();
                        } else {
                            window.location.href = '/';
                        }
                    }, 2000);
                </script>
            </div>
        `;
        res.send(html);

    } catch (e: any) {
        console.error('OAuth Callback Error:', e.response?.data || e.message);
        res.status(500).json({ error: "Failed to exchange code for token" });
    }
});

// API for other addons to get tokens
router.get('/token/:provider_name', ensureAuth, async (req, res) => {
    const { provider_name } = req.params;
    const userId = (req as any).user.sub;

    const providers = db.listOAuthProviders();
    const provider = providers.find(p => p.name.toLowerCase() === provider_name.toLowerCase());
    if (!provider) return res.status(404).json({ error: "Provider not found" });

    const tokens = db.getOAuthTokensForUser(userId);
    let token = tokens
        .filter(t => t.provider_id === provider.id)
        .sort((a, b) => b.created_at - a.created_at)[0];

    if (!token) return res.status(404).json({ error: "No token found for this provider" });

    // Refresh logic: if token is expired or expires in the next 5 minutes
    const isExpired = token.expires_at && (token.expires_at < Date.now() + 300000);
    
    if (isExpired && token.refresh_token) {
        try {
            const params = new URLSearchParams();
            params.append('client_id', provider.client_id);
            params.append('client_secret', provider.client_secret);
            params.append('refresh_token', token.refresh_token);
            params.append('grant_type', 'refresh_token');

            const response = await axios.post(provider.token_url, params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const { access_token, expires_in } = response.data;
            const newExpiresAt = expires_in ? Date.now() + (expires_in * 1000) : undefined;

            db.updateOAuthToken(token.id, access_token, newExpiresAt);
            
            return res.json({ success: true, token: access_token });
        } catch (e: any) {
            console.error('Token Refresh Error:', e.response?.data || e.message);
            // Fallback to sending the old token or error
            return res.status(500).json({ error: "Failed to refresh token" });
        }
    }

    res.json({ success: true, token: token.access_token });
});

export default router;
