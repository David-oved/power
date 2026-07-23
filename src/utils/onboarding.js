import { state } from "../state.js";
import { SafeStorage } from "./storage.js";
import { saveFieldToCloud, loadUserDataFromCloud } from "./db.js";
import { showPremiumToast } from "./helpers.js";

// Onboarding Tour Steps configuration
const tourSteps = [
  {
    title: "ברוכים הבאים ל-AuraApp! 🏋️‍♂️",
    text: "נשמח להציג לכם את תכונות המפתח של האפליקציה בסיור קצר של פחות מדקה. מוכנים?",
    element: null
  },
  {
    title: "פרופיל והגדרות אישיות 👤",
    text: "כאן תוכלו לנהל את הפרופיל שלכם, להתחבר עם Google ולסנכרן את האימונים שלכם לענן לשמירה בטוחה.",
    element: "#go-to-account-btn",
    onBeforeShow: () => {
      document.querySelector('.ios-bottom-nav .nav-tab[data-tab="settings"]')?.click();
    }
  },
  {
    title: "מצב כהה ומראה האפליקציה 🌙",
    text: "כאן תוכלו לעבור למצב כהה או בהיר לקבלת המראה המתאים לכם ביותר בכל שעה.",
    element: "#row-settings-dark-mode",
    onBeforeShow: () => {
      document.querySelector('.ios-bottom-nav .nav-tab[data-tab="settings"]')?.click();
    }
  },
  {
    title: "עדכוני מערכת מהירים 🔄",
    text: "בלחיצה כאן תוכלו לבדוק אם קיימים עדכוני גרסה חדשים וליהנות משיפורים ועיצובים חדשים ישירות מהענן.",
    element: "#row-settings-check-update",
    onBeforeShow: () => {
      document.querySelector('.ios-bottom-nav .nav-tab[data-tab="settings"]')?.click();
    }
  },
  {
    title: "לשונית האימונים שלכם 🏋️‍♀️",
    text: "נעבור ללשונית האימונים. זהו לב האפליקציה שבו מתבצע מעקב האימונים שלכם.",
    element: ".ios-bottom-nav .nav-tab[data-tab=\"workouts\"]",
    onBeforeShow: () => {
      document.querySelector('.ios-bottom-nav .nav-tab[data-tab="workouts"]')?.click();
    }
  },
  {
    title: "התחלת אימון חדש ⚡",
    text: "לחצו כאן כדי לבחור את מיקום האימון (כגון חדר כושר, פארק) ולהתחיל לעקוב אחר תרגילים, משקלים וסטים בזמן אמת.",
    element: "#start-workout-btn",
    onBeforeShow: () => {
      document.querySelector('.ios-bottom-nav .nav-tab[data-tab="workouts"]')?.click();
    }
  },
  {
    title: "יומן אימונים ואנליטיקה 📊",
    text: "עברנו ללשונית האנליטיקה. כאן תוכלו לראות את היסטוריית האימונים, לחקור גרפים של התקדמות ולצפות בשיאי כוח (1RM).",
    element: ".ios-bottom-nav .nav-tab[data-tab=\"analytics\"]",
    onBeforeShow: () => {
      document.querySelector('.ios-bottom-nav .nav-tab[data-tab="analytics"]')?.click();
    }
  },
  {
    title: "סיימנו! צאו לדרך 🚀",
    text: "כעת אתם מכירים את האפליקציה. הגיע הזמן להתאמן ולשבור שיאים חדשים! בהצלחה!",
    element: null
  }
];

let currentStepIndex = 0;
let tourActive = false;
let deferredPrompt = null;

// Capture PWA installation prompt event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log("PWA beforeinstallprompt captured.");
});

// Helper: Detect OS and Browser
function getOSAndBrowser() {
  const userAgent = navigator.userAgent;
  let os = 'other';
  let osName = 'מכשיר לא ידוע';
  let browser = 'other';
  let browserName = 'דפדפן לא ידוע';
  
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    os = 'ios';
    osName = 'iOS (iPhone/iPad)';
  } else if (/Android/i.test(userAgent)) {
    os = 'android';
    osName = 'Android';
  } else if (/Windows/i.test(userAgent)) {
    os = 'windows';
    osName = 'Windows PC';
  } else if (/Macintosh/i.test(userAgent)) {
    os = 'mac';
    osName = 'Mac';
  }
  
  if (/Firefox|FxiOS/i.test(userAgent)) {
    browser = 'firefox';
    browserName = 'Firefox';
  } else if (/Chrome|CriOS/i.test(userAgent) && !/Edge|Edg|OPR|Opera/i.test(userAgent)) {
    browser = 'chrome';
    browserName = 'Chrome';
  } else if (/Safari/i.test(userAgent) && !/Chrome|CriOS|Firefox|FxiOS/i.test(userAgent)) {
    browser = 'safari';
    browserName = 'Safari';
  } else if (/Edge|Edg/i.test(userAgent)) {
    browser = 'edge';
    browserName = 'Microsoft Edge';
  }
  
  return { os, osName, browser, browserName };
}

// Helper: Custom step-by-step instructions for installing PWA
function getPWAInstructions(os, browser) {
  const steps = [];
  let showNativePrompt = false;
  
  if (os === 'ios') {
    if (browser === 'safari') {
      steps.push(
        'לחצו על כפתור <strong>השיתוף</strong> בסרגל התחתון של Safari (אייקון של ריבוע עם חץ כלפי מעלה 📤).',
        'גללו מטה בתפריט שנפתח ובחרו באפשרות <strong>"הוסף למסך הבית"</strong> (Add to Home Screen ➕).',
        'לחצו על <strong>"הוסף"</strong> (Add) בפינה הימנית העליונה של המסך כדי לאשר.'
      );
    } else {
      steps.push(
        'לחצו על כפתור <strong>השיתוף</strong> בשורת הכתובת או בתפריט האפליקציה (📤).',
        'גללו מטה בתפריט ובחרו באפשרות <strong>"הוסף למסך הבית"</strong> (Add to Home Screen ➕).',
        'לחצו על <strong>"הוסף"</strong> (Add) בפינה הימנית העליונה.'
      );
    }
  } else if (os === 'android') {
    if (browser === 'chrome') {
      if (deferredPrompt) {
        showNativePrompt = true;
      }
      steps.push(
        'לחצו על כפתור <strong>"התקן עכשיו"</strong> המופיע בתחתית המודל.',
        'אם ההתקנה לא מתחילה, לחצו על תפריט <strong>שלוש הנקודות (⋮)</strong> בפינה השמאלית/ימנית העליונה של Chrome.',
        'בחרו ב-<strong>"התקן את האפליקציה"</strong> או <strong>"הוסף למסך הבית"</strong> (Add to Home Screen ➕).'
      );
    } else if (browser === 'firefox') {
      if (deferredPrompt) {
        showNativePrompt = true;
      }
      steps.push(
        'לחצו על תפריט <strong>שלוש הנקודות (⋮)</strong> בפינה הימנית התחתונה של Firefox.',
        'בחרו באפשרות <strong>"התקן"</strong> (Install) או <strong>"הוסף למסך הבית"</strong>.',
        'אשרו את ההתקנה בחלון שיפתח.'
      );
    } else {
      steps.push(
        'פתחו את תפריט הדפדפן (לרוב אייקון של שלוש נקודות או קווים).',
        'חפשו אפשרות בשם <strong>"התקן"</strong> (Install) או <strong>"הוסף למסך הבית"</strong> (Add to Home Screen ➕).',
        'אשרו את הפעולה.'
      );
    }
  } else {
    if (deferredPrompt) {
      showNativePrompt = true;
    }
    steps.push(
      'לחצו על אייקון <strong>ההתקנה</strong> בשורת הכתובת של הדפדפן (מופיע לרוב כסימן ➕ או כפתור התקנה ייעודי).',
      'לחצו על <strong>"התקן"</strong> (Install) בחלונית האישור שנפתחה.'
    );
  }
  
  return { steps, showNativePrompt };
}

// Create and inject PWA modal
export function createPWAModal() {
  if (document.getElementById('pwa-install-guide-modal')) return;
  
  const modal = document.createElement('div');
  modal.id = 'pwa-install-guide-modal';
  modal.className = 'workout-modal-overlay hide';
  modal.style.zIndex = '1800';
  
  const info = getOSAndBrowser();
  const instructions = getPWAInstructions(info.os, info.browser);
  
  modal.innerHTML = `
    <div class="workout-modal-card pwa-guide-modal-card" style="max-width: 400px; width: 92%; border-radius: 28px; padding: 1.8rem; border: 1px solid rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(135deg, hsla(225, 20%, 9%, 0.95) 0%, hsla(225, 20%, 5%, 0.98) 100%); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);">
      <div class="modal-header" style="padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; direction: rtl;">
        <button id="close-pwa-guide-btn" class="btn-cancel-link" style="background: none; border: none; font-size: 0.95rem; font-weight: 700; color: var(--text-muted); cursor: pointer;">סגור</button>
        <h3 class="modal-title" style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #ffffff; direction: rtl; font-family: var(--font-display);">📲 מדריך התקנת AuraApp</h3>
        <span style="width: 40px;"></span>
      </div>
      <div class="modal-body" style="padding: 1.5rem 0 0.5rem 0; text-align: right; direction: rtl; overflow-y: auto; flex: 1;">
        <div style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.5;">
          התקנת האפליקציה במסך הבית מאפשרת להשתמש בה במסך מלא, לקבל ביצועים מהירים יותר ולעבוד ללא הפרעות.
        </div>
        
        <div class="detected-badge" style="background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.25); padding: 10px 14px; border-radius: 14px; margin-bottom: 1.5rem; font-size: 0.85rem; color: var(--text-main); display: flex; justify-content: space-between; align-items: center; direction: rtl;">
          <span>זיהינו במכשיר שלך:</span>
          <strong style="color: var(--accent-light);">${info.osName} (${info.browserName})</strong>
        </div>
        
        <div class="pwa-steps-list" style="display: flex; flex-direction: column; gap: 16px;">
          ${instructions.steps.map((step, idx) => `
            <div class="pwa-step-item" style="display: flex; gap: 12px; align-items: flex-start; direction: rtl;">
              <div class="pwa-step-number" style="background: var(--accent); color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem; flex-shrink: 0; margin-top: 2px; box-shadow: 0 0 10px var(--accent-glow);">
                ${idx + 1}
              </div>
              <div class="pwa-step-text" style="font-size: 0.95rem; line-height: 1.45; color: var(--text-main);">
                ${step}
              </div>
            </div>
          `).join('')}
        </div>
        
        ${instructions.showNativePrompt ? `
          <button id="pwa-native-install-btn" class="btn btn-primary" style="width: 100%; margin-top: 1.5rem; padding: 14px; font-weight: bold; border-radius: 14px; background: linear-gradient(135deg, var(--electric-blue) 0%, var(--electric-blue-light) 100%); box-shadow: 0 4px 15px var(--electric-blue-glow);">
            📲 התקן עכשיו ישירות
          </button>
        ` : ''}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close buttons listeners
  document.getElementById('close-pwa-guide-btn')?.addEventListener('click', () => {
    modal.classList.add('hide');
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hide');
    }
  });
  
  // Native PWA prompt button behavior
  if (instructions.showNativePrompt) {
    const nativeBtn = document.getElementById('pwa-native-install-btn');
    nativeBtn?.addEventListener('click', async () => {
      if (deferredPrompt) {
        modal.classList.add('hide');
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to PWA install prompt: ${outcome}`);
        deferredPrompt = null;
      } else {
        showPremiumToast("ההתקנה האוטומטית אינה זמינה כעת בדפדפן זה.", "info");
      }
    });
  }
}

// Show PWA recommendation modal
export function showPWARecommendationModal() {
  createPWAModal();
  const modal = document.getElementById('pwa-install-guide-modal');
  if (modal) {
    modal.classList.remove('hide');
  }
}

// Create and inject Spotlight & Tooltip HTML Elements
function createTourElements() {
  if (document.getElementById('onboarding-tour-container')) return;
  
  const container = document.createElement('div');
  container.id = 'onboarding-tour-container';
  
  // Click Blocker Overlay
  const blocker = document.createElement('div');
  blocker.className = 'onboarding-click-blocker';
  container.appendChild(blocker);
  
  // Spotlight Element
  const spotlight = document.createElement('div');
  spotlight.className = 'onboarding-spotlight';
  container.appendChild(spotlight);
  
  // Tooltip Bubble
  const tooltip = document.createElement('div');
  tooltip.className = 'onboarding-tooltip';
  tooltip.innerHTML = `
    <div class="tooltip-arrow"></div>
    <div class="tooltip-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; direction: rtl;">
      <h4 class="tooltip-title" style="margin: 0; font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; color: #ffffff;"></h4>
      <span class="tooltip-progress" style="font-size: 0.8rem; color: var(--accent-light); font-weight: bold;"></span>
    </div>
    <div class="tooltip-body" style="font-size: 0.92rem; color: var(--text-main); margin-bottom: 16px; direction: rtl; line-height: 1.45;"></div>
    <div class="tooltip-footer" style="display: flex; justify-content: space-between; align-items: center; direction: rtl;">
      <button class="tour-btn tour-btn-skip" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.9rem; font-weight: bold; font-family: var(--font-sans);">דילוג</button>
      <div class="tour-btn-group" style="display: flex; gap: 8px;">
        <button class="tour-btn tour-btn-prev" style="background: hsla(225,20%,15%,0.6); border: 1px solid rgba(255,255,255,0.08); color: var(--text-main); padding: 6px 14px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 0.85rem; font-family: var(--font-sans);">הקודם</button>
        <button class="tour-btn tour-btn-next" style="background: linear-gradient(135deg, var(--electric-blue) 0%, var(--electric-blue-light) 100%); border: none; color: white; padding: 6px 16px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 0.85rem; font-family: var(--font-sans); box-shadow: 0 4px 10px var(--electric-blue-glow);">הבא</button>
      </div>
    </div>
  `;
  container.appendChild(tooltip);
  
  document.body.appendChild(container);
  
  // Event listeners for tour controls
  tooltip.querySelector('.tour-btn-skip')?.addEventListener('click', () => {
    finishTour(true);
  });
  
  tooltip.querySelector('.tour-btn-prev')?.addEventListener('click', () => {
    goToStep(currentStepIndex - 1);
  });
  
  tooltip.querySelector('.tour-btn-next')?.addEventListener('click', () => {
    if (currentStepIndex === tourSteps.length - 1) {
      finishTour(false);
    } else {
      goToStep(currentStepIndex + 1);
    }
  });
}

// End and cleanup the onboarding tour
export async function finishTour(skipped = false) {
  tourActive = false;
  
  document.getElementById('onboarding-tour-container')?.remove();
  
  window.removeEventListener('resize', updateSpotlightPosition);
  window.removeEventListener('scroll', updateSpotlightPosition, true);
  
  // Save status to global state
  state.onboardingCompleted = !skipped;
  state.onboardingSkipped = skipped;
  state.onboardingTimestamp = Date.now();
  
  const uid = state.currentUser ? state.currentUser.uid : null;
  const storageKey = uid ? `aura-onboarding_${uid}` : 'aura-onboarding_guest';
  
  const onboardingData = {
    completed: !skipped,
    skipped: skipped,
    updatedAt: Date.now()
  };
  
  SafeStorage.setItem(storageKey, JSON.stringify(onboardingData));
  
  if (uid) {
    await saveFieldToCloud('onboarding', onboardingData);
  }
  
  showPremiumToast(skipped ? 'הסיור בוטל' : 'הסיור הושלם בהצלחה! 💪', 'success');
}

// Navigate to specific tour step
async function goToStep(index) {
  if (index < 0 || index >= tourSteps.length) return;
  currentStepIndex = index;
  
  const step = tourSteps[index];
  
  if (typeof step.onBeforeShow === 'function') {
    step.onBeforeShow();
  }
  
  // Wait a short moment for DOM updates or view transition animations to resolve
  setTimeout(() => {
    const container = document.getElementById('onboarding-tour-container');
    if (!container) return;
    
    const tooltip = container.querySelector('.onboarding-tooltip');
    if (!tooltip) return;
    
    tooltip.querySelector('.tooltip-title').textContent = step.title;
    tooltip.querySelector('.tooltip-progress').textContent = `${index + 1}/${tourSteps.length}`;
    tooltip.querySelector('.tooltip-body').innerHTML = step.text;
    
    const prevBtn = tooltip.querySelector('.tour-btn-prev');
    const nextBtn = tooltip.querySelector('.tour-btn-next');
    
    if (prevBtn) {
      prevBtn.style.display = index === 0 ? 'none' : 'block';
    }
    
    if (nextBtn) {
      nextBtn.textContent = index === tourSteps.length - 1 ? 'סיום' : 'הבא';
    }
    
    updateSpotlightPosition();
  }, 350);
}

// Recalculate and update the spotlight hole and tooltip positions
function updateSpotlightPosition() {
  if (!tourActive) return;
  
  const step = tourSteps[currentStepIndex];
  const container = document.getElementById('onboarding-tour-container');
  if (!container) return;
  
  const spotlight = container.querySelector('.onboarding-spotlight');
  const tooltip = container.querySelector('.onboarding-tooltip');
  if (!spotlight || !tooltip) return;
  
  const targetElement = step.element ? document.querySelector(step.element) : null;
  
  if (!targetElement) {
    // Center of screen if no target element exists for the step
    spotlight.style.opacity = '0';
    spotlight.style.width = '0px';
    spotlight.style.height = '0px';
    
    tooltip.style.top = '50%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translate(-50%, -50%)';
    tooltip.classList.add('tooltip-center');
    tooltip.classList.remove('tooltip-top', 'tooltip-bottom');
    
    const arrow = tooltip.querySelector('.tooltip-arrow');
    if (arrow) arrow.style.display = 'none';
  } else {
    spotlight.style.opacity = '1';
    
    const rect = targetElement.getBoundingClientRect();
    const padding = 8;
    
    spotlight.style.top = `${rect.top - padding}px`;
    spotlight.style.left = `${rect.left - padding}px`;
    spotlight.style.width = `${rect.width + padding * 2}px`;
    spotlight.style.height = `${rect.height + padding * 2}px`;
    
    tooltip.classList.remove('tooltip-center');
    const arrow = tooltip.querySelector('.tooltip-arrow');
    if (arrow) arrow.style.display = 'block';
    
    tooltip.style.transform = 'none';
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 16;
    
    let top, left;
    
    // Choose above or below based on position on the screen
    if (rect.top + rect.height / 2 < window.innerHeight / 2) {
      top = rect.bottom + padding + margin;
      tooltip.classList.add('tooltip-bottom');
      tooltip.classList.remove('tooltip-top');
    } else {
      top = rect.top - padding - tooltipRect.height - margin;
      tooltip.classList.add('tooltip-top');
      tooltip.classList.remove('tooltip-bottom');
    }
    
    left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    
    // Boundary collision safety
    left = Math.max(margin, Math.min(window.innerWidth - tooltipRect.width - margin, left));
    top = Math.max(margin, Math.min(window.innerHeight - tooltipRect.height - margin, top));
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    
    if (arrow) {
      const arrowLeft = rect.left + rect.width / 2 - left - 8;
      arrow.style.left = `${Math.max(12, Math.min(tooltipRect.width - 24, arrowLeft))}px`;
    }
  }
}

// Start the tour manually
export function startTour() {
  tourActive = true;
  createTourElements();
  
  window.addEventListener('resize', updateSpotlightPosition);
  window.addEventListener('scroll', updateSpotlightPosition, true);
  
  goToStep(0);
}

// Inject Onboarding & Help category group in the iOS Settings main view
export function addOnboardingSettingsGroup() {
  const settingsMainView = document.getElementById('settings-main-view');
  if (!settingsMainView) return;
  
  if (document.getElementById('ios-settings-group-onboarding')) return;
  
  const group = document.createElement('div');
  group.id = 'ios-settings-group-onboarding';
  group.className = 'ios-settings-card-group';
  group.innerHTML = `
    <div class="ios-settings-group-title">עזרה והדרכה</div>
    
    <div class="ios-setting-row" id="row-settings-restart-tour" style="cursor: pointer;">
      <div class="ios-row-left">
        <span class="ios-row-chevron">←</span>
      </div>
      <div class="ios-row-right">
        <span class="ios-row-icon-badge" style="background-color: #5856d6;">🏋️‍♂️</span>
        <span class="ios-row-label">סיור מודרך באפליקציה</span>
      </div>
    </div>
    
    <div class="ios-setting-row" id="row-settings-pwa-guide" style="cursor: pointer;">
      <div class="ios-row-left">
        <span class="ios-row-chevron">←</span>
      </div>
      <div class="ios-row-right">
        <span class="ios-row-icon-badge" style="background-color: #ff9500;">📲</span>
        <span class="ios-row-label">מדריך התקנת PWA</span>
      </div>
    </div>
  `;
  
  const scrollContainer = settingsMainView.querySelector('.ios-settings-scroll-container') || settingsMainView;
  const groups = scrollContainer.querySelectorAll('.ios-settings-card-group');
  let systemGroup = null;
  for (const g of groups) {
    if (g.textContent.includes('מערכת') || g.textContent.includes('גרסה')) {
      systemGroup = g;
      break;
    }
  }
  
  if (systemGroup && systemGroup.parentNode) {
    systemGroup.parentNode.insertBefore(group, systemGroup);
  } else {
    scrollContainer.appendChild(group);
  }
  
  document.getElementById('row-settings-restart-tour')?.addEventListener('click', () => {
    startTour();
  });
  
  document.getElementById('row-settings-pwa-guide')?.addEventListener('click', () => {
    showPWARecommendationModal();
  });
}

// Initialize the Onboarding system, verifying previous completions and settings group
export function initOnboarding() {
  window.startTour = startTour;
  window.showPWARecommendationModal = showPWARecommendationModal;
  window.initOnboarding = initOnboarding;
  
  addOnboardingSettingsGroup();
  
  const uid = state.currentUser ? state.currentUser.uid : null;
  if (!uid) return;
  
  const storageKey = `aura-onboarding_${uid}`;
  let localData = SafeStorage.getItem(storageKey);
  
  if (!localData) {
    loadUserDataFromCloud(uid).then(cloudData => {
      if (cloudData && cloudData.onboarding) {
        SafeStorage.setItem(storageKey, JSON.stringify(cloudData.onboarding));
        if (cloudData.onboarding.completed || cloudData.onboarding.skipped) {
          return;
        }
      }
      
      // Auto-start with a friendly delay if they have never seen it
      setTimeout(() => {
        if (state.currentUser && document.getElementById('app-screen').classList.contains('active')) {
          startTour();
        }
      }, 2000);
    });
  } else {
    try {
      const parsed = JSON.parse(localData);
      if (parsed.completed || parsed.skipped) {
        return;
      }
    } catch(e) {}
    
    setTimeout(() => {
      if (state.currentUser && document.getElementById('app-screen').classList.contains('active')) {
        startTour();
      }
    }, 2000);
  }
}

// Automatically expose on window when this module is evaluated
window.startTour = startTour;
window.showPWARecommendationModal = showPWARecommendationModal;
window.initOnboarding = initOnboarding;
