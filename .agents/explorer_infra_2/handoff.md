# Explorer Handoff Report: Snapping Rest Timer (R3), Settings, and PWA Notifications

## 1. Observation

Direct investigation of the codebase has identified the implementation mechanisms, DOM structures, and browser APIs utilized across the Power app for the Rest Timer, Settings, Notifications, and Snapping physics.

### A. Rest Timer Engine & State Recovery
* **Source Location**: `src/workouts/workouts.js` (lines 930–1094, 2446–2451)
* **DOM Elements Used**:
  * `#rest-timer-bubble` (The floating bubble wrapper)
  * `#rest-timer-countdown` (Text container showing minutes and seconds remaining)
  * `#rest-timer-progress-circle` (SVG circle for elapsed time visual feedback)
  * `#rest-timer-quote` (Container displaying motivating Hebrew quotes)
  * `#rest-timer-plus-30` / `#rest-timer-minus-30` (Time adjustment steppers)
  * `#close-rest-timer-btn` (Timer dismissal trigger)
* **Classes Added/Removed**:
  * `hide` (Used to show/hide the bubble and modals)
  * `expired` (Appended to the bubble once time reaches zero)
* **Logic Summary**: 
  When a rest timer is initiated (via `startRestTimer(seconds)`), the app registers the target completion time persistently:
  ```javascript
  const endTime = Date.now() + seconds * 1000;
  SafeStorage.setItem('aura-rest-timer-end-time', String(endTime));
  ```
  It then updates the UI every second using `setInterval`.
  If the application is suspended or backgrounded by the OS (common in PWAs), state recovery occurs when the visibility changes back to `visible`:
  ```javascript
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      recoverRestTimer();
    }
  });
  ```
  `recoverRestTimer()` reads `aura-rest-timer-end-time`, calculates `remaining = Math.round((endTime - Date.now()) / 1000)`, and either resumes/starts the timer or handles expiration (if it expired less than 5 minutes ago).

---

### B. Rest Configuration Modal & Set Completed Completion Transitions
* **Source Location**: `src/workouts/workouts.js` (lines 1837–1852, 2265–2286)
* **DOM Elements Used**:
  * `#metric-selector-modal` (Modal to customize exercise parameters)
  * `#rest-time-chips-container` (Holds choices like `.rest-option-chip` containing `data-rest` values)
  * `#set-log-modal` (Sets logging slider popup)
  * `#set-log-confirm-btn` (Confirm set logger button)
* **Logic Summary**:
  Under `#set-log-confirm-btn` event handler:
  ```javascript
  const completedSetsCount = state.currentLoggingExercise.sets.filter(s => s.completed).length;
  const targetSetsCount = state.currentLoggingExercise.targetSetsCount || 3;

  if (completedSetsCount >= targetSetsCount) {
    state.currentLoggingExercise.completed = true;
    state.currentLoggingExercise.sets = state.currentLoggingExercise.sets.filter(s => s.completed);
    saveActiveWorkoutState();
    if (setLogModal) setLogModal.classList.add('hide');
    
    // Start 2-minute transition rest timer
    startRestTimer(120);
    showPremiumToast(`התרגיל הושלם בהצלחה! מעבר לתרגיל הבא בעוד 2 דקות מנוחה ⏱️💪`, "success");
  } else {
    if (setLogModal) setLogModal.classList.add('hide');
    const restSeconds = state.currentLoggingExercise.restTime || 90;
    startRestTimer(restSeconds);
  }
  ```

---

### C. Local Notifications, Service Workers, & Audio Synthesizer
* **Source Locations**: `src/utils/helpers.js` (lines 14–80), `src/workouts/workouts.js` (lines 1096–1169), `sw.js` (lines 135–156)
* **Browser APIs Used**:
  * `Notification.requestPermission` & `Notification.permission`
  * `navigator.serviceWorker.ready` & `navigator.serviceWorker.controller.postMessage`
  * `window.AudioContext` / `window.webkitAudioContext` (Web Audio API)
  * `navigator.vibrate`
* **Notification Flow**:
  1. Checks if notifications are enabled globally:
     ```javascript
     const notifEnabled = SafeStorage.getItem('settings_notifications_enabled') !== 'false';
     ```
  2. If a service worker controller exists, it posts a message to defer notification processing to the background worker (ensures execution even if browser thread suspends):
     ```javascript
     navigator.serviceWorker.controller.postMessage({
       action: 'scheduleRestNotification',
       delayMs: seconds * 1000
     });
     ```
  3. If Service Worker notification fails, falls back to `new Notification(title, options)`.
  4. Alarm audio is synthesized dynamically (no external file needed) via oscillator nodes in `playRestAlarmSynth()`:
     ```javascript
     const ctx = new AudioContext();
     // Generates 4 double beeps (987.77Hz, B5 note) ramping gain from 0 to 0.35, then back to 0.001
     ```

---

### D. Snapping Physics (16px Offset)
* **Source Location**: `src/workouts/workouts.js` (lines 2334–2465)
* **Browser APIs/Events Used**:
  * Touch Events: `touchstart`, `touchmove`, `touchend`
  * Mouse Events: `mousedown`, `mousemove`, `mouseup`
  * Wheel Events: `wheel`
  * Screen Bounds: `window.innerWidth`
* **Snapping Calculations**:
  When dragging ends (`touchend` or `mouseup`), `snapToEdge()` computes horizontal boundaries:
  ```javascript
  function snapToEdge() {
    const bubbleRect = bubble.getBoundingClientRect();
    const bubbleWidth = bubbleRect.width;
    const screenWidth = window.innerWidth;
    const centerX = (screenWidth / 2) + currentX;
    const padding = 16; // 16px edge offset
    let targetX = 0;
    
    if (centerX < screenWidth / 2) {
      // Snap to left edge
      targetX = padding + (bubbleWidth / 2) - (screenWidth / 2);
    } else {
      // Snap to right edge
      targetX = screenWidth - padding - (bubbleWidth / 2) - (screenWidth / 2);
    }
    
    currentX = targetX;
    updateBubbleTransform();
  }
  ```
  The bubble transitions smoothly to the boundary using the CSS transition: `transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.15)`.

---

## 2. Logic Chain

Based on these observations, testing these client-side modules inside a head-free Node.js runtime requires mocking several DOM entities, persistent storage properties, and browser/system APIs. 

1. **Storage Mocking**: Since `src/utils/storage.js` wraps `localStorage`, we must declare a global mock object that implements `getItem`, `setItem`, and `removeItem`.
2. **DOM / Node Mocking**: Methods in `workouts.js` call `document.getElementById` and mutate class structures (`classList.add`, `classList.remove`) and style values (`style.transform`, `style.strokeDashoffset`). We need mock elements that record updates to their properties so they can be validated inside assertions.
3. **Gesture & Mouse Interaction Mocking**: Snapping physics relies on coordinate locations (`clientX`, `clientY`) passed during event listeners. Simulating dragging requires holding array queues of added listeners on the mock DOM objects and invoking them sequentially with mock event packages.
4. **Time & Clock Mocking**: Since intervals handle counting and background timeouts dictate notifications, mocking `setInterval` / `setTimeout` with a controlled clock allows testing timer ticks without delays.
5. **PWA Background Notification Mocking**: The code depends on `navigator.serviceWorker.controller` and `navigator.serviceWorker.ready` properties. Mocking service worker handlers allows asserting that the correct message payload is sent during registration or cancellation events.

---

## 3. Caveats

* **AudioContext Activation Restrictions**: In real browsers, calling `new AudioContext()` will throw an error or be in a `'suspended'` state if the user has not interacted with the page first. The mock should simulate both success and suspended state responses.
* **Layout Constraints**: The layout parameters (`getBoundingClientRect()`, `window.innerWidth`) are hardcoded to match physical screens. Testing snapping physics precisely requires the mock to return fixed layout dimensions (e.g. `window.innerWidth = 375` and `bubbleWidth = 60`).
* **Service Worker Async Hooks**: Service workers execute asynchronously in a separate context. A zero-dependency test runner can only test that the client correctly dispatches `postMessage` calls and sets the recovery storage keys.

---

## 4. Conclusion

The Snapping Rest Timer, Notification Settings, and PWA integrations are closely coupled to browser features (`AudioContext`, `ServiceWorker`, `Notification` object, and touch gesture interactions). 

To test these features with zero dependencies using Node's native test runner (`node --test`), a mock environment must structure the following interfaces:
1. **Mock Storage**: Storage container capturing persistent parameters.
2. **Mock DOM Elements**: Custom nodes representing `#rest-timer-bubble`, `#rest-timer-countdown`, `#rest-timer-progress-circle`, `#rest-timer-plus-30`, etc., maintaining classes and coordinate transforms.
3. **Mock Device APIs**: `AudioContext`, `Notification`, `navigator.vibrate`, and `navigator.serviceWorker` registries.

---

## 5. Verification Method

To verify the logic and correctness of our mock design, we can run a custom test script locally in the workspace using Node.js's built-in test runner. Below is the proposed mock architecture and test runner script.

### A. Mock Setup Script (`tests/mock-env.js`)
Create a mock environment to replicate the browser inside Node.js.

```javascript
// Mock LocalStorage
class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(key) { return this.store[key] || null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
}

// Mock DOM Node
class MockElement {
  constructor(id, tagName = 'div') {
    this.id = id;
    this.tagName = tagName;
    this.classList = {
      classes: new Set(),
      add(cls) { this.classes.add(cls); },
      remove(cls) { this.classes.delete(cls); },
      contains(cls) { return this.classes.has(cls); },
      toggle(cls) {
        if (this.classes.has(cls)) { this.classes.delete(cls); return false; }
        else { this.classes.add(cls); return true; }
      }
    };
    this.style = {};
    this.dataset = {};
    this.textContent = '';
    this.innerHTML = '';
    this.listeners = {};
  }

  addEventListener(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  removeEventListener(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  getBoundingClientRect() {
    return { width: 60, height: 60, top: 100, left: 100 };
  }

  dispatchEvent(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb({ ...data, target: this, preventDefault() {} }));
    }
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }
}

// Global Browser Mock Initializer
export function setupBrowserMock() {
  const localStorageMock = new MockLocalStorage();
  const elements = {};

  const documentMock = {
    body: new MockElement('body'),
    elements: elements,
    listeners: {},
    
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = new MockElement(id);
      }
      return elements[id];
    },

    createElement(tagName) {
      return new MockElement('', tagName);
    },

    addEventListener(event, callback) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(callback);
    },

    dispatchEvent(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(cb => cb({ ...data, target: this, preventDefault() {} }));
      }
    }
  };

  globalThis.window = {
    innerWidth: 375,
    innerHeight: 667,
    AudioContext: class {
      constructor() {
        this.currentTime = Date.now();
        this.destination = {};
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: { setValueAtTime() {} },
          connect() {},
          start() {},
          stop() {}
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {}
        };
      }
    }
  };

  globalThis.document = documentMock;
  globalThis.localStorage = localStorageMock;

  // Mock Notification API
  globalThis.Notification = class {
    static permission = 'granted';
    static lastInstance = null;
    static requestPermission() {
      return Promise.resolve('granted');
    }
    constructor(title, options) {
      this.title = title;
      this.options = options;
      Notification.lastInstance = this;
    }
  };

  // Mock Navigator
  globalThis.navigator = {
    vibrate(pattern) {
      this.lastVibration = pattern;
      return true;
    },
    serviceWorker: {
      controller: {
        postMessage(msg) {
          navigator.serviceWorker.lastMessage = msg;
        }
      },
      ready: Promise.resolve({
        showNotification(title, options) {
          navigator.serviceWorker.lastNotification = { title, options };
          return Promise.resolve();
        }
      })
    }
  };
}
```

---

### B. Unit Test Implementation Example (`tests/rest-timer.test.js`)
We can structure unit test verification scripts validating state triggers:

```javascript
import test from 'node:test';
import assert from 'node:assert';
import { setupBrowserMock } from './mock-env.js';

// Setup Mock environment before importing modules
setupBrowserMock();

// Import target JS modules (using standard ESM)
import { state } from '../src/state.js';
import { startRestTimer, stopRestTimer, recoverRestTimer } from '../src/workouts/workouts.js';

test('Rest Timer Initialization and Background SW Messages', async (t) => {
  // Test starting the rest timer schedules sw background notification
  startRestTimer(90);
  
  assert.strictEqual(state.restTimerSecondsLeft, 90);
  assert.strictEqual(state.restTimerTotalDuration, 90);
  
  // Verify PWA Service Worker message transmission
  assert.deepStrictEqual(globalThis.navigator.serviceWorker.lastMessage, {
    action: 'scheduleRestNotification',
    delayMs: 90000
  });

  // Verify bubble class list changes
  const bubble = document.getElementById('rest-timer-bubble');
  assert.strictEqual(bubble.classList.contains('hide'), false);
  assert.strictEqual(bubble.classList.contains('expired'), false);

  // Clean up
  stopRestTimer();
  assert.deepStrictEqual(globalThis.navigator.serviceWorker.lastMessage, {
    action: 'cancelRestNotification'
  });
});

test('Rest Timer Expiration Alarm, Synthesizer, & Vibrations', async (t) => {
  startRestTimer(0.1); // Fast timer
  
  // Force manual ticking to zero
  state.restTimerSecondsLeft = 0;
  
  // Call internal expiration handler
  const { handleRestTimerExpiration } = await import('../src/workouts/workouts.js');
  handleRestTimerExpiration();

  // Verify bubble changes to expired state
  const bubble = document.getElementById('rest-timer-bubble');
  assert.strictEqual(bubble.classList.contains('expired'), true);

  // Verify hardware vibration patterns triggered
  assert.deepStrictEqual(globalThis.navigator.lastVibration, [300, 150, 300, 150, 300]);

  // Clean up
  stopRestTimer();
});

test('PWA Recovery Catch-up State on tab focus', async (t) => {
  const futureEndTime = Date.now() + 45 * 1000;
  localStorage.setItem('aura-rest-timer-end-time', String(futureEndTime));
  
  state.activeWorkout = { startTime: Date.now() - 1000 }; // Fake active workout state
  
  recoverRestTimer();
  
  // Assert catch up recovered remaining seconds correctly
  assert.ok(state.restTimerSecondsLeft >= 44 && state.restTimerSecondsLeft <= 45);
  
  // Clean up
  stopRestTimer();
});
```

To run this verification suite directly, run:
```powershell
node --experimental-vm-modules tests/rest-timer.test.js
```
*(No node_modules are required, keeping tests fast, reliable, and completely zero-dependency).*
