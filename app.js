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
      const activeWorker = navigator.serviceWorker.controller || reg.active;
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
      // Trigger update notification on load if we just updated successfully
      const justUpdated = SafeStorage.getItem('pwa_just_updated');
      if (justUpdated) {
        SafeStorage.removeItem('pwa_just_updated');
        setTimeout(() => {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            triggerLocalNotification(
              "העדכון הותקן בהצלחה! ✨",
              "האפליקציה עודכנה לגרסה האחרונה. תהנה מהשיפורים והעיצוב החדש!"
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
function resetTabs() {
  const navTabs = document.querySelectorAll('.ios-bottom-nav .nav-tab');
  const tabPanes = document.querySelectorAll('.tab-content-container .tab-pane');
  
  navTabs.forEach(t => t.classList.remove('active'));
  tabPanes.forEach(p => p.classList.remove('active'));
  
  const settingsTab = document.querySelector('.ios-bottom-nav .nav-tab[data-tab="settings"]');
  if (settingsTab) settingsTab.classList.add('active');
  
  const settingsPane = document.getElementById('tab-settings');
  if (settingsPane) settingsPane.classList.add('active');
}

// Binds tab clicking event listeners
const navTabs = document.querySelectorAll('.ios-bottom-nav .nav-tab');
const tabPanes = document.querySelectorAll('.tab-content-container .tab-pane');

navTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    if (!targetTab) return;

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
  });
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
let selectedExerciseForAdding = null;
let currentActiveCategoryFilter = 'הכל';

// Rest Timer State Variables
let restTimerInterval = null;
let restTimerSecondsLeft = 0;


// Initialize workouts state on user auth
function initWorkouts() {
  if (!currentUser) return;
  
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
  
  let baseCats = [];
  if (activeWorkout.location === 'gym') {
    baseCats = ['חזה', 'גב', 'כתפיים', 'רגליים', 'ידיים', 'בטן', 'אירובי'];
  } else if (activeWorkout.location === 'park') {
    baseCats = ['מתח', 'דחיפה', 'רגליים', 'ליבה ואירובי'];
  } else {
    baseCats = ['מותאם אישית'];
  }
  
  // Retrieve custom exercise categories matching current location
  const customCats = customExercises
    .filter(ex => {
      if (activeWorkout.location === 'gym' || activeWorkout.location === 'park') {
        return ex.locationType === activeWorkout.location;
      }
      return true;
    })
    .map(ex => ex.category || 'מותאם אישית');
    
  // Combine unique categories
  const allCats = ['הכל', ...new Set([...baseCats, ...customCats])];
  
  allCats.forEach(cat => {
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
  
  // Get base exercises
  let baseList = [];
  if (activeWorkout.location === 'gym') {
    baseList = [...GYM_EXERCISES];
  } else if (activeWorkout.location === 'park') {
    baseList = [...PARK_EXERCISES];
  } else {
    baseList = [...GYM_EXERCISES, ...PARK_EXERCISES];
  }
  
  // Add custom user-created exercises
  const userCustoms = customExercises.filter(ex => {
    if (activeWorkout.location === 'gym' || activeWorkout.location === 'park') {
      return ex.locationType === activeWorkout.location;
    }
    return true;
  });
  
  let fullList = [...baseList, ...userCustoms];
  
  // Remove duplicates by name
  const seen = new Set();
  fullList = fullList.filter(ex => {
    const k = ex.name.trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  
  // Filter by category
  if (currentActiveCategoryFilter !== 'הכל') {
    fullList = fullList.filter(ex => ex.category === currentActiveCategoryFilter);
  }
  
  // Filter by search query
  if (query) {
    fullList = fullList.filter(ex => ex.name.toLowerCase().includes(query));
  }
  
  if (fullList.length === 0) {
    const noResults = document.createElement('div');
    noResults.style.gridColumn = '1 / -1';
    noResults.style.textAlign = 'center';
    noResults.style.padding = '20px';
    noResults.style.color = 'var(--text-muted)';
    noResults.style.fontSize = '0.9rem';
    noResults.textContent = 'לא נמצאו תרגילים מתאימים';
    container.appendChild(noResults);
    return;
  }
  
  fullList.forEach(ex => {
    const btn = document.createElement('button');
    btn.className = 'exercise-picker-item-btn';
    btn.innerHTML = `
      <div style="font-weight: 700; text-align: right; width: 100%; color: #ffffff;">${ex.name}</div>
      <div style="font-size: 0.75rem; color: var(--text-muted); text-align: right; margin-top: 4px;">${ex.category || 'תרגיל'}</div>
    `;
    btn.addEventListener('click', () => {
      selectedExerciseForAdding = ex.name;
      
      // Hide exercise picker
      const pickerModal = document.getElementById('exercise-picker-modal');
      if (pickerModal) pickerModal.classList.add('hide');
      
      // Open metric selector modal
      const metricModal = document.getElementById('metric-selector-modal');
      if (metricModal) metricModal.classList.remove('hide');
    });
    container.appendChild(btn);
  });
}

// Bind workout setup events on DOM Ready
onDOMReady(() => {
  // Close modals when clicking on their background overlay
  document.querySelectorAll('.workout-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hide');
        selectedExerciseForAdding = null;
      }
    });
  });

  // Search input filter listener
  const searchInput = document.getElementById('exercise-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', renderExercisePickerList);
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

  // Open Custom Exercise Modal
  const openCustomExModalBtn = document.getElementById('open-custom-exercise-modal-btn');
  if (openCustomExModalBtn) {
    openCustomExModalBtn.addEventListener('click', () => {
      const modal = document.getElementById('custom-exercise-modal');
      if (modal) modal.classList.remove('hide');
    });
  }

  // Close Custom Exercise Modal
  const closeCustomExModalBtn = document.getElementById('close-custom-exercise-modal-btn');
  if (closeCustomExModalBtn) {
    closeCustomExModalBtn.addEventListener('click', () => {
      const modal = document.getElementById('custom-exercise-modal');
      if (modal) modal.classList.add('hide');
    });
  }

  // Save Custom Exercise inside Modal
  const saveCustomExModalBtn = document.getElementById('save-custom-exercise-modal-btn');
  if (saveCustomExModalBtn) {
    saveCustomExModalBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('custom-exercise-new-name-input');
      const categorySelect = document.getElementById('custom-exercise-new-category-select');
      
      if (!nameInput || nameInput.value.trim() === '') {
        alert('אנא הזן שם לתרגיל המותאם אישית.');
        return;
      }
      
      if (!categorySelect || categorySelect.value === '') {
        alert('אנא בחר קטגוריה.');
        return;
      }
      
      const exName = nameInput.value.trim();
      const exCategory = categorySelect.value;
      
      const newEx = {
        name: exName,
        category: exCategory,
        locationType: activeWorkout ? activeWorkout.location : 'custom'
      };
      
      customExercises.push(newEx);
      if (currentUser) {
        SafeStorage.setItem(`aura-custom-exercises_${currentUser.uid}`, JSON.stringify(customExercises));
      }
      
      nameInput.value = '';
      categorySelect.selectedIndex = 0;
      
      const modal = document.getElementById('custom-exercise-modal');
      if (modal) modal.classList.add('hide');
      
      // Auto-select and trigger metrics choice
      selectedExerciseForAdding = exName;
      
      const pickerModal = document.getElementById('exercise-picker-modal');
      if (pickerModal) pickerModal.classList.add('hide');
      
      const metricModal = document.getElementById('metric-selector-modal');
      if (metricModal) metricModal.classList.remove('hide');
      
      renderExercisePickerFilters();
      renderExercisePickerList();
    });
  }

  // Bind Metric Selector Tiles click using robust document-level event delegation
  document.addEventListener('click', (e) => {
    const tile = e.target.closest('.metric-tile');
    if (!tile) return;
    
    const metricType = tile.getAttribute('data-metric');
    console.log('Metric selection clicked (delegated):', metricType, 'for exercise:', selectedExerciseForAdding);
    
    if (selectedExerciseForAdding && activeWorkout) {
      activeWorkout.exercises.push({
        name: selectedExerciseForAdding,
        metricType: metricType,
        completed: false,
        sets: [
          { reps: '', weight: '', completed: false }
        ]
      });
      saveActiveWorkoutState();
      renderExercises();
      
      const metricModal = document.getElementById('metric-selector-modal');
      if (metricModal) metricModal.classList.add('hide');
      selectedExerciseForAdding = null;
    } else {
      console.warn('Metric selection ignored because selectedExerciseForAdding or activeWorkout is missing.');
    }
  });
});

// Add Exercise Button Listener
const addExerciseBtn = document.getElementById('add-exercise-btn');
if (addExerciseBtn) {
  addExerciseBtn.addEventListener('click', () => {
    if (!activeWorkout) return;
    
    // Discard any exercises that have 0 completed sets to prevent clogging
    activeWorkout.exercises = activeWorkout.exercises.filter(ex => ex.sets.some(s => s.completed));
    saveActiveWorkoutState();
    renderExercises();
    
    // Guard: Can't add if there is any active exercise not completed
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
  
  const hasUncompleted = activeWorkout.exercises.some(ex => !ex.completed);
  
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
        // Validate at least one set is completed
        const hasCompletedSets = ex.sets.some(s => s.completed);
        if (!hasCompletedSets) {
          alert('אנא השלם לפחות סט אחד.');
          return;
        }
        
        ex.completed = true;
        // Clean out any trailing incomplete sets on save for user convenience
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
    
    // Sets Header Row
    const setsHeader = document.createElement('div');
    setsHeader.className = 'sets-header-row';
    
    let headerHTML = '';
    if (metricType === 'both') {
      headerHTML = `
        <div>מחק</div>
        <div>משקל (ק״ג)</div>
        <div>חזרות</div>
        <div>סט</div>
      `;
    } else if (metricType === 'reps') {
      headerHTML = `
        <div>מחק</div>
        <div>חזרות</div>
        <div>סט</div>
      `;
    } else if (metricType === 'weight') {
      headerHTML = `
        <div>מחק</div>
        <div>משקל (ק״ג)</div>
        <div>סט</div>
      `;
    }
    setsHeader.innerHTML = headerHTML;
    setsArea.appendChild(setsHeader);
    
    // Filter/slice sets: show completed sets plus EXACTLY ONE active incomplete set if exercise not completed
    let visibleSets = [];
    if (ex.completed) {
      visibleSets = [...ex.sets];
    } else {
      const firstIncompleteIdx = ex.sets.findIndex(s => !s.completed);
      if (firstIncompleteIdx === -1) {
        visibleSets = [...ex.sets];
      } else {
        visibleSets = ex.sets.slice(0, firstIncompleteIdx + 1);
      }
    }
    
    visibleSets.forEach((set) => {
      const realSetIdx = ex.sets.indexOf(set);
      const setRow = document.createElement('div');
      setRow.className = `set-row ${set.completed ? 'completed' : ''}`;
      
      // Remove Set Button
      const removeSetBtn = document.createElement('button');
      removeSetBtn.className = 'remove-set-btn';
      removeSetBtn.innerHTML = '✕';
      removeSetBtn.disabled = ex.completed || set.completed; // lock completed sets
      removeSetBtn.addEventListener('click', () => {
        if (ex.sets.length > 1) {
          ex.sets.splice(realSetIdx, 1);
          saveActiveWorkoutState();
          renderExercises();
        } else {
          alert('תרגיל חייב להכיל לפחות סט אחד.');
        }
      });
      setRow.appendChild(removeSetBtn);
      
      // Weight Input (shown if both or weight)
      let weightInput = null;
      if (metricType === 'both' || metricType === 'weight') {
        const weightWrapper = document.createElement('div');
        weightWrapper.className = 'set-input-wrapper';
        weightInput = document.createElement('input');
        weightInput.type = 'number';
        weightInput.className = 'set-input';
        weightInput.placeholder = '-';
        weightInput.value = set.weight;
        weightInput.disabled = ex.completed || set.completed;
        weightInput.addEventListener('input', (e) => {
          set.weight = e.target.value;
          saveActiveWorkoutState();
        });
        weightWrapper.appendChild(weightInput);
        setRow.appendChild(weightWrapper);
      }
      
      // Reps Input (shown if both or reps)
      let repsInput = null;
      if (metricType === 'both' || metricType === 'reps') {
        const repsWrapper = document.createElement('div');
        repsWrapper.className = 'set-input-wrapper';
        repsInput = document.createElement('input');
        repsInput.type = 'number';
        repsInput.className = 'set-input';
        repsInput.placeholder = '-';
        repsInput.value = set.reps;
        repsInput.disabled = ex.completed || set.completed;
        repsInput.addEventListener('input', (e) => {
          set.reps = e.target.value;
          saveActiveWorkoutState();
        });
        repsWrapper.appendChild(repsInput);
        setRow.appendChild(repsWrapper);
      }
      
      // Set Checkmark Button (Status toggle)
      const checkWrapper = document.createElement('div');
      checkWrapper.className = 'set-input-wrapper';
      const checkBtn = document.createElement('button');
      checkBtn.className = `set-checkmark-btn ${set.completed ? 'completed' : ''}`;
      checkBtn.textContent = set.completed ? '✓' : String(realSetIdx + 1);
      checkBtn.disabled = ex.completed;
      
      checkBtn.addEventListener('click', () => {
        if (set.completed) {
          // Toggle off
          set.completed = false;
          saveActiveWorkoutState();
          renderExercises();
        } else {
          // Validate according to metric configuration
          let hasReps = true;
          let hasWeight = true;
          
          if (metricType === 'both' || metricType === 'reps') {
            hasReps = repsInput && repsInput.value.trim() !== '' && Number(repsInput.value) > 0;
          }
          if (metricType === 'both' || metricType === 'weight') {
            hasWeight = weightInput && weightInput.value.trim() !== '' && Number(weightInput.value) >= 0;
          }
          
          if (!hasReps && (metricType === 'both' || metricType === 'reps')) {
            alert('אנา הזן מספר חזרות תקין.');
            if (repsInput) repsInput.focus();
            return;
          }
          if (!hasWeight && (metricType === 'both' || metricType === 'weight')) {
            alert('אנא הזן משקל תקין.');
            if (weightInput) weightInput.focus();
            return;
          }
          
          if (repsInput) set.reps = repsInput.value;
          if (weightInput) set.weight = weightInput.value;
          set.completed = true;
          saveActiveWorkoutState();
          renderExercises();
 
          // Trigger premium Rest Timer countdown
          if (typeof startRestTimer === 'function') startRestTimer(90);
        }
      });
      checkWrapper.appendChild(checkBtn);
      setRow.appendChild(checkWrapper);
      
      setsArea.appendChild(setRow);
    });
    
    // Add Set Button - Only show if exercise is not completed AND the last set is completed!
    if (!ex.completed) {
      const lastSet = ex.sets[ex.sets.length - 1];
      if (lastSet && lastSet.completed) {
        const addSetBtn = document.createElement('button');
        addSetBtn.className = 'add-set-btn';
        addSetBtn.textContent = '➕ הוסף סט חדש';
        addSetBtn.addEventListener('click', () => {
          ex.sets.push({
            reps: lastSet.reps || '',
            weight: lastSet.weight || '',
            completed: false
          });
          saveActiveWorkoutState();
          renderExercises();
        });
        setsArea.appendChild(addSetBtn);
      }
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
  
  if (activeView) activeView.classList.add('hide');
  if (idleView) {
    idleView.classList.add('active');
    idleView.classList.remove('hide');
  }
}

// Render Workout History list in Tab 3
function renderWorkoutHistory() {
  const listContainer = document.getElementById('workout-history-list');
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  if (workoutHistory.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'history-empty-state';
    emptyState.innerHTML = `
      <span class="empty-state-emoji">📊</span>
      <h3 style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; color: #ffffff;">אין אימונים מוקלטים עדיין</h3>
      <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.5; margin-top: 6px;">האימונים שתבצע ותסיים יישמרו כאן לצמיתות בצורה מסודרת עם פרטי נפח ומשכים!</p>
    `;
    listContainer.appendChild(emptyState);
    return;
  }
  
  // Sort history descending (latest first)
  const sorted = [...workoutHistory].sort((a, b) => b.date - a.date);
  
  sorted.forEach(log => {
    const card = document.createElement('div');
    card.className = 'history-card';
    
    // Calculate total sets & volume
    let totalSets = 0;
    let totalVolume = 0;
    
    log.exercises.forEach(ex => {
      ex.sets.forEach(set => {
        if (set.completed) {
          totalSets++;
          const reps = Number(set.reps) || 0;
          const weight = Number(set.weight) || 0;
          totalVolume += (reps * weight);
        }
      });
    });
    
    // Duration formatting
    let durationText = '';
    if (log.duration < 60) {
      durationText = 'פחות מדקה';
    } else if (log.duration < 3600) {
      durationText = `${Math.floor(log.duration / 60)} דק׳`;
    } else {
      const hrs = Math.floor(log.duration / 3600);
      const mins = Math.floor((log.duration % 3600) / 60);
      durationText = `${hrs} שעות ו-${mins} דק׳`;
    }
    
    // Date formatting (Hebrew)
    const dateObj = new Date(log.date);
    const dateFormatted = dateObj.toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
    
    card.innerHTML = `
      <div class="history-card-header">
        <span class="history-card-badge ${log.location === 'gym' ? 'badge-gym' : 'badge-park'}">
          ${log.location === 'gym' ? '🏋️‍♂️ חדר כושר' : '🌳 פארק'}
        </span>
        <div class="history-card-date">${dateFormatted}</div>
      </div>
      <div class="history-card-stats">
        <div class="history-stat">⏱️ <strong>${durationText}</strong></div>
        <div class="history-stat">💪 <strong>${log.exercises.length} תרגילים</strong> (${totalSets} סטים)</div>
        <div class="history-stat">📊 נפח: <strong>${totalVolume.toLocaleString()} ק״ג</strong></div>
      </div>
    `;
    
    // Card clicking opens Edit Modal
    card.addEventListener('click', () => {
      openEditModal(log.id);
    });
    
    listContainer.appendChild(card);
  });
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
    
    metaContainer.innerHTML = `
      <div>📍 <strong>${editingWorkout.location === 'gym' ? 'חדר כושר' : 'פארק'}</strong></div>
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
  
  const isDarkMode = SafeStorage.getItem('settings_dark_mode') === 'true';

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




