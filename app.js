// AuraApp - Core PWA Logic & Firebase Authentication Gateway
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


// ==========================================================================
// 1. SafeStorage Adapter to handle Private Browsing & Quota Limits safely
// ==========================================================================
const SafeStorage = {
  _fallbackMem: {},
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
    if (Object.prototype.hasOwnProperty.call(this._fallbackMem, key)) {
      return this._fallbackMem[key];
    }
    if (this.isSupported()) {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem(key, value) {
    if (this.isSupported()) {
      try {
        localStorage.setItem(key, value);
        delete this._fallbackMem[key];
        return;
      } catch (e) {
        console.warn("Storage write failed (quota exceeded?):", e);
      }
    }
    this._fallbackMem[key] = String(value);
  },
  removeItem(key) {
    delete this._fallbackMem[key];
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

// Initialize Firebase App robustly using credentials from firebase-config.js
if (window.firebaseConfig && window.firebaseConfig.apiKey && window.firebaseConfig.apiKey !== "YOUR_API_KEY") {
  try {
    app = initializeApp(window.firebaseConfig);
    auth = getAuth(app);
    
    // Force LocalStorage Persistence to prevent session loss in restrictive third-party cookie environments like Samsung Internet
    if (typeof setPersistence === 'function' && typeof browserLocalPersistence !== 'undefined') {
      setPersistence(auth, browserLocalPersistence)
        .then(() => console.log("Firebase Auth persistence set to LocalStorage successfully."))
        .catch((err) => console.warn("Failed to set Firebase Auth persistence:", err));
    }
      
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

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('google-login-btn');

const userDisplayName = document.getElementById('user-display-name');
const appUserPhoto = document.getElementById('app-user-photo');
const profilePicBtn = document.getElementById('profile-pic-btn');
const appLogoutBtn = document.getElementById('app-logout-btn');

// Standalone mode detection (PWA Installed)
const isStandalone = window.navigator.standalone === true || 
                     window.matchMedia('(display-mode: standalone)').matches;

// Safe Element Text Updater Helper
const setElText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

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

// Manage App Screen Transitions
let _switchScreenCallId = 0;
function switchScreen(signedIn) {
  const callId = ++_switchScreenCallId; // Monotonically increasing — cancels any pending transition
  const splash = document.getElementById('splash-screen');
  const isSplashActive = splash && !splash.classList.contains('fade-out') && (splash.style.display !== 'none');

  if (signedIn) {
    document.body.classList.add('authenticated');
    authScreen.classList.remove('active');
    setTimeout(() => {
      if (callId !== _switchScreenCallId) return; // Cancelled by newer call
      authScreen.style.display = 'none';
      appScreen.style.display = 'flex';
      if (isSplashActive) {
        setTimeout(() => {
          appScreen.classList.add('active');
        }, 200);
      } else {
        setTimeout(() => appScreen.classList.add('active'), 50);
      }
    }, 400);
  } else {
    document.body.classList.remove('authenticated');
    appScreen.classList.remove('active');
    setTimeout(() => {
      if (callId !== _switchScreenCallId) return; // Cancelled by newer call
      appScreen.style.display = 'none';
      authScreen.style.display = 'flex';
      if (isSplashActive) {
        setTimeout(() => {
          authScreen.classList.add('active');
        }, 200);
      } else {
        setTimeout(() => authScreen.classList.add('active'), 50);
      }
    }, 400);
  }
}

function updateAuthUI() {
  if (!currentUser) return;

  const name = currentUser.displayName || 'Unknown User';

  // Header Display Name
  setElText('user-display-name', name ? name.split(' ')[0] : 'User');

  // Photo Binding
  const fallbackPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const photoURL = currentUser.photoURL || fallbackPhoto;
  if (appUserPhoto) {
    appUserPhoto.src = photoURL;
    appUserPhoto.onerror = () => { appUserPhoto.src = fallbackPhoto; };
  }
}

// Reset DOM fields safely on Logout to avoid credential leakage
function clearUserSession() {
  currentUser = null;
  SafeStorage._fallbackMem = {};

  setElText('user-display-name', 'User');

  const fallbackPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  if (appUserPhoto) appUserPhoto.src = fallbackPhoto;

  if (appLogoutBtn) {
    appLogoutBtn.classList.add('hide');
  }
}

// Centralized function to safely unlock and reset the login button
function resetLoginButtonState() {
  SafeStorage.removeItem('authRedirectPending');
  if (loginBtn) {
    loginBtn.disabled = false;
    const googleTextNode = loginBtn.querySelector('.google-btn-text');
    if (googleTextNode) {
      googleTextNode.textContent = 'Sign in with Google';
    }
  }
}

// If returning from a redirect, disable the login button immediately to prevent double-taps
const isReturningFromRedirect = SafeStorage.getItem('authRedirectPending') === 'true';
if (isReturningFromRedirect && loginBtn) {
  loginBtn.disabled = true;
  const googleTextNode = loginBtn.querySelector('.google-btn-text');
  if (googleTextNode) googleTextNode.textContent = 'מאמת...';
  console.log("Detected return from redirect. Login button disabled pending auth resolution.");

  // Fail-safe: Release the button and clear the flag if auth doesn't resolve in 10 seconds
  // (e.g., if the user manually returns after a Google error or blocks redirects in an in-app WebView)
  setTimeout(() => {
    if (!currentUser && loginBtn.disabled) {
      console.warn("Redirect auth resolution timed out. Releasing login button.");
      resetLoginButtonState();
    }
  }, 10000);
}


// Monitor Firebase Authentication Transitions safely
if (firebaseEnabled) {
  onAuthStateChanged(auth, (user) => {
    firebaseAuthResolved = true;
    if (user) {
      SafeStorage.removeItem('authRedirectPending'); // Clear pending redirect flag
      console.log("User signed in successfully:", user.displayName);
      currentUser = user;

      updateAuthUI();
      switchScreen(true);
    } else {
      console.log("No authenticated user active.");
      resetLoginButtonState(); // Ensure button is unlocked if not logged in
      clearUserSession();
      switchScreen(false);
    }
    hideSplashScreen();
  });

  // Resolve redirect logins
  getRedirectResult(auth)
    .then((result) => {
      if (result && result.user) {
        console.log("Redirect sign-in resolved successfully for:", result.user.displayName);
        currentUser = result.user;
        updateAuthUI();
        switchScreen(true);
      }
      // If we finished resolving redirects and we are still not logged in, unlock the UI
      if (!auth.currentUser) {
        resetLoginButtonState();
      }
    })
    .catch((error) => {
      resetLoginButtonState(); // Unlock UI on error
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
  // Increased from 3.5s to 8s to accommodate slow iOS networks and redirect processing time
  setTimeout(() => {
    if (!firebaseAuthResolved) {
      // Double-check synchronous currentUser before showing login screen
      // auth.currentUser may be populated even if onAuthStateChanged hasn't fired yet
      const syncUser = auth.currentUser;
      if (syncUser) {
        console.log("Fail-safe: auth.currentUser found synchronously. Resolving as signed-in.");
        firebaseAuthResolved = true;
        currentUser = syncUser;
        updateAuthUI();
        switchScreen(true);
      } else {
        console.warn("Firebase Auth resolution timed out after 8s. Falling back to login screen.");
        resetLoginButtonState(); // Safe cleanup to unlock button
        switchScreen(false);
      }
    }
    hideSplashScreen();
  }, 8000);
} else {
  // Graceful fallback for missing config on startup
  console.log("Firebase is disabled. Auth features are unavailable.");
  switchScreen(false);
  setTimeout(hideSplashScreen, 1000);
}

// Fetch sw.js dynamically to read and display the currently running version dynamically
function loadAppVersion() {
  const versionDisplay = document.getElementById('app-version-display');
  if (!versionDisplay) return;

  fetch('./sw.js')
    .then(response => {
      if (!response.ok) throw new Error("Failed to fetch sw.js");
      return response.text();
    })
    .then(code => {
      const match = code.match(/const\s+CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
      if (match) {
        const cacheName = match[1];
        const versionStr = cacheName.replace('aura-app-v', '');
        versionDisplay.textContent = `v${versionStr}`;
        console.log(`Dynamically resolved running app version from sw.js: v${versionStr}`);
      }
    })
    .catch(err => {
      console.warn("Failed to dynamically resolve app version from sw.js, using fallback:", err);
      versionDisplay.textContent = 'v1.1'; // Robust default fallback
    });
}

window.addEventListener('DOMContentLoaded', () => {
  detectEnvironmentAndWarn();
  loadAppVersion();
});

// Beautiful glassmorphic alert for iOS Standalone PWA security restriction
function showIOSStandaloneAlert() {
  const overlay = document.createElement('div');
  overlay.id = 'ios-standalone-alert-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100dvh;
    background: rgba(9, 10, 15, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
    font-family: var(--font-sans);
    animation: fadeIn 0.4s ease-out;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    width: 100%;
    max-width: 400px;
    background: linear-gradient(135deg, hsla(225, 20%, 9%, 0.95) 0%, hsla(225, 20%, 5%, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-card);
    padding: 32px 24px;
    text-align: right;
    direction: rtl;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 35px var(--electric-blue-glow-subtle);
    position: relative;
    overflow: hidden;
    animation: slideUp 0.4s cubic-bezier(0.25, 1, 0.5, 1);
  `;

  // Neon glowing border edge
  const borderEdge = document.createElement('div');
  borderEdge.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--electric-blue) 0%, var(--neon-orange) 100%);
  `;
  card.appendChild(borderEdge);

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  `;

  const icon = document.createElement('span');
  icon.textContent = '🔒';
  icon.style.cssText = `
    font-size: 2.2rem;
    filter: drop-shadow(0 0 10px var(--neon-orange-glow));
  `;
  header.appendChild(icon);

  const title = document.createElement('h3');
  title.textContent = 'מגבלת אבטחה ב-iOS (Apple)';
  title.style.cssText = `
    margin: 0;
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--text-heading);
    font-family: var(--font-display);
  `;
  header.appendChild(title);
  card.appendChild(header);

  const bodyText = document.createElement('div');
  bodyText.style.cssText = `
    color: var(--text-muted);
    font-size: 0.95rem;
    line-height: 1.6;
    margin-bottom: 24px;
  `;
  bodyText.innerHTML = `
    עקב מגבלות האבטחה של חברת <strong>Apple</strong> במצב אפליקציה מותקנת (PWA) ב-iOS, Google אינה מאפשרת לבצע התחברות לחשבון ממסך זה.
    <br><br>
    <strong>כיצד להתחבר בקלות?</strong>
    <ol style="margin-top: 10px; margin-bottom: 10px; padding-right: 20px; color: var(--text-main); display: flex; flex-direction: column; gap: 8px;">
      <li>פתחו את דפדפן <strong>Safari</strong> הרגיל באייפון.</li>
      <li>היכנסו לכתובת האפליקציה והתחברו לחשבונכם (ההתחברות בדפדפן עובדת בצורה מלאה ומאובטחת).</li>
      <li>לאחר שהתחברתם ב-Safari, חזרו לכאן (לאפליקציה במסך הבית) ותהיו מחוברים באופן אוטומטי!</li>
    </ol>
  `;
  card.appendChild(bodyText);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'הבנתי, תודה';
  closeBtn.style.cssText = `
    width: 100%;
    background: linear-gradient(135deg, var(--electric-blue) 0%, #2563eb 100%);
    color: #ffffff;
    border: none;
    border-radius: var(--radius-btn);
    padding: 14px 20px;
    font-size: 1.05rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px rgba(255, 255, 255, 0.15);
    transition: var(--transition-smooth);
    font-family: var(--font-sans);
  `;
  
  closeBtn.addEventListener('click', () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s ease';
    setTimeout(() => {
      overlay.remove();
    }, 250);
  });
  
  card.appendChild(closeBtn);
  overlay.appendChild(card);
  
  // Dynamic slide-in keyframes style if not already exists
  if (!document.getElementById('ios-alert-animations')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'ios-alert-animations';
    styleEl.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(styleEl);
  }

  document.body.appendChild(overlay);
}

// Dynamic Mobile/Desktop & Standalone Authenticator Gateway
if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    if (!firebaseEnabled) {
      alert("Authentication features are currently unavailable because Firebase is not configured properly. Please check your config.");
      return;
    }

    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isStandaloneMode = isStandalone || (window.navigator.standalone === true) || window.matchMedia('(display-mode: standalone)').matches;

    // Handle iOS Standalone: prevent sign-in and show beautiful alert
    if (isStandaloneMode && isIOS) {
      showIOSStandaloneAlert();
      return;
    }

    loginBtn.disabled = true;
    const googleTextNode = loginBtn.querySelector('.google-btn-text');
    const originalText = googleTextNode ? googleTextNode.textContent : 'Sign in with Google';
    if (googleTextNode) googleTextNode.textContent = 'Connecting...';

    // Handle Android Standalone: use signInWithPopup
    if (isStandaloneMode && isAndroid) {
      console.log("Android Standalone PWA detected. Triggering signInWithPopup...");
      try {
        await signInWithPopup(auth, googleProvider);
        loginBtn.disabled = false;
        if (googleTextNode) googleTextNode.textContent = originalText;
      } catch (popupError) {
        console.warn("Android Standalone popup auth failed. Error:", popupError.code);
        if (popupError.code === 'auth/popup-closed-by-user' || popupError.code === 'auth/cancelled-popup-request') {
          console.log("Android Standalone: Sign-in popup was closed by user.");
          loginBtn.disabled = false;
          if (googleTextNode) googleTextNode.textContent = originalText;
          return;
        }
        handleAuthError(popupError, loginBtn, originalText);
      }
      return;
    }

    if (isMobileDevice) {
      // Both Android and iOS: Use popup first to avoid ITP / anti-tracking storage blocking
      // signInWithRedirect is broken on iOS 17+ and Samsung Internet due to cross-origin storage blocking
      console.log("Mobile device detected. Launching popup auth to avoid redirect storage issues...");
      try {
        await signInWithPopup(auth, googleProvider);
        loginBtn.disabled = false;
        if (googleTextNode) googleTextNode.textContent = originalText;
      } catch (popupError) {
        console.warn("Mobile popup auth failed. Error:", popupError.code);
        if (popupError.code === 'auth/popup-closed-by-user' || popupError.code === 'auth/cancelled-popup-request') {
          console.log("Mobile: Sign-in popup was closed by user.");
          loginBtn.disabled = false;
          if (googleTextNode) googleTextNode.textContent = originalText;
          return;
        }
        // Fallback to redirect for older mobile browsers or in-app webviews
        console.warn("Mobile popup failed, falling back to redirect...", popupError);
        if (googleTextNode) googleTextNode.textContent = 'מעביר...';
        SafeStorage.setItem('authRedirectPending', 'true');
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          SafeStorage.removeItem('authRedirectPending');
          console.error("Mobile redirect fallback auth error:", redirectError);
          handleAuthError(redirectError, loginBtn, originalText);
        }
      }
    } else {
      // Desktop
      console.log("Desktop device or Standalone PWA detected. Attempting popup...");
      try {
        await signInWithPopup(auth, googleProvider);
        loginBtn.disabled = false;
        if (googleTextNode) googleTextNode.textContent = originalText;
      } catch (popupError) {
        console.warn("Popup sign-in failed. Error code:", popupError.code);
        
        if (popupError.code === 'auth/popup-closed-by-user' || popupError.code === 'auth/cancelled-popup-request') {
          console.log("Sign-in process was cancelled by the user.");
          loginBtn.disabled = false;
          if (googleTextNode) googleTextNode.textContent = originalText;
          return;
        }
        
        if (!isStandalone) {
          console.log("Falling back to signInWithRedirect...");
          if (googleTextNode) googleTextNode.textContent = 'Redirecting...';
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
  const googleTextNode = btn.querySelector('.google-btn-text');
  if (googleTextNode) googleTextNode.textContent = originalText;
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

// Register PWA Service Worker
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.protocol === 'file:';

if ('serviceWorker' in navigator) {
  if (isLocalhost && SafeStorage.getItem('enableLocalSW') !== 'true') {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister();
        console.log("Developer Mode: Unregistered active service worker to prevent cache lock.");
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          console.log('PWA Service Worker registered successfully! Scope:', registration.scope);
          
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

// Profile photo click interaction: toggle Sign Out button visibility
if (profilePicBtn && appLogoutBtn) {
  profilePicBtn.addEventListener('click', () => {
    appLogoutBtn.classList.toggle('hide');
  });
}

// Trigger Log Out Flow cleanly supporting Firebase Auth
if (appLogoutBtn) {
  appLogoutBtn.addEventListener('click', async () => {
    if (!currentUser) {
      console.log("Logging out from guest mode...");
      clearUserSession();
      switchScreen(false);
      return;
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
