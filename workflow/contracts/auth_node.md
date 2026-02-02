# Service Contract: Identity Gate (Auth Node)

## 🟢 Provided Services (API for Others)
The ecosystem's security bouncer.

| Endpoint | Method | Purpose | Payload |
| :--- | :--- | :--- | :--- |
| `/api/auth/pubkey` | GET | Public Key for JWT verification | `None` |
| `/api/auth/verify` | POST | Explicit token verification | `{ "token": "string" }` |
| `/api/auth/login` | POST | Exchange creds for JWT | `{ "email": "string", "pass": "string" }` |
| `/api/oauth/token/:provider` | GET | Get a stored OAuth access token | `None` (Requires Auth JWT) |

## 🔵 Unified Login Protocol (Web/External)
For addons accessed outside of Home Assistant Ingress:
1. **Redirect:** The addon SHOULD redirect unauthenticated users to:
   `http://auth-node:5006/?return_to=http://your-addon-url/callback`
2. **Login:** Identity Gate handles the entire login UI (Local or Google SSO).
3. **Return:** Upon success, Identity Gate redirects back to the `return_to` URL with a `token` query parameter.
4. **Validation:** The addon MUST then validate this token against the Auth Node or via Public Key.

## 🔵 Service-to-Service Authentication (Background Tasks)
For background tasks (e.g., `calendar_node` syncing in the background):
1. **Header:** Use the `X-Internal-Token` header instead of `Authorization`.
2. **Token:** The value MUST match the `internal_token` configured in the Auth Node settings.
3. **Endpoint:** `GET http://auth-node:5006/api/oauth/token/:provider?user_id=:id`
4. **Usage:** This allows an addon to retrieve a token for a specific user without having their active session JWT.


## 🔴 Required Services (Dependencies)
| Dependency | Service Needed | Purpose |
| :--- | :--- | :--- |
| `ai_gateway` | `/v1/process` | Risk assessment for suspicious logins. |

## ⚠️ Security Protocol
1. **Public Key Verification:** Addons should cache the public key and verify JWTs locally using RSA256 to minimize latency.
2. **RBAC Claims:** The JWT payload MUST include a `perms` array (e.g., `["wa_view", "cal_admin"]`).
