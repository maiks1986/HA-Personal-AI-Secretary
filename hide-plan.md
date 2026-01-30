# Plan: Stealth Mode Scheduler

## Overview
Allows users to schedule privacy changes (Online/Last Seen visibility) based on time and day.

---

## Option A: "Specific People" (Granular Control)
**Goal:** Hide status from *only* selected contacts (e.g., Boss) during specific hours, while remaining visible to others.

### Mechanism
1.  WhatsApp has a privacy setting: `lastSeen: "contact_blacklist"` (My Contacts Except...).
2.  **The Challenge:** There is no simple Baileys function like `addToPrivacyExclusionList()`. We must construct a raw XML IQ stanza to send to the WhatsApp servers to update this specific list.
3.  **Workflow:**
    *   **Start Time:**
        1.  Fetch current exclusion list (if possible) or maintain a local list.
        2.  Add the "Stealth Targets" to this list.
        3.  Send XML to update the list on WA servers.
        4.  Call `sock.updatePrivacySetting('lastSeen', 'contact_blacklist')`.
        5.  Call `sock.updatePrivacySetting('online', 'match_last_seen')`.
    *   **End Time:**
        1.  Remove "Stealth Targets" from the list.
        2.  Send XML update.
        3.  (Optional) Revert privacy setting if the list is empty.

### Pros & Cons
*   **Pro:** Exact control. Doesn't hide you from friends/family.
*   **Con:** High technical risk. Requires using undocumented/internal protocol features (IQ nodes). If WhatsApp changes the protocol node structure, this breaks immediately.

---

## Option B: "Global Toggle" (Reliable Control)
**Goal:** Hide status from *Everyone* (or set to "My Contacts") during specific hours.

### Mechanism
1.  Uses standard, supported Baileys APIs: `sock.updatePrivacySetting()`.
2.  **Workflow:**
    *   **Start Time:**
        *   Call `sock.updatePrivacySetting('lastSeen', 'none')` (Nobody).
        *   Call `sock.updatePrivacySetting('online', 'match_last_seen')`.
    *   **End Time:**
        *   Call `sock.updatePrivacySetting('lastSeen', 'all')` (Everyone) OR `'contacts'` (My Contacts).

### Pros & Cons
*   **Pro:** Extremely reliable. Supported by official library methods. Unlikely to break.
*   **Con:** It's "All or Nothing". You hide from your spouse at the same time you hide from your boss.

---

## Shared Architecture (Database & UI)
Regardless of the option, the data structure is similar.

### Database
*   `stealth_schedules` table:
    *   `id`, `instance_id`, `name`, `start_time` (HH:MM), `end_time` (HH:MM), `days`, `enabled`.
    *   `mode`: 'GLOBAL_NOBODY' (Option B) or 'SPECIFIC_CONTACTS' (Option A).
*   `stealth_targets` table (Only used for Option A):
    *   `schedule_id`, `jid`.

### UI
*   **Settings -> Stealth Scheduler:**
    *   List of active schedules.
    *   **Add Schedule Modal:**
        *   Name input.
        *   Time Range pickers.
        *   Day selector (M T W T F S S).
        *   **Mode Selector:** "Hide from Everyone" vs "Hide from Specific People".
        *   **Contact Picker:** Only shown if "Specific People" is selected.

---

## Recommendation
We can build the **Shared Architecture** first.
Then, we implement **Option B** as the baseline.
Finally, we *attempt* **Option A**. If the raw XML query fails or is too unstable, we disable that mode in the UI or fallback to Option B.
