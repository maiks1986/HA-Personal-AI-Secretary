# Plan: The "Personal Secretary" Ecosystem (Calendar & Intelligence)

## Vision
To move beyond simple integrations and create a **Cooperative Add-on Ecosystem** where independent modules (WhatsApp, Mail, Voice) feed data into a central intelligence layer that manages your complex schedule via a custom **Google Calendar Master** add-on.

## 1. The Ecosystem Architecture

### A. The Data Sources (Producers)
1.  **WhatsApp Engine (Existing):** Captures conversational context.
2.  **Mail Gate (Future):** Connects to IMAP/Gmail API to read incoming emails.
3.  **Voice/Home Assistant (Existing):** Manual voice commands.

### B. The Intelligence Layer (The "Brain")
Instead of hardcoding scraping logic into every addon, we use the **Gemini AI Service** (already integrated in WhatsApp, but ideally centralized) to act as the parser.
*   **Input:** "Let's meet next Tuesday around 2pm for coffee."
*   **Output (JSON):** 
    ```json
    {
      "intent": "appointment_request",
      "proposed_time": "2026-02-03T14:00:00",
      "duration_minutes": 60,
      "subject": "Coffee",
      "participants": ["Sascha"]
    }
    ```

### C. The Action Layer (The "Executor")
This is the **Google Calendar Master** add-on you want to build next.

---

## 2. The Google Calendar Master Add-on

### Why custom?
Standard HA integrations are "Read-Only" or "Simple Write". For a "complex" calendar, we need:
1.  **Conflict Resolution:** "I have a meeting then, but it's moveable."
2.  **Gap Analysis:** "Find a free slot on Tuesday afternoon."
3.  **Complex Rules:** "Don't book over Lunch," "Leave 30m travel time," "Block specific colors."

### Core Features
1.  **OAuth2 Headless Auth:** A UI to handle the Google Token exchange once, storing the refresh token securely in `/data`.
2.  **API-First Design:** It exposes a REST API for *other* add-ons to call.
    *   `POST /api/check-availability` (Dry run)
    *   `POST /api/insert-event` (Smart insert)
    *   `GET /api/context` (Get "What's my day looking like?" summary for AI)
3.  **Custom Logic Engine:**
    *   Support for multiple calendars (Work, Personal, Social).
    *   **"Shadow Calendar"**: Support for a local database that mirrors the cloud calendar for instant, offline conflict checks.

### Tech Stack
*   **Language:** TypeScript (Node.js) - Matching the WhatsApp engine.
*   **Library:** `googleapis` (official Node client).
*   **DB:** SQLite (for caching/shadow copy).

---

## 3. The "Scraping" Workflow (Example)

1.  **WhatsApp Engine** receives a message: *"Hey, are you free for a call tomorrow at 10?"*
2.  **WhatsApp Engine** calls **AI Service**: "Analyze this message for appointments."
3.  **AI Service** responds: `{"check_date": "tomorrow 10am"}`.
4.  **WhatsApp Engine** calls **Calendar Master API**: `/api/check-availability?time=2026-01-31T10:00:00`.
5.  **Calendar Master** runs **Custom Logic**:
    *   *Check:* "Is 10am free?" -> Yes.
    *   *Check:* "Is it too early after my 9am gym session?" -> No.
    *   *Response:* `{"available": true, "context": "You are free."}`.
6.  **WhatsApp Engine** (via AI) generates reply: *"Yes, 10am works for me."*
7.  **User** confirms (via Emoji or reply).
8.  **WhatsApp Engine** calls **Calendar Master API**: `/api/insert-event`.

---

## 4. Implementation Phase 1: The Calendar Manager

We should start by building the standalone Calendar Add-on.

### Step 1: Scaffold Project
*   Structure similar to `whatsapp_node` (Express, SQLite, TypeScript).
*   Config: `google_client_id`, `google_client_secret`.

### Step 2: Authentication
*   Build a "Connect" UI (React) to perform the OAuth flow.
*   Store `tokens.json` in persistent storage.

### Step 3: The Logic Core
*   Implement `CalendarManager` class.
*   Methods: `listEvents(timeMin, timeMax)`, `freeBusyQuery()`, `createEvent()`.

### Step 4: The "Complex Logic" Hooks
*   Define a `rules.json` or `logic.js` interface where we can define your specific complexities (e.g., specific keywords to ignore, color coding priorities).

## 5. Next Actions
1.  **Approve:** Do you agree with this separated architecture? (WhatsApp = Eyes/Ears, Calendar = Hands).
2.  **Scaffold:** I can generate the initial folder structure for `calendar_node` within this repo.
