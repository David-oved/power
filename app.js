// AuraApp - Core PWA Logic & Firebase Authentication Gateway
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 1. Initialize Firebase App using credentials from firebase-config.js
if (!window.firebaseConfig || !window.firebaseConfig.apiKey) {
  console.error("Firebase configuration missing! Please ensure firebase-config.js is correctly configured.");
}

const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Custom parameters to ensure the account selector shows up nicely
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

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

// Resolve the incoming redirect sign-in result on page load
getRedirectResult(auth)
  .then((result) => {
    if (result) {
      console.log("Redirect sign-in resolved successfully for:", result.user.displayName);
    }
  })
  .catch((error) => {
    console.error("Error resolving redirect result:", error.code, error.message);
    alert(`Authentication Error: ${error.message}`);
  });

// 2. Manage App Screen Transitions
function switchScreen(signedIn) {
  if (signedIn) {
    authScreen.classList.remove('active');
    setTimeout(() => {
      authScreen.style.display = 'none';
      appScreen.style.display = 'flex';
      setTimeout(() => appScreen.classList.add('active'), 50);
    }, 400);
  } else {
    appScreen.classList.remove('active');
    setTimeout(() => {
      appScreen.style.display = 'none';
      authScreen.style.display = 'flex';
      setTimeout(() => authScreen.classList.add('active'), 50);
    }, 400);
  }
}

// 3. Monitor Firebase Authentication State Transitions
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User signed in successfully:", user.displayName);
    
    // Bind credentials to dashboard widgets
    userDisplayName.textContent = user.displayName ? user.displayName.split(' ')[0] : 'User';
    userFullName.textContent = user.displayName || 'Unknown User';
    userEmail.textContent = user.email || '--';
    
    // Fallback if user lacks profile photo
    userPhoto.src = user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
    
    // Add robust error fallback for avatar image
    userPhoto.onerror = () => {
      userPhoto.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
    };

    // Populate dynamic security and metadata stats
    document.getElementById('user-uid').textContent = user.uid;
    document.getElementById('user-provider').textContent = user.providerData[0] ? user.providerData[0].providerId : 'google.com';
    
    const createdTime = user.metadata.createdAt || user.metadata.creationTime;
    document.getElementById('user-created').textContent = createdTime ? new Date(isNaN(createdTime) ? createdTime : parseInt(createdTime)).toLocaleDateString() : 'N/A';
    
    const loginTime = user.metadata.lastLoginAt || user.metadata.lastSignInTime;
    document.getElementById('user-last-login').textContent = loginTime ? new Date(isNaN(loginTime) ? loginTime : parseInt(loginTime)).toLocaleString() : 'N/A';
    
    // Email verified badge
    const badgeVerified = document.getElementById('user-verified-badge');
    if (user.emailVerified) {
      badgeVerified.textContent = 'Verified';
      badgeVerified.className = 'badge-mini badge-verified';
    } else {
      badgeVerified.textContent = 'Unverified';
      badgeVerified.className = 'badge-mini badge-unverified';
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
    document.getElementById('user-json-code').textContent = JSON.stringify(cleanUser, null, 2);

    switchScreen(true);
  } else {
    console.log("No authenticated user active.");
    switchScreen(false);
  }
});

// 4. Trigger Google Sign-In Flow (Using robust Redirect method for PWAs)
loginBtn.addEventListener('click', async () => {
  loginBtn.disabled = true;
  const originalText = loginBtn.querySelector('.google-btn-text').textContent;
  loginBtn.querySelector('.google-btn-text').textContent = 'Redirecting...';

  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error("Sign-in process encountered an error:", error.code, error.message);
    alert(`Authentication Error: ${error.message}`);
    loginBtn.disabled = false;
    loginBtn.querySelector('.google-btn-text').textContent = originalText;
  }
});

// 5. Trigger Log Out Flow
logoutBtn.addEventListener('click', async () => {
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
