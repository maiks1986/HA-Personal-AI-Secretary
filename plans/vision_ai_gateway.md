# Vision: Centralized AI Gateway Add-on (Master Brain)

## Concept
A standalone Home Assistant Add-on that acts as the "Intelligent Router", "Inter-Add-on API Bus", and "Long-Term Memory" for the entire Personal Secretary Ecosystem.

## 1. Standardized Inter-Add-on Communication
To support a modular ecosystem, the Gateway provides a standard **Internal API Bus**:
*   **Discovery:** A registry where add-ons can "check-in" (e.g., `whatsapp_node` tells the gateway it is active on port 5002).
*   **Networking:** Communication happens over the Home Assistant internal Docker network using predictable hostnames (`[repo_hash]-[addon-slug]`).
*   **Zero-Config:** Add-ons find the Gateway by attempting to resolve `ai-gateway` or its hashed equivalent automatically.
*   **Uniform Auth:** All add-ons use the Gateway's `internal_api_key` to talk to each other.
*   **User Auth (External):** For direct API access (e.g., from a web UI), the Gateway trusts **JWTs** issued by the **Identity Gate** (`auth_node`). It checks claims like `ai_usage_tier` to enforce rate limits (e.g., "Free User" = Local Model only).
*   **Request Routing:** Instead of `whatsapp_node` talking directly to `calendar_node`, it can request: `POST /bus/calendar/check-availability`. This allows the Gateway to monitor and log inter-service logic.

## 2. The Custom Component as Service Registry
While data flows directly between add-ons, the **Home Assistant Custom Component** acts as the ecosystem's "Yellow Pages":
*   **Supervisor Integration:** The component queries the HA Supervisor API (`GET /addons`) to detect which secretary modules are currently installed and running.
*   **Dynamic UI:** It provides this "Active Module List" to the Frontend, allowing the dashboard to dynamically show or hide tabs (WhatsApp, Calendar, AI Config) based on what the user has installed.
*   **Token Management:** It handles the distribution of secure communication tokens between the Core and the Add-ons.

## 3. Built-in Local Fallback (TinyLLM)
To ensure the "Secretary" never goes brain-dead during internet outages or API failures:
*   **Embedded Model:** A very small, quantized model (e.g., Phi-3 Mini or TinyLlama) included in the Gateway image.
*   **Automatic Fallback:** If Gemini/OpenAI returns an error or timeout, the Gateway transparently reroutes the "Role" to the local model.
*   **Limited Scope:** The fallback model focuses on core logic (JSON extraction, simple replies) to save CPU/RAM on the host.

## 3. Smart Routing & Role Management
*   **Model-to-Role Assignment:** Assign models (Gemini, OpenAI, Claude, Ollama, or Local Fallback) to specific tasks.
*   **Role: "System Logic"** (High Priority, Fallback enabled).
*   **Role: "Creative Content"** (Low Priority, Cloud only).

## 4. Persistent Context & Shared Memory
*   **Cross-Platform Cache:** Shared SQLite DB for the last 50-100 interactions.
*   **RAG (Retrieval Augmented Generation):** The Gateway can search historical WhatsApp chats when answering a question via Voice or Mail.

## 5. Refactoring Requirements
Existing and future add-ons must be updated to a **"Remote Brain"** architecture:
*   **WhatsApp Node:** Remove internal `AiService.ts`. Replace with a `GatewayClient.ts` that calls the Gateway's API for drafting and nudges.
*   **Calendar Node:** Does not contain AI logic; it only performs "Actions" based on JSON instructions sent by the Gateway.
*   **Home Assistant Integration:** Sensor data can be enriched by the Gateway before being pushed to HA.

## 6. Integration Roadmap
1.  **Phase 1:** ✅ Build the Gateway Scaffold with the Internal API Bus logic. (Completed)
2.  **Phase 2:** 🔄 Move the Gemini logic from WhatsApp to the Gateway. (In Progress)
3.  **Phase 3:** Implement the Local Fallback Model (quantized container).
4.  **Phase 4:** Build the UI for Role and Memory management.
