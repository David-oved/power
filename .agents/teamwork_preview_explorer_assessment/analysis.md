# Codebase Research and Environment Assessment Report

## 1. Codebase Architecture & Structure Mapping
AuraApp (referred to as "Power") has a modular client-side Progressive Web App (PWA) architecture. The codebase is organized as follows:

- **/index.html**: Holds the single-page application markup structure, including the screens, navigation, and modal overlays.
- **/style.css**: Defines the global variables (colors, fonts, sizes) and styles, using a dark high-contrast "Forged Iron Gym" theme.
- **/app.js**: Entry point that coordinates initializations (workouts, analytics, settings), tab-switching gestures, PWA updates, and the iOS navigation bar mechanics.
- **/sw.js**: Service worker engine handling on-demand resource caching, offline fallback, and background workout reminder notifications.
- **/firebase-config.js**: Sets the credentials for Firebase SDK connection (`window.firebaseConfig`).
- **/src/state.js**: Centralized single source of truth (`state` singleton object) that holds app states for Auth, navigation, active workouts, timers, and analytics.
- **/src/utils/storage.js**: SafeStorage adapter that automatically fallbacks to an in-memory dictionary if localStorage throws a quota or privacy exception.
- **/src/utils/helpers.js**: Utility functions (XSS escaping, initials-based avatar SVG generator, safe date-time formatters, custom premium toast banner system).
- **/src/auth/auth.js**: Coordinates login/logout screen transitions and maps Firebase pop-up/redirect auth resolutions.
- **/src/workouts/workouts.js**: Drives workout session tracking, exercise selectors, inline set logging, plate calculator, and the interactive drag-snapping rest timer bubble.
- **/src/metrics/metrics.js**: Implements scheduled workout reminders, muscle group splits volume bars, a GitHub-style workout contributions heatmap, an interactive calendar view, and a custom SVG Bezier curve progress chart.
- **/src/settings/settings.js**: Controls preferences (dark mode toggling, notification permission, app version check).

---

## 2. Environment Assessment & Testing Infrastructure
The environment has been assessed with the following commands and queries:
- **Node.js**: Installed (`v24.12.0`).
- **npm**: Installed (`11.6.2`).
- **Global npm packages**: `serve` (a simple static files server) and `vercel` (CLI deployment utility).
- **Project packages (`package.json`)**: **None** exist in the workspace directory. The application relies entirely on browser-native ES6 modules and external script CDNs.

---

## 3. Preserved Event Listeners, State Properties, & Library Bindings
To prevent regressions during future refactorings, these bindings and properties must be preserved:

### A. Critical Global State Container (`src/state.js`)
The `state` object exported by `src/state.js` holds variables read and mutated across different modules:
- **Auth**: `currentUser`, `firebaseEnabled`, `firebaseAuthResolved`, `app`, `auth`, `googleProvider`.
- **Navigation**: `lastActiveMainTab`, `activeSubTab` (`workouts` or `analytics`).
- **Workouts**:
  - `activeWorkout`: Object storing active session values (`startTime`, `location`, `locationName`, `locationEmoji`, `exercises`).
  - `activeTimerInterval`: ID of the running session duration timer.
  - `workoutHistory`: Array of completed workouts.
  - `editingWorkout`: Temp storage for the active workout history item being edited in the modal.
  - `customLocations` & `customExercises`: User-added presets.
  - `favoriteExercises`: Array of favorited exercise names.
- **Rest Timer**: `restTimerInterval`, `restTimerSecondsLeft`, `restTimerTotalDuration`.
- **Set Logging**: `currentLoggingExercise`, `currentLoggingSetIndex`.
- **Analytics Filters**: `filterTimeSelection`, `filterStartDate`, `filterEndDate`, `filterLocation`, `filterMuscleGroup`, `selectedAnalyticsExercise`, `activeChartType`, `currentCalendarDate`.

### B. DOM Views Structure (`index.html`)
The view state management relies on class toggling (`hide` and `active` classes) on major container elements:
- `#workout-idle-view` (Line 185): Renders when no workout is active. Contains stats summary cards and the big start button.
- `#workout-active-view` (Line 385): Renders the active workout console (timers, exercises, logging buttons).
- `#exercise-picker-modal` (Line 418): Exercise select bottom sheet.
- `#set-log-modal` (Line 576): Set logging dialog. Contains weight, reps, and time adjusters.
- `#plate-calculator-modal` (Line 674): Cast iron plate loader wizard.
- `#workout-edit-modal` (Line 698): Accordion history editor modal.
- `#rest-timer-bubble` (Line 795): The floating circle holding countdown and gesture triggers.
- `#settings-main-view` (Line 187) & `#settings-account-view` (Line 299): Layouts in the Settings tab.

### C. Core Event Listeners & Interactive Handlers
- **Global Lifecycle**:
  - `window.addEventListener('load')`: Registers `/sw.js` and loads version metadata.
  - `navigator.serviceWorker.addEventListener('controllerchange')`: Automatically reloads the browser when the Service Worker finishes updating to prevent version mixing.
  - `document.addEventListener('visibilitychange')`: Listens for visibility transitions to trigger `recoverRestTimer()` to restore background timing.
- **Service Worker Message Interface**:
  - `message` event: Communicates rest timer schedule alerts (`scheduleRestNotification`, `cancelRestNotification`) and updates coordination.
- **User Actions**:
  - `#google-login-btn` & `#app-logout-btn`: Firebase authentication transitions.
  - `.ios-bottom-nav .nav-tab` -> click: Custom navigation controller switching tabs.
  - `.tab-pane` -> scroll: Auto-collapses the iOS navigation bar.
  - `#nav-menu-toggle-btn` -> click: Restores the collapsed navigation bar.
  - `#start-workout-btn` & `#cancel-location-btn`: Toggles location choice panel.
  - `#add-exercise-btn`: Validates active exercises state and shows exercise picker.
  - `#confirm-add-exercise-btn`: Binds customized metrics options to the new exercise card.
  - `#finish-workout-btn`: Validates sets, filters empty exercises, saves workout history to Storage, and moves focus to the analytics tab.
  - `#set-log-confirm-btn`: Appends set, saves active workout state, and starts rest timer.
  - `#rest-timer-bubble` touch & mouse events: Implements drag-to-dock physics and wheel-based sizing.

---

## 4. Testing Strategy
Since the app doesn't have a compilation phase, here are two paths to set up testing:

### Option A: Standard Vitest + JSDOM Setup (Recommended)
This approach is clean and integrates with the ES Modules architecture natively:
1. Initialize a `package.json` in the project root:
   ```json
   {
     "name": "power-app-tests",
     "version": "1.0.0",
     "type": "module",
     "scripts": {
       "test": "vitest run"
     },
     "devDependencies": {
       "vitest": "^1.6.0",
       "jsdom": "^24.0.0",
       "@testing-library/dom": "^10.0.0"
     }
   }
   ```
2. Configure `vitest.config.js` to simulate a browser environment:
   ```javascript
   import { defineConfig } from 'vitest/config';
   export default defineConfig({
     test: {
       environment: 'jsdom',
       globals: true,
     },
   });
   ```
3. Test files (e.g. `src/utils/helpers.test.js`) can easily import modules and mock browser behaviors.

### Option B: Built-in Node.js Test Runner (Zero-Dependency)
Since Node v24 is active on the host, we can run tests without downloading any packages by utilizing the built-in `node:test` framework:
1. Create a `test-runner.js` script:
   ```javascript
   import test from 'node:test';
   import assert from 'node:assert';
   import { escapeHTML } from './src/utils/helpers.js';

   test('escapeHTML helper prevents script injections', () => {
     const input = '<script>alert(1)</script>';
     const expected = '&lt;script&gt;alert(1)&lt;/script&gt;';
     assert.strictEqual(escapeHTML(input), expected);
   });
   ```
2. Run directly in the command prompt:
   ```bash
   node test-runner.js
   ```
*Note: For testing files that interact with DOM (like workouts or analytics), you would need to mock `window`, `document`, and the selectors in global scope before importing them.*

### Option C: E2E Playwright Tests
Because the application relies heavily on dynamic CSS transitions, offline caching, and PWA behaviors, E2E testing is the most complete method:
1. Run local web server using global `serve` tool:
   ```bash
   npx serve .
   ```
2. Run Playwright script to verify:
   - Splash screen transitions.
   - Fallback offline warning banners.
   - Dynamic rest timer calculations upon app visibility updates.
