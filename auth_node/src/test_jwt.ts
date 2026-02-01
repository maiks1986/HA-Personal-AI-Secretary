import { KeyManager } from './manager/KeyManager';
import jwt from 'jsonwebtoken';

console.log("Initializing KeyManager...");
const km = new KeyManager();

const payload = { sub: '123', username: 'testuser' };
console.log("Signing payload:", payload);

const token = jwt.sign(payload, km.getPrivateKey(), { algorithm: 'RS256', expiresIn: '1h' });
console.log("Token generated:", token);

console.log("Verifying with Public Key...");
try {
    const decoded = jwt.verify(token, km.getPublicKey(), { algorithms: ['RS256'] });
    console.log("Verification SUCCESS:", decoded);
} catch (e) {
    console.error("Verification FAILED:", e);
}
