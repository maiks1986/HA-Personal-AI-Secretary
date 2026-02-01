import { z } from 'zod';

// --- Base Types ---

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

// --- Intelligence Protocol ---

export const IntelligenceRequestSchema = z.object({
    source: z.string(),
    role: z.string(),
    context: z.object({
        sender_id: z.string().optional(),
        conversation_history: z.array(z.any()).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
    }),
    prompt: z.string(),
});

export type IntelligenceRequest = z.infer<typeof IntelligenceRequestSchema>;

// --- Action Protocol ---

export const ActionRequestSchema = z.object({
    target: z.string(),
    action: z.string(),
    payload: z.record(z.string(), z.any()),
});

export type ActionRequest = z.infer<typeof ActionRequestSchema>;

// --- Registry Protocol ---

export const RegistrationRequestSchema = z.object({
    slug: z.string(),
    port: z.number(),
    version: z.string(),
    capabilities: z.array(z.string()),
});

export type RegistrationRequest = z.infer<typeof RegistrationRequestSchema>;
