# Handoff Report - Workout UI & Offline Testing Mocking Analysis

## 1. Observation
Direct observations of the codebase structure and interactions for the Active Workout UI (R1) and Set Logging Modal (R2):

- **File Paths and Entry Points**:
  - `c:\Users\wbddw\OneDrive\שולחן העבודה\power\app.js`: Inits the workouts module at line 337 (`initWorkoutsModule();`) and configures tab switching navigation.
  - `c:\Users\wbddw\OneDrive\שולחן העבודה\power\src\workouts\workouts.js`: Main file for workouts. Defines `initWorkoutsModule()`, `initWorkouts()`, `startNewWorkout()`, `startRestTimer()`, and `openSetLoggingModal()`.
  - `c:\Users\wbddw\OneDrive\שולחן העבודה\power\index.html`: Contains view containers, modal overlays, buttons, inputs, and SVG nodes.
  - `c:\Users\wbddw\OneDrive\שולחן העבודה\power\src\state.js`: Global state object mapping `activeWorkout`, `workoutHistory`, `currentLoggingExercise`, and other properties.
  - `c:\Users\wbddw\OneDrive\שולחן העבודה\power\src\utils\storage.js`: Wraps `localStorage` read/writes inside `SafeStorage`.
  - `c:\Users\wbddw\OneDrive\שולחן העבודה\power\src\utils\helpers.js`: Helper functions (toasts, dates, notifications).

- **Interaction Mappings**:
  - **Active Workout Initiation**:
    - Trigger: Button `#start-workout-btn` displays `#location-selector-grid`.
    - Clicking a location tile `.location-tile` invokes `startNewWorkout(location, name, emoji)` (lines 382-400 of `workouts.js`).
    - Hides `#workout-idle-view` and displays `#workout-active-view` (lines 423-424 of `workouts.js`).
  - **Adding Exercises & Metrics Selection**:
    - Trigger: Clicking `#add-exercise-btn` displays `#exercise-picker-modal`.
    - Clicking an exercise item triggers modal transition to `#metric-selector-modal`.
    - Inside `#metric-selector-modal`, target sets count is incremented/decremented via `#metric-sets-plus` and `#metric-sets-minus` and displayed in `#metric-sets-display`.
    - Clicking `#confirm-add-exercise-btn` validates inputs and pushes the exercise to `state.activeWorkout.exercises`.
  - **Logging Sets (R2 Set Logging Modal)**:
    - Trigger: Clicking `.enter-set-data-btn` ("➕ רישום סט X") calls `openSetLoggingModal(ex)` (line 1428 of `workouts.js`).
    - Displays `#set-log-modal` (line 1495 of `workouts.js`) with configured range sliders: `#weight-range-slider`, `#reps-range-slider`, `#time-range-slider`.
    - Adjustments are handled via `#weight-minus-btn`, `#weight-plus-btn`, etc.
    - Confirmed via `#set-log-confirm-btn` (`confirmSetBtn`). Saving the set pushes it to `ex.sets`. If the target set count is reached, `ex.completed = true` is set, and a 120s rest timer starts. Otherwise, a standard rest timer (`ex.restTime`) starts.
  - **Finishing Workouts**:
    - Trigger: Clicking `#finish-workout-btn` runs workout completion logic (verifies non-empty sets, removes empty exercises).
    - Logs the workout to `state.workoutHistory`, saves to SafeStorage under key `aura-workout-history_${uid}`, stops timers, clears active workout from SafeStorage, hides `#workout-active-view`, and shows `#workout-idle-view`.

- **PWA & Network Import Restrictions**:
  - Line 1-10 in `src/auth/auth.js` import Firebase resources from external HTTPS URLs:
    ```javascript
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getAuth, ... } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
    ```
  - Running standard ESM files in Node.js offline will throw a resolution error because Node.js's default ESM loader does not support `https:` protocol schemes natively.

---

## 2. Logic Chain
- **Step 1**: The application interacts with the DOM through direct element references (e.g. `document.getElementById('start-workout-btn')` and `.querySelector()`).
- **Step 2**: In a zero-dependency Node.js offline environment, standard global objects like `window`, `document`, and `navigator` are undefined, which crashes script initialization upon load.
- **Step 3**: To run integration/unit tests on these files without modifying production source code, we must construct a lightweight DOM shim and attach it to the `globalThis` context prior to module evaluation.
- **Step 4**: Because `workouts.js` and `auth.js` import external Firebase resources from HTTPS CDN links, native Node.js ESM imports will fail offline.
- **Step 5**: Therefore, a custom Node.js ESM loader is necessary to intercept these HTTPS specifiers and redirect them to local mock code strings using `data:` URI specifiers.
- **Step 6**: Pre-populating the mocked DOM with the explicit set of IDs mapped from `index.html` prevents element resolution issues during module binding phase.

---

## 3. Caveats
- **CSS Transitions/Animations**: DOM mock does not validate visual animations or class transitions (e.g., `.hide`, `.active` styling effects). Tests only verify that class addition/removal occurs.
- **Synthesized Audio**: AudioContext mock behaves as a dummy oscillator gain collector. It does not play actual alert tones.
- **User Gestures**: Rest timer notifications and browser vibration APIs are mocked to return true without native hardware interaction.

---

## 4. Conclusion
We can fully test the Active Workout UI (R1) and Set Logging Modal (R2) features offline in a zero-dependency Node.js setup by:
1. Setting up a global mock environment (`proposed_mock_env.js`) to provide shims for DOM, window, local/session storage, AudioContext, Notifications, and navigator APIs.
2. Directing imports using a custom ESM resolver loader hook (`proposed_esm_loader.js`) to intercept external HTTPS requests.
3. Invoking the tests with the native Node.js test runner using:
   `node --experimental-loader=./proposed_esm_loader.js --import=./proposed_mock_env.js proposed_workout_test.js`

---

## 5. Verification Method
Verify by reviewing the three proposed files generated in the workspace:
1. `c:\Users\wbddw\OneDrive\שולחן העבודה\power\.agents\explorer_infra_1\proposed_mock_env.js` - Inspect the mock element registry, DOM APIs, and Web interfaces.
2. `c:\Users\wbddw\OneDrive\שולחן העבודה\power\.agents\explorer_infra_1\proposed_esm_loader.js` - Review the HTTPS resolver rule redirecting `gstatic.com/firebasejs` to offline modular mocks.
3. `c:\Users\wbddw\OneDrive\שולחן העבודה\power\.agents\explorer_infra_1\proposed_workout_test.js` - Validate the test suite logic covering starting, adding exercises, logging sets (R2), rest timing, and finishing workouts.
