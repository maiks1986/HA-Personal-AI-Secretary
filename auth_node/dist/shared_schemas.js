"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Verify2FARequestSchema = exports.Setup2FAResponseSchema = exports.LoginResponseSchema = exports.LoginRequestSchema = exports.UserSchema = exports.UserRoleSchema = void 0;
const zod_1 = require("zod");
exports.UserRoleSchema = zod_1.z.enum(['admin', 'user', 'guest']);
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    username: zod_1.z.string().min(3),
    role: exports.UserRoleSchema,
    created_at: zod_1.z.number(),
    last_login: zod_1.z.number().optional(),
    is_totp_enabled: zod_1.z.boolean().optional(),
});
exports.LoginRequestSchema = zod_1.z.object({
    username: zod_1.z.string(),
    password: zod_1.z.string(),
    totp_code: zod_1.z.string().optional(), // For 2FA flow
});
exports.LoginResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    token: zod_1.z.string().optional(),
    user: exports.UserSchema.optional(),
    requires_2fa: zod_1.z.boolean().optional(), // New flag
    error: zod_1.z.string().optional(),
});
exports.Setup2FAResponseSchema = zod_1.z.object({
    secret: zod_1.z.string(),
    otpauth_url: zod_1.z.string(),
    qr_code: zod_1.z.string(), // Data URL
});
exports.Verify2FARequestSchema = zod_1.z.object({
    token: zod_1.z.string(), // The TOTP code
});
