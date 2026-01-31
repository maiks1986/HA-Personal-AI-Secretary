# Plan: Instance Settings & Online Timeout

## Objective
1.  Refine the settings architecture to support Per-Instance configurations.
2.  Implement an "Auto-Offline" timeout mechanism to prevent notification suppression.
3.  Disable the manual Online/Offline toggle in the UI.

## 1. Database Schema
### Table: `settings` (Migration)
*   Current: `key` (PK), `value`.
*   New: `instance_id` (PK, nullable), `key` (PK), `value`.
*   **Migration Strategy:**
    *   Rename old table to `settings_old`.
    *   Create new table with composite PK `(instance_id, key)`.
    *   Copy global settings with `instance_id = 0` (or NULL if SQLite allows, usually 0 is safer for PK).
    *   Drop old table.

## 2. Backend Logic
### `WhatsAppInstance.ts`
*   **New Property:** `onlineTimeout` (NodeJS.Timeout).
*   **Logic:**
    *   When `setPresence('available')` is called:
        *   Clear existing timeout.
        *   Send 'available'.
        *   Start timeout (duration from settings).
        *   On timeout: `setPresence('unavailable')`.
    *   When `setPresence('unavailable')` is called:
        *   Clear timeout.
        *   Send 'unavailable'.

### `SettingsManager.ts` (New Helper?)
*   Or just update `getDb().prepare(...)` calls to respect `instanceId`.

## 3. Frontend Logic
*   **ChatList.tsx:** Comment out the `handleTogglePresence` button.
*   **SettingsModal.tsx:**
    *   Add "Online Timeout (Seconds)" input.
    *   Ensure settings load/save with `instanceId`.

## 4. Execution Steps
1.  **DB Migration:** Update `settings` table.
2.  **API:** Update `routes/system.ts` to handle `instanceId` in settings GET/POST.
3.  **Backend:** Implement Timeout logic in `WhatsAppInstance`.
4.  **UI:** Hide toggle, add setting input.
