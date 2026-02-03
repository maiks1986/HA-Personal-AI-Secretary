# Plan: Codebase Cleanup & Hygiene

**Objective:** Reduce clutter, remove deprecated experiments, and standardize the project structure to focus on the active ecosystem (`ai_gateway`, `whatsapp`, `calendar`, `auth`).

## 🗑️ Phase 1: Remove Deprecated Modules (Mission Control)
The `mission_control` project was an experiment that has been superseded by the `ai_gateway` and simple batch workflows.

*   [ ] **Delete Directory:** `mission_control/` (Safe to delete as it's not part of the monorepo build).
*   [ ] **Delete Root Script:** `start_mission_control.bat`.

## 🧹 Phase 2: Workflow Directory Cleanup
The `workflow/` folder contains several experimental scripts for Inter-Process Communication (IPC) that are no longer used.

*   [ ] **Keep:**
    *   `MASTER_WORKFLOW.md` (The Rules)
    *   `list_agents.bat` (Essential)
    *   `check_msg.bat` (Essential)
    *   `send_msg.bat` (Essential)
    *   `messenger.py` (The Core Python Logic for bat files)
    *   `contracts/` (API Definitions)
    *   `archived_plans/` (History)
    *   `messages.json` (Message Bus)
*   [ ] **Archive (Move to `workflow/archived_experiments/`):**
    *   `mission_client.py`
    *   `send_mission_msg.bat`
    *   `agent_bridge.js`
    *   `ping_agent.js`
    *   `test_pipe.js`

## 📂 Phase 3: Root Directory Organization
The root directory should be clean and only contain high-level configuration or documentation.

*   [ ] **Create `scripts/` folder:** Move utility scripts here to declutter root.
    *   Move `run.au3` -> `scripts/run.au3` (Note: Update references in the script itself if it uses relative paths).
*   [ ] **Review `plans/`:** Ensure all plans are current. (We just did this, but good to double-check).

## 🧩 Phase 4: Standardization (Optional/Advanced)
*   [ ] **Shared Types:** Currently, schemas are copied. Consider a `shared/` folder if we want to get fancy, but for now, "Copy-Paste" is the safe, mandated protocol in `MASTER_WORKFLOW.md`. We will leave this for now to avoid breaking builds.
*   [ ] **.gitignore Audit:** Ensure `mission_control` and other deleted artifacts are removed from gitignore if they were explicitly listed.

## 🛡️ Phase 5: Gitignore Audit & Security
The current `.gitignore` may be too aggressive (ignoring plans) or too loose (tracking temp files).

*   [ ] **Root `.gitignore` Refinement:**
    *   **Un-ignore:** `plans/` and `workflow/` (These are critical documentation and should be versioned).
    *   **Ignore:** Ensure `*.db`, `*.log`, `node_modules`, and `.env` are strictly ignored globally.
    *   **Audit:** Run `git ls-files` to find files that are currently tracked but *should* be ignored, and remove them from the index (e.g., `git rm --cached`).
*   [ ] **Sub-module Cleanup:** Check if `whatsapp_node` or `calendar_node` have redundant `.gitignore` files that conflict with the root.

## 📢 Phase 6: Agent Coordination
We will use the inter-agent messaging system to ensure all modules are aligned.

*   [ ] **Broadcast Message:**
    *   **Command:** `workflow\send_msg.bat ALL "Maintenance Mode: cleanup initiated. Please report any untracked files that should be persisted."`
    *   (Note: Since I am the Master Builder, I will perform the actions, but this protocol adheres to the workflow rules).

## ⚠️ Execution Protocol
1.  **Safety First:** We will move deleted items to a `_trash/` folder first, rather than permanent deletion, just in case.
2.  **Verify:** Run the `whatsapp_node` build after cleanup to ensure no dependencies were broken.
