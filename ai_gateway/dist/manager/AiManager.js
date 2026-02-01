"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiManager = void 0;
const generative_ai_1 = require("@google/generative-ai");
const database_1 = require("../db/database");
const KeyManager_1 = require("./KeyManager");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)();
class AiManager {
    static async processRequest(request) {
        logger.info(`AI Processing: ${request.role} from ${request.source}`);
        // 1. Attempt with Gemini (with Retry/Rotation)
        try {
            return await this.tryGemini(request);
        }
        catch (error) {
            logger.error('All Gemini keys failed or exhausted. Falling back to Local Model.');
        }
        // 2. Fallback to Local Model
        return this.useLocalFallback(request);
    }
    static async tryGemini(request, attempt = 1) {
        if (attempt > 3)
            throw new Error('Max retries exceeded for Gemini');
        const apiKey = await KeyManager_1.KeyManager.getNextKey('gemini');
        if (!apiKey) {
            throw new Error('No active Gemini keys available');
        }
        try {
            const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey.key_value);
            // Use flash model for speed and cost
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            // Construct Prompt with Context
            const contextStr = JSON.stringify(request.context);
            const fullPrompt = `Role: ${request.role}\nContext: ${contextStr}\n\nUser Request: ${request.prompt}`;
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            const text = response.text();
            // Report Success (clears error count)
            KeyManager_1.KeyManager.reportSuccess(apiKey.id);
            this.logInteraction(request, text, 'gemini-1.5-flash');
            return {
                reply: text,
                usage: { model: 'gemini-1.5-flash', tokens: -1 } // Token count not always available easily
            };
        }
        catch (error) {
            logger.warn(`Gemini Error (Key ID ${apiKey.id}): ${error.message}`);
            // If it's a quota or permission error, report it
            // 429 = Quota, 403 = Permission, 400 = Bad Request (maybe invalid key)
            if (error.message.includes('429') || error.message.includes('403') || error.message.includes('400')) {
                KeyManager_1.KeyManager.reportFailure(apiKey.id);
            }
            // Recursive Retry
            return this.tryGemini(request, attempt + 1);
        }
    }
    static async useLocalFallback(request) {
        logger.info('Using Local Fallback Model (Placeholder)');
        const reply = `[Fallback Model] I am unable to reach the cloud brain right now. \nRequest: ${request.prompt}`;
        this.logInteraction(request, reply, 'local-fallback');
        return {
            reply,
            usage: { model: 'local-fallback', tokens: 0 }
        };
    }
    static logInteraction(request, reply, model) {
        const db = (0, database_1.getDb)();
        db.prepare(`
            INSERT INTO interactions (source, role, sender_id, prompt, reply, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(request.source, request.role, request.context.sender_id || null, request.prompt, reply, JSON.stringify({ model, ...request.context.metadata }));
    }
    static getHistory(sender_id, limit = 10) {
        const db = (0, database_1.getDb)();
        return db.prepare(`
            SELECT * FROM interactions 
            WHERE sender_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `).all(sender_id, limit);
    }
}
exports.AiManager = AiManager;
