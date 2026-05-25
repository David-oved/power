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
  if (floatingUserPhoto) floatingUserPhoto.src = fallbackPhoto;
  if (drawerUserPhoto) drawerUserPhoto.src = fallbackPhoto;
  
  // Reset tabs to default Settings tab upon logout
  resetTabs();

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


