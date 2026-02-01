"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const database_1 = require("../db/database");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class AiService {
    genAI = null;
    async getClient() {
        if (this.genAI)
            return this.genAI;
        let apiKey = null;
        // 1. Try Database (Runtime Override)
        try {
            const db = (0, database_1.getDb)();
            const row = db.prepare('SELECT value FROM settings WHERE instance_id = 0 AND key = ?').get('gemini_api_key');
            if (row?.value) {
                apiKey = row.value;
                console.log('TRACE [AiService]: Loaded API Key from Database (Runtime Override).');
            }
        }
        catch (e) { }
        // 2. Fallback to HA Options
        if (!apiKey) {
            try {
                const OPTIONS_PATH = process.env.NODE_ENV === 'development'
                    ? path_1.default.join(__dirname, '../../options.json')
                    : '/data/options.json';
                if (fs_1.default.existsSync(OPTIONS_PATH)) {
                    const config = JSON.parse(fs_1.default.readFileSync(OPTIONS_PATH, 'utf8'));
                    if (config.gemini_api_key) {
                        apiKey = config.gemini_api_key;
                        console.log('TRACE [AiService]: Loaded API Key from Add-on options.');
                    }
                }
            }
            catch (e) {
                console.error('TRACE [AiService]: Error reading options.json:', e);
            }
        }
        if (!apiKey) {
            console.warn("TRACE [AiService]: No Gemini API Key found in Database or Add-on settings.");
            return null;
        }
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        return this.genAI;
    }
    async analyzeIntent(messages) {
        console.log(`TRACE [AiService]: analyzeIntent() called with ${messages.length} messages`);
        const client = await this.getClient();
        if (!client)
            return "API Key Missing";
        const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        const context = messages.map(m => `${m.is_from_me ? 'Me' : 'Them'}: ${m.text}`).join('\n');
        const prompt = `
            Analyze the following WhatsApp conversation (last 20 messages).
            Identify the core "Intent" of the other person (Them).
            Return a single short phrase (3-5 words max).
            
            Conversation:
            ${context}
        `;
        try {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        }
        catch (e) {
            console.error('TRACE [AiService]: analyzeIntent error:', e.message || e);
            if (e.message && e.message.includes('429'))
                return "Quota Exceeded";
            return "Analysis Error";
        }
    }
    async generateDraft(messages, steer) {
        console.log(`TRACE [AiService]: generateDraft() called with ${messages.length} messages. Steer: ${steer}`);
        const client = await this.getClient();
        if (!client)
            return "API Key Missing";
        const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        const context = messages.map(m => `${m.is_from_me ? 'Me' : 'Them'}: ${m.text}`).join('\n');
        const prompt = `
            You are an AI helping me reply to WhatsApp messages.
            Here is the recent conversation history:
            ${context}
            
            My instructions for this reply: ${steer || "Draft a helpful and relevant reply."}            
            
            Return ONLY the text of the reply. Do not use quotes or prefixes. 
            Mimic my writing style (informal, concise).
        `;
        try {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        }
        catch (e) {
            console.error('TRACE [AiService]: generateDraft error:', e.message || e);
            return "Draft Error";
        }
    }
    // Force re-init if key changes
    reset() {
        console.log('TRACE [AiService]: reset() called');
        this.genAI = null;
    }
}
exports.aiService = new AiService();
