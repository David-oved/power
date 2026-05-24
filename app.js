// AuraApp - Core PWA Logic & Firebase Authentication Gateway
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================================================
// 1. SafeStorage Adapter to handle Private Browsing & Quota Limits safely
// ==========================================================================
const SafeStorage = {
  _fallbackMem: {},
  _failedKeys: {},
  _isSupportedCache: null,
  isSupported() {
    if (this._isSupportedCache !== null) {
      return this._isSupportedCache;
    }
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      this._isSupportedCache = true;
    } catch (e) {
      this._isSupportedCache = false;
    }
    return this._isSupportedCache;
  },
  getItem(key) {
    if (this.isSupported() && !this._failedKeys[key]) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        return val;
      }
    }
    return this._fallbackMem[key] !== undefined ? this._fallbackMem[key] : null;
  },
  setItem(key, value) {
    this._fallbackMem[key] = String(value);
    if (this.isSupported()) {
      try {
        localStorage.setItem(key, value);
        delete this._failedKeys[key];
        return;
      } catch (e) {
        console.warn("Storage write failed (quota exceeded?):", e);
        this._failedKeys[key] = true;
      }
    }
  },
  removeItem(key) {
    delete this._fallbackMem[key];
    delete this._failedKeys[key];
    if (this.isSupported()) {
      localStorage.removeItem(key);
    }
  }
};

// State Variables
let app;
let auth;
let googleProvider;
let firebaseEnabled = false;
let firebaseAuthResolved = false;

let currentUser = null;
let isSensitiveDataVisible = false;

let activeWorkout = null;
let activeTimerInterval = null;
let lastCompletedWorkout = null;

// DOM Elements
const startWorkoutBtn = document.getElementById('start-workout-btn');
const workoutIdleView = document.getElementById('workout-idle-view');
const workoutActiveView = document.getElementById('workout-active-view');
const addExerciseBtn = document.getElementById('add-exercise-btn');
const exercisesContainer = document.getElementById('exercises-container');
const finishWorkoutBtn = document.getElementById('finish-workout-btn');
const activeTimer = document.getElementById('active-timer');
const activeExercisesCount = document.getElementById('active-exercises-count');

const workoutSummaryModal = document.getElementById('workout-summary-modal');
const summaryCloseBtn = document.getElementById('summary-close-btn');
const summaryFinishBtn = document.getElementById('summary-finish-btn');
const summaryDuration = document.getElementById('summary-duration');
const summaryVolume = document.getElementById('summary-volume');
const summaryExercises = document.getElementById('summary-exercises');
const summarySets = document.getElementById('summary-sets');
const workoutHistoryList = document.getElementById('workout-history-list');

// Initialize Firebase App robustly using credentials from firebase-config.js
if (window.firebaseConfig && window.firebaseConfig.apiKey && window.firebaseConfig.apiKey !== "YOUR_API_KEY") {
  try {
    app = initializeApp(window.firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    firebaseEnabled = true;
    console.log("Firebase initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
  }
} else {
  console.error("Firebase configuration missing or invalid! Dynamic authentication features will be disabled.");
}

// Elements
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('app-logout-btn') || document.getElementById('drawer-logout-btn');
const appLogoutBtn = document.getElementById('app-logout-btn');
const profilePicBtn = document.getElementById('profile-pic-btn');

const userDisplayName = document.getElementById('user-display-name');
const floatingUserPhoto = document.getElementById('floating-user-photo');

const drawerUserPhoto = document.getElementById('drawer-user-photo');
const drawerUserFullName = document.getElementById('drawer-user-full-name');
const drawerUserEmail = document.getElementById('drawer-user-email');
const drawerUserUid = document.getElementById('drawer-user-uid');
const drawerUserVerifiedBadge = document.getElementById('drawer-user-verified-badge');
const drawerUserProvider = document.getElementById('drawer-user-provider');
const drawerUserCreated = document.getElementById('drawer-user-created');
const drawerUserLastLogin = document.getElementById('drawer-user-last-login');
const drawerUserJsonCode = document.getElementById('drawer-user-json-code');

const settingsDrawer = document.getElementById('settings-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const floatingAvatarBtn = document.getElementById('floating-avatar-btn');
const drawerCloseBtn = document.getElementById('drawer-close-btn');
const toggleSensitiveBtn = document.getElementById('drawer-toggle-sensitive-btn');

// Standalone mode detection (PWA Installed)
const isStandalone = window.navigator.standalone === true || 
                     window.matchMedia('(display-mode: standalone)').matches;

// Safe HTML escape helper to prevent Persistent DOM XSS
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Robust helper to trigger native-like local notifications
async function triggerLocalNotification(title, body) {
  if (!('Notification' in window) || typeof Notification === 'undefined') {
    console.warn("Notifications are not supported in this browser environment.");
    return;
  }
  
  if (Notification.permission !== 'granted') {
    console.warn("Notification permission is not granted.");
    return;
  }

  const options = {
    body: body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  // Try to use Service Worker registration first for full iOS and Android standalone PWA support
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, options);
        console.log("Local notification triggered successfully via Service Worker.");
        return;
      }
    } catch (e) {
      console.warn("Service Worker notification failed, falling back to window.Notification:", e);
    }
  }

  // Fallback to standard client-side Notification API (for desktop browsers)
  try {
    new Notification(title, options);
    console.log("Local notification triggered successfully via standard constructor.");
  } catch (e) {
    console.error("Failed to display notification:", e);
  }
}

// Safe Date Parsing Helper Functions
function safeFormatDate(value) {
  if (!value) return 'N/A';
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    return new Date(num).toLocaleDateString();
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
}

// Safe Date Time Helper
function safeFormatDateTime(value) {
  if (!value) return 'N/A';
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    return new Date(num).toLocaleString();
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
}

// Settings Drawer Open / Close Interactive Logic
function openDrawer() {
  if (settingsDrawer) settingsDrawer.classList.add('open');
  if (drawerOverlay) drawerOverlay.classList.add('open');
}

function closeDrawer() {
  if (settingsDrawer) settingsDrawer.classList.remove('open');
  if (drawerOverlay) drawerOverlay.classList.remove('open');
}

// Helper to hide splash screen overlay
function hideSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    if (!splash.classList.contains('fade-out')) {
      splash.classList.add('fade-out');
      setTimeout(() => {
        splash.style.display = 'none';
      }, 600);
    }
  }
}

// Manage App Screen Transitions adapted for Premium Splash Screen Overlay
// CRITICAL SECURITY NOTE FOR FUTURE AGENTS:
// To enforce strict visual isolation, all active application overlay/global elements (like bottom bars,
// settings drawers, updates alerts, and modals) MUST be completely hidden on the initial login gate.
// The presence of body class 'authenticated' is the strict CSS gatekeepers. DO NOT change this logic.
function switchScreen(signedIn) {
  const splash = document.getElementById('splash-screen');
  const isSplashActive = splash && !splash.classList.contains('fade-out') && (splash.style.display !== 'none');

  if (signedIn) {
    if (appLogoutBtn) {
      appLogoutBtn.classList.remove('hide');
    }
    document.body.classList.add('authenticated');
    if (authScreen) authScreen.classList.remove('active');
    setTimeout(() => {
      if (authScreen) authScreen.style.display = 'none';
      if (appScreen) appScreen.style.display = 'flex';
      if (isSplashActive) {
        setTimeout(() => {
          if (appScreen) appScreen.classList.add('active');
        }, 200);
      } else {
        setTimeout(() => {
          if (appScreen) appScreen.classList.add('active');
        }, 50);
      }
    }, 400);
  } else {
    if (appLogoutBtn) {
      appLogoutBtn.classList.add('hide');
    }
    document.body.classList.remove('authenticated');
    if (appScreen) appScreen.classList.remove('active');
    setTimeout(() => {
      if (appScreen) appScreen.style.display = 'none';
      if (authScreen) authScreen.style.display = 'flex';
      if (isSplashActive) {
        setTimeout(() => {
          if (authScreen) authScreen.classList.add('active');
        }, 200);
      } else {
        setTimeout(() => {
          if (authScreen) authScreen.classList.add('active');
        }, 50);
      }
    }, 400);
  }
}

// Safe Element Text Updater Helper
const setElText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

// ==========================================================================
// 2. Security Presenter: Mask credentials to prevent shoulder-surfing
// ==========================================================================
function maskString(str, visibleCount = 4) {
  if (!str) return '--';
  if (str.length <= visibleCount * 2) return '***';
  return str.substring(0, visibleCount) + '...' + str.substring(str.length - visibleCount);
}

function maskEmail(email) {
  if (!email) return '--';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) return '*@' + domain;
  return name.substring(0, 2) + '***' + '@' + domain;
}

function updateAuthUI() {
  if (!currentUser) return;

  const name = currentUser.displayName || 'Unknown User';
  const email = currentUser.email || '--';
  const uid = currentUser.uid;
  const provider = currentUser.providerData?.[0]?.providerId || 'google.com';

  const createdTime = currentUser.metadata?.createdAt || currentUser.metadata?.creationTime;
  const loginTime = currentUser.metadata?.lastLoginAt || currentUser.metadata?.lastSignInTime;

  // Header Display Name
  setElText('user-display-name', name ? name.split(' ')[0] : 'User');

  // Photo Binding
  const fallbackPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const photoURL = currentUser.photoURL || fallbackPhoto;
  if (floatingUserPhoto) {
    floatingUserPhoto.src = photoURL;
    floatingUserPhoto.onerror = () => { floatingUserPhoto.src = fallbackPhoto; };
  }
  if (drawerUserPhoto) {
    drawerUserPhoto.src = photoURL;
    drawerUserPhoto.onerror = () => { drawerUserPhoto.src = fallbackPhoto; };
  }

  // Drawer Fields
  setElText('drawer-user-full-name', name);

  if (isSensitiveDataVisible) {
    setElText('drawer-user-email', email);
    setElText('drawer-user-uid', uid);
  } else {
    setElText('drawer-user-email', maskEmail(email));
    setElText('drawer-user-uid', maskString(uid, 5));
  }

  setElText('drawer-user-provider', provider);
  setElText('drawer-user-created', safeFormatDate(createdTime));
  setElText('drawer-user-last-login', safeFormatDateTime(loginTime));

  const badgeVerified = document.getElementById('drawer-user-verified-badge');
  if (badgeVerified) {
    if (currentUser.emailVerified) {
      badgeVerified.textContent = 'Verified';
      badgeVerified.className = 'badge-mini badge-verified';
    } else {
      badgeVerified.textContent = 'Unverified';
      badgeVerified.className = 'badge-mini badge-unverified';
    }
  }

  // Raw Profile JSON compilation
  const cleanUser = {
    uid: isSensitiveDataVisible ? uid : maskString(uid, 5),
    displayName: name,
    email: isSensitiveDataVisible ? email : maskEmail(email),
    emailVerified: currentUser.emailVerified || false,
    photoURL: currentUser.photoURL ? (isSensitiveDataVisible ? currentUser.photoURL : maskString(currentUser.photoURL, 15)) : null,
    metadata: {
      createdAt: createdTime,
      lastLoginAt: loginTime
    },
    providerData: currentUser.providerData ? currentUser.providerData.map(p => ({
      providerId: p.providerId,
      uid: isSensitiveDataVisible ? p.uid : maskString(p.uid, 5),
      displayName: p.displayName,
      email: isSensitiveDataVisible ? p.email : maskEmail(p.email),
      photoURL: p.photoURL ? (isSensitiveDataVisible ? p.photoURL : maskString(p.photoURL, 15)) : null
    })) : []
  };

  if (drawerUserJsonCode) {
    drawerUserJsonCode.textContent = JSON.stringify(cleanUser, null, 2);
  }
}

// Reset DOM fields safely on Logout to avoid credential leakage
function clearUserSession() {
  currentUser = null;
  lastCompletedWorkout = null;
  SafeStorage._fallbackMem = {};
  SafeStorage._failedKeys = {};

  closeDrawer();

  setElText('user-display-name', 'User');
  setElText('drawer-user-full-name', 'User Name');
  setElText('drawer-user-email', 'user@gmail.com');
  setElText('drawer-user-uid', '--');
  setElText('drawer-user-provider', '--');
  setElText('drawer-user-created', '--');
  setElText('drawer-user-last-login', '--');

  const badgeVerified = document.getElementById('drawer-user-verified-badge');
  if (badgeVerified) {
    badgeVerified.textContent = '--';
    badgeVerified.className = 'badge-mini';
  }

  if (drawerUserJsonCode) {
    drawerUserJsonCode.textContent = 'No user session active.';
  }

  const fallbackPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  if (floatingUserPhoto) floatingUserPhoto.src = fallbackPhoto;
  if (drawerUserPhoto) drawerUserPhoto.src = fallbackPhoto;

  isSensitiveDataVisible = false;
  if (toggleSensitiveBtn) {
    toggleSensitiveBtn.innerHTML = '👁️ הצג פרטים מזהים';
  }

  // Symmetrically clear workout DOM nodes to prevent shoulder surfing
  if (workoutHistoryList) {
    workoutHistoryList.innerHTML = `
      <div class="history-empty-state">
        <span class="empty-state-emoji">📊</span>
        <p>אנא התחבר כדי לצפות בהיסטוריית האימונים שלך.</p>
      </div>
    `;
  }
  const selectEl = document.getElementById('routine-template-select');
  if (selectEl) {
    selectEl.innerHTML = '<option value="">-- אנא התחבר תחילה --</option>';
  }
}


// Monitor Firebase Authentication Transitions safely
// Monitor Firebase Authentication Transitions safely
let initialAuthCheckDone = false;
if (firebaseEnabled) {
  onAuthStateChanged(auth, (user) => {
    firebaseAuthResolved = true;
    const isLoginTransition = initialAuthCheckDone && user && !currentUser;
    const isLogoutTransition = initialAuthCheckDone && !user && currentUser;

    if (user) {
      console.log("User signed in successfully:", user.displayName);
      currentUser = user;

      updateAuthUI();
      renderWorkoutHistory();
      populateTemplateDropdown();
      switchScreen(true);

      // Trigger notification if it's a real-time transition, and we haven't welcomed them in this session
      const hasBeenWelcomed = sessionStorage.getItem('aura_session_welcomed');
      if (isLoginTransition && !hasBeenWelcomed && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        triggerLocalNotification(
          "התחברת בהצלחה! 👋",
          `ברוך הבא ל-Aura, ${user.displayName || 'משתמש'}!`
        );
        sessionStorage.setItem('aura_session_welcomed', 'true');
      } else {
        // If already logged in, quietly mark welcomed so we do not spam them
        sessionStorage.setItem('aura_session_welcomed', 'true');
      }
    } else {
      console.log("No authenticated user active.");
      const prevUser = currentUser;
      
      // Clear session guard on sign out
      sessionStorage.removeItem('aura_session_welcomed');
      
      clearUserSession();
      switchScreen(false);

      if (isLogoutTransition && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        triggerLocalNotification(
          "התנתקת מהחשבון 🔒",
          `להתראות ${prevUser && prevUser.displayName ? prevUser.displayName.split(' ')[0] : ''}, נתראה באימון הבא!`
        );
      }
    }
    initialAuthCheckDone = true;
    hideSplashScreen();
  });

  // Resolve redirect logins
  getRedirectResult(auth)
    .then((result) => {
      if (result && result.user) {
        console.log("Redirect sign-in resolved successfully for:", result.user.displayName);
        // Force session welcomed flag to prevent double-firing
        sessionStorage.setItem('aura_session_welcomed', 'true');
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          triggerLocalNotification(
            "התחברת בהצלחה! 👋",
            `ברוך הבא ל-Aura, ${result.user.displayName || 'משתמש'}!`
          );
        }
      }
    })
    .catch((error) => {
      console.error("Error resolving redirect result:", error.code, error.message);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        console.log("Sign-in process was cancelled by the user.");
      } else if (error.code === 'auth/web-storage-unsupported') {
        alert("שים לב: הדפדפן הנוכחי שלך חוסם עוגיות או פועל במצב גלישה בסתר. אנא פתח את האפליקציה בדפדפן הרגיל כדי להתחבר בהצלחה.");
      } else {
        alert(`שגיאת התחברות: ${error.message || 'נא לפתוח בדפדפן Chrome/Safari הרגיל'}`);
      }
    });

  // Fail-safe: Hide the splash screen after 8 seconds if Firebase fails or hangs on startup
  setTimeout(() => {
    if (!firebaseAuthResolved) {
      console.warn("Firebase Auth resolution timed out. Falling back to offline/auth login screen.");
      switchScreen(false);
    }
    hideSplashScreen();
  }, 8000);
} else {
  // Graceful fallback for missing config on startup
  console.log("Firebase is disabled. Auth features are unavailable.");
  switchScreen(false);
  setTimeout(hideSplashScreen, 1000);
}

window.addEventListener('DOMContentLoaded', () => {
  detectEnvironmentAndWarn();
});

// Dynamic Mobile/Desktop & Standalone Authenticator Gateway
if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    if (!firebaseEnabled) {
      alert("Authentication features are currently unavailable because Firebase is not configured properly. Please check your config.");
      return;
    }

    // Proactively request notification permission on user-initiated gesture (safely)
    if ('Notification' in window && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.warn("Could not request notification permission on login click:", err);
      }
    }

    loginBtn.disabled = true;
    const btnTextEl = loginBtn.querySelector('.google-btn-text');
    const originalText = btnTextEl ? btnTextEl.textContent : 'Sign in with Google';
    if (btnTextEl) btnTextEl.textContent = 'Connecting...';

    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isMobileDevice) {
      if (isIOS && isStandalone) {
        // iOS PWA installed mode sandboxes external redirects. Attempt popup first, then fall back dynamically to redirect if popup fails.
        console.log("iOS Standalone PWA detected. Launching in-app popup auth...");
        try {
          await signInWithPopup(auth, googleProvider);
          console.log("Logged in successfully via popup in iOS PWA!");
          loginBtn.disabled = false;
          if (btnTextEl) btnTextEl.textContent = originalText;
        } catch (popupError) {
          console.warn("iOS Standalone PWA popup auth failed. Falling back to signInWithRedirect...", popupError);
          if (btnTextEl) btnTextEl.textContent = 'Redirecting...';
          try {
            await signInWithRedirect(auth, googleProvider);
          } catch (redirectError) {
            console.error("iOS Standalone PWA redirect fallback auth error:", redirectError);
            handleAuthError(redirectError, loginBtn, originalText);
          }
        }
      } else {
        console.log("Mobile device detected. Triggering signInWithRedirect...");
        if (btnTextEl) btnTextEl.textContent = 'Redirecting...';
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          console.error("Mobile redirect auth error:", redirectError);
          handleAuthError(redirectError, loginBtn, originalText);
        }
      }
    } else {
      // Desktop PWA Standalone and desktop browsers use popup which works flawlessly.
      console.log("Desktop device or Standalone PWA detected. Attempting popup...");
      try {
        await signInWithPopup(auth, googleProvider);
        console.log("Logged in successfully!");
        loginBtn.disabled = false;
        if (btnTextEl) btnTextEl.textContent = originalText;
      } catch (popupError) {
        console.warn("Popup sign-in failed. Error code:", popupError.code);
        
        if (popupError.code === 'auth/popup-closed-by-user' || popupError.code === 'auth/cancelled-popup-request') {
          console.log("Sign-in process was cancelled by the user.");
          loginBtn.disabled = false;
          if (btnTextEl) btnTextEl.textContent = originalText;
          return;
        }
        
        if (!isStandalone) {
          console.log("Falling back to signInWithRedirect...");
          if (btnTextEl) btnTextEl.textContent = 'Redirecting...';
          try {
            await signInWithRedirect(auth, googleProvider);
          } catch (redirectError) {
            console.error("Desktop redirect fallback auth error:", redirectError);
            handleAuthError(redirectError, loginBtn, originalText);
          }
        } else {
          handleAuthError(popupError, loginBtn, originalText);
        }
      }
    }
  });
}

// Proactive Environment Warnings (WhatsApp/Telegram/Private Tabs)
function detectEnvironmentAndWarn() {
  const storageOk = SafeStorage.isSupported();
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isInApp = /FBAN|FBAV|Instagram|Twitter|FBIOS|Messenger|WhatsApp|Telegram|Line|WeChat/i.test(userAgent);

  const authCard = document.querySelector('.auth-card');
  if (authCard) {
    let warningHtml = '';
    if (isInApp) {
      warningHtml = `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px dashed rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 12px; margin-bottom: 20px; direction: rtl; text-align: right; font-size: 0.85rem; color: #ef4444; display: flex; gap: 8px; align-items: start;">
          <span style="font-size: 1.1rem;">⚠️</span>
          <div>
            <strong>שים לב: דפדפן פנימי (WhatsApp/Telegram)!</strong><br>
            התחברות עם Google עלולה להיכשל במצב זה. אנא לחץ על שלוש הנקודות בפינה העליונה (או לחצן השיתוף בתחתית) ובחר <strong>"פתח בדפדפן הרגיל"</strong> (Chrome באנדרואיד או Safari באייפון) כדי להתחבר בהצלחה.
          </div>
        </div>
      `;
    } else if (!storageOk) {
      warningHtml = `
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px dashed rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 12px; margin-bottom: 20px; direction: rtl; text-align: right; font-size: 0.85rem; color: #d97706; display: flex; gap: 8px; align-items: start;">
          <span style="font-size: 1.1rem;">🔒</span>
          <div>
            <strong>אחסון חסום / מצב גלישה בסתר פעיל!</strong><br>
            הדפדפן שלך חוסם עוגיות או גישה לאחסון מקומי. התחברות Google לא תישמר. מומלץ להשתמש בדפדפן רגיל שאינו במצב גלישה בסתר.
          </div>
        </div>
      `;
    }

    if (warningHtml) {
      const warningWrapper = document.createElement('div');
      warningWrapper.innerHTML = warningHtml;
      authCard.insertBefore(warningWrapper.firstChild, authCard.firstChild);
    }
  }
}

// Error Translator
function handleAuthError(error, btn, originalText) {
  btn.disabled = false;
  btn.querySelector('.google-btn-text').textContent = originalText;
  console.error("Auth Error details:", error.code, error.message);

  let userFriendlyMessage = "שגיאת התחברות. נא לנסות שוב.";
  if (error.code === 'auth/web-storage-unsupported') {
    userFriendlyMessage = "הדפדפן שלך חוסם עוגיות צד שלישי (זה קורה לרוב בגלישה בסתר או בתוך אפליקציות כמו WhatsApp/Telegram). אנא העתק את הקישור ופתח אותו בדפדפן הרגיל של המכשיר (Chrome באנדרואיד או Safari באייפון) כדי שתוכל להתחבר.";
  } else if (error.code === 'auth/popup-blocked') {
    userFriendlyMessage = "חלונות קופצים חסומים בדפדפן שלך. אנא פתח את האפליקציה בדפדפן Chrome/Safari הרגיל.";
  } else if (error.code === 'auth/network-request-failed') {
    userFriendlyMessage = "בעיית רשת. נא לוודא שיש חיבור אינטרנט תקין ולנסות שוב.";
  } else {
    userFriendlyMessage = `שגיאת התחברות (${error.code || 'unknown'}): אנא ודא שהקישור פתוח בדפדפן Chrome/Safari הרגיל, ולא דרך חלון פנימי של WhatsApp/Telegram.`;
  }
  alert(userFriendlyMessage);
}

// Trigger Log Out Flow cleanly supporting Firebase Auth
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    // Proactively request notification permission on user-initiated gesture if not yet determined
    if ('Notification' in window && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.warn("Could not request notification permission on logout click:", err);
      }
    }

    if (!firebaseEnabled) {
      alert("Sign out is unavailable in offline/demo mode.");
      return;
    }

    try {
      await signOut(auth);
      console.log("Session signed out successfully.");
    } catch (error) {
      console.error("Sign-out process encountered an error:", error);
    }
  });
}

// Support profilePicBtn clicking to toggle the visibility of appLogoutBtn
if (profilePicBtn) {
  profilePicBtn.addEventListener('click', () => {
    if (appLogoutBtn) {
      appLogoutBtn.classList.toggle('hide');
    }
  });
}

// Register PWA Service Worker
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.protocol === 'file:';

if ('serviceWorker' in navigator) {
  // Allow local service worker testing if developer sets localStorage.getItem('enableLocalSW') === 'true'
  if (isLocalhost && SafeStorage.getItem('enableLocalSW') !== 'true') {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister();
        console.log("Developer Mode: Unregistered active service worker to prevent cache lock.");
      }
    });
  } else {
    // Helper to query cache version dynamically from active Service Worker
    const loadAppVersion = (reg) => {
      const activeWorker = reg.active || reg.waiting || reg.installing;
      if (!activeWorker) return;
      
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data && event.data.version) {
          const badge = document.getElementById('app-version-display');
          if (badge) {
            badge.textContent = `v${event.data.version}`;
          }
        }
      };
      activeWorker.postMessage({ action: 'getVersion' }, [messageChannel.port2]);
    };

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((registration) => {
          console.log('PWA Service Worker registered successfully! Scope:', registration.scope);
          
          // Dynamically query and update active version display on load
          loadAppVersion(registration);
          
          registration.update();
          
          setInterval(() => {
            registration.update();
          }, 5 * 60 * 1000);

          if (registration.waiting) {
            showUpdateToast(registration.waiting);
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showUpdateToast(newWorker);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('Service Worker registration encountered an error:', error);
        });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log("Service Worker controller changed. Reloading page for new version...");
      window.location.reload();
    });
  }
}

// Glassmorphic PWA auto-update toast notification
function showUpdateToast(waitingWorker) {
  const toast = document.getElementById('pwa-update-toast');
  const refreshBtn = document.getElementById('pwa-refresh-btn');
  
  if (toast && refreshBtn) {
    toast.classList.add('show');
    refreshBtn.addEventListener('click', () => {
      console.log("Trainee requested update activation. Posting skipWaiting message...");
      waitingWorker.postMessage({ action: 'skipWaiting' });
    });
  }
}

// Settings Drawer Open / Close Trigger Listeners
if (floatingAvatarBtn) floatingAvatarBtn.addEventListener('click', openDrawer);
const navSettingsBtn = document.getElementById('nav-settings-btn');
if (navSettingsBtn) navSettingsBtn.addEventListener('click', openDrawer);
if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);
if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

// Collapsible JSON Terminal Toggle (Settings Drawer)
const drawerJsonToggle = document.getElementById('drawer-json-toggle');
const drawerJsonContainer = document.getElementById('drawer-json-terminal-container');
const drawerToggleArrow = document.getElementById('drawer-toggle-arrow');

if (drawerJsonToggle) {
  drawerJsonToggle.addEventListener('click', () => {
    const isExpanded = drawerJsonContainer.classList.toggle('expanded');
    drawerToggleArrow.textContent = isExpanded ? '▲' : '▼';
    drawerJsonToggle.classList.toggle('active');
  });
}

// Sensitive Information Toggle Button Listener
if (toggleSensitiveBtn) {
  toggleSensitiveBtn.addEventListener('click', () => {
    isSensitiveDataVisible = !isSensitiveDataVisible;
    toggleSensitiveBtn.innerHTML = isSensitiveDataVisible ? '🙈 הסתר פרטים מזהים' : '👁️ הצג פרטים מזהים';
    updateAuthUI();
  });
}

// Premium iOS PWA Installation Banner Prompt Logic
window.addEventListener('load', () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const iosPromptDismissed = SafeStorage.getItem('ios-pwa-prompt-dismissed');
  
  if (isIOS && !isStandalone && !iosPromptDismissed) {
    const banner = document.getElementById('ios-install-banner');
    const closeBtn = document.getElementById('ios-prompt-close-btn');
    
    if (banner) {
      setTimeout(() => {
        banner.classList.add('show');
      }, 3000);
      
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          banner.classList.remove('show');
          SafeStorage.setItem('ios-pwa-prompt-dismissed', 'true');
        });
      }
    }
  }
});

// ==========================================================================
// 10. Cyber-Athletic Workout Tracker State & Interactive UI Engine
// ==========================================================================


// Safe Time Formatting Utility (HH:MM:SS)
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map(val => val.toString().padStart(2, '0'))
    .join(':');
}

// Local Storage History Operations
function loadWorkoutHistory() {
  if (!currentUser) return [];
  try {
    const key = `aura-workout-history_${currentUser.uid}`;
    const historyJson = SafeStorage.getItem(key);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (e) {
    console.error("Failed to load workout history from localStorage:", e);
    return [];
  }
}

function saveWorkoutToHistory(workout) {
  if (!currentUser) return;
  try {
    const key = `aura-workout-history_${currentUser.uid}`;
    const history = loadWorkoutHistory();
    history.unshift(workout); // Push new workout to the top
    SafeStorage.setItem(key, JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save workout to localStorage:", e);
  }
}

function renderWorkoutHistory() {
  if (!currentUser) return;
  if (!workoutHistoryList) return;
  const history = loadWorkoutHistory();

  if (history.length === 0) {
    workoutHistoryList.innerHTML = `
      <div class="history-empty-state">
        <span class="empty-state-emoji">📊</span>
        <p>אין עדיין אימונים מתועדים במכשיר. התחל אימון חדש כדי לראות את ההיסטוריה שלך כאן!</p>
      </div>
    `;
    return;
  }

  workoutHistoryList.innerHTML = history.map(w => {
    const dateStr = new Date(w.date).toLocaleDateString('he-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <div class="history-card">
        <div class="history-card-header">
          <span class="history-card-date">${dateStr}</span>
          <span class="badge-mini history-card-badge">הושלם</span>
        </div>
        <div class="history-card-stats">
          <div class="history-stat">
            <span>⏱️</span>
            <strong>${w.duration}</strong>
          </div>
          <div class="history-stat">
            <span>🏋️‍♂️</span>
            <strong>${w.volume.toLocaleString()} ק"ג</strong>
          </div>
          <div class="history-stat">
            <span>💪</span>
            <strong>${w.exercisesCount} תרגילים</strong>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Timer Stopwatch Engine
function startTimer() {
  if (activeTimerInterval) clearInterval(activeTimerInterval);
  activeWorkout.startTime = Date.now();
  if (activeTimer) activeTimer.textContent = '00:00:00';

  activeTimerInterval = setInterval(() => {
    if (activeWorkout && activeTimer) {
      const elapsed = Date.now() - activeWorkout.startTime;
      activeTimer.textContent = formatDuration(elapsed);
    }
  }, 1000);
}

// Rendering Dynamic Exercises & Sets UI
function renderExercises() {
  if (!exercisesContainer) return;
  
  if (activeWorkout.exercises.length === 0) {
    exercisesContainer.innerHTML = `
      <div class="history-empty-state" style="padding: 3rem 1.5rem;">
        <span class="empty-state-emoji">🏋️‍♂️</span>
        <p>האימון ריק כעת. הוסף את התרגיל הראשון שלך כדי להתחיל לתעד משקלים וחזרות!</p>
      </div>
    `;
    if (activeExercisesCount) activeExercisesCount.textContent = '0 תרגילים';
    
    // Enable Add Exercise button if activeWorkout is empty
    if (addExerciseBtn) {
      addExerciseBtn.disabled = false;
      addExerciseBtn.style.opacity = '1';
      addExerciseBtn.style.pointerEvents = 'auto';
    }
    return;
  }

  if (activeExercisesCount) {
    activeExercisesCount.textContent = `${activeWorkout.exercises.length} תרגילים`;
  }

  // Find the first uncompleted exercise in the array to focus guide the trainee
  const activeIndex = activeWorkout.exercises.findIndex(x => !x.completed);

  // Set the Add Exercise button disabled status
  const hasActiveExercise = activeWorkout.exercises.some(x => !x.completed);
  if (addExerciseBtn) {
    if (hasActiveExercise) {
      addExerciseBtn.disabled = true;
      addExerciseBtn.style.opacity = '0.5';
      addExerciseBtn.style.pointerEvents = 'none';
      addExerciseBtn.title = 'סיים את התרגיל הנוכחי כדי להוסיף תרגיל חדש';
    } else {
      addExerciseBtn.disabled = false;
      addExerciseBtn.style.opacity = '1';
      addExerciseBtn.style.pointerEvents = 'auto';
      addExerciseBtn.title = '';
    }
  }

  exercisesContainer.innerHTML = activeWorkout.exercises.map((ex, exIndex) => {
    // Make sure trackingType is initialized
    if (!ex.trackingType) ex.trackingType = 'both';
    
    const isCompleted = ex.completed === true;
    // Active if it is the first uncompleted exercise, OR if all are completed (which shouldn't happen unless adding new)
    const isActive = !isCompleted && (exIndex === activeIndex || activeIndex === -1);
    const isPending = !isCompleted && exIndex !== activeIndex && activeIndex !== -1;
    
    let cardStatusClass = 'active-exercise';
    if (isCompleted) cardStatusClass = 'saved';
    else if (isPending) cardStatusClass = 'pending';

    const setRows = ex.sets.map((set, setIndex) => {
      const completedClass = set.completed ? 'completed' : '';
      return `
        <div class="set-row ${completedClass}" data-exercise-id="${ex.id}" data-set-id="${set.id}">
          ${isActive ? `
            <button class="remove-set-btn" data-action="remove-set" data-exercise-id="${ex.id}" data-set-id="${set.id}" title="מחק סט">&times;</button>
          ` : ''}
          
          <!-- Checkmark Complete Button -->
          <button class="set-checkmark-btn ${completedClass}" data-action="toggle-complete" data-exercise-id="${ex.id}" data-set-id="${set.id}" ${!isActive ? 'disabled' : ''}>
            ${set.completed ? '✓' : 'סט ' + (setIndex + 1)}
          </button>
 
          <!-- Reps Input -->
          <div class="set-input-wrapper wrapper-reps">
            <input type="number" class="set-input set-reps-input" placeholder="חזרות" min="0" value="${set.reps}" data-exercise-id="${ex.id}" data-set-id="${set.id}" ${!isActive ? 'disabled' : ''}>
          </div>
 
          <!-- Weight Input -->
          <div class="set-input-wrapper wrapper-weight">
            <input type="number" class="set-input set-weight-input" placeholder="משקל" min="0" step="any" value="${set.weight}" data-exercise-id="${ex.id}" data-set-id="${set.id}" ${!isActive ? 'disabled' : ''}>
          </div>
 
          <span class="set-number-label">#${setIndex + 1}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="exercise-card ${cardStatusClass} tracking-${ex.trackingType}">
        <div class="exercise-card-header">
          <div class="exercise-title-container">
            ${isActive ? `
              <button class="remove-exercise-btn" data-action="remove-exercise" data-exercise-id="${ex.id}" title="מחק תרגיל">&times;</button>
            ` : ''}
            <input type="text" class="exercise-name-input" placeholder="שם התרגיל (לדוגמה: לחיצת חזה)" value="${escapeHTML(ex.name)}" data-exercise-id="${ex.id}" ${!isActive ? 'disabled' : ''}>
          </div>
          
          ${isCompleted ? `
            <span class="badge-mini history-card-badge completed-badge">✓ הושלם</span>
          ` : ''}
          ${isPending ? `
            <span class="badge-mini history-card-badge pending-badge">🔒 בהמתנה</span>
          ` : ''}
        </div>

        <!-- Dynamic Tracking Parameter Selector Segmented Pills -->
        <div class="tracking-selector-wrapper">
          <div class="tracking-selector">
            <button class="track-pill ${ex.trackingType === 'both' ? 'active' : ''}" data-action="set-tracking" data-track-type="both" data-exercise-id="${ex.id}" ${!isActive ? 'disabled' : ''}>שניהם</button>
            <button class="track-pill ${ex.trackingType === 'reps' ? 'active' : ''}" data-action="set-tracking" data-track-type="reps" data-exercise-id="${ex.id}" ${!isActive ? 'disabled' : ''}>חזרות</button>
            <button class="track-pill ${ex.trackingType === 'weight' ? 'active' : ''}" data-action="set-tracking" data-track-type="weight" data-exercise-id="${ex.id}" ${!isActive ? 'disabled' : ''}>משקל</button>
          </div>
        </div>

        <div class="sets-area" style="opacity: ${isPending ? '0.5' : '1'}; pointer-events: ${isPending ? 'none' : 'auto'};">
          ${ex.sets.length > 0 ? `
            <div class="sets-header-row">
              ${isActive ? '<span class="sets-header-cell cell-delete"></span>' : ''}
              <span class="sets-header-cell cell-done">בוצע</span>
              <span class="sets-header-cell cell-reps">חזרות</span>
              <span class="sets-header-cell cell-weight">משקל</span>
              <span class="sets-header-cell cell-set">סט</span>
            </div>
          ` : ''}
          
          <div class="sets-list-container">
            ${setRows}
          </div>
 
          ${isActive ? `
            <button class="add-set-btn" data-action="add-set" data-exercise-id="${ex.id}">
              <span>➕</span> הוספת סט חדש
            </button>
          ` : ''}

          <div class="sets-area-footer" style="margin-top: 1rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
            ${isActive ? `
              <button class="btn btn-primary save-exercise-btn" data-action="save-exercise" data-exercise-id="${ex.id}">
                <span>✓</span> שמור וסיים תרגיל
              </button>
            ` : ''}
            ${isCompleted ? `
              <button class="btn btn-secondary edit-exercise-btn" data-action="edit-exercise" data-exercise-id="${ex.id}">
                <span>✏️</span> ערוך תרגיל
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================================================
// Workout Routine Templates persistent vault logic
// ==========================================================================
function loadWorkoutTemplates() {
  if (!currentUser) return [];
  try {
    const key = `aura-workout-templates_${currentUser.uid}`;
    const templatesJson = SafeStorage.getItem(key);
    return templatesJson ? JSON.parse(templatesJson) : [];
  } catch (e) {
    console.error("Failed to load workout templates from localStorage:", e);
    return [];
  }
}

function saveWorkoutTemplate(template) {
  if (!currentUser) return;
  try {
    const key = `aura-workout-templates_${currentUser.uid}`;
    const templates = loadWorkoutTemplates();
    templates.push(template);
    SafeStorage.setItem(key, JSON.stringify(templates));
  } catch (e) {
    console.error("Failed to save workout template to localStorage:", e);
  }
}

function populateTemplateDropdown() {
  const selectEl = document.getElementById('routine-template-select');
  if (!selectEl) return;
  if (!currentUser) {
    selectEl.innerHTML = '<option value="">-- אנא התחבר תחילה --</option>';
    return;
  }
  const templates = loadWorkoutTemplates();
  
  selectEl.innerHTML = '<option value="">-- אימון ריק (ללא תבנית) --</option>';
  templates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    selectEl.appendChild(opt);
  });
}

function saveTemplateIfRequested() {
  const nameInput = document.getElementById('summary-template-name');
  if (nameInput && nameInput.value.trim() && lastCompletedWorkout) {
    const templateName = nameInput.value.trim();
    
    // Build template structure
    const newTemplate = {
      id: Date.now().toString(),
      name: templateName,
      exercises: lastCompletedWorkout.exercises.map(ex => ({
        name: ex.name || 'תרגיל ללא שם',
        trackingType: ex.trackingType || 'both',
        setsCount: ex.sets.length,
        defaultWeight: ex.sets[0]?.weight || '',
        defaultReps: ex.sets[0]?.reps || ''
      }))
    };
    
    saveWorkoutTemplate(newTemplate);
    populateTemplateDropdown();
    nameInput.value = ''; // Reset input!
  } else if (nameInput) {
    nameInput.value = ''; // Reset input!
  }
}

// Active UI State Transitions
function startWorkout() {
  const templateSelect = document.getElementById('routine-template-select');
  const templateId = templateSelect ? templateSelect.value : '';

  activeWorkout = {
    startTime: Date.now(),
    exercises: []
  };

  if (templateId) {
    const templates = loadWorkoutTemplates();
    const template = templates.find(t => t.id === templateId);
    if (template) {
      activeWorkout.exercises = template.exercises.map((templateEx, index) => {
        const sets = [];
        for (let i = 0; i < templateEx.setsCount; i++) {
          sets.push({
            id: (Date.now() + i + Math.random()).toString(),
            weight: templateEx.defaultWeight || '',
            reps: templateEx.defaultReps || '',
            completed: false
          });
        }
        return {
          id: (Date.now() + index + Math.random()).toString(),
          name: templateEx.name,
          trackingType: templateEx.trackingType || 'both',
          completed: false, // all loaded exercises start as pending except first
          sets: sets
        };
      });
    }
  }

  workoutIdleView.classList.remove('active');
  setTimeout(() => {
    workoutIdleView.style.display = 'none';
    workoutActiveView.style.display = 'flex';
    setTimeout(() => {
      workoutActiveView.classList.add('active');
      startTimer();
      renderExercises();
    }, 50);
  }, 400);
}

function finishWorkout() {
  if (!activeWorkout) return;

  // Fix Issue 15: Block completely empty workouts and ask if they wish to cancel/discard
  if (activeWorkout.exercises.length === 0) {
    const confirmCancel = confirm("האימון הנוכחי ריק. האם ברצונך לבטל ולמחוק אותו?");
    if (confirmCancel) {
      if (activeTimerInterval) clearInterval(activeTimerInterval);
      activeTimerInterval = null;
      activeWorkout = null;
      if (activeTimer) activeTimer.textContent = '00:00:00';
      closeSummary();
    }
    return;
  }

  let totalSets = 0;
  let totalVolume = 0;
  let activeExercises = 0;

  activeWorkout.exercises.forEach(ex => {
    let exHasCompletedSet = false;
    ex.sets.forEach(set => {
      if (set.completed) {
        totalSets++;
        exHasCompletedSet = true;
        const parsedW = parseFloat(set.weight);
        const parsedR = parseInt(set.reps);
        const w = isNaN(parsedW) ? 0 : parsedW;
        const r = isNaN(parsedR) ? 0 : parsedR;
        totalVolume += (w * r);
      }
    });
    if (exHasCompletedSet) activeExercises++;
  });

  const durationMs = Date.now() - activeWorkout.startTime;
  const durationStr = formatDuration(durationMs);

  // If no sets are logged, alert and prompt
  if (totalSets === 0 && activeWorkout.exercises.length > 0) {
    const confirmFinish = confirm("לא סימנת אף סט כ-'בוצע' באימון זה. האם לסיים בכל זאת ללא שמירה בהיסטוריה?");
    if (!confirmFinish) return;
    
    // Fix Issue 7: Properly clean up active interval timer and active states on cancellation
    if (activeTimerInterval) clearInterval(activeTimerInterval);
    activeTimerInterval = null;
    activeWorkout = null;
    if (activeTimer) activeTimer.textContent = '00:00:00';

    closeSummary();
    return;
  }

  // Create Workout Log object
  const workoutLog = {
    date: Date.now(),
    duration: durationStr,
    exercisesCount: activeExercises || activeWorkout.exercises.length,
    setsCount: totalSets,
    volume: totalVolume,
    exercises: activeWorkout.exercises
  };

  if (totalSets > 0) {
    saveWorkoutToHistory(workoutLog);
    lastCompletedWorkout = workoutLog; // Assign lastCompletedWorkout!
  } else {
    lastCompletedWorkout = null;
  }

  // Populate summary fields
  if (summaryDuration) summaryDuration.textContent = durationStr;
  if (summaryVolume) summaryVolume.textContent = totalVolume.toLocaleString();
  if (summaryExercises) summaryExercises.textContent = workoutLog.exercisesCount;
  if (summarySets) summarySets.textContent = totalSets;

  // Stop Timer
  if (activeTimerInterval) clearInterval(activeTimerInterval);
  activeTimerInterval = null;
  activeWorkout = null;

  // Show summary modal overlay
  if (workoutSummaryModal) {
    workoutSummaryModal.classList.add('active');
  }
}

function closeSummary() {
  saveTemplateIfRequested();

  if (workoutSummaryModal) {
    workoutSummaryModal.classList.remove('active');
  }

  workoutActiveView.classList.remove('active');
  setTimeout(() => {
    workoutActiveView.style.display = 'none';
    workoutIdleView.style.display = 'flex';
    setTimeout(() => {
      workoutIdleView.classList.add('active');
      renderWorkoutHistory();
    }, 50);
  }, 400);
}

// Bind Main Core Action Click Listeners
if (startWorkoutBtn) {
  startWorkoutBtn.addEventListener('click', startWorkout);
}

if (addExerciseBtn) {
  addExerciseBtn.addEventListener('click', () => {
    if (activeWorkout) {
      const newEx = {
        id: Date.now().toString(),
        name: '',
        sets: []
      };
      activeWorkout.exercises.push(newEx);
      renderExercises();
      
      // Auto focus newly added exercise name input
      const inputs = exercisesContainer.querySelectorAll('.exercise-name-input');
      if (inputs.length > 0) {
        inputs[inputs.length - 1].focus();
      }
    }
  });
}

if (finishWorkoutBtn) {
  finishWorkoutBtn.addEventListener('click', finishWorkout);
}

if (summaryCloseBtn) {
  summaryCloseBtn.addEventListener('click', closeSummary);
}

if (summaryFinishBtn) {
  summaryFinishBtn.addEventListener('click', closeSummary);
}

// Event Delegation for Dynamic Elements (Exercises container clicks & inputs)
if (exercisesContainer) {
  // 1. Typing Sync Logic (Ensures typing is preserved without redrawing input fields)
  exercisesContainer.addEventListener('input', (e) => {
    if (!activeWorkout) return;
    
    const target = e.target;
    
    // Sync Exercise Name
    if (target.classList.contains('exercise-name-input')) {
      const exId = target.dataset.exerciseId;
      const ex = activeWorkout.exercises.find(x => x.id === exId);
      if (ex) ex.name = target.value;
    }
    
    // Sync Set Weight
    if (target.classList.contains('set-weight-input')) {
      const exId = target.dataset.exerciseId;
      const setId = target.dataset.setId;
      const ex = activeWorkout.exercises.find(x => x.id === exId);
      if (ex) {
        const set = ex.sets.find(s => s.id === setId);
        if (set) set.weight = target.value;
      }
    }
    
    // Sync Set Reps
    if (target.classList.contains('set-reps-input')) {
      const exId = target.dataset.exerciseId;
      const setId = target.dataset.setId;
      const ex = activeWorkout.exercises.find(x => x.id === exId);
      if (ex) {
        const set = ex.sets.find(s => s.id === setId);
        if (set) set.reps = target.value;
      }
    }
  });

  // 2. Action Clicks (Add set, remove set, remove exercise, toggle complete checkmark, save, edit, tracking parameter select)
  exercisesContainer.addEventListener('click', (e) => {
    if (!activeWorkout) return;

    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    const exId = btn.dataset.exerciseId;
    const setId = btn.dataset.setId;

    if (action === 'save-exercise') {
      const ex = activeWorkout.exercises.find(x => x.id === exId);
      if (ex) {
        if (!ex.name.trim()) {
          alert("נא להזין שם לתרגיל לפני השמירה!");
          return;
        }
        if (ex.sets.length === 0) {
          alert("נא להוסיף לפחות סט אחד לתרגיל!");
          return;
        }
        ex.completed = true;
        renderExercises();
      }
      return;
    }

    if (action === 'edit-exercise') {
      const ex = activeWorkout.exercises.find(x => x.id === exId);
      if (ex) {
        ex.completed = false;
        renderExercises();
      }
      return;
    }

    if (action === 'set-tracking') {
      const ex = activeWorkout.exercises.find(x => x.id === exId);
      if (ex) {
        ex.trackingType = btn.dataset.trackType;
        renderExercises();
      }
      return;
    }

    if (action === 'add-set') {
      const ex = activeWorkout.exercises.find(x => x.id === exId);
      if (ex) {
        ex.sets.push({
          id: Date.now().toString(),
          weight: '',
          reps: '',
          completed: false
        });
        renderExercises();
      }
    }

    if (action === 'remove-set') {
      const ex = activeWorkout.exercises.find(x => x.id === exId);
      if (ex) {
        ex.sets = ex.sets.filter(s => s.id !== setId);
        renderExercises();
      }
    }

    if (action === 'remove-exercise') {
      const confirmRemove = confirm("האם למחוק תרגיל זה על כל הסטים שבו?");
      if (confirmRemove) {
        activeWorkout.exercises = activeWorkout.exercises.filter(x => x.id !== exId);
        renderExercises();
      }
    }

    if (action === 'toggle-complete') {
      const ex = activeWorkout.exercises.find(x => x.id === exId);
      if (ex) {
        const set = ex.sets.find(s => s.id === setId);
        if (set) {
          set.completed = !set.completed;
          
          // Toggle local visual class dynamically so focus and values aren't disturbed
          const row = btn.closest('.set-row');
          if (row) {
            if (set.completed) {
              row.classList.add('completed');
              btn.classList.add('completed');
              btn.textContent = '✓';
            } else {
              row.classList.remove('completed');
              btn.classList.remove('completed');
              
              // Get actual index of this set
              const setIndex = ex.sets.indexOf(set);
              btn.textContent = `סט ${setIndex + 1}`;
            }
          }
        }
      }
    }
  });
}

// Initialise Past Workout History list & Templates dropdown on startup
window.addEventListener('load', () => {
  // Wiped to prevent DOM leak before successful onAuthStateChanged validation
});

// Clear Active Workout on firebase signout
if (firebaseEnabled) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      if (activeTimerInterval) clearInterval(activeTimerInterval);
      activeTimerInterval = null;
      activeWorkout = null;
      if (workoutSummaryModal) workoutSummaryModal.classList.remove('active');
      if (workoutActiveView) workoutActiveView.style.display = 'none';
      if (workoutIdleView) {
        workoutIdleView.style.display = 'flex';
        workoutIdleView.classList.add('active');
      }
    }
  });
}


