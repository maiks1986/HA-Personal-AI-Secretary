# Plan: Repository Rename & Rebranding

**Target Name:** `HA-AI-Secretary`
**Display Name:** "Maiks AI Secretary Add-on's"

## 🎯 Objective
Transition the project from `HA-Whatsapp-intergration` to `HA-AI-Secretary` to reflect its evolution into a multi-module ecosystem. This involves updating code, documentation, and external registry links while minimizing disruption to existing users.

## 📋 Checklist

### Phase 1: Preparation (The "Safe" Changes)
*   [ ] **Update `repository.yaml`:** Change the `name` field to "Maiks AI Secretary Add-on's".
*   [ ] **Update `README.md`:** Update the title and introductory text to use the new branding.
*   [ ] **Audit Hardcoded Paths:** Identify all scripts (like `run.au3` or internal `.bat` files) that rely on the absolute path `...\HA-Whatsapp-intergration`.

### Phase 2: The Rename (Execution Day)
*   [ ] **GitHub Rename:** User manually renames the repository in GitHub Settings to `HA-AI-Secretary`.
*   [ ] **Update Manifests:**
    *   `custom_components/whatsapp_hass/manifest.json`: Update `documentation` and `issue_tracker` URLs.
    *   `repository.yaml`: Update the `url` field to the new GitHub URL.
*   [ ] **Search & Replace:** Perform a global find-and-replace for `HA-Whatsapp-intergration` -> `HA-AI-Secretary` in all documentation and config files.

### Phase 3: Local Environment
*   [ ] **Rename Folder:** Rename local directory `C:\Users\Maiks\OneDrive\Bureaublad\HA-Whatsapp-intergration` to `...\HA-AI-Secretary`.
*   [ ] **Update Git Remote:** `git remote set-url origin https://github.com/maiks1986/HA-AI-Secretary.git`
*   [ ] **Update Scripts:** Update `run.au3` and any local VS Code workspace settings to point to the new folder path.

### Phase 4: User Migration & HACS
*   [ ] **HACS Update:**
    *   If using a custom repository in HACS: Users must delete the old repo and add the new URL.
    *   **Action:** Add a "Migration Notice" to the top of the old README *before* the rename if possible, or pin an issue.
*   [ ] **Add-on Store:** Home Assistant usually handles redirects for the Add-on Store, but we should verify this.
    *   **Action:** Push an update that displays a "Repo Moved" warning in the Add-on logs if we detect the old URL source (hard to do, but good to keep in mind).

## 📣 Communication Plan (Agent Broadcast)
When ready to execute, run the following broadcast to notify all sub-agents (if active) to update their internal references:

```batch
workflow\send_msg.bat ALL "ATTENTION: Repository renaming to HA-AI-Secretary. Please update any internal absolute paths or git remote references immediately."
```
