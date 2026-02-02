import axios from 'axios';
import jwt from 'jsonwebtoken';

const AUTH_URL = process.env.AUTH_PROVIDER_URL || 'http://auth-node:5006';

export interface AuthUser {
    id: string;
    isAdmin: boolean;
    source: 'global_auth';
}

export class GlobalAuthService {
    private static publicKey: string | null = null;

    static async init() {
        if (this.publicKey) return;

        try {
            console.log(`[GlobalAuth] Fetching Public Key from ${AUTH_URL}...`);
            const res = await axios.get(`${AUTH_URL}/api/auth/pubkey`);
            if (res.data) {
                this.publicKey = res.data;
                console.log('[GlobalAuth] Public Key loaded successfully.');
            }
        } catch (e) {
            console.warn(`[GlobalAuth] Failed to fetch Public Key from ${AUTH_URL}. Global Auth will be disabled.`, (e as any).message);
        }
    }

    static async getOAuthToken(provider: string, jwtToken: string): Promise<any> {
        try {
            const res = await axios.get(`${AUTH_URL}/api/oauth/token/${provider}`, {
                headers: { 'Authorization': `Bearer ${jwtToken}` }
            });
            return res.data;
        } catch (e) {
            console.error(`[GlobalAuth] Failed to fetch OAuth token for ${provider}:`, (e as any).message);
            return null;
        }
    }

    static verifyToken(token: string): AuthUser | null {
        if (!this.publicKey) return null;

        try {
            const decoded = jwt.verify(token, this.publicKey, { algorithms: ['RS256'] }) as any;
            return {
                id: decoded.sub,
                isAdmin: decoded.role === 'admin',
                source: 'global_auth'
            };
        } catch (e) {
            // console.debug('[GlobalAuth] Token verification failed:', (e as any).message);
            return null;
        }
    }
}
