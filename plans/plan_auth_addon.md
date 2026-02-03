# Plan: The "Identity Gate" (Auth Add-on)

## Vision
To transform the "Personal Secretary" ecosystem from a single-user Home Assistant tool into a **Multi-User Platform**. The Identity Gate is a centralized Authentication & Authorization service that allows external users (friends, family) to access specific Add-ons securely without needing Home Assistant credentials.

## 1. Core Responsibilities

### A. Identity Provider (IdP)
*   **User Management:** Maintain a standalone database of users (`users.db`).
    *   Fields: `email`, `password_hash`, `2fa_secret`, `created_at`.
*   **Authentication:** Handle Login, Logout, and 2FA verification.
*   **Session Management:** Issue and Revoke Refresh Tokens.

### B. Authorization (RBAC)
*   **Roles & Permissions:** Define what a user can do.
    *   *Example:* `User A` has `VIEW` access to `WhatsApp Instance 1`.
    *   *Example:* `User B` has `ADMIN` access to `Calendar Node`.
    *   *Example:* `User C` has `USE_MODEL_GPT4` access on `AI Gateway`.
*   **Token Issuance:** Mint **JWTs (JSON Web Tokens)** containing these permissions.

### C. The "Gatekeeper" UI
*   A standalone, secure frontend for:
    *   **Login / Registration** (Invite-only?).
    *   **User Profile** (Change password, setup 2FA).
    *   **Admin Dashboard** (Manage users, assign permissions).

## 2. Architecture

### Tech Stack
*   **Language:** Node.js (TypeScript).
*   **Database:** SQLite (`auth.db`).
*   **Crypto:** `bcrypt` (Passwords), `jsonwebtoken` (JWTs), `speakeasy` (2FA/TOTP).

### Integration Pattern: "Signed JWTs"
To avoid network latency on every request, we use **Public/Private Key Cryptography**.
1.  **Identity Gate** holds the **Private Key**. It signs the JWTs.
2.  **WhatsApp / Calendar** hold the **Public Key**. They can verify the JWT signature *locally* without calling the Identity Gate API.

## 3. Communication Flow

### Scenario: External User Access
1.  **User** visits `http://your-server/whatsapp`.
2.  **WhatsApp Node** detects missing/invalid Cookie/Header.
3.  **WhatsApp Node** redirects user to `http://your-server/auth/login?redirect=/whatsapp`.
4.  **Identity Gate** serves Login UI. User enters credentials.
5.  **Identity Gate** validates and issues a **Signed JWT** (Cookie).
6.  **Identity Gate** redirects back to `/whatsapp`.
7.  **WhatsApp Node** verifies the JWT signature using the Public Key.
    *   *Check:* `permissions` claim includes `whatsapp_access`.
8.  **Access Granted.**

## 4. Interaction with Home Assistant
We still want seamless access for the HA Admin.
*   **Strategy:** The Identity Gate can *also* trust Home Assistant Ingress.
*   If request comes via Ingress -> Identity Gate treats it as "Super Admin" and issues a "Super JWT" automatically.

## 5. Development Roadmap

### Phase 1: The Core (Scaffolding)
*   Setup `auth_node` directory.
*   Implement User DB and Password Hashing.
*   Create basic Login UI.

### Phase 2: The Token Logic (JWT)
*   Implement RSA Key Pair generation.
*   Create endpoints to `sign` (Login) and `verify` (Public Key exposure).
*   Standardize the JWT Payload structure.

### Phase 3: The Integration
*   Create a reusable `AuthMiddleware` library/snippet for WhatsApp and Calendar.
*   Update `whatsapp_node` to accept these new JWTs.

### Phase 4: Advanced Security
*   Implement 2FA (TOTP / Google Authenticator).
*   Add Rate Limiting (Brute force protection).
