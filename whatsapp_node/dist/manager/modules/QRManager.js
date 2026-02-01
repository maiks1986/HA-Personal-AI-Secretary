"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QRManager = void 0;
const qrcode_1 = __importDefault(require("qrcode"));
class QRManager {
    currentQr = null;
    /**
     * Processes a raw QR code string from Baileys and converts it to a Data URL.
     * @param rawQr The raw QR string provided by the connection update.
     * @returns The generated Data URL of the QR code.
     */
    async processUpdate(rawQr) {
        console.log('[QRManager] Received QR Update. Length:', rawQr.length);
        this.currentQr = await qrcode_1.default.toDataURL(rawQr);
        console.log('[QRManager] Generated Data URL. Length:', this.currentQr.length);
        return this.currentQr;
    }
    /**
     * Returns the current QR code Data URL.
     */
    getQr() {
        // console.log('[QRManager] getQr called. Result:', this.currentQr ? 'EXISTS' : 'NULL');
        return this.currentQr;
    }
    /**
     * Clears the stored QR code (e.g., on connection or timeout).
     */
    clear() {
        this.currentQr = null;
    }
}
exports.QRManager = QRManager;
