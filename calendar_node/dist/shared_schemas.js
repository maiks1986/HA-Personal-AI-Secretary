"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarInsertRequestSchema = exports.CalendarCheckRequestSchema = exports.SyncResponseSchema = exports.CalendarEventSchema = exports.CalendarListEntrySchema = exports.TokenExchangeResponseSchema = exports.TokenExchangeRequestSchema = exports.AuthUrlResponseSchema = exports.HealthResponseSchema = exports.InstanceSchema = exports.InstanceTypeSchema = exports.CalendarRoleSchema = void 0;
const zod_1 = require("zod");
// --- Roles and Types ---
exports.CalendarRoleSchema = zod_1.z.enum([
    'primary', // Main appointments
    'private', // Private appointments (blocks time, hidden details)
    'fixed', // Recurring/Routine (Vaste Afspraken)
    'presence', // Drives HA sensors (Justin Thuis/School)
    'social_slots', // Shared availability (Adriana)
    'external', // Read-only feeds (School Holidays)
    'ignore' // Specifically excluded
]);
exports.InstanceTypeSchema = zod_1.z.enum(['google', 'ics']);
// --- Instance Schemas ---
exports.InstanceSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    type: exports.InstanceTypeSchema,
    config: zod_1.z.any(), // JSON config for OAuth or ICS URL
    is_active: zod_1.z.boolean(),
});
// --- Core Response Schemas ---
exports.HealthResponseSchema = zod_1.z.object({
    status: zod_1.z.enum(['ok', 'error', 'loading']),
    version: zod_1.z.string(),
    authorized: zod_1.z.boolean(),
});
exports.AuthUrlResponseSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
});
// --- Request Schemas ---
exports.TokenExchangeRequestSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, "Authorization code is required"),
});
exports.TokenExchangeResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    tokens: zod_1.z.any().optional(), // Can refine this later if we want strict Google Token typing
    error: zod_1.z.string().optional(),
});
// --- Calendar Data Schemas ---
exports.CalendarListEntrySchema = zod_1.z.object({
    id: zod_1.z.string(),
    summary: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    primary: zod_1.z.boolean().optional(),
    backgroundColor: zod_1.z.string().optional(),
    foregroundColor: zod_1.z.string().optional(),
});
exports.CalendarEventSchema = zod_1.z.object({
    id: zod_1.z.string(),
    calendar_id: zod_1.z.string(),
    summary: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    start_time: zod_1.z.string().datetime(), // Enforces ISO 8601
    end_time: zod_1.z.string().datetime(),
    location: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
    htmlLink: zod_1.z.string().optional(),
});
exports.SyncResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    count: zod_1.z.number(),
});
// --- Contract API Schemas ---
exports.CalendarCheckRequestSchema = zod_1.z.object({
    start: zod_1.z.string().datetime(),
    end: zod_1.z.string().datetime(),
});
exports.CalendarInsertRequestSchema = zod_1.z.object({
    subject: zod_1.z.string().min(1),
    start: zod_1.z.string().datetime(),
    duration_minutes: zod_1.z.number().optional().default(60),
    description: zod_1.z.string().optional(),
});
