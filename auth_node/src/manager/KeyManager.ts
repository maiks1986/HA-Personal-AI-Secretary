import { generateKeyPairSync } from 'crypto';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';

const PRIVATE_KEY_PATH = path.join(CONFIG.dataDir, 'private.pem');
const PUBLIC_KEY_PATH = path.join(CONFIG.dataDir, 'public.pem');

export class KeyManager {
    private privateKey: string;
    private publicKey: string;

    constructor() {
        if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
            console.log('Loading existing RSA keys...');
            this.privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
            this.publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');
        } else {
            console.log('Generating new RSA Key Pair (2048 bit)...');
            const { privateKey, publicKey } = generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            });

            this.privateKey = privateKey;
            this.publicKey = publicKey;

            fs.writeFileSync(PRIVATE_KEY_PATH, this.privateKey);
            fs.writeFileSync(PUBLIC_KEY_PATH, this.publicKey);
            console.log('Keys saved to ' + CONFIG.dataDir);
        }
    }

    getPrivateKey(): string {
        return this.privateKey;
    }

    getPublicKey(): string {
        return this.publicKey;
    }
}

export const keyManager = new KeyManager();
