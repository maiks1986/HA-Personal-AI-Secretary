"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.keyManager = exports.KeyManager = void 0;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const PRIVATE_KEY_PATH = path_1.default.join(config_1.CONFIG.dataDir, 'private.pem');
const PUBLIC_KEY_PATH = path_1.default.join(config_1.CONFIG.dataDir, 'public.pem');
class KeyManager {
    privateKey;
    publicKey;
    constructor() {
        if (fs_1.default.existsSync(PRIVATE_KEY_PATH) && fs_1.default.existsSync(PUBLIC_KEY_PATH)) {
            console.log('Loading existing RSA keys...');
            this.privateKey = fs_1.default.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
            this.publicKey = fs_1.default.readFileSync(PUBLIC_KEY_PATH, 'utf-8');
        }
        else {
            console.log('Generating new RSA Key Pair (2048 bit)...');
            const { privateKey, publicKey } = (0, crypto_1.generateKeyPairSync)('rsa', {
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
            fs_1.default.writeFileSync(PRIVATE_KEY_PATH, this.privateKey);
            fs_1.default.writeFileSync(PUBLIC_KEY_PATH, this.publicKey);
            console.log('Keys saved to ' + config_1.CONFIG.dataDir);
        }
    }
    getPrivateKey() {
        return this.privateKey;
    }
    getPublicKey() {
        return this.publicKey;
    }
}
exports.KeyManager = KeyManager;
exports.keyManager = new KeyManager();
