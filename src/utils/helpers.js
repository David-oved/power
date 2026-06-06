import { SafeStorage } from "./storage.js";
import { state } from "../state.js";

// Safe HTML escape helper to prevent Persistent DOM XSS
export function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Centralized helper to safely request notification permissions in a premium, cross-browser way
export async function requestNotificationPermissionSafely() {
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

// Robust helper to trigger native-like local notifications
export async function triggerLocalNotification(title, body, isSystemUpdate = false) {
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
export function safeFormatDate(value) {
  if (!value) return 'N/A';
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    return new Date(num).toLocaleDateString();
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
}

// Safe Date Time Helper
export function safeFormatDateTime(value) {
  if (!value) return 'N/A';
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    return new Date(num).toLocaleString();
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
}

// Initials Avatar generator
export function getInitialsAvatar(name) {
  const cleanName = (name || 'User').trim();
  const parts = cleanName.split(' ');
  let initials = '';
  if (parts.length > 1) {
    initials = parts[0][0] + parts[1][0];
  } else if (parts[0].length > 0) {
    initials = parts[0].substring(0, 2);
  } else {
    initials = 'U';
  }
  initials = initials.toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="avatar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#dc2626"/>
        <stop offset="100%" stop-color="#f43f5e"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#avatar-grad)"/>
    <text x="50" y="55" font-family="'Outfit', 'Inter', sans-serif" font-weight="800" font-size="36" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" letter-spacing="1">${initials}</text>
  </svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Sleek glassmorphic Toast notification system
export function showPremiumToast(message, type = 'info') {
  let toastContainer = document.getElementById('premium-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'premium-toast-container';
    toastContainer.className = 'premium-toast-container';
    document.body.appendChild(toastContainer);
  }
  
  const toast = document.createElement('div');
  toast.className = `premium-toast toast-${type}`;
  
  let icon = '✨';
  if (type === 'error') icon = '⚠️';
  else if (type === 'success') icon = '✓';
  
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-text">${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// Reusable elegant glassmorphic status toast notifications
export function showAuraToast(message) {
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

// Secure multi-user Gemini AI HTTPS endpoint request helper
export async function callGeminiCloudFunction(prompt, systemInstruction) {
  if (!state.currentUser || !state.auth) {
    throw new Error("משתמש לא מחובר במערכת");
  }

  let token;
  try {
    token = await state.auth.currentUser.getIdToken();
  } catch (err) {
    console.error("Failed to retrieve user ID token:", err);
    throw new Error("שגיאה באימות המשתמש מול השרת");
  }

  const response = await fetch("https://us-central1-power-4ab3e.cloudfunctions.net/callGeminiModel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ prompt, systemInstruction })
  });

  if (!response.ok) {
    let errMsg = `שגיאת תקשורת עם שרת ה-AI (קוד ${response.status})`;
    try {
      const errData = await response.json();
      if (errData && errData.error) {
        errMsg = errData.error;
      }
    } catch (_) {}
    throw new Error(errMsg);
  }

  return await response.json();
}
