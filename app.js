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
const logoutBtn = document.getElementById('drawer-logout-btn');

// User details DOM outlets (Floating avatar & Sliding Settings Drawer widgets)
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

// Drawer structural elements
const settingsDrawer = document.getElementById('settings-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const floatingAvatarBtn = document.getElementById('floating-avatar-btn');
const drawerCloseBtn = document.getElementById('drawer-close-btn');

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

// Settings Drawer Open / Close Interactive Logic
function openDrawer() {
  if (settingsDrawer) settingsDrawer.classList.add('open');
  if (drawerOverlay) drawerOverlay.classList.add('open');
}

function closeDrawer() {
  if (settingsDrawer) settingsDrawer.classList.remove('open');
  if (drawerOverlay) drawerOverlay.classList.remove('open');
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
      } else if (error.code === 'auth/web-storage-unsupported') {
        alert("שים לב: הדפדפן הנוכחי שלך חוסם עוגיות או פועל במצב גלישה בסתר. אנא פתח את האפליקציה בדפדפן הרגיל (Chrome באנדרואיד או Safari באייפון) כדי שתוכל להתחבר בהצלחה.");
      } else {
        alert(`שגיאת התחברות: ${error.message || 'נא לפתוח בדפדפן Chrome/Safari הרגיל'}`);
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
      
      // Bind credentials securely to dashboard greeting and Settings Drawer widgets
      setElText('user-display-name', user.displayName ? user.displayName.split(' ')[0] : 'User');
      setElText('drawer-user-full-name', user.displayName || 'Unknown User');
      setElText('drawer-user-email', user.email || '--');
      
      // Fallback if user lacks profile photo (Map to floating avatar and drawer large avatar)
      const photoURL = user.photoURL || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      if (floatingUserPhoto) {
        floatingUserPhoto.src = photoURL;
        floatingUserPhoto.onerror = () => {
          floatingUserPhoto.onerror = null;
          floatingUserPhoto.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        };
      }
      if (drawerUserPhoto) {
        drawerUserPhoto.src = photoURL;
        drawerUserPhoto.onerror = () => {
          drawerUserPhoto.onerror = null;
          drawerUserPhoto.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        };
      }

      // Populate dynamic security and metadata stats safely inside the Settings Drawer
      setElText('drawer-user-uid', user.uid);
      setElText('drawer-user-provider', user.providerData?.[0]?.providerId || 'google.com');
      
      const createdTime = user.metadata.createdAt || user.metadata.creationTime;
      setElText('drawer-user-created', safeFormatDate(createdTime));
      
      const loginTime = user.metadata.lastLoginAt || user.metadata.lastSignInTime;
      setElText('drawer-user-last-login', safeFormatDateTime(loginTime));
      
      // Email verified badge inside Drawer
      const badgeVerified = document.getElementById('drawer-user-verified-badge');
      if (badgeVerified) {
        if (user.emailVerified) {
          badgeVerified.textContent = 'Verified';
          badgeVerified.className = 'badge-mini badge-verified';
        } else {
          badgeVerified.textContent = 'Unverified';
          badgeVerified.className = 'badge-mini badge-unverified';
        }
      }
      
      // Format and dump raw JSON representation of Google credentials into Drawer code terminal
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
      
      if (drawerUserJsonCode) {
        drawerUserJsonCode.textContent = JSON.stringify(cleanUser, null, 2);
      }

      switchScreen(true);
    } else {
      console.log("No authenticated user active.");
      closeDrawer();
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

// 4. Trigger Google Sign-In Flow (Hybrid Strategy: Direct Redirect on Mobile, Popup with Redirect fallback on Desktop)
loginBtn.addEventListener('click', async () => {
  if (!firebaseEnabled) {
    alert("Authentication features are currently unavailable because Firebase is not configured properly. Please check your config.");
    return;
  }

  loginBtn.disabled = true;
  const originalText = loginBtn.querySelector('.google-btn-text').textContent;
  loginBtn.querySelector('.google-btn-text').textContent = 'Connecting...';

  // Detect mobile devices (Android / iOS)
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobileDevice) {
    // Mobile always uses Redirect to bypass popup blocks & sandboxed webview constraints
    console.log("Mobile device detected. Triggering signInWithRedirect...");
    loginBtn.querySelector('.google-btn-text').textContent = 'Redirecting...';
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (redirectError) {
      console.error("Mobile redirect auth error:", redirectError);
      handleAuthError(redirectError, loginBtn, originalText);
    }
  } else {
    // Desktop tries Popup first for optimal instant-login experience
    console.log("Desktop device detected. Attempting signInWithPopup...");
    try {
      await signInWithPopup(auth, googleProvider);
      console.log("Logged in successfully via Popup!");
      loginBtn.disabled = false;
      loginBtn.querySelector('.google-btn-text').textContent = originalText;
    } catch (popupError) {
      console.warn("Popup sign-in failed. Error code:", popupError.code);
      
      // If popup was cancelled by user, don't force redirect, just reset the button
      if (popupError.code === 'auth/popup-closed-by-user' || popupError.code === 'auth/cancelled-popup-request') {
        console.log("Sign-in process was cancelled by the user.");
        loginBtn.disabled = false;
        loginBtn.querySelector('.google-btn-text').textContent = originalText;
        return;
      }
      
      // For any other error (popup blocked, storage unsupported, etc.), fall back to Redirect!
      console.log("Falling back to signInWithRedirect due to popup failure...");
      loginBtn.querySelector('.google-btn-text').textContent = 'Redirecting...';
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError) {
        console.error("Desktop redirect fallback auth error:", redirectError);
        handleAuthError(redirectError, loginBtn, originalText);
      }
    }
  }
});

// Helper function to handle and translate authentication errors beautifully for the user
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
          
          // 1. Force check for updates on launch immediately
          registration.update();
          
          // 2. Schedule automatic background update checks every 5 minutes
          setInterval(() => {
            registration.update();
          }, 5 * 60 * 1000);

          // 3. Check if there is already a waiting service worker (installed but waiting to activate)
          if (registration.waiting) {
            showUpdateToast(registration.waiting);
          }

          // 4. Listen for future new service worker installations
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // A new version has been downloaded and installed in background
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

    // 5. Instantly and smoothly reload the page when the new Service Worker becomes active
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log("Service Worker controller changed. Reloading page for new version...");
      window.location.reload();
    });
  }
}

// Function to slide down the premium glassmorphic PWA auto-update toast notification
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

// 7. Interactive Settings Drawer Event Listeners
if (floatingAvatarBtn) {
  floatingAvatarBtn.addEventListener('click', openDrawer);
}

const navSettingsBtn = document.getElementById('nav-settings-btn');
if (navSettingsBtn) {
  navSettingsBtn.addEventListener('click', openDrawer);
}

if (drawerCloseBtn) {
  drawerCloseBtn.addEventListener('click', closeDrawer);
}

if (drawerOverlay) {
  drawerOverlay.addEventListener('click', closeDrawer);
}

// 8. Collapsible JSON Terminal Toggle (Settings Drawer)
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

// 9. Premium iOS PWA Installation Banner Prompt Logic
window.addEventListener('load', () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true || 
                       window.matchMedia('(display-mode: standalone)').matches;
  const iosPromptDismissed = localStorage.getItem('ios-pwa-prompt-dismissed');
  
  if (isIOS && !isStandalone && !iosPromptDismissed) {
    const banner = document.getElementById('ios-install-banner');
    const closeBtn = document.getElementById('ios-prompt-close-btn');
    
    if (banner) {
      // Show banner after 3 seconds for premium, elegant delayed appearance
      setTimeout(() => {
        banner.classList.add('show');
      }, 3000);
      
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          banner.classList.remove('show');
          localStorage.setItem('ios-pwa-prompt-dismissed', 'true');
        });
      }
    }
  }
});

// ==========================================================================
// 10. Cyber-Athletic Workout Tracker State & Interactive UI Engine
// ==========================================================================
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
  try {
    const historyJson = localStorage.getItem('aura-workout-history');
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (e) {
    console.error("Failed to load workout history from localStorage:", e);
    return [];
  }
}

function saveWorkoutToHistory(workout) {
  try {
    const history = loadWorkoutHistory();
    history.unshift(workout); // Push new workout to the top
    localStorage.setItem('aura-workout-history', JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save workout to localStorage:", e);
  }
}

function renderWorkoutHistory() {
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
            <input type="text" class="exercise-name-input" placeholder="שם התרגיל (לדוגמה: לחיצת חזה)" value="${ex.name}" data-exercise-id="${ex.id}" ${!isActive ? 'disabled' : ''}>
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
  try {
    const templatesJson = localStorage.getItem('aura-workout-templates');
    return templatesJson ? JSON.parse(templatesJson) : [];
  } catch (e) {
    console.error("Failed to load workout templates from localStorage:", e);
    return [];
  }
}

function saveWorkoutTemplate(template) {
  try {
    const templates = loadWorkoutTemplates();
    templates.push(template);
    localStorage.setItem('aura-workout-templates', JSON.stringify(templates));
  } catch (e) {
    console.error("Failed to save workout template to localStorage:", e);
  }
}

function populateTemplateDropdown() {
  const selectEl = document.getElementById('routine-template-select');
  if (!selectEl) return;
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

  let totalSets = 0;
  let totalVolume = 0;
  let activeExercises = 0;

  activeWorkout.exercises.forEach(ex => {
    let exHasCompletedSet = false;
    ex.sets.forEach(set => {
      if (set.completed) {
        totalSets++;
        exHasCompletedSet = true;
        const w = parseFloat(set.weight) || 0;
        const r = parseInt(set.reps) || 0;
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
    
    // Just return to home screen
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
  renderWorkoutHistory();
  populateTemplateDropdown();
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


