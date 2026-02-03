# The "Personal Secretary" Ecosystem: Master Plan

## 1. Vision
We are building a suite of cooperating Home Assistant Add-ons that act as a "Personal Secretary". The system observes communication (WhatsApp, Mail), reasons about it (Gemini AI), and acts on it (Calendar, Reminders).

**Core Philosophy:** "Easy to Install, Modular to Maintain."

## 2. Repository Structure (Monorepo)
The repository `HA-Personal-AI-Secretary` contains multiple Add-ons:

```text
/
├── whatsapp_node/       # [EXISTING] The "Social Engine"
│   ├── Purpose: Connects to WhatsApp, tracks presence, sends/receives messages.
│   └── Status: Stable (v1.9.1.0038). Features: Social Sensors, Ephemeral Mode, AI Nudge.
│
├── calendar_node/       # [NEXT UP] The "Time Master"
│   ├── Purpose: Manages Google Calendars, resolves conflicts, finds free slots.
│   └── Status: Scaffolding only.
│
└── mail_node/           # [FUTURE] The "Mail Gate"
    ├── Purpose: IMAP/SMTP bridge to read/send emails.
    └── Status: Planned.
```

## 3. The "Intelligence Layer" (AI Gateway)
We are shifting from per-addon AI logic to a centralized **AI Gateway Addon**.
*   **Role:** Handles all LLM calls (Gemini, OpenAI, Local Fallback).
*   **API Bus:** Acts as the router for communication between addons (e.g., WhatsApp -> Gateway -> Calendar).
*   **Memory:** Shared database for cross-platform conversation context.
*   **Action for Next Agent:** When building `calendar_node` or updating `whatsapp_node`, assume all "reasoning" happens via an external API call to the Gateway.

## 4. The "Calendar Master" (Detailed Plan for Next Agent)

### A. Core Responsibilities
1.  **Auth:** Manage Google OAuth2 tokens (Headless UI flow).
2.  **API:** Expose REST endpoints for the **AI Gateway** to call:
    *   `POST /api/calendar/check-availability` (Purely technical slot check)
    *   `POST /api/calendar/insert` (Execute insertion)
    *   `GET /api/calendar/summary` (Raw data dump for the Gateway to summarize)
3.  **Shadow DB:** Maintain a local SQLite mirror of the calendar for instant queries.

### B. Tech Stack
*   **Base:** Node.js (TypeScript), Express, SQLite (better-sqlite3).
*   **Google:** `googleapis` library.
*   **Frontend:** React (Vite) for the Config/Auth dashboard.

### C. Immediate Tasks
1.  **Initialize:** Run `npm init` in `calendar_node`.
2.  **Config:** Create `config.yaml` for Home Assistant (ingress: true).
3.  **Auth:** Build the OAuth2 flow.
4.  **Refactor WhatsApp:** Prepare to move its AI logic to the future `ai_gateway`.


## 5. Deployment & Discovery Strategy
*   **One Repo URL:** The user adds this single repo to HA Store.
*   **Internal Networking:** Add-ons talk via Docker/HA internal network using hostnames like `local-calendar-node` or `[repo_hash]-calendar-node`. (Underscores in slugs become hyphens in hostnames).
*   **Service Registry:** The **Custom Component** (`whatsapp_hass`) acts as the registry. It queries the Supervisor API to find active add-ons and tells the Frontend which UI modules to enable.
*   **Zero-Config Link:** No manual IP setup. Add-ons attempt to self-discover the **AI Gateway** on startup.

## 6. Current Status of `whatsapp_node`
*   **Version:** 1.9.1.0038
*   **Key Features:**
    *   **Social Sensors:** Tracks contacts to HA Sensors.
    *   **Stealth Mode:** Schedule privacy settings.
    *   **Ephemeral:** "Delete for Me" automation.
    *   **Robustness:** Auto-resets corrupted sessions, retries syncs.
    *   **Ingress:** Fully working auto-login.

## 7. Handover Instruction
**To the next Agent:**
Your primary focus is **bootstrapping the `calendar_node`**.
1.  Read this plan.
2.  Set up `calendar_node/package.json`, `tsconfig.json`, `Dockerfile`.
3.  Implement the basic Express server.
4.  Build the Google Auth flow.
