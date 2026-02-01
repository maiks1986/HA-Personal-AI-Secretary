"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrationRequestSchema = exports.ActionRequestSchema = exports.IntelligenceRequestSchema = void 0;
const zod_1 = require("zod");
// --- Intelligence Protocol ---
exports.IntelligenceRequestSchema = zod_1.z.object({
    source: zod_1.z.string(),
    role: zod_1.z.string(),
    context: zod_1.z.object({
        sender_id: zod_1.z.string().optional(),
        conversation_history: zod_1.z.array(zod_1.z.any()).optional(),
        metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    }),
    prompt: zod_1.z.string(),
});
// --- Action Protocol ---
exports.ActionRequestSchema = zod_1.z.object({
    target: zod_1.z.string(),
    action: zod_1.z.string(),
    payload: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
});
// --- Registry Protocol ---
exports.RegistrationRequestSchema = zod_1.z.object({
    slug: zod_1.z.string(),
    port: zod_1.z.number(),
    version: zod_1.z.string(),
    capabilities: zod_1.z.array(zod_1.z.string()),
});
