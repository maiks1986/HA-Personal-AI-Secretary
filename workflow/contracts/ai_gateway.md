# Service Contract: AI Gateway (The Brain)

## 🟢 Provided Services (API for Others)
Central logic hub for all reasoning.

| Endpoint | Method | Purpose | Payload |
| :--- | :--- | :--- | :--- |
| `/v1/process` | POST | General AI thinking | `{ "role": "string", "context": {}, "prompt": "string" }` |
| `/bus/dispatch` | POST | Inter-addon routing | `{ "target": "string", "action": "string", "payload": {} }` |
| `/auth/google/url`| GET | Get OAuth Login URL | `None` |
| `/auth/google/callback`| GET | OAuth Redirect Handler | `query: code` |
| `/settings` | GET/POST | Internal config sync | `{ "key": "string", "value": "string" }` |

## 🔴 Required Services (Dependencies)
| Dependency | Service Needed | Purpose |
| :--- | :--- | :--- |
| `auth_node` | `/api/auth/pubkey` | Fetching public key to verify user tiers/limits in JWTs. |
| `whatsapp_node` | `/api/send_message` | Pushing proactive AI nudges to users. |
| `calendar_node`| `/api/calendar/check` | Verifying slots during "Thinking" phase. |

## ⚠️ Protocol Rules
1.  **Stateful Memory:** The Gateway maintains the last 50 turns. Add-ons do not need to resend full history.
2.  **Schema Enforcement:** `/v1/process` will always return a valid JSON object if a schema is requested in the prompt.
3.  **Configuration Sync:** HA Add-on `options.json` (google_client_id, secret, etc.) are synced to the internal `settings` table on every startup. Dashboard settings are read-only if managed by HA.
