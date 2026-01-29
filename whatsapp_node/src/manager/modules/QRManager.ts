import qrcode from 'qrcode';

export class QRManager {
    private currentQr: string | null = null;

    /**
     * Processes a raw QR code string from Baileys and converts it to a Data URL.
     * @param rawQr The raw QR string provided by the connection update.
     * @returns The generated Data URL of the QR code.
     */
    async processUpdate(rawQr: string): Promise<string> {
        console.log('[QRManager] Received QR Update. Length:', rawQr.length);
        this.currentQr = await qrcode.toDataURL(rawQr);
        console.log('[QRManager] Generated Data URL. Length:', this.currentQr.length);
        return this.currentQr;
    }

    /**
     * Returns the current QR code Data URL.
     */
    getQr(): string | null {
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
