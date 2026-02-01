"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KeyManager_1 = require("./manager/KeyManager");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
console.log("Initializing KeyManager...");
const km = new KeyManager_1.KeyManager();
const payload = { sub: '123', username: 'testuser' };
console.log("Signing payload:", payload);
const token = jsonwebtoken_1.default.sign(payload, km.getPrivateKey(), { algorithm: 'RS256', expiresIn: '1h' });
console.log("Token generated:", token);
console.log("Verifying with Public Key...");
try {
    const decoded = jsonwebtoken_1.default.verify(token, km.getPublicKey(), { algorithms: ['RS256'] });
    console.log("Verification SUCCESS:", decoded);
}
catch (e) {
    console.error("Verification FAILED:", e);
}
