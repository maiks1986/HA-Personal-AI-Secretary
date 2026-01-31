# Plan: Social Sensors & Automated Nudge System

## Objective
Create individual Home Assistant sensors for selected WhatsApp contacts to track their `online` status, `last_seen`, and `online_duration`. Enable automation potential for "Social Nudge" scripts.

## 1. Architecture

### Backend Logic (`whatsapp_node`)
1.  **Module:** `SocialManager.ts`
    *   **Tracking:** Maintains an in-memory map of `jid -> { startTime, totalDurationToday }`.
    *   **Presence Listener:** Listens to `presence.update`.
        *   When `available`: Record `startTime`. Update HA sensor state to `on`.
        *   When `unavailable`: Calculate duration (`now - startTime`). Add to `totalDurationToday`. Update HA sensor state to `off`. Update attributes (`last_seen`, `session_duration`, `daily_total`).
    *   **HA Integration:** Uses Home Assistant Supervisor API (or Long-Lived Token) to push sensor updates.
        *   **Discovery:** We should likely use MQTT Discovery if available, OR the Supervisor API if running as an Add-on (REST API).
        *   **Sensor Entity:** `binary_sensor.wa_contact_<clean_jid>` (Online/Offline).
        *   **Attributes:** `last_seen`, `current_session_duration`, `daily_online_duration`.

2.  **Configuration:**
    *   We cannot create sensors for *all* contacts (too much noise/load).
    *   **UI:** "Tracked Contacts" list in Settings. User selects who to track.

### Frontend Logic
*   **Settings -> Social Tracking:**
    *   List of tracked contacts.
    *   "Add Contact" picker.

### Home Assistant Automation (The "Logic" Layer)
*   **Why not in Node?** The logic "if I'm awake, no appointments..." depends on other HA entities (Calendar, Sleep sensor). It belongs in HA Automations, not the Add-on.
*   **The Add-on's Role:** Provide the **Data**.
    *   `binary_sensor.wa_mom` -> `on` (Online).
    *   `sensor.wa_mom_stats` -> Attributes: `last_online: 08:30`, `daily_minutes: 45`.
*   **The Automation (YAML/Node-RED in HA):**
    ```yaml
    trigger:
      - platform: state
        entity_id: binary_sensor.wa_friend
        to: 'off' # When they go offline (session finished)
    condition:
      - condition: state
        entity_id: input_boolean.im_awake
        state: 'on'
      - condition: numeric_state
        entity_id: sensor.wa_friend_stats
        attribute: daily_minutes
        above: 60 # They were online for > 1 hour today
    action:
      - service: script.send_whatsapp_nudge
        data:
          target: friend
    ```

## 2. Implementation Steps

### Phase 1: Tracking Engine (`SocialManager.ts`)
1.  **Database:** `tracked_contacts` table (`instance_id`, `jid`).
2.  **Presence Handler:**
    *   Hook into `presence.update`.
    *   If JID is in `tracked_contacts`:
        *   Calculate stats.
        *   **Push to HA:** `POST http://supervisor/core/api/states/binary_sensor.wa_<name>` (requires Supervisor Token).

### Phase 2: Configuration UI
1.  **API:** `GET/POST /api/social/tracked`.
2.  **Frontend:** Multi-select contact picker in Settings.

### Phase 3: The "Nudge" Helper (Optional)
*   The user mentioned "send them 'good morning...' either list or AI".
*   We can expose an API: `POST /api/ai/generate_nudge { jid, tone: 'friendly' }`.
*   HA can call this via `shell_command` or `rest_command`.

## 3. Risks & Constraints
*   **Privacy:** Monitoring online duration is invasive. Ensure this is only used for personal "social health" and not stalking.
*   **HA Rate Limits:** Pushing state updates every few seconds for many contacts might bloat the HA recorder database.
    *   *Mitigation:* Only push state changes (Online <-> Offline), calculate duration on the "Offline" event.

## 4. Execution Plan
1.  **Create:** `SocialManager.ts`.
2.  **Integrate:** Hook into `WhatsAppInstance`.
3.  **UI:** Add tracking selection.
4.  **HA API:** Implement the `updateHASensor` function using the internal Supervisor token.
