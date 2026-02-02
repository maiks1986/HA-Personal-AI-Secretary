"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthTokenSchema = exports.OAuthProviderSchema = exports.RegistrationRequestSchema = exports.ActionRequestSchema = exports.IntelligenceRequestSchema = void 0;
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
// --- OAuth Bridge Protocol (Synced from Auth Node) ---
exports.OAuthProviderSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1),
    type: zod_1.z.enum(['google', 'github', 'generic']),
    client_id: zod_1.z.string().min(1),
    client_secret: zod_1.z.string().min(1),
    authorize_url: zod_1.z.string().url(),
    token_url: zod_1.z.string().url(),
    redirect_uri: zod_1.z.string().url(),
    scope: zod_1.z.string(),
});
exports.OAuthTokenSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    user_id: zod_1.z.string().uuid(),
    provider_id: zod_1.z.string().uuid(),
    access_token: zod_1.z.string(),
    refresh_token: zod_1.z.string().optional(),
    expires_at: zod_1.z.number().optional(),
    created_at: zod_1.z.number(),
});
