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

// --- OAuth Bridge Protocol (Synced from Auth Node) ---

export const OAuthProviderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['google', 'github', 'generic']),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  authorize_url: z.string().url(),
  token_url: z.string().url(),
  redirect_uri: z.string().url(),
  scope: z.string(),
});
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

export const OAuthTokenSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_at: z.number().optional(),
  created_at: z.number(),
});
export type OAuthToken = z.infer<typeof OAuthTokenSchema>;
