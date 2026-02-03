import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDb } from '../db/database';
import { IntelligenceRequest } from '../shared_schemas';
import { KeyManager } from './KeyManager';
import { GeminiOauthClient } from './GeminiOauthClient';
import pino from 'pino';

const logger = pino();

export class AiManager {
    
    static async processRequest(request: IntelligenceRequest): Promise<{ reply: string, usage: any }> {
        logger.info(`AI Processing: ${request.role} from ${request.source}`);

        // 1. Fetch Stateful Memory (Last 50 turns)
        const history = this.getHistory(request.context.sender_id || 'system', 50);
        
        // 2. Attempt with Gemini (with Retry/Rotation)
        try {
            return await this.tryGemini(request, history);
        } catch (error) {
            logger.error('All Gemini keys failed or exhausted. Falling back to Local Model.');
        }

        // 3. Fallback to Local Model
        return this.useLocalFallback(request);
    }

    private static async tryGemini(request: IntelligenceRequest, history: any[], attempt: number = 1): Promise<{ reply: string, usage: any }> {
        if (attempt > 3) throw new Error('Max retries exceeded for Gemini');

        const db = getDb();
        const modelRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_model') as { value: string } | undefined;
        const modelName = modelRow?.value || "gemini-1.5-flash";

        const apiKey = await KeyManager.getNextKey('gemini');
        if (!apiKey) {
            throw new Error('No active Gemini keys available');
        }

        try {
            let text: string;

            if (apiKey.type === 'oauth') {
                logger.info(`Using Gemini OAuth Client (Key ID ${apiKey.id})`);
                const tokens = JSON.parse(apiKey.key_value);
                const oauthClient = new GeminiOauthClient(tokens);
                
                // For OAuth, we might want to use a different model naming if needed,
                // but we'll try with the configured one.
                const prompt = this.constructFullPrompt(request, history);
                text = await oauthClient.generateContent(prompt, modelName);
            } else {
                logger.info(`Using Gemini SDK (Key ID ${apiKey.id})`);
                const genAI = new GoogleGenerativeAI(apiKey.key_value);
                const model = genAI.getGenerativeModel({ model: modelName });

                const fullPrompt = this.constructFullPrompt(request, history);
                const result = await model.generateContent(fullPrompt);
                const response = await result.response;
                text = response.text();

                // Clean up JSON if requested (remove markdown blocks)
                if (fullPrompt.includes('VALID JSON ONLY')) {
                    text = text.replace(/```json\n?/, '').replace(/```\n?/, '').trim();
                }
            }

            // Report Success (clears error count)
            KeyManager.reportSuccess(apiKey.id);
            this.logInteraction(request, text, modelName);

            return {
                reply: text,
                usage: { model: modelName, tokens: -1 }
            };

        } catch (error: any) {
            logger.warn(`Gemini Error (Key ID ${apiKey.id}): ${error.message}`);
            
            if (error.message.includes('429') || error.message.includes('403') || error.message.includes('400')) {
                KeyManager.reportFailure(apiKey.id);
            }

            return this.tryGemini(request, history, attempt + 1);
        }
    }

    private static constructFullPrompt(request: IntelligenceRequest, history: any[]): string {
        const historyStr = history.reverse().map(h => `User: ${h.prompt}\nAI: ${h.reply}`).join('\n\n');
        const contextStr = JSON.stringify(request.context);
        
        let fullPrompt = `Role: ${request.role}\nContext: ${contextStr}\n\n`;
        if (historyStr) fullPrompt += `Recent History:\n${historyStr}\n\n`;
        fullPrompt += `User Request: ${request.prompt}`;

        // Contract: Return valid JSON if requested
        if (request.prompt.toLowerCase().includes('json') || request.role.toLowerCase().includes('json')) {
            fullPrompt += "\n\nIMPORTANT: Respond with VALID JSON ONLY.";
        }
        return fullPrompt;
    }

    private static async useLocalFallback(request: IntelligenceRequest) {
        logger.info('Using Local Fallback Model (Placeholder)');
        const reply = `[Fallback Model] I am unable to reach the cloud brain right now. \nRequest: ${request.prompt}`;
        
        this.logInteraction(request, reply, 'local-fallback');

        return {
            reply,
            usage: { model: 'local-fallback', tokens: 0 }
        };
    }

    private static logInteraction(request: IntelligenceRequest, reply: string, model: string) {
        const db = getDb();
        db.prepare(`
            INSERT INTO interactions (source, role, sender_id, prompt, reply, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            request.source,
            request.role,
            request.context.sender_id || null,
            request.prompt,
            reply,
            JSON.stringify({ model, ...request.context.metadata })
        );
    }

    static getHistory(sender_id: string, limit: number = 10) {
        const db = getDb();
        return db.prepare(`
            SELECT * FROM interactions 
            WHERE sender_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `).all(sender_id, limit);
    }
}