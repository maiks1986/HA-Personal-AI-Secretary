# Plan: The Unified Dashboard (The "Shell")

## Vision
To create a single, cohesive User Interface that unifies all "Personal Secretary" add-ons (WhatsApp, Calendar, AI, Auth) into one seamless application experience.

**Goal:** Users should feel like they are using *one* powerful app, not 4 separate Docker containers.

## 1. The "Shell" Architecture
The Shell is a lightweight React Application that acts as the **Window Manager**.

### Responsibilities
*   **Navigation:** A persistent sidebar or top bar to switch between modules (Chat, Schedule, Brain, Admin).
*   **Context:** Displays global status (e.g., "AI Processing...", "System Healthy").
*   **Auth Enforcement:** Checks the user's Token (JWT) immediately on load. If invalid, redirects to the Login screen.
*   **Module Loading:** Dynamically loads the content of the active module.

## 2. Hosting Strategy
Where does this Shell live?

### Option A: The "Identity Gate" Host (Recommended)
Since the **Identity Gate** (`auth_node`) is already the public entry point for login, it makes sense for it to serve the Shell.
*   **URL:** `https://your-domain.com/` (The Shell).
*   **Modules:**
    *   `/whatsapp` -> Proxies to `whatsapp_node` UI.
    *   `/calendar` -> Proxies to `calendar_node` UI.
    *   `/admin` -> Internal User Management UI.

### Option B: Home Assistant Custom Panel
For HA users, the "Custom Component" acts as the Shell.
*   **Sidebar:** HA provides the sidebar.
*   **Tabs:** We use a `Tabbed View` inside the main iframe to switch between our internal tools if we want to combine them into one HA Panel item.

## 3. Micro-Frontend Implementation (The "How")

### Level 1: The IFrame Composition (Easiest)
The Shell renders a generic layout with a Navigation Bar. The main content area is an `<iframe>` pointing to the internal URL of the active add-on.
*   **Pros:** Zero code sharing required. Each add-on can use different tech/versions.
*   **Cons:** Slower (reloads resources), harder to share state (e.g., "New Message" badge on the calendar tab).

### Level 2: API Composition (Better UX)
The Shell is the *only* Frontend.
*   **WhatsApp Node:** becomes *Headless* (API only). The Shell imports the `ChatList` component and talks to the WhatsApp API directly.
*   **Calendar Node:** becomes *Headless*. The Shell imports the `CalendarView`.
*   **Pros:** Instant switching, shared state, feels like a true Single Page App (SPA).
*   **Cons:** High coupling. The Shell build needs access to *all* shared React components from other repos.

## 4. The "Hybrid" Roadmap

### Phase 1: The Landing Page
*   Identity Gate serves a simple "Dashboard" with big cards: "Open WhatsApp", "Open Calendar".
*   These link to the separate UIs.

### Phase 2: The IFrame Shell
*   Identity Gate serves a React App with a Sidebar.
*   Clicking "WhatsApp" loads the WhatsApp UI in the main frame (Proxying the assets).
*   Shared "Top Bar" shows the User Profile and Logout button.

### Phase 3: The Unified SPA (Long Term)
*   We move all React code into a `shared/frontend` workspace.
*   The "Shell" imports `ChatModule` and `CalendarModule` as libraries.
*   We build *one* giant frontend artifact that can talk to all the different backends.

## 5. Immediate Action
1.  **Design System:** We need a shared UI library (Tailwind config + Components) so WhatsApp and Calendar look identical (Same fonts, colors, buttons).
2.  **Shared Header:** Create a "standard header" component that every Add-on includes, which has a "Apps" dropdown to switch between them even before the full Shell exists.
