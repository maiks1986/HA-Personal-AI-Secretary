# WhatsApp Pro for Home Assistant - Project Plan

## 🎯 Vision
Build a private, multi-instance, AI-powered WhatsApp CRM running natively on Home Assistant.

## 🏗 Architecture
- **Backend:** Node.js + TypeScript + Baileys (Multi-device protocol)
- **Database:** SQLite (Persistent storage for messages, users, and instances)
- **Frontend:** React + Vite + Tailwind CSS (WhatsApp-style UI)
- **AI:** Google Gemini 1.5 Flash (Intent analysis and reply drafting)

---

## 🚦 Roadmap

### ✅ Phase 1: Database & Multi-Instance Core (COMPLETED v1.1.0)
- [x] SQLite schema design (`users`, `instances`, `messages`).
- [x] Multi-Instance Manager logic.
- [x] Persistent message logging.

### 🚀 Phase 2: The "WhatsApp Pro" UI (In Progress)
- [ ] Implement Tailwind CSS for professional styling.
- [ ] Create Dual-Pane layout (Sidebar for chats, Main for messages).
- [ ] Build Instance Switcher (dropdown/tabs).
- [ ] Implement Chat Controls (Clear button, AI Draft field).

### 🤖 Phase 3: Gemini AI Integration
- [ ] Settings page for Gemini API Keys.
- [ ] Intent Analysis Engine (last 20 messages).
- [ ] Smart Suggestion Engine with "Steer" functionality.

### 🔒 Phase 4: Auth & Security
- [ ] JWT Login system.
- [ ] Role-based access (Admin vs User).
- [ ] User-Instance binding.

---

## 📝 Current Todo List
- [ ] **Phase 2:** Build the new React layout with Tailwind.
- [ ] **Phase 2:** Connect frontend to the new Multi-Instance API.
- [ ] **Phase 2:** Implement real-time message stream via Socket.io.
