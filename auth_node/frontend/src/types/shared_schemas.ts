import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'user', 'guest']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3),
  role: UserRoleSchema,
  created_at: z.number(),
  last_login: z.number().optional(),
  is_totp_enabled: z.boolean().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const LoginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
  totp_code: z.string().optional(), // For 2FA flow
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  success: z.boolean(),
  token: z.string().optional(),
  user: UserSchema.optional(),
  requires_2fa: z.boolean().optional(), // New flag
  error: z.string().optional(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const Setup2FAResponseSchema = z.object({
    secret: z.string(),
    otpauth_url: z.string(),
    qr_code: z.string(), // Data URL
});
export type Setup2FAResponse = z.infer<typeof Setup2FAResponseSchema>;

export const Verify2FARequestSchema = z.object({
    token: z.string(), // The TOTP code
});

export interface JWTPayload {
  sub: string; // user_id
  username: string;
  role: UserRole;
  permissions: string[];
  iat: number;
  exp: number;
}
