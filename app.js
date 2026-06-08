// =========================================================================================
// 🛡️ AuraApp - Clean Modular Entry Point (ES6 Modules)
// =========================================================================================
import { state } from "./src/state.js";
import { SafeStorage } from "./src/utils/storage.js";
import { triggerLocalNotification, showPremiumToast } from "./src/utils/helpers.js";
import { initAuth } from "./src/auth/auth.js";
import { initWorkoutsModule } from "./src/workouts/workouts.js";
import { initAnalyticsModule, initAnalyticsTab } from "./src/metrics/metrics.js";
import { initSettingsModule, initPremiumSettings, showUpdateStateInSettings } from "./src/settings/settings.js";
import { initOnboarding } from "./src/utils/onboarding.js";
import { initAdminModule } from "./src/settings/admin.js";

// Helper to run functions on DOM load
function onDOMReady(fn) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

// ==========================================================================
// PWA On-Demand Update Engine & Version Isolation Guard (Preserved Rules)
// ==========================================================================
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
      if (!navigator.serviceWorker.controller) return;
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
        showPremiumToast('הורדת העדכון נכשלה. אנא ודא שיש לך חיבור רשת תקין ונסה שוב.', 'error');
      }
    });
  }
}

function showUpdateToast(waitingWorker) {
  const toast = document.getElementById('pwa-update-toast');
  const refreshBtn = document.getElementById('pwa-refresh-btn');
  
  if (toast && refreshBtn) {
    // Query the waiting worker for version and update description
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data) {
        const textEl = toast.querySelector('.toast-text');
        if (textEl) {
          const versionStr = event.data.version ? `גרסה ${event.data.version}` : 'גרסה חדשה';
          const descriptionStr = event.data.description || 'שיפורי ביצועים ועיצוב כלליים';
          textEl.innerHTML = `<strong>${versionStr} זמינה!</strong><br><span style="font-size: 0.78rem; font-weight: 500; color: #475569; display: block; margin-top: 2px;">${descriptionStr}</span>`;
        }
      }
    };
    waitingWorker.postMessage({ action: 'getVersion' }, [messageChannel.port2]);

    toast.classList.add('show');
    refreshBtn.addEventListener('click', () => {
      console.log("User requested update activation. Initiating on-demand asset download...");
      refreshBtn.disabled = true;
      refreshBtn.style.opacity = '0.7';
      refreshBtn.style.cursor = 'not-allowed';
      refreshBtn.textContent = 'מוריד עדכונים... ⏳';
      waitingWorker.postMessage({ action: 'downloadAndActivate' });
    });
  }

  showUpdateStateInSettings(waitingWorker);
}


// ==========================================================================
// iOS Premium Bottom Navigation Bar Switcher & Collapsible UX
// ==========================================================================
let autoCollapseTimeout = null;

export function collapseNav() {
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

export function expandNav() {
  const bottomNav = document.querySelector('.ios-bottom-nav');
  const menuToggleBtn = document.getElementById('nav-menu-toggle-btn');
  if (bottomNav) {
    bottomNav.classList.remove('collapsed');
    if (menuToggleBtn) menuToggleBtn.classList.add('hide');
  }
  if (autoCollapseTimeout) {
    clearTimeout(autoCollapseTimeout);
  }
  autoCollapseTimeout = setTimeout(() => {
    collapseNav();
  }, 5000);
}

export function resetTabs() {
  const navTabs = document.querySelectorAll('.ios-bottom-nav .nav-tab');
  const tabPanes = document.querySelectorAll('.tab-content-container .tab-pane');
  
  navTabs.forEach(t => t.classList.remove('active'));
  tabPanes.forEach(p => p.classList.remove('active'));
  
  const settingsTab = document.querySelector('.ios-bottom-nav .nav-tab[data-tab="settings"]');
  if (settingsTab) settingsTab.classList.add('active');
  
  const settingsPane = document.getElementById('tab-settings');
  if (settingsPane) settingsPane.classList.add('active');

  expandNav();
}

// Binds tab clicks
onDOMReady(() => {
  const navTabs = document.querySelectorAll('.ios-bottom-nav .nav-tab');
  const tabPanes = document.querySelectorAll('.tab-content-container .tab-pane');

  window.collapseNav = collapseNav;
  window.expandNav = expandNav;
  window.resetTabs = resetTabs;

  navTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();

      const targetTab = tab.dataset.tab;
      if (!targetTab) return;

      if (targetTab !== 'analytics') {
        state.lastActiveMainTab = targetTab;
      }

      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Reset window viewport scroll to prevent page shift (UX fix)
      window.scrollTo(0, 0);

      tabPanes.forEach((pane) => {
        pane.classList.remove('active');
        if (pane.id === `tab-${targetTab}`) {
          pane.classList.add('active');
          pane.scrollTop = 0;
          
          // Reset internal scrollable wrappers
          const innerScrolls = pane.querySelectorAll('.ios-settings-scroll-container, .ios-analytics-scroll-container, .exercises-list-container, .workout-history-list');
          innerScrolls.forEach(c => c.scrollTop = 0);
        }
      });
      
      console.log(`Switched to tab: ${targetTab}`);
      if (targetTab === 'analytics') {
        const mainNav = document.querySelector('.ios-bottom-nav');
        const workoutsSubNav = document.getElementById('metrics-sub-nav');
        
        if (mainNav) mainNav.classList.add('nav-hidden');
        
        if (workoutsSubNav) {
          workoutsSubNav.classList.remove('nav-hidden');
          if (workoutsSubNav.classList.contains('collapsed')) {
            workoutsSubNav.classList.remove('collapsed');
          }
        }
        const defaultSubTab = document.querySelector(`#metrics-sub-nav .nav-tab[data-sub-tab="${state.activeSubTab || 'workouts'}"]`);
        if (defaultSubTab) {
          defaultSubTab.click();
        } else {
          if (window.renderWorkoutsLog) window.renderWorkoutsLog();
        }
      }

      if (autoCollapseTimeout) {
        clearTimeout(autoCollapseTimeout);
        autoCollapseTimeout = null;
      }
      expandNav();
    });
  });

  // Attach nav collapse trigger on scrolling inside tab content
  const allPanes = document.querySelectorAll('.tab-content-container .tab-pane');
  allPanes.forEach(pane => {
    let scrollThreshold = false;
    pane.addEventListener('scroll', () => {
      if (!scrollThreshold) {
        scrollThreshold = true;
        collapseNav();
        setTimeout(() => { scrollThreshold = false; }, 1000);
      }
    }, { passive: true });
  });

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

// iOS Settings Sub-navigation (Main View <-> Account Details View)
onDOMReady(() => {
  const goToAccountBtn = document.getElementById('go-to-account-btn');
  const backToSettingsBtn = document.getElementById('back-to-settings-btn');
  const settingsMainView = document.getElementById('settings-main-view');
  const settingsAccountView = document.getElementById('settings-account-view');

  if (goToAccountBtn && settingsMainView && settingsAccountView) {
    goToAccountBtn.addEventListener('click', () => {
      settingsMainView.classList.add('hide');
      settingsAccountView.classList.remove('hide');
    });
  }

  if (backToSettingsBtn && settingsMainView && settingsAccountView) {
    backToSettingsBtn.addEventListener('click', () => {
      settingsAccountView.classList.add('hide');
      settingsMainView.classList.remove('hide');
    });
  }
});

// Premium iOS PWA Installation Banner Prompt Logic
window.addEventListener('load', () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true || 
                       window.matchMedia('(display-mode: standalone)').matches;
  const iosPromptDismissed = SafeStorage.getItem('ios-pwa-prompt-dismissed');
  
  if (isIOS && !isStandalone && !iosPromptDismissed) {
    const banner = document.getElementById('ios-install-banner');
    const closeBtn = document.getElementById('ios-prompt-close-btn');
    
    if (banner) {
      setTimeout(() => banner.classList.add('show'), 3000);
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
// Binds Modules and Run initializers on Startup
// ==========================================================================
initWorkoutsModule();
initAnalyticsModule();
initSettingsModule();

// DOM initialization trigger
onDOMReady(() => {
  // Initialize Auth module which sets up Firebase state resolvers and periodic session checkers
  initAuth();
  
  // Tab Initializers setup
  initPremiumSettings();
  initAnalyticsTab();
  initOnboarding();
  initAdminModule();
});
