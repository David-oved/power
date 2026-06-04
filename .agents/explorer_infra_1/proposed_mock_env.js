/**
 * proposed_mock_env.js
 * Zero-dependency Node.js browser environment mock for testing AuraApp workouts/set logging offline.
 * 
 * Instructions: Load this file at the start of your test suite before importing any production ESM files.
 */

// Mock HTML Element Class
class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName;
    this.classList = {
      classes: new Set(),
      add: (cls) => this.classList.classes.add(cls),
      remove: (cls) => this.classList.classes.delete(cls),
      contains: (cls) => this.classList.classes.has(cls),
      toggle: (cls) => {
        if (this.classList.classes.has(cls)) {
          this.classList.classes.delete(cls);
        } else {
          this.classList.classes.add(cls);
        }
      }
    };
    this.listeners = {};
    this.attributes = {};
    this.style = {};
    this._innerHTML = '';
    this.children = [];
    this.disabled = false;
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) { this._innerHTML = val; }
  get textContent() { return this._innerHTML; }
  set textContent(val) { this._innerHTML = val; }

  addEventListener(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  removeEventListener(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] || null; }
  removeAttribute(name) { delete this.attributes[name]; }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  // Trigger DOM events programmatically
  click(eventObj = {}) {
    if (this.listeners['click']) {
      this.listeners['click'].forEach(cb => cb({
        stopPropagation: () => {},
        preventDefault: () => {},
        target: this,
        ...eventObj
      }));
    }
  }

  input(val) {
    this.value = val;
    if (this.listeners['input']) {
      this.listeners['input'].forEach(cb => cb({ target: this }));
    }
  }

  querySelector(selector) {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return this.children.find(c => c.classList.contains(cls)) || null;
    }
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return this.children.find(c => c.id === id) || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return this.children.filter(c => c.classList.contains(cls));
    }
    return [];
  }

  closest(selector) {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      if (this.classList.contains(cls)) return this;
    }
    return null;
  }
}

// Registry for Mock DOM Elements
const elementsById = new Map();
const elementsByClass = new Map();

// Helper to pre-populate mock elements
function registerMockElement(id, classes = [], tagName = 'div') {
  const el = new MockElement(id, tagName);
  classes.forEach(c => el.classList.add(c));
  if (id) elementsById.set(id, el);
  classes.forEach(c => {
    if (!elementsByClass.has(c)) elementsByClass.set(c, []);
    elementsByClass.get(c).push(el);
  });
  return el;
}

// Pre-register important IDs for Active Workout and Set Logging interactions
const requiredIds = [
  'workout-idle-view', 'workout-active-view', 'active-workout-progress-bar',
  'active-location-icon', 'active-location-text', 'active-timer',
  'exercises-container', 'add-exercise-btn', 'finish-workout-btn',
  'exercise-picker-modal', 'close-exercise-picker-btn', 'exercise-search-input',
  'exercise-category-filters', 'exercise-picker-list', 'open-custom-exercise-modal-btn',
  'metric-selector-modal', 'close-metric-selector-btn', 'metric-sets-minus',
  'metric-sets-display', 'metric-sets-plus', 'sets-chips-container',
  'rest-time-chips-container', 'confirm-add-exercise-btn', 'rest-timer-bubble',
  'rest-timer-countdown', 'rest-timer-progress-circle', 'rest-timer-quote',
  'close-rest-timer-btn', 'rest-timer-plus-30', 'rest-timer-minus-30',
  'trigger-plate-calc-btn', 'plate-calculator-modal', 'close-plate-calc-btn',
  'plate-calc-target-weight', 'plates-stack-left', 'plates-list-needed',
  
  // Set Logging (R2) Elements
  'set-log-modal', 'set-log-exercise-name', 'set-log-set-number',
  'set-log-weight-group', 'weight-slider-value', 'weight-minus-btn',
  'weight-range-slider', 'weight-plus-btn', 'set-log-reps-group',
  'reps-slider-value', 'reps-minus-btn', 'reps-range-slider', 'reps-plus-btn',
  'set-log-time-group', 'time-slider-value', 'time-minus-btn',
  'time-range-slider', 'time-plus-btn', 'set-log-confirm-btn', 'set-log-cancel-btn',

  // Other layout / metadata dependencies
  'app-version-display', 'settings-system-version', 'pwa-update-toast',
  'pwa-refresh-btn', 'nav-menu-toggle-btn', 'go-to-account-btn',
  'back-to-settings-btn', 'settings-main-view', 'settings-account-view',
  'ios-install-banner', 'ios-prompt-close-btn', 'workout-stats-weekly',
  'workout-stats-minutes', 'workout-stats-monthly', 'workout-stats-last',
  'workout-user-name', 'workout-daily-quote', 'location-selector-grid',
  'location-tiles-container', 'cancel-location-btn', 'workout-edit-modal',
  'close-edit-modal-btn', 'save-edited-workout-btn', 'delete-workout-btn',
  'modal-workout-meta', 'modal-exercises-container', 'workout-history-list'
];

requiredIds.forEach(id => registerMockElement(id));

// Define global window/document mock
globalThis.window = globalThis;

globalThis.document = {
  readyState: 'complete',
  
  getElementById(id) {
    if (!elementsById.has(id)) {
      // Auto-create to handle dynamic layout adjustments
      elementsById.set(id, new MockElement(id));
    }
    return elementsById.get(id);
  },
  
  querySelector(selector) {
    if (selector.startsWith('#')) {
      return this.getElementById(selector.slice(1));
    }
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      const list = elementsByClass.get(cls) || [];
      return list[0] || null;
    }
    return null;
  },
  
  querySelectorAll(selector) {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return elementsByClass.get(cls) || [];
    }
    if (selector === '.ios-bottom-nav .nav-tab') {
      return elementsByClass.get('nav-tab') || [];
    }
    if (selector === '.tab-content-container .tab-pane') {
      return elementsByClass.get('tab-pane') || [];
    }
    return [];
  },
  
  createElement(tagName) {
    return new MockElement('', tagName);
  },
  
  addEventListener(event, callback) {
    if (event === 'DOMContentLoaded') {
      callback();
    }
  }
};

// Mock Navigator
globalThis.navigator = {
  userAgent: 'Node-Test-Offline',
  standalone: false,
  serviceWorker: {
    register: () => Promise.resolve({
      scope: '/',
      update: () => {},
      active: { postMessage: () => {} }
    }),
    getRegistrations: () => Promise.resolve([]),
    addEventListener: () => {}
  },
  vibrate: () => true
};

// Mock location
globalThis.location = {
  hostname: 'localhost',
  protocol: 'http:',
  reload() { console.log('Mock page reloaded'); }
};

// Mock localStorage and sessionStorage
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
};

const session = new Map();
globalThis.sessionStorage = {
  getItem: (key) => session.get(key) || null,
  setItem: (key, val) => session.set(key, String(val)),
  removeItem: (key) => session.delete(key),
  clear: () => session.clear()
};

// Mock AudioContext for Rest Alarm
globalThis.AudioContext = class {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {}
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {}
    };
  }
};
globalThis.webkitAudioContext = globalThis.AudioContext;

// Mock Web Notifications
globalThis.Notification = {
  permission: 'granted',
  requestPermission: () => Promise.resolve('granted')
};

// Mock MessageChannel
globalThis.MessageChannel = class {
  constructor() {
    this.port1 = { onmessage: null };
    this.port2 = {};
  }
};

// Mock standard modal functions
globalThis.alert = (msg) => console.log(`[ALERT] ${msg}`);
globalThis.confirm = (msg) => {
  console.log(`[CONFIRM] ${msg}`);
  return true; // Auto-confirm for seamless test coverage
};

// Add global listener registration helper
globalThis.addEventListener = (event, callback) => {
  if (event === 'load') callback();
};

console.log("Offline DOM and Browser Mock environment loaded successfully.");
