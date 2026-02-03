# Maiks AI Secretary Ecosystem

This repository houses a suite of professional Home Assistant Add-ons designed to work together as a **Personal AI Secretary**. The system is modular, allowing you to install only what you need, but designed to be powerful when connected.

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=maiks1986&repository=HA-Personal-AI-Secretary&category=integration)
[![Open your Home Assistant instance and show the add-on store with a specific repository enabled.](https://my.home-assistant.io/badges/supervisor_add_repo.svg)](https://my.home-assistant.io/redirect/supervisor_add_repo/?repository=https%3A%2F%2Fgithub.com%2Fmaiks1986%2FHA-Personal-AI-Secretary)

## 📦 The Ecosystem Modules

### 1. 🧠 AI Gateway (`ai_gateway`)
**The Central Brain.**
*   **Purpose:** Routes intelligence and API requests between all other add-ons.
*   **Features:** Centralized Gemini API management, System Prompts, and inter-service communication bus.
*   **Why install?** Required for AI features in WhatsApp and Calendar.

### 2. 💬 WhatsApp Node (`whatsapp_node`)
**The Communication Hub.**
*   **Purpose:** A powerful, browserless WhatsApp client for Home Assistant.
*   **Features:**
    *   **No Phone Required:** Runs on the server (Baileys engine).
    *   **Sidebar UI:** Full chat interface inside Home Assistant.
    *   **AI Drafting:** Smart reply suggestions powered by the Gateway.
    *   **Home Assistant Integration:** Trigger automations based on incoming messages.

### 3. 📅 Calendar Master (`calendar_node`)
**The Scheduler.**
*   **Purpose:** Advanced Google Calendar integration.
*   **Features:**
    *   Deep bi-directional sync with Google Calendar.
    *   Conflict resolution and "Day Briefing" generation.
    *   Can be queried by the AI Gateway to answer availability questions.

### 4. 🛡️ Identity Gate (`auth_node`)
**The Security Layer.**
*   **Purpose:** Centralized authentication for the ecosystem.
*   **Features:**
    *   Manages JWTs and API Tokens for external access.
    *   Ensures only authorized users access the Secretary dashboards.

---

## 🚀 Installation Guide

1.  **Add the Repository:**
    *   Click the "Add to Home Assistant" button above, or manually add this repository URL to your Add-on Store.
2.  **Install Core Modules:**
    *   Install **AI Gateway** (Required for intelligence).
    *   Install **WhatsApp Node** (For messaging).
    *   Install **Calendar Master** (Optional, for scheduling).
3.  **Install the Integration:**
    *   Search for "WhatsApp Integration" in HACS or Devices & Services to connect the add-ons to your Home Assistant entities.

---

## 🛠 Features Overview
*   **Privacy First:** All database storage (`sqlite`) is local to your machine.
*   **Type-Safe:** All modules are written in TypeScript for maximum stability.
*   **Modular:** If one module updates or restarts, the others keep running.

---
*Maintained by Maiks*