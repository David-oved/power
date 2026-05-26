// =========================================================================================
// ⚠️ AI AGENTS SECURITY & PRESERVATION GUARD - PLEASE READ CAREFULLY!
// =========================================================================================
// This codebase has a highly custom, optimized PWA On-Demand Update Engine and a Version
// Isolation Guard in app.js and sw.js.
// 
// RULES OF ENGAGEMENT:
// 1. DO NOT touch the Service Worker registration and loadAppVersion / showUpdateToast functions.
// 2. DO NOT revert the PWA update flow back to automatic background-caching in sw.js.
// 3. DO NOT change the active user profile image element ID (#app-user-photo) in DOM binding.
// 4. NOTE: Most of the workout, sets, and exercise logic in app.js is CURRENTLY "inactive/dormant"
//    because index.html is in a Minimal Profile Hub state. DO NOT try to delete or "revive"
//    it unless explicitly asked by the user.
// 
// 🚨 CRITICAL RULE: If these constraints interfere with a task given to you by the user,
// you MUST ask the user in the chat for explicit permission first! Do NOT make changes to
// these flows without the user's explicit OK in the chat!
// =========================================================================================

// AuraApp - Core PWA Logic & Firebase Authentication Gateway
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  linkWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const navUserPhoto = document.getElementById('nav-user-photo');
const settingsUserPhoto = document.getElementById('settings-user-photo');
const appUserPhoto = settingsUserPhoto; // Mapping compatibility for dormant code
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
async function triggerLocalNotification(title, body, isSystemUpdate = false) {
  if (!isSystemUpdate) {
    const notifEnabled = SafeStorage.getItem('settings_notifications_enabled') !== 'false';
    if (!notifEnabled) {
      console.log("Notifications are disabled by user settings. Skipping non-system notification.");
      return;
    }
  }

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
  setElText('settings-user-name-field', name);
  setElText('settings-user-email-field', email);
  setElText('settings-user-name-main', name);

  // Photo Binding
  const fallbackPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const photoURL = currentUser.photoURL || fallbackPhoto;
  if (navUserPhoto) {
    navUserPhoto.src = photoURL;
    navUserPhoto.onerror = () => { navUserPhoto.src = fallbackPhoto; };
  }
  if (settingsUserPhoto) {
    settingsUserPhoto.src = photoURL;
    settingsUserPhoto.onerror = () => { settingsUserPhoto.src = fallbackPhoto; };
  }
  const settingsUserPhotoMain = document.getElementById('settings-user-photo-main');
  if (settingsUserPhotoMain) {
    settingsUserPhotoMain.src = photoURL;
    settingsUserPhotoMain.onerror = () => { settingsUserPhotoMain.src = fallbackPhoto; };
  }
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
  SafeStorage._fallbackMem = {};
  SafeStorage._failedKeys = {};

  closeDrawer();

  setElText('user-display-name', 'User');
  setElText('settings-user-name-field', 'User');
  setElText('settings-user-email-field', 'user@gmail.com');
  setElText('settings-user-name-main', 'משתמש');
  const mainView = document.getElementById('settings-main-view');
  const accountView = document.getElementById('settings-account-view');
  if (mainView) mainView.classList.remove('hide');
  if (accountView) accountView.classList.add('hide');

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
  if (navUserPhoto) navUserPhoto.src = fallbackPhoto;
  if (settingsUserPhoto) settingsUserPhoto.src = fallbackPhoto;
  const settingsUserPhotoMain = document.getElementById('settings-user-photo-main');
  if (settingsUserPhotoMain) settingsUserPhotoMain.src = fallbackPhoto;
  if (floatingUserPhoto) floatingUserPhoto.src = fallbackPhoto;
  if (drawerUserPhoto) drawerUserPhoto.src = fallbackPhoto;
  
  // Reset tabs to default Settings tab upon logout
  resetTabs();

  if (typeof clearWorkoutSession === 'function') clearWorkoutSession();

  isSensitiveDataVisible = false;
  if (toggleSensitiveBtn) {
    toggleSensitiveBtn.innerHTML = '👁️ הצג פרטים מזהים';
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
      if (typeof initWorkouts === 'function') initWorkouts();
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
      if (error.code === 'auth/account-exists-with-different-credential') {
        handleAccountExistsWithDifferentCredential(error);
        return;
      }
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

function onDOMReady(fn) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

onDOMReady(detectEnvironmentAndWarn);

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

    // 100% Success-Rate Google Auth flow for both Mobile & Desktop
    // Attempt signInWithPopup first because it maintains session state reliably without page reloads/redirect loops.
    // Fall back to signInWithRedirect ONLY if popup is blocked or unsupported.
    try {
      console.log("Attempting Google Authentication via popup...");
      await signInWithPopup(auth, googleProvider);
      console.log("Logged in successfully via popup!");
      loginBtn.disabled = false;
      if (btnTextEl) btnTextEl.textContent = originalText;
    } catch (popupError) {
      console.warn("Popup authentication failed/blocked. Code:", popupError.code, popupError.message);
      
      if (popupError.code === 'auth/account-exists-with-different-credential') {
        handleAccountExistsWithDifferentCredential(popupError);
        loginBtn.disabled = false;
        if (btnTextEl) btnTextEl.textContent = originalText;
        return;
      }

      // If user cancelled, just reset button state and return safely.
      if (popupError.code === 'auth/popup-closed-by-user' || popupError.code === 'auth/cancelled-popup-request') {
        console.log("Sign-in process was cancelled by the user.");
        loginBtn.disabled = false;
        if (btnTextEl) btnTextEl.textContent = originalText;
        return;
      }

      // If blocked by browser popup blocker, or third-party storage restriction, fallback dynamically to Redirect
      console.log("Falling back dynamically to signInWithRedirect...");
      if (btnTextEl) btnTextEl.textContent = 'Redirecting...';
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError) {
        console.error("Redirect fallback authentication error:", redirectError);
        if (redirectError.code === 'auth/account-exists-with-different-credential') {
          handleAccountExistsWithDifferentCredential(redirectError);
          loginBtn.disabled = false;
          if (btnTextEl) btnTextEl.textContent = originalText;
        } else {
          handleAuthError(redirectError, loginBtn, originalText);
        }
      }
    }
  });
}

// Proactive Environment Warnings (WhatsApp/Telegram/Private Tabs)
// Proactive Environment Warnings (WhatsApp/Telegram/Private Tabs/Android WebViews/Local Files)
function detectEnvironmentAndWarn() {
  const storageOk = SafeStorage.isSupported();
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // זיהוי דפדפנים פנימיים באפליקציות מוכרות
  const isKnownInApp = /FBAN|FBAV|Instagram|Twitter|FBIOS|Messenger|WhatsApp|Telegram|Line|WeChat/i.test(userAgent);
  
  // זיהוי WebView כללי באנדרואיד (מכיל את האינדיקטור wv)
  const isAndroidWebView = /Android/i.test(userAgent) && /wv/i.test(userAgent);
  const isInApp = isKnownInApp || isAndroidWebView;

  // בדיקה האם האפליקציה מורצת מקובץ מקומי ולא משרת מאובטח
  const isLocalFile = window.location.protocol === 'file:';

  const authCard = document.querySelector('.auth-card');
  if (authCard) {
    let warningHtml = '';
    
    if (isLocalFile) {
      warningHtml = `
        <div style="background: rgba(239, 68, 68, 0.12); border: 1px dashed rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 14px; margin-bottom: 20px; direction: rtl; text-align: right; font-size: 0.88rem; color: #f87171; display: flex; gap: 10px; align-items: start; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.08);">
          <span style="font-size: 1.25rem;">⚠️</span>
          <div>
            <strong>הרצה מקומית לא מאובטחת!</strong><br>
            הורדת קבצי הקוד ישירות למכשיר חוסמת את החיבור המאובטח של גוגל.<br>
            <strong style="color: #fff;">איך להתחבר?</strong> עליך להיכנס לאפליקציה דרך הקישור הרשמי והמאובטח שלה: <br>
            <a href="https://power-4ab3e.web.app" target="_blank" style="color: #60a5fa; text-decoration: underline; font-weight: bold;">https://power-4ab3e.web.app</a><br>
            ומשם תוכל להתקין אותה למסך הבית בקלות!
          </div>
        </div>
      `;
    } else if (isInApp) {
      warningHtml = `
        <div style="background: rgba(239, 68, 68, 0.12); border: 1px dashed rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 14px; margin-bottom: 20px; direction: rtl; text-align: right; font-size: 0.88rem; color: #f87171; display: flex; gap: 10px; align-items: start; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.08);">
          <span style="font-size: 1.25rem;">⚠️</span>
          <div>
            <strong>דפדפן לא נתמך / חסום על ידי Google!</strong><br>
            פתחת את האפליקציה מתוך קישור פנימי. גוגל חוסמת התחברות מאובטחת בסביבה זו.<br>
            <strong style="color: #fff;">מה לעשות?</strong> לחץ על שלוש הנקודות בפינה העליונה ובחר <strong>"פתח בדפדפן"</strong> (Chrome) כדי להתחבר בהצלחה ולהתקין את האפליקציה למסך הבית.
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

// ==========================================================================
// AuraApp - Email & Password Authentication & Account Linking Flow Handlers
// ==========================================================================

// Global state variables for Account Linking
let pendingGoogleCredential = null;
let pendingEmailForLinking = null;

// Helper to prompt for existing password and securely link accounts
window.handleAccountExistsWithDifferentCredential = function(error) {
  console.log("Caught account-exists-with-different-credential. Prompting password for linking...");
  pendingGoogleCredential = GoogleAuthProvider.credentialFromError(error);
  pendingEmailForLinking = error.customData?.email || error.email;
  
  const linkingModal = document.getElementById('account-linking-modal');
  if (linkingModal) {
    linkingModal.classList.remove('hide');
  }
};

// Wire up Account Linking Modal & Form
const accountLinkingForm = document.getElementById('account-linking-form');
const closeAccountLinkingBtn = document.getElementById('close-account-linking-btn');
const accountLinkingModal = document.getElementById('account-linking-modal');

if (closeAccountLinkingBtn && accountLinkingModal) {
  closeAccountLinkingBtn.addEventListener('click', () => {
    accountLinkingModal.classList.add('hide');
    pendingGoogleCredential = null;
    pendingEmailForLinking = null;
  });
}

if (accountLinkingForm) {
  accountLinkingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pendingGoogleCredential || !pendingEmailForLinking) {
      alert("שגיאת תהליך קישור. אנא נסה להתחבר מחדש.");
      return;
    }

    const passwordInput = document.getElementById('link-password-input');
    const password = passwordInput ? passwordInput.value : '';
    
    const submitBtn = accountLinkingForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "מקשר חשבונות... ⏳";
    }

    try {
      // 1. Sign in with the existing email and password
      const userCredential = await signInWithEmailAndPassword(auth, pendingEmailForLinking, password);
      // 2. Link the google credential to the signed in user
      await linkWithCredential(userCredential.user, pendingGoogleCredential);
      
      alert("החשבונות קושרו בהצלחה! מעתה תוכל להתחבר בשתי הדרכים.");
      if (accountLinkingModal) accountLinkingModal.classList.add('hide');
      if (passwordInput) passwordInput.value = '';
      pendingGoogleCredential = null;
      pendingEmailForLinking = null;
    } catch (linkError) {
      console.error("Account linking failed:", linkError);
      alert("קישור החשבון נכשל. אנא ודא שהסיסמה שהזנת נכונה.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "אמת וקשר חשבון";
      }
    }
  });
}

// Wire up Tab Segment Controls for Login Card
const authTabGoogle = document.getElementById('auth-tab-google');
const authTabEmail = document.getElementById('auth-tab-email');
const googleAuthSection = document.getElementById('google-auth-section');
const emailAuthSection = document.getElementById('email-auth-section');

if (authTabGoogle && authTabEmail && googleAuthSection && emailAuthSection) {
  authTabGoogle.addEventListener('click', () => {
    authTabGoogle.classList.add('active');
    authTabEmail.classList.remove('active');
    googleAuthSection.classList.remove('hide');
    emailAuthSection.classList.add('hide');
  });

  authTabEmail.addEventListener('click', () => {
    authTabEmail.classList.add('active');
    authTabGoogle.classList.remove('active');
    emailAuthSection.classList.remove('hide');
    googleAuthSection.classList.add('hide');
  });
}

// Wire up Email & Password Sign-in / Sign-up Mode toggler
const toggleAuthModeBtn = document.getElementById('toggle-auth-mode-btn');
const emailFormTitle = document.getElementById('email-form-title');
const emailSubmitBtn = document.getElementById('email-submit-btn');

let emailAuthMode = "signin"; // default is sign-in

if (toggleAuthModeBtn && emailFormTitle && emailSubmitBtn) {
  toggleAuthModeBtn.addEventListener('click', () => {
    if (emailAuthMode === "signin") {
      emailAuthMode = "signup";
      emailFormTitle.textContent = "הרשמה לחשבון חדש";
      emailSubmitBtn.textContent = "הרשם כעת";
      toggleAuthModeBtn.textContent = "כבר יש לך חשבון? להתחברות ✨";
    } else {
      emailAuthMode = "signin";
      emailFormTitle.textContent = "התחברות לחשבון";
      emailSubmitBtn.textContent = "התחבר כעת";
      toggleAuthModeBtn.textContent = "אין לך חשבון? להרשמה חדשה ✨";
    }
  });
}

// Wire up Email Form Submission
const emailAuthForm = document.getElementById('email-auth-form');
if (emailAuthForm) {
  emailAuthForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!firebaseEnabled) {
      alert("Authentication features are currently unavailable because Firebase is not configured properly.");
      return;
    }

    const email = document.getElementById('auth-email-input').value;
    const password = document.getElementById('auth-password-input').value;
    
    if (password.length < 6) {
      alert("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return;
    }
    
    const submitBtn = document.getElementById('email-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = emailAuthMode === "signin" ? "מתחבר... ⏳" : "נרשם... ⏳";
    }
    
    try {
      if (emailAuthMode === "signin") {
        console.log("Signing in with email & password...");
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        console.log("Registering with email & password...");
        await createUserWithEmailAndPassword(auth, email, password);
        alert("נרשמת בהצלחה! ברוך הבא ל-AuraApp.");
      }
    } catch (authError) {
      console.error("Email auth error:", authError.code, authError.message);
      let userFriendlyMessage = "שגיאת הזדהות. אנא נסה שוב.";
      if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found' || authError.code === 'auth/wrong-password') {
        userFriendlyMessage = "אימייל או סיסמה לא נכונים.";
      } else if (authError.code === 'auth/email-already-in-use') {
        userFriendlyMessage = "כתובת האימייל הזו כבר נמצאת בשימוש במערכת. נסה להתחבר.";
      } else if (authError.code === 'auth/invalid-email') {
        userFriendlyMessage = "כתובת אימייל לא תקינה.";
      } else if (authError.code === 'auth/weak-password') {
        userFriendlyMessage = "הסיסמה חלשה מדי. אנא בחר סיסמה עם לפחות 6 תווים.";
      }
      alert(userFriendlyMessage);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = emailAuthMode === "signin" ? "התחבר כעת" : "הרשם כעת";
      }
    }
  });
}

// Wire up Forgot Password Modal Toggles
const forgotPasswordLink = document.getElementById('forgot-password-link');
const forgotPasswordModal = document.getElementById('forgot-password-modal');
const closeForgotPasswordBtn = document.getElementById('close-forgot-password-btn');

if (forgotPasswordLink && forgotPasswordModal) {
  forgotPasswordLink.addEventListener('click', () => {
    forgotPasswordModal.classList.remove('hide');
  });
}

if (closeForgotPasswordBtn && forgotPasswordModal) {
  closeForgotPasswordBtn.addEventListener('click', () => {
    forgotPasswordModal.classList.add('hide');
  });
}

// Wire up Forgot Password Submission
const forgotPasswordForm = document.getElementById('forgot-password-form');
if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!firebaseEnabled) {
      alert("שירותי אימות אינם זמינים כעת.");
      return;
    }

    const email = document.getElementById('reset-email-input').value;
    
    try {
      await sendPasswordResetEmail(auth, email);
      alert("קישור לאיפוס הסיסמה נשלח לתיבת המייל שלך!");
      if (forgotPasswordModal) forgotPasswordModal.classList.add('hide');
      document.getElementById('reset-email-input').value = '';
    } catch (resetError) {
      console.error("Password reset error:", resetError);
      alert("שליחת קישור האיפוס נכשלה. אנא ודא שהאימייל שהזנת תקין.");
    }
  });
}

// Wire up Settings Pane Add/Change Password
const settingsPasswordForm = document.getElementById('settings-password-form');
if (settingsPasswordForm) {
  settingsPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!firebaseEnabled || !currentUser) {
      alert("אין משתמש מחובר במצב אימות פעיל.");
      return;
    }
    
    const passwordInput = document.getElementById('settings-password-input');
    const password = passwordInput ? passwordInput.value : '';
    if (password.length < 6) {
      alert("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return;
    }
    
    const saveBtn = document.getElementById('save-settings-password-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "...שומר סיסמה ⏳";
    }
    
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await linkWithCredential(currentUser, credential);
      alert("הסיסמה נשמרה בהצלחה! מעתה תוכל להתחבר גם באמצעות אימייל וסיסמה.");
      if (passwordInput) passwordInput.value = '';
    } catch (saveError) {
      console.error("Failed to link email credential from settings:", saveError.code, saveError.message);
      let userFriendlyMessage = "שמירת הסיסמה נכשלה. אנא נסה שוב.";
      if (saveError.code === 'auth/credential-already-in-use') {
        userFriendlyMessage = "האימייל הזה כבר מקושר לחשבון אחר במערכת.";
      } else if (saveError.code === 'auth/requires-recent-login') {
        userFriendlyMessage = "פעולה זו דורשת התחברות מחדש מטעמי אבטחה.";
      }
      alert(userFriendlyMessage);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "שמור סיסמה";
      }
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
      const activeWorker = navigator.serviceWorker.controller || reg.active;
      if (!activeWorker) return;
      
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data && event.data.version) {
          const badge = document.getElementById('app-version-display');
          if (badge) {
            badge.textContent = `v${event.data.version}`;
          }
          const settingsVer = document.getElementById('settings-system-version');
          if (settingsVer) {
            settingsVer.textContent = `v${event.data.version}`;
          }
        }
      };
      activeWorker.postMessage({ action: 'getVersion' }, [messageChannel.port2]);
    };

    window.addEventListener('load', () => {
      // Trigger update notification on load if we just updated successfully
      const justUpdated = SafeStorage.getItem('pwa_just_updated');
      if (justUpdated) {
        SafeStorage.removeItem('pwa_just_updated');
        setTimeout(() => {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            triggerLocalNotification(
              "העדכון הותקן בהצלחה! ✨",
              "האפליקציה עודכנה לגרסה האחרונה. תהנה מהשיפורים והעיצוב החדש!",
              true
            );
          }
        }, 1500);
      }

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
      if (!navigator.serviceWorker.controller) return; // הגנה מלופ
      refreshing = true;
      console.log("Service Worker controller changed. Reloading page for new version...");
      SafeStorage.setItem('pwa_just_updated', 'true');
      window.location.reload();
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.action === 'updateFailed') {
        const refreshBtn = document.getElementById('pwa-refresh-btn');
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.style.opacity = '1';
          refreshBtn.style.cursor = 'pointer';
          refreshBtn.textContent = 'רענן כעת';
        }
        alert('הורדת העדכון נכשלה. אנא ודא שיש לך חיבור רשת תקין ונסה שוב.');
      }
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
      console.log("User requested update activation. Initiating on-demand asset download...");
      
      // Make the button disabled and change its visual state to loading
      refreshBtn.disabled = true;
      refreshBtn.style.opacity = '0.7';
      refreshBtn.style.cursor = 'not-allowed';
      refreshBtn.textContent = 'מוריד עדכונים... ⏳';
      
      // Send message to Service Worker to start download and skip waiting
      waitingWorker.postMessage({ action: 'downloadAndActivate' });
    });
  }

  // Also show update button in settings tab dynamically
  showUpdateStateInSettings(waitingWorker);
}

// Display "עדכן 🚀" button inside settings check update row
function showUpdateStateInSettings(waitingWorker) {
  const updateStatus = document.getElementById('settings-update-status');
  const checkUpdateRow = document.getElementById('row-settings-check-update');
  if (updateStatus && checkUpdateRow) {
    updateStatus.innerHTML = '<button id="settings-update-now-btn" class="ios-update-badge-btn">עדכן 🚀</button>';
    checkUpdateRow.classList.remove('checking');
    
    const updateNowBtn = document.getElementById('settings-update-now-btn');
    if (updateNowBtn) {
      updateNowBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering check update row click
        updateNowBtn.disabled = true;
        updateNowBtn.innerHTML = 'מוריד... ⏳';
        waitingWorker.postMessage({ action: 'downloadAndActivate' });
      });
    }
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
    let isExpanded = false;
    if (drawerJsonContainer) {
      isExpanded = drawerJsonContainer.classList.toggle('expanded');
    }
    if (drawerToggleArrow) {
      drawerToggleArrow.textContent = isExpanded ? '▲' : '▼';
    }
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
// iOS 26 Tab Switching Engine & Tab Reset Logic
// ==========================================================================
let autoCollapseTimeout = null;

function collapseNav() {
  const bottomNav = document.querySelector('.ios-bottom-nav');
  const menuToggleBtn = document.getElementById('nav-menu-toggle-btn');
  if (bottomNav) {
    bottomNav.classList.add('collapsed');
    if (menuToggleBtn) menuToggleBtn.classList.remove('hide');
  }
  if (autoCollapseTimeout) {
    clearTimeout(autoCollapseTimeout);
    autoCollapseTimeout = null;
  }
}

function expandNav() {
  const bottomNav = document.querySelector('.ios-bottom-nav');
  const menuToggleBtn = document.getElementById('nav-menu-toggle-btn');
  if (bottomNav) {
    bottomNav.classList.remove('collapsed');
    if (menuToggleBtn) menuToggleBtn.classList.add('hide');
  }
  // UX premium: if no tab clicked in 5 seconds, auto-collapse back
  if (autoCollapseTimeout) {
    clearTimeout(autoCollapseTimeout);
  }
  autoCollapseTimeout = setTimeout(() => {
    collapseNav();
  }, 5000);
}

function resetTabs() {
  const navTabs = document.querySelectorAll('.ios-bottom-nav .nav-tab');
  const tabPanes = document.querySelectorAll('.tab-content-container .tab-pane');
  
  navTabs.forEach(t => t.classList.remove('active'));
  tabPanes.forEach(p => p.classList.remove('active'));
  
  const settingsTab = document.querySelector('.ios-bottom-nav .nav-tab[data-tab="settings"]');
  if (settingsTab) settingsTab.classList.add('active');
  
  const settingsPane = document.getElementById('tab-settings');
  if (settingsPane) settingsPane.classList.add('active');

  // Reset to expanded state on tab reset
  expandNav();
}

// Binds tab clicking event listeners
const navTabs = document.querySelectorAll('.ios-bottom-nav .nav-tab');
const tabPanes = document.querySelectorAll('.tab-content-container .tab-pane');

let lastActiveMainTab = 'settings';

navTabs.forEach((tab) => {
  tab.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent triggering expandNav on the nav itself

    const targetTab = tab.dataset.tab;
    if (!targetTab) return;

    if (targetTab !== 'analytics') {
      lastActiveMainTab = targetTab;
    }

    // Update active class on tab buttons
    navTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update active class on tab panes
    tabPanes.forEach((pane) => {
      pane.classList.remove('active');
      if (pane.id === `tab-${targetTab}`) {
        pane.classList.add('active');
      }
    });
    
    console.log(`Switched to tab: ${targetTab}`);
    if (targetTab === 'analytics') {
      const mainNav = document.querySelector('.ios-bottom-nav');
      const subNav = document.getElementById('metrics-sub-nav');
      if (mainNav) mainNav.classList.add('nav-hidden');
      if (subNav) subNav.classList.remove('nav-hidden');

      // Expand sub-nav if collapsed
      if (subNav && subNav.classList.contains('collapsed')) {
        subNav.classList.remove('collapsed');
      }

      // Automatically activate default workouts sub-tab
      const defaultSubTab = document.querySelector('#metrics-sub-nav .nav-tab[data-sub-tab="workouts"]');
      if (defaultSubTab) {
        defaultSubTab.click();
      } else {
        renderWorkoutsLog();
      }
    }

    // NEW BEHAVIOR: Expand nav on tab switch, let it stay open until user interacts with the tab content
    // The nav collapses only when user scrolls or takes an action inside the tab
    if (autoCollapseTimeout) {
      clearTimeout(autoCollapseTimeout);
      autoCollapseTimeout = null;
    }
    expandNav();
  });
});

// Attach scroll listeners to all tab panes — collapse nav when user scrolls inside a tab
onDOMReady(() => {
  const allPanes = document.querySelectorAll('.tab-content-container .tab-pane');
  allPanes.forEach(pane => {
    let scrollThreshold = false;
    pane.addEventListener('scroll', () => {
      if (!scrollThreshold) {
        scrollThreshold = true;
        collapseNav();
        // Reset threshold after 1s so it can collapse again on next scroll burst
        setTimeout(() => { scrollThreshold = false; }, 1000);
      }
    }, { passive: true });
  });
});

// Bind click listeners for Collapsible Navigation Bar
onDOMReady(() => {
  const bottomNav = document.querySelector('.ios-bottom-nav');
  const menuToggleBtn = document.getElementById('nav-menu-toggle-btn');

  if (bottomNav) {
    bottomNav.addEventListener('click', (e) => {
      if (bottomNav.classList.contains('collapsed')) {
        e.stopPropagation();
        expandNav();
      }
    });
  }

  if (menuToggleBtn) {
    menuToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      expandNav();
    });
  }
});

// ==========================================================================
// iOS Settings Sub-navigation (Main View <-> Account Details View)
// ==========================================================================
const goToAccountBtn = document.getElementById('go-to-account-btn');
const backToSettingsBtn = document.getElementById('back-to-settings-btn');
const settingsMainView = document.getElementById('settings-main-view');
const settingsAccountView = document.getElementById('settings-account-view');

if (goToAccountBtn && settingsMainView && settingsAccountView) {
  goToAccountBtn.addEventListener('click', () => {
    settingsMainView.classList.add('hide');
    settingsAccountView.classList.remove('hide');
    console.log("Navigated to Account Details Sub-view.");
  });
}

if (backToSettingsBtn && settingsMainView && settingsAccountView) {
  backToSettingsBtn.addEventListener('click', () => {
    settingsAccountView.classList.add('hide');
    settingsMainView.classList.remove('hide');
    console.log("Navigated back to Main Settings View.");
  });
}

// ==========================================================================
// 18. CYBER WORKOUT STATE MACHINE & HISTORY MANAGER
// ==========================================================================
const GYM_EXERCISES = [
  { name: 'לחיצת חזה עם מוט', category: 'חזה' },
  { name: 'לחיצת חזה בשיפוע חיובי', category: 'חזה' },
  { name: 'פרפר בכבלים', category: 'חזה' },
  { name: 'לחיצת חזה במכונה', category: 'חזה' },
  { name: 'דדליפט', category: 'גב' },
  { name: 'משיכת פולי עליון', category: 'גב' },
  { name: 'חתירה בכבלים', category: 'גב' },
  { name: 'מתח', category: 'גב' },
  { name: 'חתירה עם משקולת יד', category: 'גב' },
  { name: 'לחיצת כתפיים עם משקולות', category: 'כתפיים' },
  { name: 'הרחקת זרועות לצדדים', category: 'כתפיים' },
  { name: 'הרמת ידיים לפנים', category: 'כתפיים' },
  { name: 'פרפר אחורי במכונה', category: 'כתפיים' },
  { name: 'פייס פולס', category: 'כתפיים' },
  { name: 'משיכת כתפיים (Shrugs)', category: 'כתפיים' },
  { name: 'סקוואט עם מוט', category: 'רגליים' },
  { name: 'לחיצת רגליים במכונה', category: 'רגליים' },
  { name: 'פשיטת ברכיים', category: 'רגליים' },
  { name: 'כפיפת ברכיים', category: 'רגליים' },
  { name: 'דדליפט רומני', category: 'רגליים' },
  { name: 'הרמת עקבים (Calves)', category: 'רגליים' },
  { name: 'כפיפת מרפקים עם מוט', category: 'ידיים' },
  { name: 'כפיפת מרפקים פטישים', category: 'ידיים' },
  { name: 'כפיפת מרפקים בכור כומר', category: 'ידיים' },
  { name: 'פשיטת מרפקים בפולי', category: 'ידיים' },
  { name: 'פשיטת מרפקים מעל הראש', category: 'ידיים' },
  { name: 'כפיפות בטן', category: 'בטן' },
  { name: 'פלאנק', category: 'בטן' },
  { name: 'הרמת רגליים בתלייה', category: 'בטן' },
  { name: 'ריצה על הליכון', category: 'אירובי' }
];

const PARK_EXERCISES = [
  { name: 'מתח רגיל', category: 'מתח' },
  { name: 'מתח באחיזה הפוכה (Chin-ups)', category: 'מתח' },
  { name: 'מאסל-אפ (Muscle-ups)', category: 'מתח' },
  { name: 'חתירה אוסטרלית', category: 'מתח' },
  { name: 'מקבילים (Dips)', category: 'דחיפה' },
  { name: 'שכיבות שמיכה', category: 'דחיפה' },
  { name: 'שכיבות שמיכה יהלום', category: 'דחיפה' },
  { name: 'שכיבות שמיכה בשיפוע שלילי', category: 'דחיפה' },
  { name: 'שכיבות שמיכה פייק', category: 'דחיפה' },
  { name: 'מקבילים אחוריים על ספסל', category: 'דחיפה' },
  { name: 'פיסטול סקוואט', category: 'רגליים' },
  { name: 'סקוואט משקל גוף', category: 'רגליים' },
  { name: 'לאנג׳ים', category: 'רגליים' },
  { name: 'עליות מדרגה', category: 'רגליים' },
  { name: 'הרמת עקבים', category: 'רגליים' },
  { name: 'פלאנק', category: 'ליבה ואירובי' },
  { name: 'הרמת רגליים על ספסל', category: 'ליבה ואירובי' },
  { name: 'ברפיז (Burpees)', category: 'ליבה ואירובי' },
  { name: 'אל-סיט (L-Sit)', category: 'ליבה ואירובי' },
  { name: 'מטפס הרים', category: 'ליבה ואירובי' }
];

let activeWorkout = null;
let activeTimerInterval = null;
let workoutHistory = [];
let editingWorkout = null;

// Custom Locations & Exercises State
let customLocations = [];
let customExercises = [];
let favoriteExercises = []; // ⭐ Names of exercises marked as favorites
let selectedExerciseForAdding = null;
let currentActiveCategoryFilter = 'הכל';

// Rest Timer State Variables
let restTimerInterval = null;
let restTimerSecondsLeft = 0;

// Set Logging State Variables
let currentLoggingExercise = null;
let currentLoggingExerciseIndex = -1;
let currentLoggingSetIndex = -1;

function saveActiveWorkoutState() {
  if (currentUser && activeWorkout) {
    SafeStorage.setItem(`aura-active-workout_${currentUser.uid}`, JSON.stringify(activeWorkout));
  }
}

// Unified Exercises LocalStorage Helpers
function getAllExercises() {
  if (!currentUser) {
    return [...GYM_EXERCISES, ...PARK_EXERCISES];
  }
  const key = `aura-all-exercises_${currentUser.uid}`;
  let list = SafeStorage.getItem(key);
  if (!list) {
    const combined = [];
    const names = new Set();
    [...GYM_EXERCISES, ...PARK_EXERCISES].forEach(item => {
      if (!names.has(item.name)) {
        names.add(item.name);
        combined.push(item);
      }
    });
    SafeStorage.setItem(key, JSON.stringify(combined));
    return combined;
  }
  try {
    return JSON.parse(list);
  } catch (e) {
    console.error("Failed to parse aura-all-exercises from storage:", e);
    return [...GYM_EXERCISES, ...PARK_EXERCISES];
  }
}

function saveAllExercises(list) {
  if (!currentUser) return;
  const key = `aura-all-exercises_${currentUser.uid}`;
  SafeStorage.setItem(key, JSON.stringify(list));
}

// Global Exercises Getter to maintain absolute compatibility with existing files & code
Object.defineProperty(window, 'exercisesList', {
  get: function() {
    return getAllExercises();
  },
  configurable: true
});

// Initialize workouts state on user auth
function initWorkouts() {
  if (!currentUser) return;

  // Initialize unified exercises list in LocalStorage if not already present
  const key = `aura-all-exercises_${currentUser.uid}`;
  if (!SafeStorage.getItem(key)) {
    const combined = [];
    const names = new Set();
    [...GYM_EXERCISES, ...PARK_EXERCISES].forEach(item => {
      if (!names.has(item.name)) {
        names.add(item.name);
        combined.push(item);
      }
    });
    SafeStorage.setItem(key, JSON.stringify(combined));
  }
  
  // Load History
  const historyData = SafeStorage.getItem(`aura-workout-history_${currentUser.uid}`);
  if (historyData) {
    try {
      workoutHistory = JSON.parse(historyData);
    } catch (e) {
      console.error("Failed to parse workout history, resetting:", e);
      workoutHistory = [];
    }
  } else {
    workoutHistory = [];
  }
  
  // Load Custom Locations
  const locsData = SafeStorage.getItem(`aura-custom-locations_${currentUser.uid}`);
  if (locsData) {
    try {
      customLocations = JSON.parse(locsData);
    } catch (e) {
      console.error("Failed to parse custom locations:", e);
      customLocations = [];
    }
  } else {
    customLocations = [];
  }
  
  // Load Custom Exercises
  const exsData = SafeStorage.getItem(`aura-custom-exercises_${currentUser.uid}`);
  if (exsData) {
    try {
      customExercises = JSON.parse(exsData);
    } catch (e) {
      console.error("Failed to parse custom exercises:", e);
      customExercises = [];
    }
  } else {
    customExercises = [];
  }
  
  // Load Favorite Exercises
  const favsData = SafeStorage.getItem(`aura-favorite-exercises_${currentUser.uid}`);
  if (favsData) {
    try {
      favoriteExercises = JSON.parse(favsData);
    } catch (e) {
      console.error("Failed to parse favorite exercises:", e);
      favoriteExercises = [];
    }
  } else {
    favoriteExercises = [];
  }
  
  // Render Tab 3 History Logs
  renderWorkoutHistory();
  
  // Render location grid dynamically
  renderLocationSelectorGrid();
  
  // Restore Active Workout if any (anti-data loss on reload)
  const activeData = SafeStorage.getItem(`aura-active-workout_${currentUser.uid}`);
  if (activeData) {
    try {
      activeWorkout = JSON.parse(activeData);
      if (activeWorkout && activeWorkout.startTime) {
        if (!activeWorkout.exercises || !Array.isArray(activeWorkout.exercises)) {
          activeWorkout.exercises = [];
        }
        console.log("Restored active workout from storage, resuming timer...");
        resumeWorkoutTimer();
      }
    } catch (e) {
      console.error("Failed to parse restored active workout:", e);
      activeWorkout = null;
    }
  }
}

// Clear workout session on logout
function clearWorkoutSession() {
  if (activeTimerInterval) {
    clearInterval(activeTimerInterval);
    activeTimerInterval = null;
  }
  
  // Stop the rest timer on logout
  if (typeof stopRestTimer === 'function') stopRestTimer();

  activeWorkout = null;
  workoutHistory = [];
  editingWorkout = null;
  
  // Reset active UI views to idle
  const activeView = document.getElementById('workout-active-view');
  const idleView = document.getElementById('workout-idle-view');
  const locationGrid = document.getElementById('location-selector-grid');
  const startBtn = document.getElementById('start-workout-btn');
  
  if (activeView) activeView.classList.add('hide');
  if (idleView) {
    idleView.classList.add('active');
    idleView.classList.remove('hide');
  }
  if (locationGrid) locationGrid.classList.add('hide');
  if (startBtn) startBtn.classList.remove('hide');
  
  const historyList = document.getElementById('workout-history-list');
  if (historyList) historyList.innerHTML = '';
}

// Toggle grid to select location
const startWorkoutBtn = document.getElementById('start-workout-btn');
const cancelLocationBtn = document.getElementById('cancel-location-btn');
const locationGrid = document.getElementById('location-selector-grid');

if (startWorkoutBtn && locationGrid) {
  startWorkoutBtn.addEventListener('click', () => {
    startWorkoutBtn.classList.add('hide');
    locationGrid.classList.remove('hide');
  });
}

if (cancelLocationBtn && startWorkoutBtn && locationGrid) {
  cancelLocationBtn.addEventListener('click', () => {
    locationGrid.classList.add('hide');
    startWorkoutBtn.classList.remove('hide');
  });
}

// Dynamic Location Selector Grid Render
function renderLocationSelectorGrid() {
  const container = document.getElementById('location-tiles-container');
  if (!container) return;
  container.innerHTML = '';
  
  // Default Gym Tile
  const gymTile = document.createElement('button');
  gymTile.className = 'location-tile';
  gymTile.innerHTML = `
    <span class="tile-icon">🏋️‍♂️</span>
    <span class="tile-label">חדר כושר</span>
  `;
  gymTile.addEventListener('click', () => startNewWorkout('gym'));
  container.appendChild(gymTile);

  // Default Park Tile
  const parkTile = document.createElement('button');
  parkTile.className = 'location-tile';
  parkTile.innerHTML = `
    <span class="tile-icon">🌳</span>
    <span class="tile-label">פארק</span>
  `;
  parkTile.addEventListener('click', () => startNewWorkout('park'));
  container.appendChild(parkTile);

  // Render Custom Locations
  customLocations.forEach(loc => {
    const tile = document.createElement('button');
    tile.className = 'location-tile';
    tile.innerHTML = `
      <span class="tile-icon">${loc.emoji || '💪'}</span>
      <span class="tile-label">${loc.name}</span>
    `;
    tile.addEventListener('click', () => startNewWorkout(loc.id, loc.name, loc.emoji));
    container.appendChild(tile);
  });

  // Add Custom Location Tile
  const addTile = document.createElement('button');
  addTile.className = 'location-tile add-custom-location-tile';
  addTile.innerHTML = `
    <span class="tile-icon">➕</span>
    <span class="tile-label">סוג אימון חדש</span>
  `;
  addTile.addEventListener('click', () => {
    const modal = document.getElementById('custom-location-modal');
    if (modal) modal.classList.remove('hide');
  });
  container.appendChild(addTile);
}

function startNewWorkout(location, name = '', emoji = '') {
  if (!currentUser) return;
  
  let dispName = 'חדר כושר';
  let dispEmoji = '🏋️‍♂️';
  
  if (location === 'gym') {
    dispName = 'חדר כושר';
    dispEmoji = '🏋️‍♂️';
  } else if (location === 'park') {
    dispName = 'פארק';
    dispEmoji = '🌳';
  } else {
    dispName = name || 'אימון מותאם';
    dispEmoji = emoji || '💪';
  }
  
  activeWorkout = {
    startTime: Date.now(),
    location: location,
    locationName: dispName,
    locationEmoji: dispEmoji,
    exercises: []
  };
  
  SafeStorage.setItem(`aura-active-workout_${currentUser.uid}`, JSON.stringify(activeWorkout));
  
  // Transition Views
  const idleView = document.getElementById('workout-idle-view');
  const activeView = document.getElementById('workout-active-view');
  
  if (idleView) {
    idleView.classList.remove('active');
    idleView.classList.add('hide');
  }
  if (activeView) activeView.classList.remove('hide');
  
  // Reset Start buttons for next time
  if (locationGrid) locationGrid.classList.add('hide');
  if (startWorkoutBtn) startWorkoutBtn.classList.remove('hide');
  
  // Update Header Badge
  const badgeIcon = document.getElementById('active-location-icon');
  const badgeText = document.getElementById('active-location-text');
  if (badgeIcon) badgeIcon.textContent = dispEmoji;
  if (badgeText) badgeText.textContent = dispName;
  
  // Reset Timer UI
  const timerDisplay = document.getElementById('active-timer');
  if (timerDisplay) timerDisplay.textContent = '00:00:00';
  
  // Start Timer
  if (activeTimerInterval) clearInterval(activeTimerInterval);
  activeTimerInterval = setInterval(updateActiveTimer, 1000);
  
  // Render exercises list (empty)
  renderExercises();
  
  // Collapse nav — user has taken action inside the tab
  if (typeof collapseNav === 'function') collapseNav();
}

function resumeWorkoutTimer() {
  const activeView = document.getElementById('workout-active-view');
  const idleView = document.getElementById('workout-idle-view');
  
  if (idleView) {
    idleView.classList.remove('active');
    idleView.classList.add('hide');
  }
  if (activeView) activeView.classList.remove('hide');
  
  const badgeIcon = document.getElementById('active-location-icon');
  const badgeText = document.getElementById('active-location-text');
  const dispEmoji = activeWorkout.locationEmoji || (activeWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳');
  const dispName = activeWorkout.locationName || (activeWorkout.location === 'gym' ? 'חדר כושר' : 'פארק');
  
  if (badgeIcon) badgeIcon.textContent = dispEmoji;
  if (badgeText) badgeText.textContent = dispName;
  
  if (activeTimerInterval) clearInterval(activeTimerInterval);
  activeTimerInterval = setInterval(updateActiveTimer, 1000);
  updateActiveTimer();
  
  renderExercises();
}

function updateActiveTimer() {
  if (!activeWorkout || !activeWorkout.startTime) return;
  
  const diffMs = Date.now() - activeWorkout.startTime;
  const totalSecs = Math.floor(diffMs / 1000);
  
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  
  const pad = (num) => String(num).padStart(2, '0');
  
  const timerDisplay = document.getElementById('active-timer');
  if (timerDisplay) {
    timerDisplay.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
}

// Exercise Picker List and Filters Rendering
function renderExercisePickerFilters() {
  const container = document.getElementById('exercise-category-filters');
  if (!container || !activeWorkout) return;
  container.innerHTML = '';
  
  let categories = ['הכל'];
  if (activeWorkout.location === 'gym') {
    categories = ['הכל', 'חזה', 'גב', 'כתפיים', 'רגליים', 'ידיים', 'בטן', 'אירובי'];
  } else if (activeWorkout.location === 'park') {
    categories = ['הכל', 'מתח', 'דחיפה', 'רגליים', 'ליבה ואירובי'];
  } else {
    categories = ['הכל', 'מותאם אישית'];
  }

  // Add מועדפים at beginning if there are any
  if (favoriteExercises.length > 0 && !categories.includes('מועדפים')) {
    categories.splice(1, 0, '⭐ מועדפים');
  }

  const hasCustoms = customExercises.some(ex => {
    if (activeWorkout.location === 'gym' || activeWorkout.location === 'park') {
      return ex.locationType === activeWorkout.location;
    }
    return true;
  });
  if (hasCustoms && !categories.includes('מותאם אישית')) {
    categories.push('מותאם אישית');
  }
  
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `category-filter-btn ${currentActiveCategoryFilter === cat ? 'active' : ''}`;
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      currentActiveCategoryFilter = cat;
      renderExercisePickerFilters();
      renderExercisePickerList();
    });
    container.appendChild(btn);
  });
}

function renderExercisePickerList() {
  const container = document.getElementById('exercise-picker-list');
  if (!container || !activeWorkout) return;
  container.innerHTML = '';
  
  const searchInput = document.getElementById('exercise-search-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  
  // Read exclusively from getAllExercises() as single source of truth
  let fullList = getAllExercises();
  
  // Filter by workout location type if defined
  if (activeWorkout.location === 'gym' || activeWorkout.location === 'park') {
    fullList = fullList.filter(ex => {
      if (ex.locationType && ex.locationType !== activeWorkout.location) {
        return false;
      }
      return true;
    });
  }
  
  // Remove duplicates by name (precautionary)
  const seen = new Set();
  fullList = fullList.filter(ex => {
    const k = ex.name.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  
  // Filter by category (or favorites)
  if (currentActiveCategoryFilter === '⭐ מועדפים') {
    fullList = fullList.filter(ex => favoriteExercises.includes(ex.name));
  } else if (currentActiveCategoryFilter !== 'הכל') {
    fullList = fullList.filter(ex => ex.category === currentActiveCategoryFilter);
  }
  
  // Filter by search query
  if (query) {
    fullList = fullList.filter(ex => ex.name.toLowerCase().includes(query));
  }
  
  if (fullList.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'exercise-picker-empty';
    noResults.textContent = 'לא נמצאו תרגילים מתאימים';
    container.appendChild(noResults);
    return;
  }
  
  // Category color map for badges
  const categoryColors = {
    'חזה':      { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
    'גב':       { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
    'כתפיים':    { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc' },
    'רגליים':    { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
    'ידיים':    { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c' },
    'בטן':      { bg: 'rgba(234,179,8,0.15)',   color: '#facc15' },
    'אירובי':    { bg: 'rgba(20,184,166,0.15)',  color: '#2dd4bf' },
    'ליבה':      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
    'מתח':      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
    'דחיפה':    { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
    'ליבה ואירובי': { bg: 'rgba(20,184,166,0.15)', color: '#2dd4bf' },
    'מותאם אישית': { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8' },
  };
  
  fullList.forEach(ex => {
    const itemWrapper = document.createElement('div');
    itemWrapper.className = 'exercise-list-item-wrapper';
    itemWrapper.style.cssText = 'position: relative; display: flex; align-items: center; gap: 8px; direction: rtl;';

    const item = document.createElement('button');
    item.className = 'exercise-list-item';
    item.style.flex = '1';
    
    const catStyle = categoryColors[ex.category] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' };
    const emoji = ex.emoji ? `<span class="ex-list-emoji">${ex.emoji}</span>` : '';
    const isFav = favoriteExercises.includes(ex.name);
    
    item.innerHTML = `
      <div class="ex-list-info">
        ${emoji}
        <span class="ex-list-name">${ex.name}</span>
      </div>
      <div class="ex-list-right">
        <span class="ex-category-badge" style="background: ${catStyle.bg}; color: ${catStyle.color};">${ex.category || 'תרגיל'}</span>
        <span class="ex-list-arrow">←</span>
      </div>
    `;
    item.addEventListener('click', () => {
      selectedExerciseForAdding = ex.name;
      
      // Hide exercise picker
      const pickerModal = document.getElementById('exercise-picker-modal');
      if (pickerModal) pickerModal.classList.add('hide');
      
      // Open metric selector modal
      const metricModal = document.getElementById('metric-selector-modal');
      if (metricModal) metricModal.classList.remove('hide');

      // Trigger Previous Performance Popup Alert if history exists
      if (typeof checkAndShowPreviousPerformance === 'function') {
        checkAndShowPreviousPerformance(ex.name);
      }
    });

    // ⭐ Favorite Star Button
    const starBtn = document.createElement('button');
    starBtn.className = `ex-fav-star-btn ${isFav ? 'active' : ''}`;
    starBtn.title = isFav ? 'הסר ממועדפים' : 'הוסף למועדפים';
    starBtn.innerHTML = isFav ? '⭐' : '☆';
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = favoriteExercises.indexOf(ex.name);
      if (idx > -1) {
        favoriteExercises.splice(idx, 1);
        starBtn.innerHTML = '☆';
        starBtn.classList.remove('active');
        starBtn.title = 'הוסף למועדפים';
      } else {
        favoriteExercises.push(ex.name);
        starBtn.innerHTML = '⭐';
        starBtn.classList.add('active');
        starBtn.title = 'הסר ממועדפים';
      }
      if (currentUser) {
        SafeStorage.setItem(`aura-favorite-exercises_${currentUser.uid}`, JSON.stringify(favoriteExercises));
      }
      // Re-render filters to update מועדפים category visibility
      renderExercisePickerFilters();
      if (currentActiveCategoryFilter === '⭐ מועדפים') {
        renderExercisePickerList();
      }
    });

    itemWrapper.appendChild(starBtn);
    itemWrapper.appendChild(item);
    container.appendChild(itemWrapper);
  });
}

// Bind workout setup events on DOM Ready
onDOMReady(() => {
  // Search input filter listener
  const searchInput = document.getElementById('exercise-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', renderExercisePickerList);
  }
  
  // Backdrop click listeners for modals
  const pickerModal = document.getElementById('exercise-picker-modal');
  if (pickerModal) {
    pickerModal.addEventListener('click', (e) => {
      if (e.target === pickerModal) {
        pickerModal.classList.add('hide');
      }
    });
  }

  const metricModal = document.getElementById('metric-selector-modal');
  if (metricModal) {
    metricModal.addEventListener('click', (e) => {
      if (e.target === metricModal) {
        metricModal.classList.add('hide');
        selectedExerciseForAdding = null;
      }
    });
  }
  
  // Close exercise picker button
  const closePickerBtn = document.getElementById('close-exercise-picker-btn');
  if (closePickerBtn) {
    closePickerBtn.addEventListener('click', () => {
      const pickerModal = document.getElementById('exercise-picker-modal');
      if (pickerModal) pickerModal.classList.add('hide');
    });
  }

  // Close Custom Location Modal
  const closeCustomLocBtn = document.getElementById('close-custom-location-btn');
  if (closeCustomLocBtn) {
    closeCustomLocBtn.addEventListener('click', () => {
      const modal = document.getElementById('custom-location-modal');
      if (modal) modal.classList.add('hide');
    });
  }

  // Close Metric Selector Modal
  const closeMetricBtn = document.getElementById('close-metric-selector-btn');
  if (closeMetricBtn) {
    closeMetricBtn.addEventListener('click', () => {
      const modal = document.getElementById('metric-selector-modal');
      if (modal) modal.classList.add('hide');
      selectedExerciseForAdding = null;
    });
  }

  // Save Custom Location
  const saveCustomLocBtn = document.getElementById('save-custom-location-btn');
  if (saveCustomLocBtn) {
    saveCustomLocBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('custom-location-name-input');
      const emojiInput = document.getElementById('custom-location-emoji-input');
      
      if (!nameInput || nameInput.value.trim() === '') {
        alert('אנא הזן שם לסוג האימון.');
        return;
      }
      
      const newLoc = {
        id: 'custom_' + Date.now(),
        name: nameInput.value.trim(),
        emoji: emojiInput ? emojiInput.value.trim() || '💪' : '💪'
      };
      
      customLocations.push(newLoc);
      if (currentUser) {
        SafeStorage.setItem(`aura-custom-locations_${currentUser.uid}`, JSON.stringify(customLocations));
      }
      
      nameInput.value = '';
      if (emojiInput) emojiInput.value = '';
      
      const modal = document.getElementById('custom-location-modal');
      if (modal) modal.classList.add('hide');
      
      renderLocationSelectorGrid();
    });
  }

  // Open Custom Exercise Modal button (new flow)
  const openCustomExModalBtn = document.getElementById('open-custom-exercise-modal-btn');
  if (openCustomExModalBtn) {
    openCustomExModalBtn.addEventListener('click', () => {
      const customExModal = document.getElementById('custom-exercise-modal');
      if (customExModal) {
        // Reset form state
        const nameInput = document.getElementById('new-custom-exercise-name-input');
        if (nameInput) nameInput.value = '';
        
        // Reset category pills to default
        document.querySelectorAll('#custom-ex-category-selector .muscle-card').forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.category === 'חזה') btn.classList.add('active');
        });
        
        // Reset emoji to none
        document.querySelectorAll('#custom-ex-emoji-selector .emoji-pick-btn').forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.emoji === '') btn.classList.add('active');
        });
        
        customExModal.classList.remove('hide');
        setTimeout(() => { if (nameInput) nameInput.focus(); }, 100);
      }
    });
  }

  // Category pill single-select in custom exercise modal
  const categoryPillContainer = document.getElementById('custom-ex-category-selector');
  if (categoryPillContainer) {
    categoryPillContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.muscle-card');
      if (!pill) return;
      categoryPillContainer.querySelectorAll('.muscle-card').forEach(b => b.classList.remove('active'));
      pill.classList.add('active');
    });
  }

  // Emoji single-select in custom exercise modal
  const emojiSelectorContainer = document.getElementById('custom-ex-emoji-selector');
  if (emojiSelectorContainer) {
    emojiSelectorContainer.addEventListener('click', (e) => {
      const emojiBtn = e.target.closest('.emoji-pick-btn');
      if (!emojiBtn) return;
      emojiSelectorContainer.querySelectorAll('.emoji-pick-btn').forEach(b => b.classList.remove('active'));
      emojiBtn.classList.add('active');
    });
  }

  // Close Custom Exercise Modal
  const closeCustomExModalBtn = document.getElementById('close-custom-exercise-modal-btn');
  if (closeCustomExModalBtn) {
    closeCustomExModalBtn.addEventListener('click', () => {
      const customExModal = document.getElementById('custom-exercise-modal');
      if (customExModal) customExModal.classList.add('hide');
    });
  }

  // Backdrop click to close custom exercise modal
  const customExModal = document.getElementById('custom-exercise-modal');
  if (customExModal) {
    customExModal.addEventListener('click', (e) => {
      if (e.target === customExModal) customExModal.classList.add('hide');
    });
  }

  // Save Custom Exercise from new modal
  const saveCustomExBtn = document.getElementById('save-custom-exercise-btn');
  if (saveCustomExBtn) {
    saveCustomExBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('new-custom-exercise-name-input');
      if (!nameInput || nameInput.value.trim() === '') {
        alert('אנא הזן שם לתרגיל המותאם אישית.');
        if (nameInput) nameInput.focus();
        return;
      }
      
      const exName = nameInput.value.trim();
      
      // Get selected category
      const activeCatPill = document.querySelector('#custom-ex-category-selector .muscle-card.active');
      const selectedCategory = activeCatPill ? activeCatPill.dataset.category : 'מותאם אישית';
      
      // Get selected emoji
      const activeEmojiBtn = document.querySelector('#custom-ex-emoji-selector .emoji-pick-btn.active');
      const selectedEmoji = activeEmojiBtn ? activeEmojiBtn.dataset.emoji : '';
      
      const newEx = {
        name: exName,
        category: selectedCategory,
        locationType: activeWorkout ? activeWorkout.location : 'custom',
        emoji: selectedEmoji || ''
      };
      
      customExercises.push(newEx);
      if (currentUser) {
        SafeStorage.setItem(`aura-custom-exercises_${currentUser.uid}`, JSON.stringify(customExercises));
        // Add to unified exercises database if not already present
        let allExs = getAllExercises();
        if (!allExs.some(ex => ex.name.trim().toLowerCase() === exName.trim().toLowerCase())) {
          allExs.push(newEx);
          saveAllExercises(allExs);
        }
      }
      
      // Close custom exercise modal
      const customExModal = document.getElementById('custom-exercise-modal');
      if (customExModal) customExModal.classList.add('hide');
      
      // Auto-select and trigger metrics choice
      selectedExerciseForAdding = exName;
      
      const pickerModal = document.getElementById('exercise-picker-modal');
      if (pickerModal) pickerModal.classList.add('hide');
      
      const metricModal = document.getElementById('metric-selector-modal');
      if (metricModal) metricModal.classList.remove('hide');
      
      // Re-render the list in background
      renderExercisePickerList();
    });
  }

  // Legacy add-custom-exercise-btn (gracefully inactive since we removed the inline creator)
  // Kept as a no-op stub to avoid errors if anything references it externally
  const legacyAddCustomExBtn = document.getElementById('add-custom-exercise-btn');
  if (legacyAddCustomExBtn) {
    legacyAddCustomExBtn.style.display = 'none'; // Hidden fallback
  }

  // Bind Metric Selector Tiles click — saves metric type and chosen rest time, then adds exercise
  document.querySelectorAll('.metric-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const metricType = tile.getAttribute('data-metric');
      console.log("Metric tile clicked. Chosen metricType:", metricType, "selectedExerciseForAdding:", selectedExerciseForAdding);
      
      if (!selectedExerciseForAdding) {
        console.warn("No selected exercise for adding. Checking active picker state...");
        alert('שגיאה: לא נבחר תרגיל. אנא בחר תרגיל שוב.');
        return;
      }
      
      if (!activeWorkout) {
        console.error("No active workout session found.");
        return;
      }
      
      // Get selected rest time from chips inside the metric modal
      const activeRestChip = document.querySelector('#rest-time-chips-container .rest-option-chip.active');
      const seconds = activeRestChip ? parseInt(activeRestChip.getAttribute('data-rest'), 10) : 90;

      // Create new exercise object
      const newExercise = {
        name: selectedExerciseForAdding,
        metricType: metricType,
        restTime: seconds,
        completed: false,
        sets: []
      };

      activeWorkout.exercises.push(newExercise);
      saveActiveWorkoutState();
      
      // Hide metric modal
      const metricModal = document.getElementById('metric-selector-modal');
      if (metricModal) metricModal.classList.add('hide');
      
      // Clear selected exercise
      selectedExerciseForAdding = null;
      
      renderExercises();
    });
  });

  // Bind Metric Selector Modal Rest Option Chips active status toggling
  const restChipsContainer = document.getElementById('rest-time-chips-container');
  if (restChipsContainer) {
    restChipsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.rest-option-chip');
      if (!chip) return;
      restChipsContainer.querySelectorAll('.rest-option-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  }
});

// Add Exercise Button Listener
const addExerciseBtn = document.getElementById('add-exercise-btn');
if (addExerciseBtn) {
  addExerciseBtn.addEventListener('click', () => {
    if (!activeWorkout) return;
    
    // Automatically filter out and discard any draft exercises that have 0 completed sets
    activeWorkout.exercises = activeWorkout.exercises.filter(ex => {
      return ex.sets.some(s => s.completed);
    });
    saveActiveWorkoutState();
    renderExercises();
    
    // Guard: Can't add if there is any active exercise that has completed sets but is not finalized
    const hasActive = activeWorkout.exercises.some(ex => !ex.completed);
    if (hasActive) {
      alert('נא לסיים את התרגיל הנוכחי לפני הוספת תרגיל חדש.');
      return;
    }
    
    // Open exercise picker modal
    const pickerModal = document.getElementById('exercise-picker-modal');
    if (pickerModal) {
      pickerModal.classList.remove('hide');
      const searchInput = document.getElementById('exercise-search-input');
      if (searchInput) searchInput.value = '';
      currentActiveCategoryFilter = 'הכל';
      renderExercisePickerFilters();
      renderExercisePickerList();
    }
  });
}// Render dynamic Exercises List in Tab 2
function renderExercises() {
  const container = document.getElementById('exercises-container');
  if (!container || !activeWorkout) return;
  
  container.innerHTML = '';
  
  // An exercise only counts as uncompleted if it has at least one completed set but isn't finalized
  const hasUncompleted = activeWorkout.exercises.some(ex => !ex.completed && ex.sets.some(s => s.completed));
  
  // Disable / Enable Add Exercise Button styles
  if (addExerciseBtn) {
    if (hasUncompleted) {
      addExerciseBtn.disabled = true;
      addExerciseBtn.style.opacity = '0.4';
      addExerciseBtn.style.cursor = 'not-allowed';
    } else {
      addExerciseBtn.disabled = false;
      addExerciseBtn.style.opacity = '1';
      addExerciseBtn.style.cursor = 'pointer';
    }
  }
  
  activeWorkout.exercises.forEach((ex, exIdx) => {
    const card = document.createElement('div');
    card.className = `exercise-card ${ex.completed ? 'saved' : ''}`;
    
    const metricType = ex.metricType || 'both'; // Default compatibility
    
    // Header Row
    const header = document.createElement('div');
    header.className = 'exercise-card-header';
    
    const titleContainer = document.createElement('div');
    titleContainer.className = 'exercise-title-container';
    
    // Trash icon to delete exercise (only if not completed)
    if (!ex.completed) {
      const removeExBtn = document.createElement('button');
      removeExBtn.className = 'remove-exercise-btn';
      removeExBtn.innerHTML = '🗑️';
      removeExBtn.title = 'מחק תרגיל';
      removeExBtn.addEventListener('click', () => {
        activeWorkout.exercises.splice(exIdx, 1);
        saveActiveWorkoutState();
        renderExercises();
      });
      titleContainer.appendChild(removeExBtn);
    }
    
    const nameLabel = document.createElement('span');
    nameLabel.className = 'exercise-name-label';
    nameLabel.style.fontSize = '1.15rem';
    nameLabel.style.fontWeight = '800';
    nameLabel.style.color = '#ffffff';
    nameLabel.textContent = ex.name;
    titleContainer.appendChild(nameLabel);
    
    // Metric Badge
    let metricLabel = '⚖️ משקל וחזרות';
    if (metricType === 'reps') metricLabel = '🔢 חזרות בלבד';
    if (metricType === 'weight') metricLabel = '🏋️‍♂️ משקל בלבד';
    
    const metricBadge = document.createElement('span');
    metricBadge.className = 'badge-mini';
    metricBadge.style.marginRight = '8px';
    metricBadge.style.fontSize = '0.75rem';
    metricBadge.style.background = 'rgba(255,255,255,0.06)';
    metricBadge.style.color = 'var(--text-muted)';
    metricBadge.style.padding = '3px 8px';
    metricBadge.style.borderRadius = '20px';
    metricBadge.textContent = metricLabel;
    titleContainer.appendChild(metricBadge);
    
    header.appendChild(titleContainer);
    
    // Save / Edit exercise button on top corner
    const actionBtn = document.createElement('button');
    if (ex.completed) {
      actionBtn.className = 'btn edit-exercise-btn';
      actionBtn.textContent = 'ערוך תרגיל ✏️';
      actionBtn.addEventListener('click', () => {
        ex.completed = false;
        saveActiveWorkoutState();
        renderExercises();
      });
    } else {
      actionBtn.className = 'btn save-exercise-btn';
      actionBtn.textContent = 'סיום תרגיל ✓';
      actionBtn.addEventListener('click', () => {
        const hasCompletedSets = ex.sets.some(s => s.completed);
        if (!hasCompletedSets) {
          alert('אנא השלם לפחות סט אחד.');
          return;
        }
        ex.completed = true;
        ex.sets = ex.sets.filter(s => s.completed);
        saveActiveWorkoutState();
        renderExercises();
      });
    }
    header.appendChild(actionBtn);
    card.appendChild(header);
    
    // Sets Container Area
    const setsArea = document.createElement('div');
    setsArea.className = 'sets-area';
    
    // ---- NEW BEHAVIOR: horizontal pills for completed sets ----
    const completedSets = ex.sets.filter(s => s.completed);
    if (completedSets.length > 0) {
      const chipsContainer = document.createElement('div');
      chipsContainer.className = 'completed-sets-chips-container';
      chipsContainer.style.display = 'flex';
      chipsContainer.style.flexWrap = 'wrap';
      chipsContainer.style.gap = '8px';
      chipsContainer.style.marginTop = '10px';
      chipsContainer.style.direction = 'rtl';
      
      completedSets.forEach((set, idx) => {
        const chip = document.createElement('div');
        chip.className = 'completed-set-chip';
        chip.style.display = 'inline-flex';
        chip.style.alignItems = 'center';
        chip.style.background = 'rgba(255,255,255,0.06)';
        chip.style.border = '1px solid rgba(255,255,255,0.08)';
        chip.style.padding = '6px 12px';
        chip.style.borderRadius = '12px';
        chip.style.fontSize = '0.88rem';
        chip.style.color = '#ffffff';
        chip.style.gap = '6px';
        
        let valueStr = '';
        if (metricType === 'both') {
          valueStr = `${set.weight || 0} ק״ג × ${set.reps || 0}`;
        } else if (metricType === 'weight') {
          valueStr = `${set.weight || 0} ק״ג`;
        } else {
          valueStr = `${set.reps || 0} חזרות`;
        }
        
        const realIdx = ex.sets.indexOf(set);
        chip.innerHTML = `
          <span style="font-weight: 700; color: var(--electric-blue);">סט ${realIdx + 1}:</span>
          <span>${valueStr}</span>
        `;
        
        // Click on completed set to undo it (toggle off)
        if (!ex.completed) {
          chip.style.cursor = 'pointer';
          chip.title = 'לחץ לביטול הסט';
          chip.addEventListener('click', () => {
            if (confirm(`האם ברצונך לבטל את סט ${realIdx + 1}?`)) {
              set.completed = false;
              saveActiveWorkoutState();
              renderExercises();
            }
          });
        }
        chipsContainer.appendChild(chip);
      });
      setsArea.appendChild(chipsContainer);
    }
    
    // If exercise not yet completed, show the broad "➕ רישום סט" button
    if (!ex.completed) {
      const enterSetBtn = document.createElement('button');
      enterSetBtn.className = 'enter-set-data-btn';
      enterSetBtn.style.width = '100%';
      enterSetBtn.style.padding = '12px';
      enterSetBtn.style.borderRadius = '14px';
      enterSetBtn.style.background = 'var(--electric-blue, #4f46e5)';
      enterSetBtn.style.color = '#ffffff';
      enterSetBtn.style.border = 'none';
      enterSetBtn.style.fontWeight = '700';
      enterSetBtn.style.fontSize = '0.95rem';
      enterSetBtn.style.cursor = 'pointer';
      enterSetBtn.style.marginTop = '12px';
      enterSetBtn.style.display = 'block';
      
      const nextIncompleteIdx = ex.sets.findIndex(s => !s.completed);
      const activeSetIdx = nextIncompleteIdx !== -1 ? nextIncompleteIdx : ex.sets.length;
      
      enterSetBtn.textContent = `➕ רישום סט ${activeSetIdx + 1}`;
      enterSetBtn.addEventListener('click', () => {
        openSetLoggingModal(ex, exIdx);
      });
      setsArea.appendChild(enterSetBtn);
    }
    
    card.appendChild(setsArea);
    container.appendChild(card);
  });
}

// Finish Workout Event Listener
const finishWorkoutBtn = document.getElementById('finish-workout-btn');
if (finishWorkoutBtn) {
  finishWorkoutBtn.addEventListener('click', () => {
    if (!activeWorkout) return;
    
    // Auto-complete any active exercises that have valid sets filled but weren't finalized
    activeWorkout.exercises.forEach(ex => {
      if (!ex.completed && ex.name.trim() !== '') {
        ex.sets.forEach(set => {
          if (!set.completed) {
            const hasReps = set.reps !== '' && Number(set.reps) > 0;
            const hasWeight = set.weight !== '' && Number(set.weight) >= 0;
            if (hasReps || hasWeight) {
              set.completed = true;
            }
          }
        });
        const hasCompletedSets = ex.sets.some(s => s.completed);
        if (hasCompletedSets) {
          ex.completed = true;
        }
      }
    });

    // Sanitization: Filter out empty sets and discard exercises with no valid sets or empty names
    const sanitizedExercises = activeWorkout.exercises.map(ex => {
      const clonedEx = JSON.parse(JSON.stringify(ex));
      clonedEx.sets = clonedEx.sets.filter(s => {
        const hasReps = s.reps !== null && String(s.reps).trim() !== '' && Number(s.reps) > 0;
        const hasWeight = s.weight !== null && String(s.weight).trim() !== '' && Number(s.weight) >= 0;
        return s.completed && (hasReps || hasWeight);
      });
      return clonedEx;
    }).filter(ex => ex.name.trim() !== '' && ex.sets.length > 0);

    if (sanitizedExercises.length === 0) {
      if (confirm('אין תרגילים תקפים שהושלמו באימון זה. האם ברצונך לבטל את האימון ולחזור למסך הראשי?')) {
        cancelWorkoutSession();
      }
      return;
    }
    
    // Calculate final duration
    const durationSeconds = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
    
    const workoutLog = {
      id: Date.now(),
      date: Date.now(),
      location: activeWorkout.location,
      locationName: activeWorkout.locationName || (activeWorkout.location === 'gym' ? 'חדר כושר' : 'פארק'),
      locationEmoji: activeWorkout.locationEmoji || (activeWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳'),
      duration: durationSeconds,
      exercises: sanitizedExercises
    };
    
    // Add to history
    workoutHistory.push(workoutLog);
    SafeStorage.setItem(`aura-workout-history_${currentUser.uid}`, JSON.stringify(workoutHistory));
    
    // Clean up active session and Rest Timer
    SafeStorage.removeItem(`aura-active-workout_${currentUser.uid}`);
    if (typeof stopRestTimer === 'function') stopRestTimer();

    if (activeTimerInterval) {
      clearInterval(activeTimerInterval);
      activeTimerInterval = null;
    }
    activeWorkout = null;
    
    // Reset Workouts Tab Views to Idle
    const activeView = document.getElementById('workout-active-view');
    const idleView = document.getElementById('workout-idle-view');
    if (activeView) activeView.classList.add('hide');
    if (idleView) {
      idleView.classList.add('active');
      idleView.classList.remove('hide');
    }
    
    // Re-render History list
    renderWorkoutHistory();
    
    // Switch dynamically to Tab 3 (Analytics/Data Tab)
    const analyticsTabBtn = document.querySelector('.ios-bottom-nav .nav-tab[data-tab="analytics"]');
    if (analyticsTabBtn) {
      analyticsTabBtn.click();
    }
    
    // Trigger successful notification
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      triggerLocalNotification("אימון נשמר בהצלחה! 💪", "הנתונים שלך מוגנים ומאובטחים לצמיתות במכשיר.");
    }
  });
}

function cancelWorkoutSession() {
  if (activeTimerInterval) {
    clearInterval(activeTimerInterval);
    activeTimerInterval = null;
  }
  
  // Stop the rest timer on cancel
  if (typeof stopRestTimer === 'function') stopRestTimer();

  activeWorkout = null;
  if (currentUser) {
    SafeStorage.removeItem(`aura-active-workout_${currentUser.uid}`);
  }
  
  const activeView = document.getElementById('workout-active-view');
  const idleView = document.getElementById('workout-idle-view');
  if (activeView) activeView.classList.add('hide');
  if (idleView) {
    idleView.classList.add('active');
    idleView.classList.remove('hide');
  }
}

// Render Workout History list in Tab 3
function renderWorkoutHistory() {
  if (typeof renderAnalytics === 'function') {
    renderAnalytics();
  }
}

// Workout History Editor Modal system
const editModal = document.getElementById('workout-edit-modal');
const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
const saveEditedWorkoutBtn = document.getElementById('save-edited-workout-btn');
const deleteWorkoutBtn = document.getElementById('delete-workout-btn');

if (closeEditModalBtn && editModal) {
  closeEditModalBtn.addEventListener('click', () => {
    editModal.classList.add('hide');
    editingWorkout = null;
  });
  
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
      editModal.classList.add('hide');
      editingWorkout = null;
    }
  });
}

function openEditModal(workoutId) {
  const original = workoutHistory.find(w => w.id === workoutId);
  if (!original || !editModal) return;
  
  // Clone the workout object so modifications are staged
  editingWorkout = JSON.parse(JSON.stringify(original));
  
  // Load Meta Info
  const metaContainer = document.getElementById('modal-workout-meta');
  if (metaContainer) {
    const dateObj = new Date(editingWorkout.date);
    const dateText = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
    
    let durationText = '';
    if (editingWorkout.duration < 60) {
      durationText = 'פחות מדקה';
    } else if (editingWorkout.duration < 3600) {
      durationText = `${Math.floor(editingWorkout.duration / 60)} דקות`;
    } else {
      const hrs = Math.floor(editingWorkout.duration / 3600);
      const mins = Math.floor((editingWorkout.duration % 3600) / 60);
      durationText = `${hrs} שעות ו-${mins} דק׳`;
    }
    
    const dispName = editingWorkout.locationName || (editingWorkout.location === 'gym' ? 'חדר כושר' : 'פארק');
    const dispEmoji = editingWorkout.locationEmoji || (editingWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳');
    metaContainer.innerHTML = `
      <div>📍 <strong>${dispEmoji} ${dispName}</strong></div>
      <div>⏱️ משך: <strong>${durationText}</strong></div>
      <div>📅 תאריך: <strong>${dateText}</strong></div>
    `;
  }
  
  renderModalExercises();
  
  // Display Modal Panel
  editModal.classList.remove('hide');
}

function renderModalExercises() {
  const container = document.getElementById('modal-exercises-container');
  if (!container || !editingWorkout) return;
  
  container.innerHTML = '';
  
  editingWorkout.exercises.forEach((ex, exIdx) => {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.style.background = 'rgba(255, 255, 255, 0.03)';
    
    // Header
    const header = document.createElement('div');
    header.className = 'exercise-card-header';
    
    const titleContainer = document.createElement('div');
    titleContainer.className = 'exercise-title-container';
    
    const removeExBtn = document.createElement('button');
    removeExBtn.className = 'remove-exercise-btn';
    removeExBtn.innerHTML = '🗑️';
    removeExBtn.addEventListener('click', () => {
      editingWorkout.exercises.splice(exIdx, 1);
      renderModalExercises();
    });
    titleContainer.appendChild(removeExBtn);
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'exercise-name-input';
    nameInput.placeholder = 'שם התרגיל';
    nameInput.value = ex.name;
    nameInput.addEventListener('input', (e) => {
      ex.name = e.target.value;
    });
    titleContainer.appendChild(nameInput);
    header.appendChild(titleContainer);
    
    card.appendChild(header);
    
    // Sets list (LTR layout)
    const setsArea = document.createElement('div');
    setsArea.className = 'sets-area';
    
    const setsHeader = document.createElement('div');
    setsHeader.className = 'sets-header-row';
    setsHeader.innerHTML = `
      <div>מחק</div>
      <div>משקל</div>
      <div>חזרות</div>
      <div>סט</div>
    `;
    setsArea.appendChild(setsHeader);
    
    ex.sets.forEach((set, setIdx) => {
      const setRow = document.createElement('div');
      setRow.className = 'set-row completed'; // All saved/edited sets are fully unlocked in edit mode
      
      // Remove Set
      const removeSetBtn = document.createElement('button');
      removeSetBtn.className = 'remove-set-btn';
      removeSetBtn.innerHTML = '✕';
      removeSetBtn.addEventListener('click', () => {
        if (ex.sets.length > 1) {
          ex.sets.splice(setIdx, 1);
          renderModalExercises();
        } else {
          alert('תרגיל חייב להכיל לפחות סט אחד.');
        }
      });
      setRow.appendChild(removeSetBtn);
      
      // Weight
      const weightWrapper = document.createElement('div');
      weightWrapper.className = 'set-input-wrapper';
      const weightInput = document.createElement('input');
      weightInput.type = 'number';
      weightInput.className = 'set-input';
      weightInput.value = set.weight;
      weightInput.addEventListener('input', (e) => {
        set.weight = e.target.value;
      });
      weightWrapper.appendChild(weightInput);
      setRow.appendChild(weightWrapper);
      
      // Reps
      const repsWrapper = document.createElement('div');
      repsWrapper.className = 'set-input-wrapper';
      const repsInput = document.createElement('input');
      repsInput.type = 'number';
      repsInput.className = 'set-input';
      repsInput.value = set.reps;
      repsInput.addEventListener('input', (e) => {
        set.reps = e.target.value;
      });
      repsWrapper.appendChild(repsInput);
      setRow.appendChild(repsWrapper);
      
      // Set label
      const setLabelWrapper = document.createElement('div');
      setLabelWrapper.className = 'set-input-wrapper';
      const setLabel = document.createElement('span');
      setLabel.className = 'set-number-label';
      setLabel.textContent = String(setIdx + 1);
      setLabelWrapper.appendChild(setLabel);
      setRow.appendChild(setLabelWrapper);
      
      setsArea.appendChild(setRow);
    });
    
    // Add Set button in modal
    const addSetBtn = document.createElement('button');
    addSetBtn.className = 'add-set-btn';
    addSetBtn.textContent = '➕ הוסף סט';
    addSetBtn.addEventListener('click', () => {
      const lastSet = ex.sets[ex.sets.length - 1];
      ex.sets.push({
        reps: lastSet ? lastSet.reps : '',
        weight: lastSet ? lastSet.weight : '',
        completed: true
      });
      renderModalExercises();
    });
    setsArea.appendChild(addSetBtn);
    
    card.appendChild(setsArea);
    container.appendChild(card);
  });
  
  // Add Exercise button inside edit modal
  const addExBtn = document.createElement('button');
  addExBtn.className = 'btn btn-secondary';
  addExBtn.style.width = '100%';
  addExBtn.style.marginTop = '10px';
  addExBtn.textContent = '➕ הוסף תרגיל חדש';
  addExBtn.addEventListener('click', () => {
    editingWorkout.exercises.push({
      id: Date.now(),
      name: '',
      completed: true,
      sets: [{ reps: '', weight: '', completed: true }]
    });
    renderModalExercises();
  });
  container.appendChild(addExBtn);
}

// Save Edited Workout
if (saveEditedWorkoutBtn) {
  saveEditedWorkoutBtn.addEventListener('click', () => {
    if (!editingWorkout || !currentUser) return;
    
    // Validations
    if (editingWorkout.exercises.length === 0) {
      if (confirm('לא נותרו תרגילים באימון זה. האם ברצונך למחוק אותו לגמרי מההיסטוריה?')) {
        deleteWorkoutFromHistory(editingWorkout.id);
      }
      return;
    }
    
    for (let i = 0; i < editingWorkout.exercises.length; i++) {
      const ex = editingWorkout.exercises[i];
      if (!ex.name.trim()) {
        alert('אנא ודא שלכל התרגילים יש שם.');
        return;
      }
      
      // Filter out completely empty sets in edit mode for user convenience, or validate
      ex.sets = ex.sets.filter(s => {
        const hasReps = s.reps !== null && String(s.reps).trim() !== '' && Number(s.reps) > 0;
        const hasWeight = s.weight !== null && String(s.weight).trim() !== '' && Number(s.weight) >= 0;
        return hasReps || hasWeight;
      });
      
      if (ex.sets.length === 0) {
        alert(`התרגיל "${ex.name}" חייב להכיל לפחות סט אחד בעל ערכים תקינים.`);
        return;
      }
      
      // Mark all sets completed inside this edited workout log
      ex.sets.forEach(s => s.completed = true);
      ex.completed = true;
    }
    
    // Update main history array
    const originalIdx = workoutHistory.findIndex(w => w.id === editingWorkout.id);
    if (originalIdx !== -1) {
      workoutHistory[originalIdx] = editingWorkout;
      SafeStorage.setItem(`aura-workout-history_${currentUser.uid}`, JSON.stringify(workoutHistory));
      
      // UI refresh
      renderWorkoutHistory();
      
      // Close modal
      editModal.classList.add('hide');
      editingWorkout = null;
    }
  });
}

// Delete Workout from History
if (deleteWorkoutBtn) {
  deleteWorkoutBtn.addEventListener('click', () => {
    if (!editingWorkout) return;
    
    if (confirm('האם אתה בטוח שברצונך למחוק את האימון הזה לצמיתות מההיסטוריה? פעולה זו אינה ניתנת לביטול.')) {
      deleteWorkoutFromHistory(editingWorkout.id);
    }
  });
}

function deleteWorkoutFromHistory(workoutId) {
  if (!currentUser) return;
  
  workoutHistory = workoutHistory.filter(w => w.id !== workoutId);
  SafeStorage.setItem(`aura-workout-history_${currentUser.uid}`, JSON.stringify(workoutHistory));
  
  renderWorkoutHistory();
  
  if (editModal) editModal.classList.add('hide');
  editingWorkout = null;
}

// ==========================================================================
// AuraApp Redesigned Settings Tab Controller & iOS Interactive Logic
// ==========================================================================
function initPremiumSettings() {
  console.log("Initializing premium iOS Settings View...");

  const allTabs = document.querySelectorAll('.tab-content-container .tab-pane');
  const toggleDarkMode = document.getElementById('toggle-settings-dark-mode');
  const toggleNotifications = document.getElementById('toggle-settings-notifications');
  const settingsVer = document.getElementById('settings-system-version');
  const checkUpdateRow = document.getElementById('row-settings-check-update');
  const updateStatus = document.getElementById('settings-update-status');
  
  const isDarkMode = SafeStorage.getItem('settings_dark_mode') === 'true';
  const isNotificationsEnabled = SafeStorage.getItem('settings_notifications_enabled') !== 'false';

  allTabs.forEach(tab => {
    if (isDarkMode) {
      tab.classList.add('dark-theme');
    } else {
      tab.classList.remove('dark-theme');
    }
  });

  if (toggleDarkMode) {
    toggleDarkMode.checked = isDarkMode;
    toggleDarkMode.addEventListener('change', (e) => {
      SafeStorage.setItem('settings_dark_mode', e.target.checked);
      console.log('Saved settings dark mode active preference:', e.target.checked);
      allTabs.forEach(tab => {
        if (e.target.checked) {
          tab.classList.add('dark-theme');
        } else {
          tab.classList.remove('dark-theme');
        }
      });
    });
  }

  if (toggleNotifications) {
    toggleNotifications.checked = isNotificationsEnabled;
    toggleNotifications.addEventListener('change', (e) => {
      SafeStorage.setItem('settings_notifications_enabled', e.target.checked);
      console.log('Saved notifications active preference:', e.target.checked);
    });
  }

  // Initialize version row value to match current badge version
  if (settingsVer) {
    const mainBadge = document.getElementById('app-version-display');
    if (mainBadge && mainBadge.textContent) {
      settingsVer.textContent = mainBadge.textContent;
    } else {
      settingsVer.textContent = 'v1.2';
    }
  }

  // Manual update checking trigger row listener
  if (checkUpdateRow && updateStatus) {
    checkUpdateRow.addEventListener('click', async (e) => {
      // Prevent running if we are currently clicking the dynamic update button
      if (e.target.id === 'settings-update-now-btn') return;
      if (checkUpdateRow.classList.contains('checking')) return;

      checkUpdateRow.classList.add('checking');
      updateStatus.innerHTML = 'בודק... <span class="ios-spinner"></span>';
      
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            // Trigger Service Worker checking
            await reg.update();
            
            // Wait a tiny bit (1.5 seconds) for any statechange / updatefound events to process
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const newWorker = reg.waiting || reg.installing;
            if (newWorker) {
              showUpdateStateInSettings(newWorker);
            } else {
              // No update found
              updateStatus.textContent = 'מעודכן ✓';
              updateStatus.style.color = '#34c759'; // iOS Green
              setTimeout(() => {
                updateStatus.textContent = 'בדוק';
                updateStatus.style.color = '';
                checkUpdateRow.classList.remove('checking');
              }, 3000);
            }
          } else {
            updateStatus.textContent = 'לא נתמך';
            checkUpdateRow.classList.remove('checking');
          }
        } catch (err) {
          console.error('Manual PWA update check failed:', err);
          updateStatus.textContent = 'שגיאה ⚠️';
          setTimeout(() => {
            updateStatus.textContent = 'בדוק';
            checkUpdateRow.classList.remove('checking');
          }, 3000);
        }
      } else {
        updateStatus.textContent = 'לא נתמך';
        checkUpdateRow.classList.remove('checking');
      }
    });
  }

  // Proactively check if there's already a waiting worker on load
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting) {
        showUpdateStateInSettings(reg.waiting);
      }
    });
  }
}

// Invoke the premium settings view initializer on window load and dynamic transitions
onDOMReady(initPremiumSettings);


// ==========================================================================
// 19. PREMIUM REST TIMER SYSTEM
// ==========================================================================
function startRestTimer(seconds = 90) {
  // Clear any existing rest timer
  stopRestTimer();

  restTimerSecondsLeft = seconds;
  const bubble = document.getElementById('rest-timer-bubble');

  if (bubble) {
    bubble.classList.remove('hide');
    bubble.classList.remove('expired');
  }

  updateRestTimerUI();

  restTimerInterval = setInterval(() => {
    restTimerSecondsLeft--;
    if (restTimerSecondsLeft <= 0) {
      restTimerSecondsLeft = 0;
      updateRestTimerUI();
      handleRestTimerExpiration();
    } else {
      updateRestTimerUI();
    }
  }, 1000);
}

function stopRestTimer() {
  if (restTimerInterval) {
    clearInterval(restTimerInterval);
    restTimerInterval = null;
  }
  const bubble = document.getElementById('rest-timer-bubble');
  if (bubble) {
    bubble.classList.add('hide');
    bubble.classList.remove('expired');
  }
}

function updateRestTimerUI() {
  const countdownDisplay = document.getElementById('rest-timer-countdown');
  if (!countdownDisplay) return;

  const mins = Math.floor(restTimerSecondsLeft / 60);
  const secs = restTimerSecondsLeft % 60;
  countdownDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function handleRestTimerExpiration() {
  if (restTimerInterval) {
    clearInterval(restTimerInterval);
    restTimerInterval = null;
  }

  const bubble = document.getElementById('rest-timer-bubble');
  if (bubble) {
    bubble.classList.add('expired');
  }

  // Trigger Local Notification
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    triggerLocalNotification("המנוחה נגמרה! ⏱️💪", "הגיע הזמן לסט הבא. קדימה, לעבודה!");
  }

  // Support mobile haptic vibration
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
}

// Bind Rest Timer controls
onDOMReady(() => {
  const closeBtn = document.getElementById('close-rest-timer-btn');
  const plus30Btn = document.getElementById('rest-timer-plus-30');
  const minus30Btn = document.getElementById('rest-timer-minus-30');

  if (closeBtn) {
    closeBtn.addEventListener('click', stopRestTimer);
  }

  if (plus30Btn) {
    plus30Btn.addEventListener('click', () => {
      restTimerSecondsLeft += 30;
      // If it was expired or stopped, revive it
      if (restTimerSecondsLeft > 0 && !restTimerInterval) {
        const bubble = document.getElementById('rest-timer-bubble');
        if (bubble) bubble.classList.remove('expired');
        
        restTimerInterval = setInterval(() => {
          restTimerSecondsLeft--;
          if (restTimerSecondsLeft <= 0) {
            restTimerSecondsLeft = 0;
            updateRestTimerUI();
            handleRestTimerExpiration();
          } else {
            updateRestTimerUI();
          }
        }, 1000);
      }
      updateRestTimerUI();
    });
  }

  if (minus30Btn) {
    minus30Btn.addEventListener('click', () => {
      restTimerSecondsLeft = Math.max(0, restTimerSecondsLeft - 30);
      updateRestTimerUI();
      if (restTimerSecondsLeft === 0) {
        handleRestTimerExpiration();
      }
    });
  }
});

// Bind Set Logging Modal controls & Micro-adjustments
onDOMReady(() => {
  const setLogModal = document.getElementById('set-log-modal');
  const weightSlider = document.getElementById('weight-range-slider');
  const weightValueText = document.getElementById('weight-slider-value');
  const repsSlider = document.getElementById('reps-range-slider');
  const repsValueText = document.getElementById('reps-slider-value');

  const weightMinusBtn = document.getElementById('weight-minus-btn');
  const weightPlusBtn = document.getElementById('weight-plus-btn');
  const repsMinusBtn = document.getElementById('reps-minus-btn');
  const repsPlusBtn = document.getElementById('reps-plus-btn');

  const confirmSetBtn = document.getElementById('set-log-confirm-btn');
  const cancelSetBtn = document.getElementById('set-log-cancel-btn');

  // Slider change listeners
  if (weightSlider && weightValueText) {
    weightSlider.addEventListener('input', () => {
      weightValueText.textContent = weightSlider.value;
    });
  }
  if (repsSlider && repsValueText) {
    repsSlider.addEventListener('input', () => {
      repsValueText.textContent = repsSlider.value;
    });
  }

  // Weight micro-adjustments (- / + 2.5 kg)
  if (weightMinusBtn && weightSlider && weightValueText) {
    weightMinusBtn.addEventListener('click', () => {
      let val = parseFloat(weightSlider.value) || 0;
      val = Math.max(0, val - 2.5);
      weightSlider.value = val;
      weightValueText.textContent = val;
    });
  }
  if (weightPlusBtn && weightSlider && weightValueText) {
    weightPlusBtn.addEventListener('click', () => {
      let val = parseFloat(weightSlider.value) || 0;
      val = Math.min(250, val + 2.5);
      weightSlider.value = val;
      weightValueText.textContent = val;
    });
  }

  // Reps micro-adjustments (- / + 1 rep)
  if (repsMinusBtn && repsSlider && repsValueText) {
    repsMinusBtn.addEventListener('click', () => {
      let val = parseInt(repsSlider.value, 10) || 0;
      val = Math.max(0, val - 1);
      repsSlider.value = val;
      repsValueText.textContent = val;
    });
  }
  if (repsPlusBtn && repsSlider && repsValueText) {
    repsPlusBtn.addEventListener('click', () => {
      let val = parseInt(repsSlider.value, 10) || 0;
      val = Math.min(50, val + 1);
      repsSlider.value = val;
      repsValueText.textContent = val;
    });
  }

  // Backdrop click close for Set Logging Modal
  if (setLogModal) {
    setLogModal.addEventListener('click', (e) => {
      if (e.target === setLogModal) {
        setLogModal.classList.add('hide');
        currentLoggingExercise = null;
        currentLoggingSetIndex = -1;
      }
    });
  }

  // Save/Confirm action
  if (confirmSetBtn) {
    confirmSetBtn.addEventListener('click', () => {
      if (!currentLoggingExercise) return;

      const metricType = currentLoggingExercise.metricType || 'both';
      let repsVal = '';
      let weightVal = '';

      if (metricType === 'both' || metricType === 'reps') {
        repsVal = repsSlider ? repsSlider.value : '10';
      }
      if (metricType === 'both' || metricType === 'weight') {
        weightVal = weightSlider ? weightSlider.value : '60';
      }

      const loggedSet = {
        reps: repsVal,
        weight: weightVal,
        completed: true
      };

      if (!currentLoggingExercise.sets) {
        currentLoggingExercise.sets = [];
      }

      // Filter out any incomplete draft sets to avoid trailing blank set rows
      currentLoggingExercise.sets = currentLoggingExercise.sets.filter(s => s.completed);

      // Insert new completed set
      currentLoggingExercise.sets.push(loggedSet);

      saveActiveWorkoutState();

      // Close modal
      if (setLogModal) setLogModal.classList.add('hide');

      // Trigger dynamic rest timer
      const restSeconds = currentLoggingExercise.restTime || 90;
      if (typeof startRestTimer === 'function') {
        startRestTimer(restSeconds);
      }

      // Reset references
      currentLoggingExercise = null;
      currentLoggingSetIndex = -1;

      // Re-render
      renderExercises();
    });
  }

  // Cancel action
  if (cancelSetBtn) {
    cancelSetBtn.addEventListener('click', () => {
      if (setLogModal) setLogModal.classList.add('hide');
      currentLoggingExercise = null;
      currentLoggingSetIndex = -1;
    });
  }
});

// Helper function to launch the Set Logging modal
function openSetLoggingModal(ex, exIdx) {
  currentLoggingExercise = ex;
  currentLoggingExerciseIndex = exIdx;

  const nextIncompleteIdx = ex.sets.findIndex(s => !s.completed);
  currentLoggingSetIndex = nextIncompleteIdx !== -1 ? nextIncompleteIdx : ex.sets.length;

  // Set header details
  const nameDisplay = document.getElementById('set-log-exercise-name');
  const setNumDisplay = document.getElementById('set-log-set-number');
  if (nameDisplay) nameDisplay.textContent = ex.name;
  if (setNumDisplay) setNumDisplay.textContent = `סט ${currentLoggingSetIndex + 1}`;

  // Toggle visible slider rows based on metricType
  const weightGroup = document.getElementById('set-log-weight-group');
  const repsGroup = document.getElementById('set-log-reps-group');
  const metricType = ex.metricType || 'both';

  // Use CSS class (.slider-group-hidden) rather than inline style.display,
  // because .slider-group-container has display:flex !important in CSS
  if (weightGroup) {
    if (metricType === 'reps') {
      weightGroup.classList.add('slider-group-hidden');
    } else {
      weightGroup.classList.remove('slider-group-hidden');
    }
  }
  if (repsGroup) {
    if (metricType === 'weight') {
      repsGroup.classList.add('slider-group-hidden');
    } else {
      repsGroup.classList.remove('slider-group-hidden');
    }
  }

  // Determine standard baseline values based on last completed set or sensible defaults
  const completedSets = ex.sets.filter(s => s.completed);
  const previousSet = completedSets[completedSets.length - 1];

  let initialWeight = 60;
  let initialReps = 10;

  if (previousSet) {
    initialWeight = parseFloat(previousSet.weight) || 60;
    initialReps = parseInt(previousSet.reps, 10) || 10;
  }

  // Apply inputs and update display texts
  const weightSlider = document.getElementById('weight-range-slider');
  const weightValueText = document.getElementById('weight-slider-value');
  const repsSlider = document.getElementById('reps-range-slider');
  const repsValueText = document.getElementById('reps-slider-value');

  if (weightSlider) {
    weightSlider.value = initialWeight;
    if (weightValueText) weightValueText.textContent = initialWeight;
  }
  if (repsSlider) {
    repsSlider.value = initialReps;
    if (repsValueText) repsValueText.textContent = initialReps;
  }

  // Open modal view
  const setLogModal = document.getElementById('set-log-modal');
  if (setLogModal) {
    setLogModal.classList.remove('hide');
  }
}


// ==========================================================================
// 20. PREMIUM WORKOUTS & METRICS EXTENSIONS
// ==========================================================================

// Global settings for Analytics Tab
let filterTimeSelection = 'all';
let filterStartDate = null;
let filterEndDate = null;
let filterLocation = 'all';
let filterMuscleGroup = 'all';
let selectedAnalyticsExercise = null;
let activeChartType = '1rm'; // '1rm', 'weight', 'volume'
let activeAnalyticsView = 'calendar'; // 'calendar', 'heatmap', 'split', 'list'
let activeAnalyticsSegment = 'overview';
let activeLogsSubView = 'calendar';
let currentCalendarDate = new Date();

// Hebrew Quotes for Rest Timer Screen
const HEBREW_QUOTES = [
  "אין קיצורי דרך למקומות ששווה להגיע אליהם! 🔥",
  "כל חזרה מקרבת אותך לגרסה הטובה ביותר של עצמך. 💪",
  "הכאב של היום הוא הכוח של מחר! ⚡",
  "אל תפסיק כשזה קשה, תפסיק כשסיימת. 🏆",
  "המשמעת העצמית שלך היא המפתח לברזל! 🏋️‍♂️",
  "אתה נלחם נגד עצמך של אתמול, לא נגד אף אחד אחר. 🌟",
  "הפוך את התירוצים שלך לתוצאות בקצה הברזל! 🔥",
  "המנוחה מכינה אותך לסט המושלם הבא. תתרכז! 🎯"
];

// Circular progress variable
let restTimerTotalDuration = 90;

// Override startRestTimer to handle premium circular animation, quotes, and total duration tracking
const originalStartRestTimer = startRestTimer;
startRestTimer = function(seconds = 90) {
  restTimerTotalDuration = seconds;
  restTimerSecondsLeft = seconds;

  // Clear existing
  if (restTimerInterval) {
    clearInterval(restTimerInterval);
    restTimerInterval = null;
  }

  const bubble = document.getElementById('rest-timer-bubble');
  if (bubble) {
    bubble.classList.remove('hide');
    bubble.classList.remove('expired');
  }

  // Display a random motivational quote
  const quoteEl = document.getElementById('rest-timer-quote');
  if (quoteEl) {
    const randIdx = Math.floor(Math.random() * HEBREW_QUOTES.length);
    quoteEl.textContent = `"${HEBREW_QUOTES[randIdx]}"`;
  }

  updateRestTimerUI();

  restTimerInterval = setInterval(() => {
    restTimerSecondsLeft--;
    if (restTimerSecondsLeft <= 0) {
      restTimerSecondsLeft = 0;
      updateRestTimerUI();
      handleRestTimerExpiration();
    } else {
      updateRestTimerUI();
    }
  }, 1000);
};

// Override updateRestTimerUI to update SVG circular progress
const originalUpdateRestTimerUI = updateRestTimerUI;
updateRestTimerUI = function() {
  const countdownDisplay = document.getElementById('rest-timer-countdown');
  if (!countdownDisplay) return;

  const mins = Math.floor(restTimerSecondsLeft / 60);
  const secs = restTimerSecondsLeft % 60;
  countdownDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  // Update SVG Circular Indicator
  const progressCircle = document.getElementById('rest-timer-progress-circle');
  if (progressCircle) {
    const pct = restTimerTotalDuration > 0 ? restTimerSecondsLeft / restTimerTotalDuration : 0;
    // Circular length is 283 (approx 2 * Math.PI * 45)
    const offset = Math.max(0, Math.min(283, 283 * (1 - pct)));
    progressCircle.style.strokeDashoffset = offset;
  }
};

// Adjust rest timer control bindings
onDOMReady(() => {
  const plus30 = document.getElementById('rest-timer-plus-30');
  const minus30 = document.getElementById('rest-timer-minus-30');

  if (plus30) {
    plus30.addEventListener('click', (e) => {
      restTimerTotalDuration = Math.max(restTimerTotalDuration, restTimerSecondsLeft);
      updateRestTimerUI();
    });
  }
  if (minus30) {
    minus30.addEventListener('click', (e) => {
      updateRestTimerUI();
    });
  }
});

// A. Previous Workout Performance Alert popup
function checkAndShowPreviousPerformance(exerciseName) {
  if (!workoutHistory || workoutHistory.length === 0) return;

  // Find the last completed training session containing this exercise (latest first)
  const sorted = [...workoutHistory].sort((a, b) => b.date - a.date);
  const prevWorkout = sorted.find(w => w.exercises && w.exercises.some(ex => ex.name === exerciseName && ex.sets && ex.sets.some(s => s.completed)));
  if (!prevWorkout) return;

  const prevEx = prevWorkout.exercises.find(ex => ex.name === exerciseName);
  if (!prevEx) return;

  const completedSets = prevEx.sets.filter(s => s.completed);
  if (completedSets.length === 0) return;

  // Set popup text
  const titleEl = document.getElementById('prev-workout-alert-title');
  const dateEl = document.getElementById('prev-workout-alert-date');
  const container = document.getElementById('prev-workout-alert-sets');

  if (titleEl) titleEl.textContent = exerciseName;
  if (dateEl) {
    const dateObj = new Date(prevWorkout.date);
    const dateStr = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const locationStr = prevWorkout.locationName || (prevWorkout.location === 'gym' ? 'חדר כושר' : 'פארק');
    const emoji = prevWorkout.locationEmoji || (prevWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳');
    dateEl.textContent = `אימון אחרון (${emoji} ${locationStr}): ${dateStr}`;
  }

  if (container) {
    container.innerHTML = '';
    completedSets.forEach((s, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 6px; font-size: 0.9rem; color: #ffffff;';
      
      let valText = '';
      if (prevEx.metricType === 'both') {
        valText = `<strong>${s.weight} ק״ג</strong> × <strong>${s.reps} חזרות</strong>`;
      } else if (prevEx.metricType === 'weight') {
        valText = `<strong>${s.weight} ק״ג</strong>`;
      } else {
        valText = `<strong>${s.reps} חזרות</strong>`;
      }

      row.innerHTML = `
        <span style="font-weight: 700; color: #ef4444;">סט ${idx + 1}</span>
        <span style="direction: ltr;">${valText}</span>
      `;
      container.appendChild(row);
    });
  }

  // Show the alert modal
  const modal = document.getElementById('prev-workout-alert-modal');
  if (modal) modal.classList.remove('hide');
}

// Bind Previous Performance Alert buttons
onDOMReady(() => {
  const modal = document.getElementById('prev-workout-alert-modal');
  const closeBtn = document.getElementById('close-prev-workout-alert-btn');
  const okBtn = document.getElementById('prev-workout-alert-ok-btn');

  const dismiss = () => {
    if (modal) modal.classList.add('hide');
  };

  if (closeBtn) closeBtn.addEventListener('click', dismiss);
  if (okBtn) okBtn.addEventListener('click', dismiss);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) dismiss();
    });
  }
});

// B. Plate Calculator
function calculatePlates(targetWeight) {
  const displayTarget = document.getElementById('plate-calc-target-weight');
  if (displayTarget) displayTarget.textContent = targetWeight;

  const stack = document.getElementById('plates-stack-left');
  const list = document.getElementById('plates-list-needed');

  if (stack) stack.innerHTML = '';
  if (list) list.innerHTML = '';

  const bar = 20;
  if (targetWeight <= bar) {
    if (list) list.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">מוט ריק בלבד (20 ק״ג) 🏋️‍♂️</span>';
    return;
  }

  let weightPerSide = (targetWeight - bar) / 2;
  const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
  const needed = [];

  let temp = weightPerSide;
  for (const p of plates) {
    const count = Math.floor(temp / p);
    if (count > 0) {
      needed.push({ weight: p, count: count });
      temp = Math.round((temp - p * count) * 100) / 100;
    }
  }

  if (needed.length === 0) {
    if (list) list.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">אין שילוב פלטות מתאים</span>';
    return;
  }

  // Display list chips
  needed.forEach(item => {
    const chip = document.createElement('span');
    chip.className = 'plate-chip';
    chip.textContent = `${item.weight} ק״ג × ${item.count}`;
    if (list) list.appendChild(chip);
  });

  // Render visual stack on barbell rod sleeve
  const colors = {
    25: '#dc2626', // Molten red
    20: '#2563eb', // Heavy blue
    15: '#eab308', // Gold yellow
    10: '#16a34a', // Forest green
    5: '#94a3b8',  // Sleek silver
    2.5: '#475569', // Iron charcoal
    1.25: '#1e293b' // Micro steel
  };

  const heights = { 25: 86, 20: 80, 15: 72, 10: 62, 5: 50, 2.5: 42, 1.25: 34 };
  const widths = { 25: 18, 20: 16, 15: 14, 10: 12, 5: 10, 2.5: 8, 1.25: 6 };

  needed.forEach(item => {
    for (let i = 0; i < item.count; i++) {
      const plate = document.createElement('div');
      const h = heights[item.weight] || 40;
      const w = widths[item.weight] || 8;
      const c = colors[item.weight] || '#ffffff';

      plate.style.cssText = `
        width: ${w}px;
        height: ${h}px;
        background: ${c};
        border-radius: 4px;
        box-shadow: 0 0 8px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.25);
        border: 1px solid rgba(0, 0, 0, 0.4);
        transition: transform 0.2s ease;
      `;
      plate.title = `${item.weight} ק״ג`;
      if (stack) stack.appendChild(plate);
    }
  });
}

// Bind Barbell Plate Calculator trigger & close
onDOMReady(() => {
  const trigger = document.getElementById('trigger-plate-calc-btn');
  const modal = document.getElementById('plate-calculator-modal');
  const close = document.getElementById('close-plate-calc-btn');

  if (trigger && modal) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const slider = document.getElementById('weight-range-slider');
      const target = slider ? parseFloat(slider.value) || 60 : 60;
      calculatePlates(target);
      modal.classList.remove('hide');
    });
  }

  const dismiss = () => {
    if (modal) modal.classList.add('hide');
  };

  if (close) close.addEventListener('click', dismiss);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) dismiss();
    });
  }
});

// C. Metrics Tab Rendering and Event Listeners
function initAnalyticsTab() {
  console.log("Initializing premium Analytics Dashboard controllers...");

  // 1. Collapsible Filters panel drawer toggle
  const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
  const collapsibleFiltersContainer = document.getElementById('collapsible-filters-container');
  if (toggleFiltersBtn && collapsibleFiltersContainer) {
    toggleFiltersBtn.addEventListener('click', () => {
      const isExpanded = collapsibleFiltersContainer.classList.toggle('expanded');
      toggleFiltersBtn.classList.toggle('expanded', isExpanded);
    });
  }

  // 2. iOS Segmented Control Selector Navigation
  const segmentBtns = document.querySelectorAll('#tab-analytics .segment-btn');
  const segmentedControl = document.querySelector('#tab-analytics .segmented-control');
  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      segmentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const segment = btn.dataset.segment;
      activeAnalyticsSegment = segment;
      if (segmentedControl) {
        segmentedControl.setAttribute('data-active', segment);
      }

      // Toggle active panes
      const panes = document.querySelectorAll('#tab-analytics .analytics-segment-pane');
      panes.forEach(pane => {
        pane.classList.remove('active');
      });
      const activePane = document.getElementById(`segment-${segment}-pane`);
      if (activePane) activePane.classList.add('active');

      // Trigger lazy rendering
      renderAnalytics();
    });
  });

  // 3. Compact Switcher inside Log Book Pane
  const logsSwitchBtns = document.querySelectorAll('#tab-analytics .logs-switch-btn');
  logsSwitchBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      logsSwitchBtns.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = 'var(--text-muted)';
      });
      btn.classList.add('active');
      btn.style.background = 'var(--electric-blue-light)';
      btn.style.color = '#fff';

      const subview = btn.dataset.subview;
      activeLogsSubView = subview;

      const calendarView = document.getElementById('analytics-calendar-view');
      const historyListView = document.getElementById('analytics-history-list-view');

      if (subview === 'calendar') {
        if (calendarView) calendarView.classList.remove('hide');
        if (historyListView) historyListView.classList.add('hide');
        renderCalendarView();
      } else {
        if (calendarView) calendarView.classList.add('hide');
        if (historyListView) historyListView.classList.remove('hide');
        renderAccordionHistoryView();
      }
    });
  });

  // Quick Time filter chips
  const chips = document.querySelectorAll('#tab-analytics .filter-chip');
  const customDateInputs = document.getElementById('custom-date-inputs');

  chips.forEach(c => {
    c.addEventListener('click', () => {
      chips.forEach(x => x.classList.remove('active'));
      c.classList.add('active');

      filterTimeSelection = c.dataset.time;

      if (filterTimeSelection === 'custom') {
        if (customDateInputs) customDateInputs.style.display = 'flex';
      } else {
        if (customDateInputs) customDateInputs.style.display = 'none';
      }

      renderAnalytics();
    });
  });

  // Custom date selection inputs
  const startD = document.getElementById('filter-start-date');
  const endD = document.getElementById('filter-end-date');

  const onDateChange = () => {
    filterStartDate = startD && startD.value ? new Date(startD.value) : null;
    filterEndDate = endD && endD.value ? new Date(endD.value) : null;
    renderAnalytics();
  };

  if (startD) startD.addEventListener('change', onDateChange);
  if (endD) endD.addEventListener('change', onDateChange);

  // Dropdown filter triggers
  const locationSelect = document.getElementById('filter-location-select');
  const muscleSelect = document.getElementById('filter-muscle-select');

  if (locationSelect) {
    locationSelect.addEventListener('change', () => {
      filterLocation = locationSelect.value;
      renderAnalytics();
    });
  }

  if (muscleSelect) {
    muscleSelect.addEventListener('change', () => {
      filterMuscleGroup = muscleSelect.value;
      renderAnalytics();
    });
  }

  // Autocomplete suggestions searchable exercise picker
  const searchInput = document.getElementById('analytics-exercise-search');
  const dropdown = document.getElementById('analytics-suggestions-dropdown');
  const clearBtn = document.getElementById('clear-dashboard-btn');

  if (searchInput && dropdown) {
    searchInput.addEventListener('input', () => {
      const val = searchInput.value.trim().toLowerCase();
      if (!val) {
        dropdown.classList.add('hide');
        return;
      }

      // Collect all exercises from history and standard lists
      const set = new Set();
      if (typeof exercisesList !== 'undefined') {
        exercisesList.forEach(e => set.add(e.name));
      }
      workoutHistory.forEach(w => {
        if (w.exercises) w.exercises.forEach(e => set.add(e.name));
      });

      const matches = Array.from(set).filter(name => name.toLowerCase().includes(val));

      if (matches.length === 0) {
        dropdown.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: right; direction: rtl;">לא נמצאו תרגילים מתאימים</div>';
      } else {
        dropdown.innerHTML = '';
        matches.slice(0, 5).forEach(name => {
          const item = document.createElement('div');
          item.className = 'suggestion-item';
          item.style.cssText = 'padding: 10px 14px; color: #fff; font-size: 0.9rem; font-weight: 600; cursor: pointer; text-align: right; direction: rtl; border-bottom: 1px solid rgba(255,255,255,0.03);';
          item.textContent = name;
          item.addEventListener('click', () => {
            selectedAnalyticsExercise = name;
            searchInput.value = name;
            dropdown.classList.add('hide');

            // Open dashboard
            const db = document.getElementById('analytics-exercise-dashboard');
            const dbName = document.getElementById('dashboard-exercise-name');
            if (db) db.classList.remove('hide');
            if (dbName) dbName.textContent = name;

            renderExerciseAnalyticsDashboard();
          });
          dropdown.appendChild(item);
        });
      }
      dropdown.classList.remove('hide');
    });

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
      if (e.target !== searchInput && e.target !== dropdown) {
        dropdown.classList.add('hide');
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      selectedAnalyticsExercise = null;
      if (searchInput) searchInput.value = '';
      const db = document.getElementById('analytics-exercise-dashboard');
      if (db) db.classList.add('hide');
    });
  }

  // Chart Switcher tabs listener
  const chartTabs = document.querySelectorAll('#tab-analytics .chart-tab');
  chartTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      chartTabs.forEach(x => x.classList.remove('active'));
      tab.classList.add('active');

      activeChartType = tab.dataset.chart;
      renderExerciseAnalyticsDashboard();
    });
  });

  // Calendar month navigation
  const prevMonthBtn = document.getElementById('calendar-prev-month');
  const nextMonthBtn = document.getElementById('calendar-next-month');

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      renderCalendarView();
    });
  }
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      renderCalendarView();
    });
  }

  // Future Workout Scheduling Controls
  const scheduleTriggerBtn = document.getElementById('schedule-workout-trigger-btn');
  const scheduleModal = document.getElementById('schedule-workout-modal');
  const closeScheduleBtn = document.getElementById('close-schedule-workout-btn');
  const scheduleForm = document.getElementById('schedule-workout-form');
  const scheduleLocationSelect = document.getElementById('schedule-location-select');
  const scheduleCustomLocation = document.getElementById('schedule-custom-location');

  if (scheduleTriggerBtn && scheduleModal) {
    scheduleTriggerBtn.addEventListener('click', () => {
      // Safely request permission
      requestNotificationPermissionSafely();
      
      scheduleModal.classList.remove('hide');
      scheduleModal.style.display = 'flex';
      
      // Auto fill today's date
      const todayStr = new Date().toISOString().split('T')[0];
      const dateInput = document.getElementById('schedule-date');
      if (dateInput) dateInput.value = todayStr;
    });
  }

  if (closeScheduleBtn && scheduleModal) {
    closeScheduleBtn.addEventListener('click', () => {
      scheduleModal.classList.add('hide');
      scheduleModal.style.display = 'none';
    });
  }

  if (scheduleLocationSelect && scheduleCustomLocation) {
    scheduleLocationSelect.addEventListener('change', () => {
      if (scheduleLocationSelect.value === 'custom') {
        scheduleCustomLocation.style.display = 'block';
        scheduleCustomLocation.setAttribute('required', 'true');
      } else {
        scheduleCustomLocation.style.display = 'none';
        scheduleCustomLocation.removeAttribute('required');
      }
    });
  }

  if (scheduleForm && scheduleModal) {
    scheduleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const locVal = scheduleLocationSelect.value;
      let finalLoc = '';
      let emoji = '🏋️‍♂️';

      if (locVal === 'custom') {
        finalLoc = scheduleCustomLocation.value.trim();
        emoji = '✨';
      } else if (locVal === 'gym') {
        finalLoc = 'חדר כושר';
        emoji = '🏋️‍♂️';
      } else if (locVal === 'park') {
        finalLoc = 'פארק';
        emoji = '🌳';
      }

      const dateVal = document.getElementById('schedule-date').value;
      const timeVal = document.getElementById('schedule-time').value;
      const reminderSelect = document.getElementById('schedule-reminder-select');
      const reminderMinutes = parseInt(reminderSelect.value, 10);

      if (!finalLoc || !dateVal || !timeVal) {
        alert("נא למלא את כל השדות החיוניים");
        return;
      }

      const newFutureWorkout = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        location: finalLoc,
        locationEmoji: emoji,
        date: dateVal,
        time: timeVal,
        reminderMinutes: reminderMinutes,
        reminderSent: false
      };

      const currentFutures = getFutureWorkouts();
      currentFutures.push(newFutureWorkout);
      saveFutureWorkouts(currentFutures);

      // Close modal
      scheduleModal.classList.add('hide');
      scheduleModal.style.display = 'none';

      // Reset form
      scheduleForm.reset();
      if (scheduleCustomLocation) {
        scheduleCustomLocation.style.display = 'none';
        scheduleCustomLocation.removeAttribute('required');
      }

      // Proactively request permission again to ensure it is granted
      requestNotificationPermissionSafely();

      // Refresh Calendar
      renderCalendarView();

      alert(`אימון עתידי מסוג "${finalLoc}" מתוזמן בהצלחה! 🏋️‍♂️`);
    });
  }
}


// Orchestrator for tab refresh
function renderAnalytics() {
  console.log("Refreshing Analytics view with active filters...", activeSubTab);
  
  if (activeSubTab === 'workouts') {
    renderWorkoutsLog();
  } else if (activeSubTab === 'calendar') {
    if (typeof renderCalendarView === 'function') renderCalendarView();
    if (typeof renderMuscleSplitView === 'function') renderMuscleSplitView();
  } else if (activeSubTab === 'exercises') {
    if (typeof renderExercisesManager === 'function') renderExercisesManager();
  } else if (activeSubTab === 'ai') {
    console.log("Aura AI Coach segment active.");
  }
}

// Get history array filtered by advanced controls
function getFilteredHistory() {
  let result = [...workoutHistory];

  // Time Filter
  const now = new Date();
  if (filterTimeSelection === '7') {
    const limit = new Date();
    limit.setDate(now.getDate() - 7);
    result = result.filter(w => new Date(w.date) >= limit);
  } else if (filterTimeSelection === '30') {
    const limit = new Date();
    limit.setDate(now.getDate() - 30);
    result = result.filter(w => new Date(w.date) >= limit);
  } else if (filterTimeSelection === 'custom') {
    if (filterStartDate) {
      result = result.filter(w => new Date(w.date) >= filterStartDate);
    }
    if (filterEndDate) {
      const endLimit = new Date(filterEndDate);
      endLimit.setHours(23, 59, 59, 999);
      result = result.filter(w => new Date(w.date) <= endLimit);
    }
  }

  // Location Filter
  if (filterLocation !== 'all') {
    result = result.filter(w => w.location === filterLocation);
  }

  // Muscle Group Filter
  if (filterMuscleGroup !== 'all') {
    result = result.filter(w => {
      return w.exercises && w.exercises.some(ex => {
        let cat = 'אחר';
        if (typeof exercisesList !== 'undefined') {
          const matched = exercisesList.find(x => x.name === ex.name);
          if (matched) cat = matched.category || 'אחר';
        }
        return cat === filterMuscleGroup;
      });
    });
  }

  return result.sort((a, b) => b.date - a.date);
}

// Switch between views
function renderActiveVariationView() {
  // Bypassed in favor of premium lazy rendering
  renderAnalytics();
}

// D. Single Exercise progression Bezier SVG Chart Dashboard
function renderExerciseAnalyticsDashboard() {
  if (!selectedAnalyticsExercise) return;

  const filteredHistory = getFilteredHistory();
  const exerciseSessions = [];
  const chronological = [...filteredHistory].sort((a, b) => a.date - b.date);

  chronological.forEach(w => {
    if (!w.exercises) return;
    const ex = w.exercises.find(e => e.name === selectedAnalyticsExercise);
    if (ex && ex.sets && ex.sets.some(s => s.completed)) {
      exerciseSessions.push({
        date: new Date(w.date),
        sets: ex.sets.filter(s => s.completed),
        metricType: ex.metricType || 'both'
      });
    }
  });

  const chartSvg = document.getElementById('bezier-chart-svg');
  const noDataEl = document.getElementById('chart-no-data');
  const prEl = document.getElementById('dashboard-pr-value');
  const rmEl = document.getElementById('dashboard-1rm-value');
  const volEl = document.getElementById('dashboard-vol-value');

  if (!chartSvg) return;

  if (exerciseSessions.length === 0) {
    if (noDataEl) noDataEl.style.display = 'flex';
    if (prEl) prEl.textContent = '--';
    if (rmEl) rmEl.textContent = '--';
    if (volEl) volEl.textContent = '--';
    
    const areaPath = document.getElementById('chart-area-path');
    const linePath = document.getElementById('chart-line-path');
    const pointsGroup = document.getElementById('chart-points-group');
    const gridlines = document.getElementById('chart-gridlines');
    if (areaPath) areaPath.setAttribute('d', '');
    if (linePath) linePath.setAttribute('d', '');
    if (pointsGroup) pointsGroup.innerHTML = '';
    if (gridlines) gridlines.innerHTML = '';
    return;
  }

  if (noDataEl) noDataEl.style.display = 'none';

  let maxWeight = 0;
  let max1RM = 0;
  let totalVolume = 0;
  const points = [];

  exerciseSessions.forEach(session => {
    let sessionMaxWeight = 0;
    let sessionMax1RM = 0;
    let sessionVolume = 0;

    session.sets.forEach(s => {
      const w = parseFloat(s.weight) || 0;
      const r = parseInt(s.reps, 10) || 0;

      if (w > sessionMaxWeight) sessionMaxWeight = w;
      const oneRM = r === 1 ? w : w * (1 + r / 30);
      if (oneRM > sessionMax1RM) sessionMax1RM = oneRM;
      sessionVolume += (w * r);
    });

    totalVolume += sessionVolume;
    if (sessionMaxWeight > maxWeight) maxWeight = sessionMaxWeight;
    if (sessionMax1RM > max1RM) max1RM = sessionMax1RM;

    let yValue = 0;
    if (activeChartType === '1rm') {
      yValue = sessionMax1RM;
    } else if (activeChartType === 'weight') {
      yValue = sessionMaxWeight;
    } else {
      yValue = sessionVolume;
    }

    points.push({
      date: session.date,
      value: yValue
    });
  });

  if (prEl) prEl.textContent = `${maxWeight} ק״ג`;
  if (rmEl) rmEl.textContent = `${Math.round(max1RM)} ק״ג`;
  if (volEl) volEl.textContent = `${totalVolume.toLocaleString()} ק״ג`;

  const width = chartSvg.clientWidth || 320;
  const height = chartSvg.clientHeight || 160;

  const paddingX = 30;
  const paddingY = 20;

  const minVal = Math.min(...points.map(p => p.value)) * 0.9;
  const maxVal = Math.max(...points.map(p => p.value)) * 1.1 || 100;
  const valRange = (maxVal - minVal) || 1;

  const svgCoords = points.map((p, idx) => {
    const x = points.length > 1 
      ? paddingX + (idx / (points.length - 1)) * (width - 2 * paddingX)
      : width / 2;
    const y = height - paddingY - ((p.value - minVal) / valRange) * (height - 2 * paddingY);
    return { x, y, val: p.value, date: p.date };
  });

  let dLine = '';
  let dArea = '';

  if (svgCoords.length === 1) {
    const c = svgCoords[0];
    dLine = `M ${c.x - 10} ${c.y} L ${c.x + 10} ${c.y}`;
    dArea = `M ${c.x - 10} ${c.y} L ${c.x + 10} ${c.y} L ${c.x + 10} ${height} L ${c.x - 10} ${height} Z`;
  } else {
    dLine = `M ${svgCoords[0].x} ${svgCoords[0].y}`;
    for (let i = 0; i < svgCoords.length - 1; i++) {
      const curr = svgCoords[i];
      const next = svgCoords[i + 1];
      const cpX1 = curr.x + (next.x - curr.x) / 3;
      const cpY1 = curr.y;
      const cpX2 = curr.x + 2 * (next.x - curr.x) / 3;
      const cpY2 = next.y;
      dLine += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
    }
    dArea = dLine + ` L ${svgCoords[svgCoords.length - 1].x} ${height} L ${svgCoords[0].x} ${height} Z`;
  }

  const areaPath = document.getElementById('chart-area-path');
  const linePath = document.getElementById('chart-line-path');
  const pointsGroup = document.getElementById('chart-points-group');
  const gridlines = document.getElementById('chart-gridlines');

  if (areaPath) areaPath.setAttribute('d', dArea);
  if (linePath) {
    linePath.setAttribute('d', dLine);
    linePath.style.stroke = 'var(--electric-blue-light)';
    linePath.style.strokeWidth = '3';
    linePath.style.fill = 'none';
  }

  if (gridlines) {
    gridlines.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const y = paddingY + (i / 2) * (height - 2 * paddingY);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y);
      line.setAttribute('x2', width);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(255, 255, 255, 0.05)');
      line.setAttribute('stroke-dasharray', '4, 4');
      gridlines.appendChild(line);
    }
  }

  if (pointsGroup) {
    pointsGroup.innerHTML = '';
    svgCoords.forEach(c => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', c.x);
      circle.setAttribute('cy', c.y);
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', '#ffffff');
      circle.setAttribute('stroke', 'var(--color-danger)');
      circle.setAttribute('stroke-width', '2.5');
      circle.style.cursor = 'pointer';

      circle.addEventListener('mouseover', () => {
        circle.setAttribute('r', '7');
        const dateStr = c.date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
        circle.title = `${dateStr}: ${Math.round(c.val)} ק״ג`;
      });
      circle.addEventListener('mouseout', () => {
        circle.setAttribute('r', '5');
      });
      pointsGroup.appendChild(circle);
    });
  }
}

// E. Monthly Calendar layout renderer
// Helper for Notification Permission
async function requestNotificationPermissionSafely() {
  if ('Notification' in window && typeof Notification !== 'undefined') {
    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        console.log("Notification permission state:", permission);
      } catch (err) {
        console.warn("Could not request notification permission:", err);
      }
    }
  }
}

// Helpers for LocalStorage and Future Workouts
function getFutureWorkouts() {
  if (!currentUser) return [];
  const key = `aura-future-workouts_${currentUser.uid}`;
  try {
    const data = SafeStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error reading future workouts", e);
    return [];
  }
}

function saveFutureWorkouts(workouts) {
  if (!currentUser) return;
  const key = `aura-future-workouts_${currentUser.uid}`;
  try {
    SafeStorage.setItem(key, JSON.stringify(workouts));
  } catch (e) {
    console.error("Error saving future workouts", e);
  }
}

// Start background checker for future workouts reminder
function startFutureWorkoutReminderChecker() {
  console.log("Starting high-precision periodic background checker for scheduled workouts...");
  setInterval(() => {
    if (!currentUser) return;
    const futureWorkouts = getFutureWorkouts();
    let updated = false;

    futureWorkouts.forEach(workout => {
      if (workout.reminderSent) return;

      const targetDateTimeStr = `${workout.date}T${workout.time}:00`;
      const targetTimeMs = new Date(targetDateTimeStr).getTime();
      if (isNaN(targetTimeMs)) return;

      const thresholdTimeMs = targetTimeMs - (workout.reminderMinutes * 60 * 1000);
      const nowMs = Date.now();

      if (nowMs >= thresholdTimeMs && nowMs < targetTimeMs + 60 * 60 * 1000) {
        workout.reminderSent = true;
        updated = true;

        const displayLoc = workout.location === 'gym' ? 'חדר כושר' : (workout.location === 'park' ? 'פארק' : workout.location);
        const title = `תזכורת לאימון: אימון ${displayLoc} מתוזמן לשעה ${workout.time}! 🏋️‍♂️`;
        const body = "אימון עתידי בפתח! 🏋️‍♂️";

        triggerLocalNotification(title, body, true);
        console.log(`Notification sent for future workout ${workout.id}`);
      } else if (nowMs >= targetTimeMs + 60 * 60 * 1000) {
        // Mark as sent if it's already in the past by 1 hour, to avoid sending alerts next time we load
        workout.reminderSent = true;
        updated = true;
      }
    });

    if (updated) {
      saveFutureWorkouts(futureWorkouts);
      if (activeSubTab === 'calendar') {
        renderCalendarView();
      }
    }
  }, 15000); // Checks every 15 seconds
}

function renderCalendarView() {
  const container = document.getElementById('calendar-days-grid');
  const monthLabel = document.getElementById('calendar-month-label');

  if (!container || !monthLabel) return;

  container.innerHTML = '';
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const monthsHebrew = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  monthLabel.textContent = `${monthsHebrew[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const filtered = getFilteredHistory();
  const workoutsByDay = {};

  filtered.forEach(w => {
    const d = new Date(w.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const dayNum = d.getDate();
      if (!workoutsByDay[dayNum]) workoutsByDay[dayNum] = [];
      workoutsByDay[dayNum].push(w);
    }
  });

  const futureWorkouts = getFutureWorkouts();
  const futureWorkoutsByDay = {};

  futureWorkouts.forEach(w => {
    const parts = w.date.split('-');
    if (parts.length === 3) {
      const wYear = parseInt(parts[0], 10);
      const wMonth = parseInt(parts[1], 10) - 1; // 0-indexed
      const wDay = parseInt(parts[2], 10);

      if (wYear === year && wMonth === month) {
        if (!futureWorkoutsByDay[wDay]) futureWorkoutsByDay[wDay] = [];
        futureWorkoutsByDay[wDay].push(w);
      }
    }
  });

  for (let i = 0; i < firstDayIndex; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day-empty';
    container.appendChild(empty);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day-cell';
    dayCell.textContent = day;

    const today = new Date();
    if (today.getDate() === day && today.getMonth() === month && today.getFullYear() === year) {
      dayCell.classList.add('today');
    }

    const sessions = workoutsByDay[day] || [];
    const futures = futureWorkoutsByDay[day] || [];

    if (sessions.length > 0) {
      dayCell.classList.add('has-workout');

      const dot = document.createElement('span');
      dot.className = 'calendar-workout-dot';
      dayCell.appendChild(dot);
    }

    if (futures.length > 0) {
      dayCell.classList.add('has-future-workout');

      const fDot = document.createElement('span');
      fDot.className = 'future-workout-dot-indicator';
      dayCell.appendChild(fDot);
    }

    if (sessions.length > 0 || futures.length > 0) {
      dayCell.addEventListener('click', (e) => {
        e.stopPropagation();
        
        let detailsHtml = '';

        if (sessions.length > 0) {
          sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
          detailsHtml += `<h5 style="color: #fca5a5; text-align: right; margin: 4px 0 8px 0; font-size: 0.9rem; font-weight: 700;">אימוני עבר:</h5>`;
          detailsHtml += sessions.map(w => {
            const duration = w.duration ? Math.round(w.duration / 60) : 0;
            const wDate = new Date(w.date);
            const timeStr = wDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            return `
              <div style="padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 8px; direction: rtl; text-align: right;">
                <div style="display: flex; justify-content: space-between; font-weight: 700; color: #fff;">
                  <span>${w.locationEmoji || '🏋️'} ${w.locationName || 'אימון'}</span>
                  <span style="font-size: 0.8rem; color: var(--text-muted);">${timeStr} • ${duration} דק׳</span>
                </div>
                <button onclick="openEditModal(${w.id}); this.closest('.custom-calendar-alert-overlay').remove();" class="btn btn-secondary" style="width: 100%; margin-top: 8px; padding: 6px !important; font-size: 0.75rem !important;">🛠️ ערוך אימון</button>
              </div>
            `;
          }).join('');
        }

        if (futures.length > 0) {
          futures.sort((a, b) => a.time.localeCompare(b.time));
          detailsHtml += `<h5 style="color: #fdba74; text-align: right; margin: 12px 0 8px 0; font-size: 0.9rem; font-weight: 700;">אימונים עתידיים מתוכננים:</h5>`;
          detailsHtml += futures.map(f => {
            const displayLoc = f.location === 'gym' ? 'חדר כושר 🏋️‍♂️' : (f.location === 'park' ? 'פארק 🌳' : f.location);
            return `
              <div class="future-workout-card">
                <div class="future-header">
                  <span>📅 אימון עתידי</span>
                  <span class="future-badge">${f.time}</span>
                </div>
                <div style="color: #e2e8f0; font-size: 0.85rem; margin-top: 4px;">
                  מיקום: <strong>${displayLoc}</strong>
                </div>
                <div style="color: var(--text-muted); font-size: 0.78rem; margin-top: 2px;">
                  תזכורת: ${f.reminderMinutes === 0 ? 'בדיוק בזמן' : (f.reminderMinutes === 60 ? 'שעה לפני' : (f.reminderMinutes === 180 ? '3 שעות לפני' : f.reminderMinutes + ' דקות לפני'))}
                </div>
                <button class="btn btn-secondary cancel-future-btn" data-id="${f.id}" style="width: 100%; margin-top: 8px; padding: 6px !important; font-size: 0.75rem !important; background: rgba(220,38,38,0.1) !important; border-color: rgba(220,38,38,0.2) !important; color: #fca5a5 !important;">❌ ביטול אימון</button>
              </div>
            `;
          }).join('');
        }

        const summaryAlert = document.createElement('div');
        summaryAlert.className = 'custom-calendar-alert-overlay';
        summaryAlert.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1600;';
        summaryAlert.innerHTML = `
          <div class="workout-modal-card glass-modal-card" style="max-width: 320px; width: 90%; border-radius: 20px; padding: 1.2rem; text-align: center; border: 1px solid rgba(255,255,255,0.08);">
            <h4 style="margin: 0 0 12px 0; font-size: 1.1rem; color: #fff; direction: rtl;">אימונים ב-${day}/${month + 1}/${year}</h4>
            <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
              ${detailsHtml}
            </div>
            <button class="btn btn-primary close-calendar-alert" style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 10px;">סגור</button>
          </div>
        `;

        summaryAlert.querySelector('.close-calendar-alert').addEventListener('click', () => {
          summaryAlert.remove();
        });

        // Cancel button action
        summaryAlert.querySelectorAll('.cancel-future-btn').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const fId = btn.dataset.id;
            let currentFutures = getFutureWorkouts();
            currentFutures = currentFutures.filter(x => x.id !== fId);
            saveFutureWorkouts(currentFutures);
            summaryAlert.remove();
            renderCalendarView();
          });
        });

        document.body.appendChild(summaryAlert);
      });
    }
    container.appendChild(dayCell);
  }
}


// F. Annual Github-style Heatmap renderer
function renderHeatmapView() {
  const svg = document.getElementById('heatmap-svg');
  if (!svg) return;

  svg.innerHTML = '';

  const filtered = getFilteredHistory();
  const workoutsByDateStr = {};

  filtered.forEach(w => {
    const d = new Date(w.date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!workoutsByDateStr[dateStr]) workoutsByDateStr[dateStr] = 0;
    workoutsByDateStr[dateStr]++;
  });

  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 364);

  const startDay = startDate.getDay();
  startDate.setDate(startDate.getDate() - startDay);

  const rectSize = 10;
  const gap = 3;

  for (let week = 0; week < 53; week++) {
    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + (week * 7) + day);

      if (currentDate > now) continue;

      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      const count = workoutsByDateStr[dateStr] || 0;

      let color = 'rgba(255, 255, 255, 0.05)';
      if (count === 1) color = '#fca5a5';
      else if (count === 2) color = '#f87171';
      else if (count >= 3) color = '#dc2626';

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(week * (rectSize + gap)));
      rect.setAttribute('y', String(day * (rectSize + gap)));
      rect.setAttribute('width', String(rectSize));
      rect.setAttribute('height', String(rectSize));
      rect.setAttribute('rx', '2');
      rect.setAttribute('fill', color);
      
      const formattedDate = currentDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
      rect.setAttribute('title', `${formattedDate}: ${count} אימונים`);

      rect.addEventListener('mouseover', () => {
        rect.setAttribute('stroke', '#ffffff');
        rect.setAttribute('stroke-width', '1');
      });
      rect.addEventListener('mouseout', () => {
        rect.removeAttribute('stroke');
      });

      svg.appendChild(rect);
    }
  }
}

// G. Muscle volume distribution progress split
function renderMuscleSplitView() {
  const container = document.getElementById('muscle-splits-container');
  const adviceEl = document.getElementById('muscle-recommendation-box');

  if (!container || !adviceEl) return;

  container.innerHTML = '';

  const filtered = getFilteredHistory();
  const volumeByMuscle = {
    'חזה': 0, 'גב': 0, 'כתפיים': 0, 'רגליים': 0, 'ידיים': 0, 'בטן': 0, 'אירובי': 0, 'ליבה': 0, 'אחר': 0
  };

  let totalOverallVolume = 0;

  filtered.forEach(w => {
    if (!w.exercises) return;
    w.exercises.forEach(ex => {
      let cat = 'אחר';
      if (typeof exercisesList !== 'undefined') {
        const matched = exercisesList.find(x => x.name === ex.name);
        if (matched) cat = matched.category || 'אחר';
      }

      ex.sets.forEach(s => {
        if (s.completed) {
          const w = parseFloat(s.weight) || 0;
          const r = parseInt(s.reps, 10) || 0;
          const vol = w * r;

          if (volumeByMuscle[cat] !== undefined) {
            volumeByMuscle[cat] += vol;
            totalOverallVolume += vol;
          } else {
            volumeByMuscle['אחר'] += vol;
            totalOverallVolume += vol;
          }
        }
      });
    });
  });

  if (totalOverallVolume === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px; font-size: 0.9rem;">אין נתוני נפח שרירים מסוננים עדיין.</div>';
    adviceEl.textContent = 'בצע אימונים ורשום סטים כדי לקבל המלצות לאיזון שרירי.';
    return;
  }

  Object.keys(volumeByMuscle).forEach(muscle => {
    const vol = volumeByMuscle[muscle];
    if (vol === 0) return;

    const pct = Math.round((vol / totalOverallVolume) * 100);
    const barRow = document.createElement('div');
    barRow.className = 'muscle-split-row';
    barRow.style.cssText = 'margin-bottom: 12px;';

    barRow.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 4px; direction: rtl;">
        <span>${muscle}</span>
        <span>${pct}% (${vol.toLocaleString()} ק״ג)</span>
      </div>
      <div class="progress-bar-track" style="width: 100%; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
        <div class="progress-bar-fill" style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #ef4444, #dc2626); box-shadow: 0 0 8px rgba(220, 38, 38, 0.4); border-radius: 4px;"></div>
      </div>
    `;
    container.appendChild(barRow);
  });

  const legsPct = (volumeByMuscle['רגליים'] / totalOverallVolume) * 100;
  const chestPct = (volumeByMuscle['חזה'] / totalOverallVolume) * 100;
  const backPct = (volumeByMuscle['גב'] / totalOverallVolume) * 100;

  if (legsPct < 15) {
    adviceEl.innerHTML = `⚠️ <strong>הנחיית איזון:</strong> נפח אימוני הרגליים שלך נמוך יחסית לתא המותניים (${Math.round(legsPct)}%). מומלץ להוסיף סקוואט או מכרעים כדי למנוע חוסר איזון פיזיולוגי! 🦵`;
  } else if (Math.abs(chestPct - backPct) > 20) {
    adviceEl.innerHTML = '⚠️ <strong>הנחיית איזון:</strong> יש פער משמעותי בין נפח החזה לגב. הקפד על יחס שווה של לחיצות ומשיכות למניעת פציעות כתפיים ויציבה כפופה! 🦅🍒';
  } else {
    adviceEl.innerHTML = '✨ <strong>הנחיית איזון:</strong> כל הכבוד! חלוקת העומסים והנפח שלך מאוזנת ומקצועית ביותר. המשך ככה! 🏋️‍♂️🏆';
  }
}

// H. Accordion history list view renderer
function renderAccordionHistoryView() {
  const container = document.getElementById('accordion-history-container');
  if (!container) return;

  container.innerHTML = '';
  const filtered = getFilteredHistory();

  if (filtered.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px; font-size: 0.9rem; direction: rtl;">לא נמצאו אימונים התואמים את המסננים שבחרת.</div>';
    return;
  }

  filtered.forEach(w => {
    const card = document.createElement('div');
    card.className = 'history-accordion-card';
    card.style.cssText = 'background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; margin-bottom: 12px; padding: 12px 16px; cursor: pointer; transition: all 0.25s ease;';

    const duration = w.duration ? Math.round(w.duration / 60) : 0;
    const dateObj = new Date(w.date);
    const dateStr = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });

    let totalVolume = 0;
    let totalSets = 0;

    w.exercises.forEach(ex => {
      ex.sets.forEach(s => {
        if (s.completed) {
          totalSets++;
          totalVolume += (parseFloat(s.weight) || 0) * (parseInt(s.reps, 10) || 0);
        }
      });
    });

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; direction: rtl;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.4rem;">${w.locationEmoji || '🏋️'}</span>
          <div>
            <h4 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: #fff;">${w.locationName || 'אימון'}</h4>
            <span style="font-size: 0.78rem; color: var(--text-muted);">${dateStr} • ${duration} דקות</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 0.82rem; font-weight: 700; color: var(--electric-blue-light);">${totalVolume.toLocaleString()} ק״ג</span>
          <span class="accordion-arrow" style="font-size: 0.9rem; transition: transform 0.2s ease;">▼</span>
        </div>
      </div>
      <div class="accordion-details hide" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); direction: rtl;">
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
          ${w.exercises.map(ex => {
            const exSetsText = ex.sets.map(s => `${s.weight}ק״ג×${s.reps}`).join(', ');
            return `
              <div style="font-size: 0.85rem; color: #e2e8f0; display: flex; justify-content: space-between;">
                <span style="font-weight: 700;">• ${ex.name}</span>
                <span style="color: var(--text-muted); font-size: 0.8rem; direction: ltr;">[${exSetsText}]</span>
              </div>
            `;
          }).join('')}
        </div>
        <button class="btn btn-secondary edit-w-accordion-btn" style="width: 100%; padding: 8px !important; font-size: 0.8rem !important; border-radius: 10px;">🛠️ ערוך פרטי אימון</button>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.edit-w-accordion-btn')) return;

      const details = card.querySelector('.accordion-details');
      const arrow = card.querySelector('.accordion-arrow');

      if (details) {
        if (details.classList.contains('hide')) {
          details.classList.remove('hide');
          if (arrow) arrow.style.transform = 'rotate(180deg)';
          card.style.background = 'rgba(255,255,255,0.04)';
        } else {
          details.classList.add('hide');
          if (arrow) arrow.style.transform = 'rotate(0deg)';
          card.style.background = 'rgba(255,255,255,0.02)';
        }
      }
    });

    const editBtn = card.querySelector('.edit-w-accordion-btn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(w.id);
      });
    }

    container.appendChild(card);
  });
}

// Hook Analytics Initialization on Window Load and PWA startup
onDOMReady(initAnalyticsTab);

// ==========================================================================
// DYNAMIC SUB-NAVIGATION BAR & TAB 1 WORKOUTS LOG IMPLEMENTATION
// ==========================================================================
let activeSubTab = 'workouts';
let filterSortSelection = 'date-desc';

// Bind click listeners for sub-tabs in metrics-sub-nav & Back Button
onDOMReady(() => {
  const subTabs = document.querySelectorAll('#metrics-sub-nav .nav-tab[data-sub-tab]');
  const subPanes = document.querySelectorAll('#tab-analytics .sub-tab-pane');
  const subNav = document.getElementById('metrics-sub-nav');
  const mainNav = document.querySelector('.ios-bottom-nav');
  const subNavBackBtn = document.getElementById('sub-nav-back-btn');

  // Sub-tabs switching
  subTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetSubTab = tab.dataset.subTab;
      if (!targetSubTab) return;

      activeSubTab = targetSubTab;

      // Update active class on sub-nav tab buttons
      subTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active class on sub-tab panes
      subPanes.forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
        if (pane.id === `sub-tab-${targetSubTab}`) {
          pane.style.display = 'flex';
          setTimeout(() => {
            pane.classList.add('active');
          }, 10);
        }
      });

      console.log(`Switched to sub-tab: ${targetSubTab}`);
      renderAnalytics();
    });
  });

  // Back button restores main bottom nav
  if (subNavBackBtn) {
    subNavBackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (subNav) subNav.classList.add('nav-hidden');
      if (mainNav) mainNav.classList.remove('nav-hidden');

      // Switch active tab in main-nav back to lastActiveMainTab
      const prevTabBtn = document.querySelector(`.ios-bottom-nav .nav-tab[data-tab="${lastActiveMainTab}"]`);
      if (prevTabBtn) {
        prevTabBtn.click();
      }
    });
  }

  // Hook sort selection change listener
  const sortSelect = document.getElementById('filter-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      filterSortSelection = sortSelect.value;
      renderWorkoutsLog();
    });
  }

  // Start high-precision background timer for future workouts
  startFutureWorkoutReminderChecker();

  // Initialize premium AURA AI Coach card interactions and micro-animations
  initAICoach();
});

// AI Coach interactive click handlers and digital ripple effects
function initAICoach() {
  const card = document.querySelector('#sub-tab-ai .aura-ai-card');
  if (!card) return;

  card.addEventListener('click', (e) => {
    e.preventDefault();

    // Create dynamic digital ripple element
    const ripple = document.createElement('span');
    ripple.className = 'ai-ripple';

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    card.appendChild(ripple);

    // Subtle vibration for tactile feel (if supported)
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }

    // Show dynamic toast
    showAuraToast("המאמן האישי שלך בהכנה... 🤖🔥");

    // Remove ripple node after animation finishes
    setTimeout(() => {
      ripple.remove();
    }, 800);
  });
}

// Reusable elegant glassmorphic status toast notifications
function showAuraToast(message) {
  const existing = document.getElementById('aura-premium-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'aura-premium-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: calc(90px + env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: rgba(15, 15, 20, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(220, 38, 38, 0.4);
    box-shadow: 0 10px 30px rgba(220, 38, 38, 0.15), 0 0 15px rgba(220, 38, 38, 0.25);
    padding: 14px 24px;
    border-radius: 16px;
    color: #ffffff;
    font-size: 0.95rem;
    font-weight: 700;
    z-index: 99999;
    pointer-events: none;
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    direction: rtl;
    text-align: center;
    white-space: nowrap;
    font-family: var(--font-sans);
  `;
  toast.innerHTML = `<span>🤖🔥</span> ${message}`;
  document.body.appendChild(toast);

  // Force a reflow
  toast.offsetHeight;

  // Fade and slide in
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  // Remove toast
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 2500);
}

// Tab 1: Chronological Workouts Log Renderer
function renderWorkoutsLog() {
  const container = document.getElementById('workouts-log-container');
  if (!container) return;

  container.innerHTML = '';

  // 1. Get filtered history using existing getFilteredHistory() function
  let filtered = getFilteredHistory();

  // 2. Compute PRs dynamically for the PRs sorting or display badge
  const maxWeights = {};
  workoutHistory.forEach(w => {
    if (!w.exercises) return;
    w.exercises.forEach(ex => {
      if (!ex.sets) return;
      ex.sets.forEach(s => {
        if (s.completed) {
          const weight = parseFloat(s.weight) || 0;
          if (!maxWeights[ex.name] || weight > maxWeights[ex.name]) {
            maxWeights[ex.name] = weight;
          }
        }
      });
    });
  });

  // Compute stats for sorting & badges
  const workoutMetrics = filtered.map(w => {
    let totalVolume = 0;
    let totalSets = 0;
    let prCount = 0;

    if (w.exercises) {
      w.exercises.forEach(ex => {
        const maxW = maxWeights[ex.name] || 0;
        let exerciseHasPR = false;

        ex.sets.forEach(s => {
          if (s.completed) {
            totalSets++;
            const wVal = parseFloat(s.weight) || 0;
            totalVolume += wVal * (parseInt(s.reps, 10) || 0);

            if (maxW > 0 && wVal === maxW) {
              exerciseHasPR = true;
            }
          }
        });
        if (exerciseHasPR) prCount++;
      });
    }

    return {
      workout: w,
      totalVolume,
      totalSets,
      prCount
    };
  });

  // 3. Apply custom sort selection
  if (filterSortSelection === 'volume-desc') {
    workoutMetrics.sort((a, b) => {
      if (b.totalVolume !== a.totalVolume) {
        return b.totalVolume - a.totalVolume;
      }
      return b.workout.date - a.workout.date;
    });
  } else if (filterSortSelection === 'prs-first') {
    workoutMetrics.sort((a, b) => {
      if (b.prCount !== a.prCount) {
        return b.prCount - a.prCount;
      }
      return b.workout.date - a.workout.date;
    });
  } else {
    // Default chronological (date-desc)
    workoutMetrics.sort((a, b) => b.workout.date - a.workout.date);
  }

  if (workoutMetrics.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 30px; font-size: 0.95rem; direction: rtl;">לא נמצאו אימונים התואמים את סינוני החיפוש.</div>';
    return;
  }

  // 4. Render workout cards
  workoutMetrics.forEach(item => {
    const w = item.workout;
    const duration = w.duration ? Math.round(w.duration / 60) : 0;
    const dateObj = new Date(w.date);
    const dateStr = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });

    const card = document.createElement('div');
    card.className = 'workout-log-card';

    const prBadgeHtml = item.prCount > 0 ? `<span class="workout-log-pr-badge">🏆 שיא אישי x${item.prCount}</span>` : '';
    const dispName = w.locationName || (w.location === 'gym' ? 'חדר כושר' : 'פארק');
    const dispEmoji = w.locationEmoji || (w.location === 'gym' ? '🏋️‍♂️' : '🌳');

    card.innerHTML = `
      <div class="workout-log-header">
        <div class="workout-log-location">
          <span class="workout-log-emoji">${dispEmoji}</span>
          <div>
            <h4 class="workout-log-name">${dispName}</h4>
            <span class="workout-log-date">${dateStr} • ${duration} דק׳</span>
          </div>
        </div>
        <div class="workout-log-stats">
          <span class="workout-log-volume">${item.totalVolume.toLocaleString()} ק״ג</span>
          ${prBadgeHtml}
        </div>
      </div>
      <div class="workout-log-exercises">
        ${w.exercises.map(ex => {
          const exSetsText = ex.sets.map(s => `${s.weight}ק״ג×${s.reps}`).join(', ');
          return `
            <div class="workout-log-exercise-item">
              <span class="workout-log-exercise-name">• ${ex.name}</span>
              <span class="workout-log-exercise-sets">[${exSetsText}]</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Connect click listener to openEditModal
    card.addEventListener('click', () => {
      openEditModal(w.id);
    });

    container.appendChild(card);
  });
}


// ==========================================================================
// TAB 3: EXERCISES MANAGER & DETAILED INSPECTOR PROGRESSION DASHBOARD
// ==========================================================================

let activeChartTypeTab3 = '1rm';
let currentInspectorExercise = null;

// Category colors helper mapping (for consistent badges in Tab 3)
const categoryColorsTab3 = {
  'חזה':      { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  'גב':       { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  'כתפיים':    { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc' },
  'רגליים':    { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
  'ידיים':    { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c' },
  'בטן':      { bg: 'rgba(234,179,8,0.15)',   color: '#facc15' },
  'אירובי':    { bg: 'rgba(20,184,166,0.15)',  color: '#2dd4bf' },
  'ליבה':      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  'מתח':      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  'דחיפה':    { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  'ליבה ואירובי': { bg: 'rgba(20,184,166,0.15)', color: '#2dd4bf' },
  'מותאם אישית': { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8' }
};

// Compute completed stats for a specific exercise in workout history
function getExerciseStats(exerciseName) {
  let timesPerformed = 0;
  let totalSets = 0;
  let maxWeight = 0;
  let max1RM = 0;
  let peakVolume = 0;

  workoutHistory.forEach(w => {
    if (!w.exercises) return;
    const ex = w.exercises.find(e => e.name === exerciseName);
    if (ex && ex.sets) {
      const completedSets = ex.sets.filter(s => s.completed);
      if (completedSets.length > 0) {
        timesPerformed++;
        totalSets += completedSets.length;
        
        let sessionVolume = 0;
        completedSets.forEach(s => {
          const wVal = parseFloat(s.weight) || 0;
          const rVal = parseInt(s.reps, 10) || 0;

          if (wVal > maxWeight) maxWeight = wVal;
          const oneRM = rVal === 1 ? wVal : wVal * (1 + rVal / 30);
          if (oneRM > max1RM) max1RM = oneRM;
          sessionVolume += (wVal * rVal);
        });

        if (sessionVolume > peakVolume) peakVolume = sessionVolume;
      }
    }
  });

  return { timesPerformed, totalSets, maxWeight, max1RM, peakVolume };
}

// Render dynamic Exercises Grid in Tab 3 (Exercises Manager)
function renderExercisesManager() {
  const gridContainer = document.getElementById('exercises-list-grid-tab3');
  if (!gridContainer) return;
  gridContainer.innerHTML = '';

  const searchInput = document.getElementById('exercises-search-input-tab3');
  const muscleFilter = document.getElementById('exercises-muscle-filter-tab3');
  const typeFilter = document.getElementById('exercises-type-filter-tab3');

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const selectedMuscle = muscleFilter ? muscleFilter.value : 'all';
  const selectedType = typeFilter ? typeFilter.value : 'all';

  let allExs = getAllExercises();

  // Advanced Filters: Search + Muscle Group + Type
  if (query) {
    allExs = allExs.filter(ex => ex.name.toLowerCase().includes(query));
  }
  if (selectedMuscle !== 'all') {
    allExs = allExs.filter(ex => ex.category === selectedMuscle);
  }
  if (selectedType !== 'all') {
    const standardNames = new Set([...GYM_EXERCISES, ...PARK_EXERCISES].map(e => e.name.trim().toLowerCase()));
    if (selectedType === 'standard') {
      allExs = allExs.filter(ex => standardNames.has(ex.name.trim().toLowerCase()));
    } else if (selectedType === 'custom') {
      allExs = allExs.filter(ex => !standardNames.has(ex.name.trim().toLowerCase()));
    }
  }  if (allExs.length === 0) {
    gridContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 20px; direction: rtl;">אין תרגילים העונים על סינון זה</div>';
    return;
  }

  allExs.forEach(ex => {
    const stats = getExerciseStats(ex.name);
    
    const card = document.createElement('div');
    card.className = 'exercise-manage-card-tab3';
    
    const catStyle = categoryColorsTab3[ex.category] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' };
    const emojiStr = ex.emoji ? `<span class="ex-card-emoji-tab3">${ex.emoji}</span>` : '💪';
    
    card.innerHTML = `
      <div class="ex-card-info-tab3" style="text-align: right; direction: rtl;">
        <div class="ex-card-title-row">
          ${emojiStr}
          <span class="ex-card-name-tab3">${ex.name}</span>
        </div>
        <div class="ex-card-stats-tab3" style="margin-top: 4px;">
          בוצע ${stats.timesPerformed} פעמים • ${stats.totalSets} סטים
        </div>
      </div>
      <div>
        <span class="ex-card-badge-tab3" style="background: ${catStyle.bg}; color: ${catStyle.color};">${ex.category || 'אחר'}</span>
      </div>
    `;

    // Click card opens Inspector modal
    card.addEventListener('click', () => {
      openExerciseInspector(ex.name);
    });

    gridContainer.appendChild(card);
  });
}

// Open exercise progression detailed panel (Inspector)
function openExerciseInspector(exerciseName) {
  currentInspectorExercise = exerciseName;
  
  const allExs = getAllExercises();
  const exDetails = allExs.find(ex => ex.name === exerciseName) || { name: exerciseName, category: 'אחר', emoji: '💪' };

  const nameEl = document.getElementById('inspector-exercise-name');
  const catBadge = document.getElementById('inspector-exercise-category');
  
  if (nameEl) {
    nameEl.textContent = (exDetails.emoji ? `${exDetails.emoji} ` : '') + exDetails.name;
  }
  
  if (catBadge) {
    catBadge.textContent = exDetails.category || 'אחר';
    const catStyle = categoryColorsTab3[exDetails.category] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' };
    catBadge.style.cssText = `background: ${catStyle.bg}; color: ${catStyle.color}; margin-top: 4px; display: inline-block;`;
  }

  // Populate Statistics
  const stats = getExerciseStats(exerciseName);
  
  const prVal = document.getElementById('inspector-pr-val');
  const rmVal = document.getElementById('inspector-1rm-val');
  const volVal = document.getElementById('inspector-vol-val');
  const performedVal = document.getElementById('inspector-performed-val');

  if (prVal) prVal.textContent = stats.maxWeight > 0 ? `${stats.maxWeight} ק״ג` : '--';
  if (rmVal) rmVal.textContent = stats.max1RM > 0 ? `${Math.round(stats.max1RM)} ק״ג` : '--';
  if (volVal) volVal.textContent = stats.peakVolume > 0 ? `${stats.peakVolume} ק״ג` : '--';
  if (performedVal) performedVal.textContent = `${stats.timesPerformed} פעמים • ${stats.totalSets} סטים`;

  // Compute Broken PRs Timeline
  const timelineContainer = document.getElementById('pr-history-timeline-tab3');
  if (timelineContainer) {
    timelineContainer.innerHTML = '';
    
    const chronological = [...workoutHistory]
      .filter(w => w.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningMaxWeight = 0;
    const brokenPRs = [];

    chronological.forEach(w => {
      if (!w.exercises) return;
      const ex = w.exercises.find(e => e.name === exerciseName);
      if (ex && ex.sets) {
        const completedSets = ex.sets.filter(s => s.completed);
        if (completedSets.length > 0) {
          const sessionMaxWeight = Math.max(...completedSets.map(s => parseFloat(s.weight) || 0));
          if (sessionMaxWeight > runningMaxWeight) {
            runningMaxWeight = sessionMaxWeight;
            brokenPRs.push({
              date: new Date(w.date),
              weight: sessionMaxWeight
            });
          }
        }
      }
    });

    if (brokenPRs.length === 0) {
      timelineContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 10px;">לא נרשמו שיאים אישיים עדיין</div>';
    } else {
      [...brokenPRs].reverse().forEach(pr => {
        const item = document.createElement('div');
        item.className = 'pr-timeline-item';
        const dateStr = pr.date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="pr-timeline-badge">PR שבור!</span>
            <span class="pr-timeline-val">${pr.weight} ק״ג</span>
          </div>
          <span class="pr-timeline-date">${dateStr}</span>
        `;
        timelineContainer.appendChild(item);
      });
    }
  }

  // Reset to 1RM Tab and draw
  activeChartTypeTab3 = '1rm';
  const tabs = document.querySelectorAll('[data-chart-tab3]');
  tabs.forEach(t => {
    t.classList.remove('active');
    if (t.dataset.chartTab3 === '1rm') t.classList.add('active');
  });

  renderExerciseInspectorChart();

  // Open Modal
  const modal = document.getElementById('exercise-inspector-modal');
  if (modal) modal.classList.remove('hide');
}

// Render Inspector Bezier SVG Curve Line Chart
function renderExerciseInspectorChart() {
  const exerciseName = currentInspectorExercise;
  if (!exerciseName) return;

  const chartSvg = document.getElementById('bezier-chart-svg-tab3');
  const noDataEl = document.getElementById('chart-no-data-tab3');
  if (!chartSvg) return;

  const exerciseSessions = [];
  const chronological = [...workoutHistory]
    .filter(w => w.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  chronological.forEach(w => {
    if (!w.exercises) return;
    const ex = w.exercises.find(e => e.name === exerciseName);
    if (ex && ex.sets && ex.sets.some(s => s.completed)) {
      exerciseSessions.push({
        date: new Date(w.date),
        sets: ex.sets.filter(s => s.completed)
      });
    }
  });

  if (exerciseSessions.length === 0) {
    if (noDataEl) noDataEl.style.display = 'flex';
    
    const areaPath = document.getElementById('chart-area-path-tab3');
    const linePath = document.getElementById('chart-line-path-tab3');
    const pointsGroup = document.getElementById('chart-points-group-tab3');
    const gridlines = document.getElementById('chart-gridlines-tab3');
    if (areaPath) areaPath.setAttribute('d', '');
    if (linePath) linePath.setAttribute('d', '');
    if (pointsGroup) pointsGroup.innerHTML = '';
    if (gridlines) gridlines.innerHTML = '';
    return;
  }

  if (noDataEl) noDataEl.style.display = 'none';

  const points = [];
  exerciseSessions.forEach(session => {
    let sessionMaxWeight = 0;
    let sessionMax1RM = 0;
    let sessionVolume = 0;

    session.sets.forEach(s => {
      const w = parseFloat(s.weight) || 0;
      const r = parseInt(s.reps, 10) || 0;

      if (w > sessionMaxWeight) sessionMaxWeight = w;
      const oneRM = r === 1 ? w : w * (1 + r / 30);
      if (oneRM > sessionMax1RM) sessionMax1RM = oneRM;
      sessionVolume += (w * r);
    });

    let yValue = 0;
    if (activeChartTypeTab3 === '1rm') {
      yValue = sessionMax1RM;
    } else if (activeChartTypeTab3 === 'weight') {
      yValue = sessionMaxWeight;
    } else {
      yValue = sessionVolume;
    }

    points.push({
      date: session.date,
      value: yValue
    });
  });

  const width = chartSvg.clientWidth || 320;
  const height = chartSvg.clientHeight || 180;

  const paddingX = 35;
  const paddingY = 25;

  const values = points.map(p => p.value);
  const minVal = Math.min(...values) * 0.9;
  const maxVal = Math.max(...values) * 1.1 || 100;
  const valRange = (maxVal - minVal) || 1;

  const svgCoords = points.map((p, idx) => {
    const x = points.length > 1 
      ? paddingX + (idx / (points.length - 1)) * (width - 2 * paddingX)
      : width / 2;
    const y = height - paddingY - ((p.value - minVal) / valRange) * (height - 2 * paddingY);
    return { x, y, val: p.value, date: p.date };
  });

  let dLine = '';
  let dArea = '';

  if (svgCoords.length === 1) {
    const c = svgCoords[0];
    dLine = `M ${c.x - 15} ${c.y} L ${c.x + 15} ${c.y}`;
    dArea = `M ${c.x - 15} ${c.y} L ${c.x + 15} ${c.y} L ${c.x + 15} ${height} L ${c.x - 15} ${height} Z`;
  } else {
    dLine = `M ${svgCoords[0].x} ${svgCoords[0].y}`;
    for (let i = 0; i < svgCoords.length - 1; i++) {
      const curr = svgCoords[i];
      const next = svgCoords[i + 1];
      const cpX1 = curr.x + (next.x - curr.x) / 3;
      const cpY1 = curr.y;
      const cpX2 = curr.x + 2 * (next.x - curr.x) / 3;
      const cpY2 = next.y;
      dLine += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
    }
    dArea = dLine + ` L ${svgCoords[svgCoords.length - 1].x} ${height} L ${svgCoords[0].x} ${height} Z`;
  }

  const areaPath = document.getElementById('chart-area-path-tab3');
  const linePath = document.getElementById('chart-line-path-tab3');
  const pointsGroup = document.getElementById('chart-points-group-tab3');
  const gridlines = document.getElementById('chart-gridlines-tab3');

  if (areaPath) areaPath.setAttribute('d', dArea);
  if (linePath) {
    linePath.setAttribute('d', dLine);
    linePath.style.stroke = 'var(--electric-blue-light)';
    linePath.style.strokeWidth = '3.5';
    linePath.style.fill = 'none';
  }

  if (gridlines) {
    gridlines.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const y = paddingY + (i / 2) * (height - 2 * paddingY);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y);
      line.setAttribute('x2', width);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(255, 255, 255, 0.05)');
      line.setAttribute('stroke-dasharray', '4, 4');
      gridlines.appendChild(line);
    }
  }

  if (pointsGroup) {
    pointsGroup.innerHTML = '';
    svgCoords.forEach(c => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', c.x);
      circle.setAttribute('cy', c.y);
      circle.setAttribute('r', '5');
      circle.setAttribute('class', 'bezier-chart-point-tab3');

      circle.addEventListener('mouseover', () => {
        circle.setAttribute('r', '7');
        const dateStr = c.date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
        circle.title = `${dateStr}: ${Math.round(c.val)} ק״ג`;
      });
      circle.addEventListener('mouseout', () => {
        circle.setAttribute('r', '5');
      });
      pointsGroup.appendChild(circle);
    });
  }
}

// Delete global exercise completely from single source of truth (aura-all-exercises)
function deleteGlobalExercise(exerciseName) {
  if (!confirm(`האם אתה בטוח שברצונך למחוק את "${exerciseName}" לצמיתות?\nפעולה זו תסיר את התרגיל מרשימות הבחירה בעתיד, אך תשמור אותו בהיסטוריית האימונים הישנים שלך כדי לשמור על הסטטיסטיקות.`)) {
    return;
  }

  let allExs = getAllExercises();
  allExs = allExs.filter(ex => ex.name.trim().toLowerCase() !== exerciseName.trim().toLowerCase());
  saveAllExercises(allExs);

  // Close inspector modal
  const modal = document.getElementById('exercise-inspector-modal');
  if (modal) modal.classList.add('hide');

  // Re-render views
  renderExercisesManager();
  if (typeof renderExercisePickerList === 'function') renderExercisePickerList();
  
  alert(`התרגיל "${exerciseName}" נמחק לנצח! 🗑️`);
}

// Add new global exercise completely to single source of truth
function addGlobalExercise() {
  const nameInput = document.getElementById('new-global-exercise-name');
  const muscleSelect = document.getElementById('new-global-exercise-muscle');
  const emojiInput = document.getElementById('new-global-exercise-emoji');

  if (!nameInput || !nameInput.value.trim()) {
    alert('אנא הזן שם לתרגיל החדש.');
    if (nameInput) nameInput.focus();
    return;
  }

  const name = nameInput.value.trim();
  const category = muscleSelect ? muscleSelect.value : 'אחר';
  const emoji = emojiInput ? emojiInput.value.trim() : '';

  let allExs = getAllExercises();

  // Validate Duplicate
  if (allExs.some(ex => ex.name.trim().toLowerCase() === name.toLowerCase())) {
    alert('תרגיל בשם זה כבר קיים במערכת!');
    return;
  }

  const newEx = {
    name,
    category,
    emoji: emoji || '💪'
  };

  allExs.push(newEx);
  saveAllExercises(allExs);

  // Clear inputs
  nameInput.value = '';
  if (emojiInput) emojiInput.value = '';

  // Close modal
  const modal = document.getElementById('add-global-exercise-modal');
  if (modal) modal.classList.add('hide');

  // Re-render views
  renderExercisesManager();
  if (typeof renderExercisePickerList === 'function') renderExercisePickerList();

  alert(`התרגיל "${name}" נוסף לנצח בהצלחה! ✨`);
}

// Register all Tab 3 (Exercises Manager) DOM interactive events
onDOMReady(() => {
  // Opening the Add Global Exercise Modal
  const addBtn = document.getElementById('add-new-global-exercise-btn');
  const addModal = document.getElementById('add-global-exercise-modal');
  const closeAddModalBtn = document.getElementById('close-add-global-exercise-modal-btn');
  
  if (addBtn && addModal) {
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addModal.classList.remove('hide');
    });
  }

  if (closeAddModalBtn && addModal) {
    closeAddModalBtn.addEventListener('click', () => {
      addModal.classList.add('hide');
    });
    
    // Close modal on background click
    addModal.addEventListener('click', (e) => {
      if (e.target === addModal) {
        addModal.classList.add('hide');
      }
    });
  }

  // Save new exercise
  const saveBtn = document.getElementById('save-new-global-exercise-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addGlobalExercise();
    });
  }

  // Close Detailed Exercise Inspector Overlay
  const closeInspectorBtn = document.getElementById('close-exercise-inspector-btn');
  const inspectorModal = document.getElementById('exercise-inspector-modal');
  
  if (closeInspectorBtn && inspectorModal) {
    closeInspectorBtn.addEventListener('click', () => {
      inspectorModal.classList.add('hide');
    });

    inspectorModal.addEventListener('click', (e) => {
      if (e.target === inspectorModal) {
        inspectorModal.classList.add('hide');
      }
    });
  }

  // Delete exercise click
  const deleteBtn = document.getElementById('delete-global-exercise-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentInspectorExercise) {
        deleteGlobalExercise(currentInspectorExercise);
      }
    });
  }

  // Advanced search input keypress/typing
  const searchInputTab3 = document.getElementById('exercises-search-input-tab3');
  if (searchInputTab3) {
    searchInputTab3.addEventListener('input', () => {
      renderExercisesManager();
    });
  }

  // Muscle filter select changes
  const muscleFilterTab3 = document.getElementById('exercises-muscle-filter-tab3');
  if (muscleFilterTab3) {
    muscleFilterTab3.addEventListener('change', () => {
      renderExercisesManager();
    });
  }

  // Type filter select changes
  const typeFilterTab3 = document.getElementById('exercises-type-filter-tab3');
  if (typeFilterTab3) {
    typeFilterTab3.addEventListener('change', () => {
      renderExercisesManager();
    });
  }

  // Chart tabs switcher within inspector modal
  const chartTabsTab3 = document.querySelectorAll('[data-chart-tab3]');
  chartTabsTab3.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetChartType = tab.getAttribute('data-chart-tab3');
      if (!targetChartType) return;

      activeChartTypeTab3 = targetChartType;

      chartTabsTab3.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      renderExerciseInspectorChart();
    });
  });

  // Re-draw chart on window resize to ensure fluid responsive layout
  window.addEventListener('resize', () => {
    if (inspectorModal && !inspectorModal.classList.contains('hide')) {
      renderExerciseInspectorChart();
    }
  });
});




