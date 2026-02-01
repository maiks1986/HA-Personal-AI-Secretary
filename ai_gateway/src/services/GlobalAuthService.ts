import axios from 'axios';
import jwt from 'jsonwebtoken';

const AUTH_URL = process.env.AUTH_PROVIDER_URL || 'http://localhost:5006';

export interface AuthUser {
    id: string;
    isAdmin: boolean;
    source: string;
}

export class GlobalAuthService {
    private static publicKey: string | null = null;

    static async init() {
        if (this.publicKey) return;

        try {
            console.log(`[GlobalAuth] Fetching Public Key from ${AUTH_URL}...`);
            const res = await axios.get(`${AUTH_URL}/api/auth/public-key`);
            if (res.data) {
                this.publicKey = res.data;
                console.log('[GlobalAuth] Public Key loaded successfully.');
            }
        } catch (e) {
            console.warn(`[GlobalAuth] Failed to fetch Public Key from ${AUTH_URL}. Global Auth will be disabled.`, (e as any).message);
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
            return null;
        }
    }
}
