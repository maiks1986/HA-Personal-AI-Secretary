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

## 🔵 OAuth Bridge & SSO Policy
*   **Centralized Tokens:** Addons request tokens via `GET http://auth-node:5006/api/oauth/token/:provider`.
*   **Automatic Refresh:** Token refreshing is handled transparently by the Auth Node.
*   **Pre-Approval & Linking:** Google SSO is restricted to accounts that have been manually linked. Users must first log in with their local credentials and use the "Connect" button in the dashboard to bond their Google identity to their local account.


## 🔴 Required Services (Dependencies)
| Dependency | Service Needed | Purpose |
| :--- | :--- | :--- |
| `ai_gateway` | `/v1/process` | Risk assessment for suspicious logins. |

## ⚠️ Security Protocol
1. **Public Key Verification:** Addons should cache the public key and verify JWTs locally using RSA256 to minimize latency.
2. **RBAC Claims:** The JWT payload MUST include a `perms` array (e.g., `["wa_view", "cal_admin"]`).
