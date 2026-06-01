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
        if (event.data) {
          let ver = event.data.version;
          if (event.data.action === 'versionInfo') {
            const isAdmin = state.currentUserRole === 'admin';
            ver = isAdmin ? event.data.adminVersion : event.data.userVersion;
          }
          if (ver) {
            const badge = document.getElementById('app-version-display');
            if (badge) badge.textContent = `v${ver}`;
            const settingsVer = document.getElementById('settings-system-version');
            if (settingsVer) settingsVer.textContent = `v${ver}`;
          }
        }
      };
      
      activeWorker.postMessage({ action: 'getVersionInfo' }, [messageChannel.port2]);
      
      const fallbackChannel = new MessageChannel();
      fallbackChannel.port1.onmessage = (e) => {
        if (e.data && e.data.version) {
          const badge = document.getElementById('app-version-display');
          if (badge && (!badge.textContent || badge.textContent === 'v1.1')) {
            badge.textContent = `v${e.data.version}`;
          }
          const settingsVer = document.getElementById('settings-system-version');
          if (settingsVer && (!settingsVer.textContent || settingsVer.textContent === 'v1.2')) {
            settingsVer.textContent = `v${e.data.version}`;
          }
        }
      };
      activeWorker.postMessage({ action: 'getVersion' }, [fallbackChannel.port2]);
    };

    const checkIfUpdateAppliesAndShow = (newWorker) => {
      const activeWorker = navigator.serviceWorker.controller;
      if (!activeWorker) {
        newWorker.postMessage({ action: 'skipWaiting' });
        return;
      }

      const channelForNew = new MessageChannel();
      channelForNew.port1.onmessage = (eventNew) => {
        if (eventNew.data && eventNew.data.action === 'versionInfo') {
          const newU = eventNew.data.userVersion;
          const newA = eventNew.data.adminVersion;

          const channelForActive = new MessageChannel();
          channelForActive.port1.onmessage = (eventActive) => {
            if (eventActive.data && eventActive.data.action === 'versionInfo') {
              const activeU = eventActive.data.userVersion;
              const activeA = eventActive.data.adminVersion;

              const isAdmin = state.currentUserRole === 'admin';
              let updateNeeded = false;

              if (isAdmin) {
                updateNeeded = (newA !== activeA) || (newU !== activeU);
              } else {
                updateNeeded = (newU !== activeU);
              }

              if (updateNeeded) {
                console.log(`Update applies to role ${state.currentUserRole}. Showing update toast.`);
                showUpdateToast(newWorker);
              } else {
                console.log(`Update does NOT apply to role ${state.currentUserRole}. Skipping waiting silently.`);
                newWorker.postMessage({ action: 'downloadAndActivate' });
              }
            } else {
              showUpdateToast(newWorker);
            }
          };
          activeWorker.postMessage({ action: 'getVersionInfo' }, [channelForActive.port2]);
        } else {
          showUpdateToast(newWorker);
        }
      };
      newWorker.postMessage({ action: 'getVersionInfo' }, [channelForNew.port2]);
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
            checkIfUpdateAppliesAndShow(registration.waiting);
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  checkIfUpdateAppliesAndShow(newWorker);
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

      tabPanes.forEach((pane) => {
        pane.classList.remove('active');
        if (pane.id === `tab-${targetTab}`) {
          pane.classList.add('active');
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
});
