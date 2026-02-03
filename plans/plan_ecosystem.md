# Maiks AI Secretary Ecosystem - Master Plan

## 🌍 Vision
A comprehensive, private, and modular "Personal Secretary" system running natively on Home Assistant. It acts as a bridge between the user's external world (WhatsApp, Google Calendar, Mail) and their private home automation, powered by a centralized local/cloud AI brain.

## 🏗️ Architecture Overview

The system is designed as a **Monorepo of Micro-Addons**. Each folder represents a standalone Home Assistant Add-on that communicates via a standardized internal bus.

### 🧩 The Core Modules

#### 1. 🧠 AI Gateway (`ai_gateway`)
*   **Role:** The "Brain" and Router.
*   **Responsibilities:**
    *   Centralized LLM API handling (Gemini, OpenAI, Local).
    *   Inter-addon communication bus.
    *   Long-term memory (RAG).
*   **Status:** ✅ Core Active.

#### 2. 💬 WhatsApp Node (`whatsapp_node`)
*   **Role:** The "Mouth" and "Ears".
*   **Responsibilities:**
    *   Connection to WhatsApp Web via Baileys.
    *   Chat UI for Home Assistant.
    *   Message drafting and intent forwarding to Gateway.
*   **Status:** ✅ Stable & Feature Rich.

#### 3. 📅 Calendar Master (`calendar_node`)
*   **Role:** The "Timekeeper".
*   **Responsibilities:**
    *   Google Calendar synchronization.
    *   Conflict detection and scheduling.
    *   "Day Briefing" generation.
*   **Status:** ✅ Beta (Functional).

#### 4. 🛡️ Identity Gate (`auth_node`)
*   **Role:** The "Bouncer".
*   **Responsibilities:**
    *   Authentication provider for external access.
    *   JWT issuance and validation.
    *   Manages user roles and permissions.
*   **Status:** ✅ Active.

---

## 🚀 Current Strategic Focus

### 1. Ecosystem Integration
Ensure that `whatsapp_node` and `calendar_node` are not just standalone tools but communicate effectively via the `ai_gateway`.
*   *Example:* User asks WhatsApp "Am I free tonight?", Gateway queries Calendar, processes result, and WhatsApp sends the reply.

### 2. Stability & Polish
*   Standardize error handling across all nodes.
*   Ensure the `workflow` scripts (bat files) are the primary source of truth for agent coordination during development.

---

## 📂 Sub-Plans
For detailed roadmaps of specific modules, refer to their specific plans:
*   [WhatsApp Plan](./plan_whatsapp_node.md)
*   [AI Gateway Vision](./vision_ai_gateway.md)
