# 🛡️ AuraApp - Strict AI Development & Preservation Guidelines

Welcome, AI Agent! This project has a highly optimized, modular Progressive Web App (PWA) architecture, customized authentication flows, and security measures designed in collaboration between the user and the Antigravity agent.

Please adhere strictly to these rules. Any changes that violate these boundaries will break critical user journeys.

---

## 📂 Modular Codebase Structure & Architecture

The codebase has been refactored from a single monolithic file into a clean, decoupled folder structure using native browser ES6 Modules.

```text
power/
├── AI_GUIDELINES.md         # This guidelines file
├── app.js                   # Clean entry point. Handles tab switching and SW lifecycle bootstrap.
├── firebase-config.js       # Firebase SDK configuration credentials
├── index.html               # Semantic HTML structure & premium tabs containers
├── style.css                # Custom CSS styling tokens & micro-animations
├── sw.js                    # PWA Service Worker (On-Demand Caching updates engine, Offline Support)
└── src/                     # Modular Javascript folder
    ├── state.js             # Singleton global state container (Single Source of Truth)
    ├── utils/               # Common helper utilities
    │   ├── storage.js       # SafeStorage adapter protecting private/incognito tabs
    │   └── helpers.js       # XSS escaping, safe formatters, initials generator, toast banners
    ├── auth/                # Sign-In screen & Firebase Auth module
    │   └── auth.js          # Google Popups/Redirects auth resolving, environment checks
    ├── workouts/            # Workouts Tab module
    │   └── workouts.js      # Active tracking console, sets recorders, plate calculator, rest timer
    ├── meals/               # Meals & Nutrition Tab module
    │   └── meals.js         # Daily calorie summary, meals logging, healthy meals quick log
    ├── metrics/             # Metrics & Analytics Sub-tab module
    │   └── metrics.js       # History logs, charts, interactive calendar, periodic reminders
    └── settings/            # Settings Tab module
        └── settings.js      # Preferences, dark mode, manual updates checker trigger
```

### 🔄 How to communicate between modules:
1. **Shared State:** State should be mutated or read strictly through the `state` object imported from `../state.js`.
2. **Utilities:** Import HTML escaping, toast banners, date formatters, and Storage adapter strictly from `src/utils/`.
3. **Dynamic Hooks:** In modular files, if you need to call a function in another module that hasn't loaded yet, reference it dynamically through `window` hooks (e.g. `if (window.renderWorkoutHistory) window.renderWorkoutHistory()`).

---

## 🚫 Critical Preservation Rules (Do Not Modify)

1. **PWA On-Demand Updates (sw.js & app.js):**
   * **Do NOT** revert the update flow back to automatic background-caching inside the `install` event of `sw.js`.
   * **Do NOT** remove the `downloadAndActivate` message listener inside `sw.js`. This is responsible for lazy-downloading and caching all core assets *only after* the user clicks "Update Now".
   * **Do NOT** modify `showUpdateToast` in `app.js` which manages the dynamic button loading state ("מוריד עדכונים... ⏳").
   * **Do NOT** forget to add any new file you create in `src/` to the `ASSETS` array in `sw.js`.

2. **Version Isolation Guard (app.js):**
   * The version badge in the UI must **strictly** reflect the version of the *currently active and controlling* Service Worker. 
   * **Do NOT** change the query `navigator.serviceWorker.controller || reg.active` in `loadAppVersion`. This prevents the UI from leaking/showing a pending version number (e.g. `v1.5`) while the page is still running the old version.

3. **Active Element Bindings (index.html & app.js):**
   * The profile picture element in `index.html` has the ID `#app-user-photo`. **Do NOT** rename this ID or decouple it from `app.js`.

4. **Preserve Inactive/Dormant Workout Code:**
   * Most of the workout, set-tracking, templates, and history code inside `app.js` is currently **inactive** (dormant) because `index.html` has been intentionally stripped down to a Minimal Profile Hub.
   * **Do NOT** attempt to delete, refactor, or "revive" this dormant code unless the user explicitly requests you to do so!
   * *Note: With the modularization, the dormant code is located inside `src/workouts/workouts.js` and `src/metrics/metrics.js`.*

---

## 🚨 AI Escalation Protocol (User Authorization Required)

> [!IMPORTANT]
> **If any of these guidelines or comments interfere with a task given to you directly by the user:**
> 1. **STOP** immediately.
> 2. Explain the conflict to the user in the chat.
> 3. **Request explicit permission** from the user to proceed.
> 4. **Only** execute the modifications *after* the user gives you their explicit OK in the chat.
