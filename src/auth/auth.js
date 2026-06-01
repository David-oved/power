import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from "../state.js";
import { SafeStorage } from "../utils/storage.js";
import { triggerLocalNotification, getInitialsAvatar, showPremiumToast } from "../utils/helpers.js";

// DOM Elements
let authScreen;
let appScreen;
let loginBtn;
let logoutBtn;
let userDisplayName;
let navUserPhoto;
let settingsUserPhoto;
let settingsUserPhotoMain;
let floatingUserPhoto;

// Safe helper to update text contents safely
const setElText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

// Reset DOM fields safely on Logout to avoid credential leakage
export function clearUserSession() {
  state.currentUser = null;
  state.currentUserRole = 'user';
  SafeStorage._fallbackMem = {};
  SafeStorage._failedKeys = {};

  // Close drawer if it was defined, otherwise ignore safely
  const closeDrawerBtn = document.getElementById('drawer-close-btn');
  if (closeDrawerBtn) closeDrawerBtn.click();

  setElText('user-display-name', 'User');
  setElText('settings-user-name-field', 'User');
  setElText('settings-user-email-field', 'user@gmail.com');
  setElText('settings-user-name-main', 'משתמש');
  
  const mainView = document.getElementById('settings-main-view');
  const accountView = document.getElementById('settings-account-view');
  const adminView = document.getElementById('settings-admin-view');
  const adminRowGroup = document.getElementById('row-settings-admin-group');

  if (mainView) mainView.classList.remove('hide');
  if (accountView) accountView.classList.add('hide');
  if (adminView) adminView.classList.add('hide');
  if (adminRowGroup) adminRowGroup.classList.add('hide');

  const initialsFallback = getInitialsAvatar('User');
  if (navUserPhoto) navUserPhoto.src = initialsFallback;
  if (settingsUserPhoto) settingsUserPhoto.src = initialsFallback;
  if (settingsUserPhotoMain) settingsUserPhotoMain.src = initialsFallback;
  if (floatingUserPhoto) floatingUserPhoto.src = initialsFallback;
  
  // Reset tabs to default Settings tab upon logout
  if (window.resetTabs) window.resetTabs();

  // Call clean sessions globally or dynamically
  if (window.clearWorkoutSession) window.clearWorkoutSession();
}

// Manage App Screen Transitions with premium animations
export function switchScreen(signedIn) {
  const splash = document.getElementById('splash-screen');
  const isSplashActive = splash && !splash.classList.contains('fade-out') && (splash.style.display !== 'none');

  if (signedIn) {
    if (logoutBtn) logoutBtn.classList.remove('hide');
    document.body.classList.add('authenticated');
    if (authScreen) authScreen.classList.remove('active');
    
    setTimeout(() => {
      if (authScreen) authScreen.style.display = 'none';
      if (appScreen) appScreen.style.display = 'flex';
      
      const transitionDelay = isSplashActive ? 200 : 50;
      setTimeout(() => {
        if (appScreen) appScreen.classList.add('active');
      }, transitionDelay);
    }, 400);
  } else {
    if (logoutBtn) logoutBtn.classList.add('hide');
    document.body.classList.remove('authenticated');
    if (appScreen) appScreen.classList.remove('active');
    
    setTimeout(() => {
      if (appScreen) appScreen.style.display = 'none';
      if (authScreen) authScreen.style.display = 'flex';
      
      const transitionDelay = isSplashActive ? 200 : 50;
      setTimeout(() => {
        if (authScreen) authScreen.classList.add('active');
      }, transitionDelay);
    }, 400);
  }
}

// Update the user details everywhere in DOM
export function updateAuthUI() {
  if (!state.currentUser) return;

  const name = state.currentUser.displayName || 'Unknown User';
  const email = state.currentUser.email || '--';

  // Header Display Name
  setElText('user-display-name', name ? name.split(' ')[0] : 'User');
  setElText('settings-user-name-field', name);
  setElText('settings-user-email-field', email);
  setElText('settings-user-name-main', name);

  // Photo Binding
  const initialsFallback = getInitialsAvatar(name);
  const photoURL = state.currentUser.photoURL || initialsFallback;

  if (navUserPhoto) {
    navUserPhoto.src = photoURL;
    navUserPhoto.onerror = () => { navUserPhoto.src = initialsFallback; };
  }
  if (settingsUserPhoto) {
    settingsUserPhoto.src = photoURL;
    settingsUserPhoto.onerror = () => { settingsUserPhoto.src = initialsFallback; };
  }
  if (settingsUserPhotoMain) {
    settingsUserPhotoMain.src = photoURL;
    settingsUserPhotoMain.onerror = () => { settingsUserPhotoMain.src = initialsFallback; };
  }
  if (floatingUserPhoto) {
    floatingUserPhoto.src = photoURL;
    floatingUserPhoto.onerror = () => { floatingUserPhoto.src = initialsFallback; };
  }

  // Populate system role diagnostic field
  const roleField = document.getElementById('settings-user-role-field');
  if (roleField) {
    if (state.currentUserRole === 'admin') {
      roleField.textContent = "מנהל מערכת 👑";
      roleField.style.color = "#ff9500";
    } else {
      roleField.textContent = "משתמש רגיל 👥";
      roleField.style.color = "#8e8e93";
    }
  }
}

// Translate auth error codes into friendly Hebrew
function handleAuthError(error, btn, originalText) {
  btn.disabled = false;
  const btnTextEl = btn.querySelector('.google-btn-text');
  if (btnTextEl) btnTextEl.textContent = originalText;
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
  showPremiumToast(userFriendlyMessage, "error");
}

// Proactive Environment Warnings (WhatsApp/Telegram/Private Tabs/Android WebViews/Local Files)
export function detectEnvironmentAndWarn() {
  const storageOk = SafeStorage.isSupported();
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Android/iOS internal App browser identification
  const isKnownInApp = /FBAN|FBAV|Instagram|Twitter|FBIOS|Messenger|WhatsApp|Telegram|Line|WeChat/i.test(userAgent);
  const isAndroidWebView = /Android/i.test(userAgent) && /wv/i.test(userAgent);
  const isInApp = isKnownInApp || isAndroidWebView;
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

// Authorized Admin Accounts (Developer / Owner email addresses)
export const ADMIN_EMAILS = [
  "wbddwd55@gmail.com",
  "wbddw2013@gmail.com",
  "admin@example.com",
  "wbddw@example.com"
];

// Secure Firestore User Profile Synchronization & Role Resolution
export async function syncUserProfileAndRole(user) {
  if (!state.db) {
    console.warn("Firestore db instance not available. Defaulting to user role.");
    state.currentUserRole = 'user';
    return;
  }

  const userDocRef = doc(state.db, "users", user.uid);
  try {
    const userDoc = await getDoc(userDocRef);
    let resolvedRole = 'user';
    const cleanEmail = user.email ? user.email.trim().toLowerCase() : '';
    const isDefaultAdmin = ADMIN_EMAILS.some(email => email.trim().toLowerCase() === cleanEmail);

    console.log("AuraApp Role Resolver Diagnostic:", {
      providedEmail: user.email,
      cleanedEmail: cleanEmail,
      isDefaultAdmin: isDefaultAdmin,
      adminEmailsList: ADMIN_EMAILS
    });

    if (!userDoc.exists()) {
      // User is logging in for the very first time (create profile)
      resolvedRole = isDefaultAdmin ? 'admin' : 'user';
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'משתמש',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        role: resolvedRole
      });
      console.log(`Created new profile for ${user.displayName} (${user.email}). Assigned role: ${resolvedRole}`);
    } else {
      // User already exists in the Firestore database
      const existingData = userDoc.data();
      
      // Auto-promote to admin if email matches hardcoded array and DB role is outdated
      if (isDefaultAdmin && existingData.role !== 'admin') {
        resolvedRole = 'admin';
      } else {
        resolvedRole = existingData.role || 'user';
      }

      await setDoc(userDocRef, {
        lastLogin: serverTimestamp(),
        displayName: user.displayName || existingData.displayName || 'משתמש',
        photoURL: user.photoURL || existingData.photoURL || '',
        role: resolvedRole
      }, { merge: true });
      
      console.log(`Synced profile for ${user.displayName}. Resolved role: ${resolvedRole}`);
    }

    state.currentUserRole = resolvedRole;
  } catch (err) {
    console.error("Failed to sync profile with Firestore:", err);
    throw err;
  }
}

// Initialize Auth
export function initAuth() {
  authScreen = document.getElementById('auth-screen');
  appScreen = document.getElementById('app-screen');
  loginBtn = document.getElementById('google-login-btn');
  logoutBtn = document.getElementById('app-logout-btn');
  userDisplayName = document.getElementById('user-display-name');
  navUserPhoto = document.getElementById('nav-user-photo');
  settingsUserPhoto = document.getElementById('settings-user-photo');
  settingsUserPhotoMain = document.getElementById('settings-user-photo-main');
  floatingUserPhoto = document.getElementById('floating-user-photo');

  // Set compatibility mappings for dormant code
  window.clearUserSession = clearUserSession;

  // Initialize Firebase dynamically
  if (window.firebaseConfig && window.firebaseConfig.apiKey && window.firebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
      state.app = initializeApp(window.firebaseConfig);
      state.auth = getAuth(state.app);
      state.db = getFirestore(state.app);
      state.googleProvider = new GoogleAuthProvider();
      state.googleProvider.setCustomParameters({ prompt: 'select_account' });
      state.firebaseEnabled = true;
      console.log("Firebase Auth & Firestore initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize Firebase Auth module:", error);
    }
  } else {
    console.error("Firebase configuration missing or invalid! Auth flows disabled.");
  }

  // Detect and Warn on environment
  detectEnvironmentAndWarn();

  // Binds event listeners
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      if (!state.firebaseEnabled) {
        showPremiumToast("שירותי ההתחברות אינם זמינים כעת עקב בעיית תצורה ב-Firebase.", "error");
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

      try {
        console.log("Attempting Google Authentication via popup...");
        await signInWithPopup(state.auth, state.googleProvider);
        console.log("Logged in successfully via popup!");
        loginBtn.disabled = false;
        if (btnTextEl) btnTextEl.textContent = originalText;
      } catch (popupError) {
        console.warn("Popup authentication failed/blocked. Code:", popupError.code, popupError.message);
        
        if (popupError.code === 'auth/account-exists-with-different-credential') {
          showPremiumToast("קיים כבר חשבון רשום עם כתובת אימייל זו במערכת. אנא פנה לתמיכה לצורך מיזוג חשבונות.", "error");
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

        // Redirect fallback
        console.log("Falling back dynamically to signInWithRedirect...");
        if (btnTextEl) btnTextEl.textContent = 'Redirecting...';
        try {
          await signInWithRedirect(state.auth, state.googleProvider);
        } catch (redirectError) {
          console.error("Redirect fallback authentication error:", redirectError);
          if (redirectError.code === 'auth/account-exists-with-different-credential') {
            showPremiumToast("קיים כבר חשבון רשום עם כתובת אימייל זו במערכת. אנא פנה לתמיכה לצורך מיזוג חשבונות.", "error");
            loginBtn.disabled = false;
            if (btnTextEl) btnTextEl.textContent = originalText;
          } else {
            handleAuthError(redirectError, loginBtn, originalText);
          }
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if ('Notification' in window && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch (err) {
          console.warn("Could not request notification permission on logout click:", err);
        }
      }

      if (!state.firebaseEnabled) {
        showPremiumToast("התנתקות אינה זמינה במצב לא מקוון/דמו.", "error");
        return;
      }

      try {
        await signOut(state.auth);
        console.log("Session signed out successfully.");
      } catch (error) {
        console.error("Sign-out process encountered an error:", error);
      }
    });
  }

  // Handle Firebase auth checking state changes
  let initialAuthCheckDone = false;
  if (state.firebaseEnabled) {
    onAuthStateChanged(state.auth, (user) => {
      state.firebaseAuthResolved = true;
      const isLoginTransition = initialAuthCheckDone && user && !state.currentUser;
      const isLogoutTransition = initialAuthCheckDone && !user && state.currentUser;

      if (user) {
        console.log("User signed in successfully:", user.displayName);
        state.currentUser = user;

        syncUserProfileAndRole(user).then(() => {
          updateAuthUI();
          
          // Dynamic initializers
          if (window.initWorkouts) window.initWorkouts();
          if (window.checkAdminViewAccessibility) window.checkAdminViewAccessibility();
          
          switchScreen(true);

          const hasBeenWelcomed = sessionStorage.getItem('aura_session_welcomed');
          if (isLoginTransition && !hasBeenWelcomed && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            triggerLocalNotification(
              "התחברת בהצלחה! 👋",
              `ברוך הבא ל-Aura, ${user.displayName || 'משתמש'}!`
            );
            sessionStorage.setItem('aura_session_welcomed', 'true');
          } else {
            sessionStorage.setItem('aura_session_welcomed', 'true');
          }
        }).catch(err => {
          console.log("Failed to resolve user database profile, falling back to offline mode:", err);
          state.currentUserRole = 'user';
          updateAuthUI();
          if (window.initWorkouts) window.initWorkouts();
          if (window.checkAdminViewAccessibility) window.checkAdminViewAccessibility();
          switchScreen(true);
          
          // Visual toast with Firestore diagnostic details
          showPremiumToast("שגיאת סנכרון: " + (err.message || err), "error");
        });
      } else {
        console.log("No authenticated user active.");
        const prevUser = state.currentUser;
        
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
      
      const splash = document.getElementById('splash-screen');
      if (splash) {
        if (!splash.classList.contains('fade-out')) {
          splash.classList.add('fade-out');
          setTimeout(() => {
            splash.style.display = 'none';
          }, 600);
        }
      }
    });

    // Resolve redirect result
    getRedirectResult(state.auth)
      .then((result) => {
        if (result && result.user) {
          console.log("Redirect sign-in resolved successfully for:", result.user.displayName);
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
          showPremiumToast("קיים כבר חשבון רשום עם כתובת אימייל זו במערכת. אנא פנה לתמיכה לצורך מיזוג חשבונות.", "error");
          return;
        }
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
          console.log("Sign-in process was cancelled by the user.");
        } else if (error.code === 'auth/web-storage-unsupported') {
          showPremiumToast("שים לב: הדפדפן הנוכחי שלך חוסם עוגיות או פועל במצב גלישה בסתר. אנא פתח את האפליקציה בדפדפן הרגיל כדי להתחבר בהצלחה.", "error");
        } else {
          showPremiumToast(`שגיאת התחברות: ${error.message || 'נא לפתוח בדפדפן Chrome/Safari הרגיל'}`, "error");
        }
      });

    // Fail-safe: Hide the splash screen after 8 seconds if Firebase fails or hangs on startup
    setTimeout(() => {
      if (!state.firebaseAuthResolved) {
        console.warn("Firebase Auth resolution timed out. Falling back to offline/auth login screen.");
        switchScreen(false);
      }
      const splash = document.getElementById('splash-screen');
      if (splash && splash.style.display !== 'none') {
        splash.classList.add('fade-out');
        setTimeout(() => splash.style.display = 'none', 600);
      }
    }, 8000);
  } else {
    console.log("Firebase is disabled. Auth features are unavailable.");
    switchScreen(false);
    setTimeout(() => {
      const splash = document.getElementById('splash-screen');
      if (splash) {
        splash.classList.add('fade-out');
        setTimeout(() => splash.style.display = 'none', 600);
      }
    }, 1000);
  }
}
