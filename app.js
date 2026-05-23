// AuraApp - Core PWA Logic & Firebase Authentication Gateway
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 1. Initialize Firebase App using credentials from firebase-config.js robustly
let app;
let auth;
let googleProvider;
let firebaseEnabled = false;

if (window.firebaseConfig && window.firebaseConfig.apiKey && window.firebaseConfig.apiKey !== "YOUR_API_KEY") {
  try {
    app = initializeApp(window.firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    
    // Custom parameters to ensure the account selector shows up nicely
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
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
const logoutBtn = document.getElementById('logout-btn');

// User details DOM outlets
const userDisplayName = document.getElementById('user-display-name');
const userFullName = document.getElementById('user-full-name');
const userEmail = document.getElementById('user-email');
const userPhoto = document.getElementById('user-photo');

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

function safeFormatDateTime(value) {
  if (!value) return 'N/A';
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    return new Date(num).toLocaleString();
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
}

// Resolve the incoming redirect sign-in result on page load gracefully
if (firebaseEnabled) {
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        console.log("Redirect sign-in resolved successfully for:", result.user.displayName);
      }
    })
    .catch((error) => {
      console.error("Error resolving redirect result:", error.code, error.message);
      // Handle known redirect errors gracefully
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        console.log("Sign-in process was cancelled by the user.");
      } else {
        alert(`Authentication Error during redirect: ${error.message}`);
      }
    });
}

// Helper to hide splash screen overlay
function hideSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    if (!splash.classList.contains('fade-out')) {
      splash.classList.add('fade-out');
      // Set display to none after transition completes
      setTimeout(() => {
        splash.style.display = 'none';
      }, 600); // matching smooth transition in style.css
    }
  }
}

// 2. Manage App Screen Transitions adapted for Premium Splash Screen Overlay
function switchScreen(signedIn) {
  const splash = document.getElementById('splash-screen');
  const isSplashActive = splash && !splash.classList.contains('fade-out') && (splash.style.display !== 'none');

  if (signedIn) {
    authScreen.classList.remove('active');
    setTimeout(() => {
      authScreen.style.display = 'none';
      appScreen.style.display = 'flex';
      
      if (isSplashActive) {
        // Wait until splash screen fades out to animate app screen active
        setTimeout(() => {
          appScreen.classList.add('active');
        }, 500);
      } else {
        setTimeout(() => appScreen.classList.add('active'), 50);
      }
    }, 400);
  } else {
    appScreen.classList.remove('active');
    setTimeout(() => {
      appScreen.style.display = 'none';
      authScreen.style.display = 'flex';
      
      if (isSplashActive) {
        // Wait until splash screen fades out to animate auth screen active
        setTimeout(() => {
          authScreen.classList.add('active');
        }, 500);
      } else {
        setTimeout(() => authScreen.classList.add('active'), 50);
      }
    }, 400);
  }
}

// Safe Element Text Updater Helper
const setElText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

// 3. Monitor Firebase Authentication State Transitions
if (firebaseEnabled) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("User signed in successfully:", user.displayName);
      
      // Bind credentials securely to dashboard widgets
      setElText('user-display-name', user.displayName ? user.displayName.split(' ')[0] : 'User');
      setElText('user-full-name', user.displayName || 'Unknown User');
      setElText('user-email', user.email || '--');
      
      // Fallback if user lacks profile photo
      if (userPhoto) {
        userPhoto.src = user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
        userPhoto.onerror = () => {
          userPhoto.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
        };
      }

      // Populate dynamic security and metadata stats safely
      setElText('user-uid', user.uid);
      setElText('user-provider', user.providerData?.[0]?.providerId || 'google.com');
      
      const createdTime = user.metadata.createdAt || user.metadata.creationTime;
      setElText('user-created', safeFormatDate(createdTime));
      
      const loginTime = user.metadata.lastLoginAt || user.metadata.lastSignInTime;
      setElText('user-last-login', safeFormatDateTime(loginTime));
      
      // Email verified badge
      const badgeVerified = document.getElementById('user-verified-badge');
      if (badgeVerified) {
        if (user.emailVerified) {
          badgeVerified.textContent = 'Verified';
          badgeVerified.className = 'badge-mini badge-verified';
        } else {
          badgeVerified.textContent = 'Unverified';
          badgeVerified.className = 'badge-mini badge-unverified';
        }
      }
      
      // Format and dump raw JSON representation of Google credentials
      const cleanUser = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        emailVerified: user.emailVerified,
        photoURL: user.photoURL,
        metadata: {
          createdAt: user.metadata.createdAt || user.metadata.creationTime,
          lastLoginAt: user.metadata.lastLoginAt || user.metadata.lastSignInTime
        },
        providerData: user.providerData
      };
      
      const jsonCode = document.getElementById('user-json-code');
      if (jsonCode) {
        jsonCode.textContent = JSON.stringify(cleanUser, null, 2);
      }

      switchScreen(true);
    } else {
      console.log("No authenticated user active.");
      switchScreen(false);
    }
    
    // Hide splash screen overlay once initial auth state is determined
    hideSplashScreen();
  });
} else {
  // Graceful fallback when Firebase is missing/unconfigured
  console.log("Firebase is disabled. Running in offline/demo mode.");
  switchScreen(false);
  setTimeout(() => {
    hideSplashScreen();
  }, 1000);
}

// 4. Trigger Google Sign-In Flow (Hybrid Strategy: Popup first, Redirect fallback)
loginBtn.addEventListener('click', async () => {
  if (!firebaseEnabled) {
    alert("Authentication features are currently unavailable because Firebase is not configured properly. Please check your config.");
    return;
  }

  loginBtn.disabled = true;
  const originalText = loginBtn.querySelector('.google-btn-text').textContent;
  loginBtn.querySelector('.google-btn-text').textContent = 'Connecting...';

  try {
    // Try Popup first (ideal for Desktop, bypassed popups restrictions, instant login)
    await signInWithPopup(auth, googleProvider);
    console.log("Logged in successfully via Popup!");
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      // User simply closed the popup: do not automatically trigger redirect
      console.log("Popup closed by the user.");
      alert("Sign-in process was cancelled. You can try again whenever you're ready!");
      loginBtn.disabled = false;
      loginBtn.querySelector('.google-btn-text').textContent = originalText;
    } else if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported') {
      // Fallback to Redirect only for compatibility/popup-blocked issues!
      console.log("Popup blocked or unsupported. Falling back to Redirect...");
      loginBtn.querySelector('.google-btn-text').textContent = 'Redirecting...';
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError) {
        console.error("Redirect auth error:", redirectError);
        alert(`Authentication Error: ${redirectError.message}`);
        loginBtn.disabled = false;
        loginBtn.querySelector('.google-btn-text').textContent = originalText;
      }
    } else {
      console.error("Popup auth error:", error.code, error.message);
      alert(`Authentication Error: ${error.message}`);
      loginBtn.disabled = false;
      loginBtn.querySelector('.google-btn-text').textContent = originalText;
    }
  }
});

// 5. Trigger Log Out Flow
logoutBtn.addEventListener('click', async () => {
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

// 6. Register PWA Service Worker (Only in production/deployed environment)
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.protocol === 'file:';

if ('serviceWorker' in navigator) {
  if (isLocalhost) {
    // Unregister any active service workers on localhost to avoid developer cache lockouts!
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister();
        console.log("Developer Mode: Unregistered active service worker to prevent cache lock.");
      }
    });
  } else {
    // Register normally in production (e.g. GitHub Pages)
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((registration) => {
          console.log('PWA Service Worker registered successfully! Scope:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker registration encountered an error:', error);
        });
    });
  }
}

// 7. Interactive Glass Card Hover Tracking (HIGHLY OPTIMIZED)
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--x', `${x}px`);
    card.style.setProperty('--y', `${y}px`);
  });
});

// 8. Collapsible JSON Terminal Toggle
const jsonToggle = document.getElementById('json-toggle');
const jsonContainer = document.getElementById('json-terminal-container');
const toggleArrow = document.getElementById('toggle-arrow');

if (jsonToggle) {
  jsonToggle.addEventListener('click', () => {
    const isExpanded = jsonContainer.classList.toggle('expanded');
    toggleArrow.textContent = isExpanded ? '▲' : '▼';
    jsonToggle.classList.toggle('active');
  });
}
