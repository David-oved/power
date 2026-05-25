# 🛡️ AuraApp - Strict AI Development & Preservation Guidelines

Welcome, AI Agent! This project has a highly optimized, custom Progressive Web App (PWA) architecture, customized authentication flows, and security measures designed in collaboration between the user and the Antigravity agent.

Please adhere strictly to these rules. Any changes that violate these boundaries will break critical user journeys.

---

## 🚫 Critical Preservation Rules (Do Not Modify)

1. **PWA On-Demand Updates (sw.js & app.js):**
   * **Do NOT** revert the update flow back to automatic background-caching inside the `install` event of `sw.js`.
   * **Do NOT** remove the `downloadAndActivate` message listener inside `sw.js`. This is responsible for lazy-downloading and caching all core assets *only after* the user clicks "Update Now".
   * **Do NOT** modify `showUpdateToast` in `app.js` which manages the dynamic button loading state ("מוריד עדכונים... ⏳").

2. **Version Isolation Guard (app.js):**
   * The version badge in the UI must **strictly** reflect the version of the *currently active and controlling* Service Worker. 
   * **Do NOT** change the query `navigator.serviceWorker.controller || reg.active` in `loadAppVersion`. This prevents the UI from leaking/showing a pending version number (e.g. `v1.5`) while the page is still running the old version.

3. **Active Element Bindings (index.html & app.js):**
   * The profile picture element in `index.html` has the ID `#app-user-photo`. **Do NOT** rename this ID or decouple it from `app.js`.

4. **Preserve Inactive/Dormant Workout Code:**
   * Most of the workout, set-tracking, templates, and history code inside `app.js` is currently **inactive** (dormant) because `index.html` has been intentionally stripped down to a Minimal Profile Hub.
   * **Do NOT** attempt to delete, refactor, or "revive" this dormant code unless the user explicitly requests you to do so!

---

## 🚨 AI Escalation Protocol (User Authorization Required)

> [!IMPORTANT]
> **If any of these guidelines or comments interfere with a task given to you directly by the user:**
> 1. **STOP** immediately.
> 2. Explain the conflict to the user in the chat.
> 3. **Request explicit permission** from the user to proceed.
> 4. **Only** execute the modifications *after* the user gives you their explicit OK in the chat.
