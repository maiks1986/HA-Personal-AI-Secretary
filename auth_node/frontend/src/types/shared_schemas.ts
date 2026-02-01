import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'user', 'guest']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3),
  role: UserRoleSchema,
  created_at: z.number(),
  last_login: z.number().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const LoginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  success: z.boolean(),
  token: z.string().optional(),
  user: UserSchema.optional(),
  error: z.string().optional(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export interface JWTPayload {
  sub: string; // user_id
  username: string;
  role: UserRole;
  permissions: string[];
  iat: number;
  exp: number;
}
