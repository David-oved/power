import { state } from "../state.js";
import { SafeStorage } from "../utils/storage.js";
import { showPremiumToast } from "../utils/helpers.js";
import { getCustomIcon, ICONS_MAP } from "../utils/icons.js";

// Display "עדכן 🚀" button inside settings check update row
export function showUpdateStateInSettings(waitingWorker) {
  const updateStatus = document.getElementById('settings-update-status');
  const checkUpdateRow = document.getElementById('row-settings-check-update');
  if (updateStatus && checkUpdateRow) {
    updateStatus.innerHTML = '<button id="settings-update-now-btn" class="ios-update-badge-btn">עדכן 🚀</button>';
    checkUpdateRow.classList.remove('checking');
    
    const updateNowBtn = document.getElementById('settings-update-now-btn');
    if (updateNowBtn) {
      updateNowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateNowBtn.disabled = true;
        updateNowBtn.innerHTML = 'מוריד... ⏳';
        waitingWorker.postMessage({ action: 'downloadAndActivate' });
      });
    }
  }
}

// Initializer for the settings tab preferences
export function initPremiumSettings() {
  console.log("Initializing premium iOS Settings View...");

  // Apply startup display preferences
  if (state.outdoorMode) {
    document.body.classList.add('outdoor-mode');
  } else {
    document.body.classList.remove('outdoor-mode');
  }
  if (!state.showGlows) {
    document.body.classList.add('hide-glows');
  } else {
    document.body.classList.remove('hide-glows');
  }

  const allTabs = document.querySelectorAll('.tab-pane');
  const toggleDarkMode = document.getElementById('toggle-settings-dark-mode');
  const toggleNotifications = document.getElementById('toggle-settings-notifications');
  const toggleOutdoorMode = document.getElementById('toggle-settings-outdoor-mode');
  const toggleShowGlows = document.getElementById('toggle-settings-show-glows');
  const settingsVer = document.getElementById('settings-system-version');
  const checkUpdateRow = document.getElementById('row-settings-check-update');
  const updateStatus = document.getElementById('settings-update-status');
  
  // Settings sub-views navigation buttons
  const goToAccountBtn = document.getElementById('go-to-account-btn');
  const backToSettingsBtn = document.getElementById('back-to-settings-btn');
  const goToDisplayBtn = document.getElementById('go-to-display-settings-btn');
  const backFromDisplayBtn = document.getElementById('back-from-display-btn');
  const goToFeedbackBtn = document.getElementById('go-to-feedback-btn');
  const backFromFeedbackBtn = document.getElementById('back-from-feedback-btn');
  const goToMessagesBtn = document.getElementById('go-to-messages-btn');
  const backFromMessagesBtn = document.getElementById('back-from-messages-btn');
  const goToAdminBtn = document.getElementById('go-to-admin-console-btn');
  const backFromAdminBtn = document.getElementById('back-from-admin-btn');

  const settingsMainView = document.getElementById('settings-main-view');
  const displayView = document.getElementById('settings-display-view');
  const accountView = document.getElementById('settings-account-view');
  const adminView = document.getElementById('settings-admin-view');
  const feedbackView = document.getElementById('settings-feedback-view');
  const messagesView = document.getElementById('settings-messages-view');
  const syncView = document.getElementById('settings-sync-view');

  const resetSettingsViews = () => {
    if (settingsMainView) settingsMainView.classList.remove('hide');
    if (displayView) displayView.classList.add('hide');
    if (accountView) accountView.classList.add('hide');
    if (adminView) adminView.classList.add('hide');
    if (feedbackView) feedbackView.classList.add('hide');
    if (messagesView) messagesView.classList.add('hide');
    if (syncView) syncView.classList.add('hide');
  };

  resetSettingsViews();

  const settingsNavBtn = document.querySelector('[data-tab="settings"]');
  if (settingsNavBtn) {
    settingsNavBtn.addEventListener('click', resetSettingsViews);
  }

  // Bind Account View
  if (goToAccountBtn) {
    goToAccountBtn.addEventListener('click', () => {
      if (settingsMainView) settingsMainView.classList.add('hide');
      if (accountView) accountView.classList.remove('hide');
    });
  }
  if (backToSettingsBtn) {
    backToSettingsBtn.addEventListener('click', () => {
      if (accountView) accountView.classList.add('hide');
      if (settingsMainView) settingsMainView.classList.remove('hide');
    });
  }

  // Bind Display View
  if (goToDisplayBtn) {
    goToDisplayBtn.addEventListener('click', () => {
      if (settingsMainView) settingsMainView.classList.add('hide');
      if (displayView) displayView.classList.remove('hide');
    });
  }
  if (backFromDisplayBtn) {
    backFromDisplayBtn.addEventListener('click', () => {
      if (displayView) displayView.classList.add('hide');
      if (settingsMainView) settingsMainView.classList.remove('hide');
    });
  }

  // Bind Feedback View
  if (goToFeedbackBtn) {
    goToFeedbackBtn.addEventListener('click', () => {
      if (settingsMainView) settingsMainView.classList.add('hide');
      if (feedbackView) feedbackView.classList.remove('hide');
    });
  }
  if (backFromFeedbackBtn) {
    backFromFeedbackBtn.addEventListener('click', () => {
      if (feedbackView) feedbackView.classList.add('hide');
      if (settingsMainView) settingsMainView.classList.remove('hide');
    });
  }

  // Bind Messages View
  if (goToMessagesBtn) {
    goToMessagesBtn.addEventListener('click', () => {
      if (settingsMainView) settingsMainView.classList.add('hide');
      if (messagesView) messagesView.classList.remove('hide');
    });
  }
  if (backFromMessagesBtn) {
    backFromMessagesBtn.addEventListener('click', () => {
      if (messagesView) messagesView.classList.add('hide');
      if (settingsMainView) settingsMainView.classList.remove('hide');
    });
  }

  // Bind Admin View
  if (goToAdminBtn) {
    goToAdminBtn.addEventListener('click', () => {
      if (settingsMainView) settingsMainView.classList.add('hide');
      if (adminView) adminView.classList.remove('hide');
    });
  }
  if (backFromAdminBtn) {
    backFromAdminBtn.addEventListener('click', () => {
      if (adminView) adminView.classList.add('hide');
      if (settingsMainView) settingsMainView.classList.remove('hide');
    });
  }

  // Phase 3 Accessibility Enhancement: Bind keydown (Enter/Space) to all interactive rows with role="button" or tabindex="0"
  const interactiveRows = document.querySelectorAll('#tab-settings [role="button"], #tab-settings [tabindex="0"]');
  interactiveRows.forEach(row => {
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        row.click();
      }
    });
  });

  const isDarkMode = SafeStorage.getItem('settings_dark_mode') !== 'false';
  const isNotificationsEnabled = SafeStorage.getItem('settings_notifications_enabled') !== 'false';

  allTabs.forEach(tab => {
    if (isDarkMode) {
      tab.classList.add('dark-theme');
    } else {
      tab.classList.remove('dark-theme');
    }
  });

  if (toggleDarkMode) {
    toggleDarkMode.checked = isDarkMode;
    toggleDarkMode.addEventListener('change', (e) => {
      SafeStorage.setItem('settings_dark_mode', e.target.checked);
      console.log('Saved settings dark mode preference:', e.target.checked);
      allTabs.forEach(tab => {
        if (e.target.checked) {
          tab.classList.add('dark-theme');
        } else {
          tab.classList.remove('dark-theme');
        }
      });
    });
  }

  if (toggleNotifications) {
    toggleNotifications.checked = isNotificationsEnabled;
    toggleNotifications.addEventListener('change', async (e) => {
      SafeStorage.setItem('settings_notifications_enabled', e.target.checked);
      console.log('Saved notifications preference:', e.target.checked);
      if (e.target.checked) {
        const { requestNotificationPermissionSafely } = await import("../utils/helpers.js");
        requestNotificationPermissionSafely();
      }
    });
  }

  if (toggleOutdoorMode) {
    toggleOutdoorMode.checked = state.outdoorMode;
    toggleOutdoorMode.addEventListener('change', (e) => {
      state.outdoorMode = e.target.checked;
      SafeStorage.setItem('aura-outdoor-mode', state.outdoorMode ? 'true' : 'false');
      console.log('Saved settings outdoor mode preference:', state.outdoorMode);
      if (state.outdoorMode) {
        document.body.classList.add('outdoor-mode');
      } else {
        document.body.classList.remove('outdoor-mode');
      }
    });
  }

  if (toggleShowGlows) {
    toggleShowGlows.checked = state.showGlows;
    toggleShowGlows.addEventListener('change', (e) => {
      state.showGlows = e.target.checked;
      SafeStorage.setItem('aura-show-glows', state.showGlows ? 'true' : 'false');
      console.log('Saved settings show glows preference:', state.showGlows);
      if (!state.showGlows) {
        document.body.classList.add('hide-glows');
      } else {
        document.body.classList.remove('hide-glows');
      }
    });
  }

  // Nav Bar Style Modal Sheet Picker binding
  const NAV_STYLES_CONFIG = [
    {
      id: 'floating',
      title: 'מרחף (דינמי)',
      desc: 'סרגל צף מעל תחתית המסך המתכווץ בעת גלילה ומשחרר שטח צפייה מרבי',
      iconSvg: ICONS_MAP.floating
    },
    {
      id: 'fixed',
      title: 'קבוע לתחתית',
      desc: 'סרגל עוגן קבוע ומלא בתחתית המסך ללא התכווצות בעת גלילה',
      iconSvg: ICONS_MAP.pin
    }
  ];

  const navStyleBtn = document.getElementById('go-to-nav-style-modal-btn');
  const navStyleDetailText = document.getElementById('nav-style-detail-text');

  const updateNavStyleUI = (style) => {
    const matched = NAV_STYLES_CONFIG.find(item => item.id === style) || NAV_STYLES_CONFIG[0];
    if (navStyleDetailText) {
      navStyleDetailText.textContent = matched.title;
    }
  };

  updateNavStyleUI(state.navStyle);

  if (navStyleBtn) {
    navStyleBtn.addEventListener('click', () => {
      const modal = document.getElementById('ios-selection-modal');
      const titleEl = document.getElementById('ios-modal-title');
      const optionsContainer = document.getElementById('ios-modal-options');
      const closeBtn = document.getElementById('ios-modal-close');

      if (!modal || !optionsContainer) return;

      if (titleEl) titleEl.textContent = 'בחר סגנון סרגל ניווט';
      optionsContainer.innerHTML = '';

      const closeModal = () => {
        modal.classList.remove('show');
        modal.classList.add('hide');
      };

      NAV_STYLES_CONFIG.forEach(item => {
        const isSelected = item.id === state.navStyle;
        const optionRow = document.createElement('div');
        optionRow.className = `ios-modal-option ${isSelected ? 'selected' : ''}`;
        optionRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; margin-bottom: 8px; cursor: pointer; border-radius: 14px; pointer-events: auto !important; position: relative; z-index: 100002;';
        
        optionRow.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px; direction: rtl; text-align: right; pointer-events: none;">
            <span style="display: flex; align-items: center; color: var(--electric-blue); pointer-events: none;">${item.iconSvg}</span>
            <div style="pointer-events: none;">
              <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 2px; pointer-events: none;">${item.title}</div>
              <div style="font-size: 0.78rem; opacity: 0.8; line-height: 1.3; pointer-events: none;">${item.desc}</div>
            </div>
          </div>
          ${isSelected ? '<span class="ios-modal-option-check" style="color: #34c759; font-weight: bold; font-size: 1.2rem; pointer-events: none;">✓</span>' : ''}
        `;

        const selectNavStyleOption = (e) => {
          if (e) {
            e.stopPropagation();
          }
          
          state.navStyle = item.id;
          SafeStorage.setItem('aura-nav-style', item.id);
          updateNavStyleUI(item.id);

          if (window.applyNavStyle) {
            window.applyNavStyle(item.id);
          } else {
            if (item.id === 'fixed') {
              document.body.classList.add('nav-style-fixed');
            } else {
              document.body.classList.remove('nav-style-fixed');
            }
          }

          closeModal();
          showPremiumToast(`סגנון הסרגל עודכן: ${item.title}`, 'success');
        };

        optionRow.addEventListener('click', selectNavStyleOption);

        optionsContainer.appendChild(optionRow);
      });

      // Show modal overlay
      modal.classList.add('show');
      modal.classList.remove('hide');

      if (closeBtn) closeBtn.onclick = closeModal;
      modal.onclick = (e) => {
        if (e.target === modal) closeModal();
      };
    });
  }

  if (settingsVer) {
    const mainBadge = document.getElementById('app-version-display');
    if (mainBadge && mainBadge.textContent) {
      settingsVer.textContent = mainBadge.textContent;
    } else {
      settingsVer.textContent = 'v1.2.0';
    }
  }

  if (checkUpdateRow && updateStatus) {
    checkUpdateRow.addEventListener('click', async (e) => {
      if (e.target.id === 'settings-update-now-btn') return;
      if (checkUpdateRow.classList.contains('checking')) return;

      checkUpdateRow.classList.add('checking');
      updateStatus.innerHTML = 'בודק... <span class="ios-spinner"></span>';
      
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const newWorker = reg.waiting || reg.installing;
            if (newWorker) {
              showUpdateStateInSettings(newWorker);
            } else {
              updateStatus.textContent = 'מעודכן ✓';
              updateStatus.style.color = '#34c759'; // iOS Green
              setTimeout(() => {
                updateStatus.textContent = 'בדוק';
                updateStatus.style.color = '';
                checkUpdateRow.classList.remove('checking');
              }, 3000);
            }
          } else {
            updateStatus.textContent = 'מעודכן ✓';
            updateStatus.style.color = '#34c759'; // iOS Green
            setTimeout(() => {
              updateStatus.textContent = 'בדוק';
              updateStatus.style.color = '';
              checkUpdateRow.classList.remove('checking');
            }, 3000);
          }
        } catch (err) {
          console.error('Manual PWA update check failed:', err);
          updateStatus.textContent = 'מעודכן ✓';
          setTimeout(() => {
            updateStatus.textContent = 'בדוק';
            checkUpdateRow.classList.remove('checking');
          }, 3000);
        }
      } else {
        updateStatus.textContent = 'מעודכן ✓';
        setTimeout(() => {
          updateStatus.textContent = 'בדוק';
          checkUpdateRow.classList.remove('checking');
        }, 3000);
      }
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting) {
        showUpdateStateInSettings(reg.waiting);
      }
    });
  }

  // --- CLOUD SYNC MENU BINDINGS ---
  const goToSyncBtn = document.getElementById('go-to-cloud-sync-btn');
  const backFromSyncBtn = document.getElementById('back-from-sync-btn');
  const syncStatusBadge = document.getElementById('settings-sync-status-badge');

  // Actions
  const syncActionNow = document.getElementById('sync-action-now');
  const syncActionDisconnect = document.getElementById('sync-action-disconnect');
  const syncActionConnect = document.getElementById('sync-action-connect');
  const syncActionDelete = document.getElementById('sync-action-delete');

  // Status elements
  const syncMenuStatus = document.getElementById('sync-menu-status');
  const syncMenuLastTime = document.getElementById('sync-menu-last-time');

  // Stats elements
  const statHistory = document.getElementById('sync-stat-history');
  const statCustomEx = document.getElementById('sync-stat-custom-ex');
  const statCustomLoc = document.getElementById('sync-stat-custom-loc');
  const statFavorites = document.getElementById('sync-stat-favorites');
  const statFuture = document.getElementById('sync-stat-future');

  // Toggles
  const toggles = {
    history: document.getElementById('sync-toggle-history'),
    customEx: document.getElementById('sync-toggle-custom-ex'),
    customLoc: document.getElementById('sync-toggle-custom-loc'),
    favorites: document.getElementById('sync-toggle-favorites'),
    defaults: document.getElementById('sync-toggle-defaults'),
    future: document.getElementById('sync-toggle-future'),
    messages: document.getElementById('sync-toggle-messages')
  };

  const getTogglesMap = () => ({
    workoutHistory: toggles.history ? toggles.history.checked : true,
    customExercises: toggles.customEx ? toggles.customEx.checked : true,
    customLocations: toggles.customLoc ? toggles.customLoc.checked : true,
    favoriteExercises: toggles.favorites ? toggles.favorites.checked : true,
    exerciseDefaults: toggles.defaults ? toggles.defaults.checked : true,
    futureWorkouts: toggles.future ? toggles.future.checked : true,
    messages: toggles.messages ? toggles.messages.checked : true
  });

  const saveTogglesState = () => {
    state.cloudSyncToggles = getTogglesMap();
    SafeStorage.setItem('aura-cloud-sync-toggles', JSON.stringify(state.cloudSyncToggles));
    // Save toggles preference to cloud
    import("../utils/db.js").then(({ saveFieldToCloud }) => {
      saveFieldToCloud("cloudSyncToggles", state.cloudSyncToggles);
    });
  };

  const updateSyncUI = () => {
    if (!state.currentUser) {
      if (goToSyncBtn) goToSyncBtn.style.display = 'none';
      return;
    } else {
      if (goToSyncBtn) goToSyncBtn.style.display = 'flex';
    }

    const enabled = state.cloudSyncEnabled;
    if (syncStatusBadge) {
      syncStatusBadge.textContent = enabled ? "מחובר" : "מנותק";
      syncStatusBadge.style.color = enabled ? "#34c759" : "#ff9500";
    }

    if (syncMenuStatus) {
      syncMenuStatus.textContent = enabled ? "מחובר ומסונכרן" : "סנכרון מנותק (מקומי בלבד)";
      syncMenuStatus.style.color = enabled ? "#34c759" : "#ff9500";
    }

    // Toggle actions buttons visibility
    if (enabled) {
      if (syncActionDisconnect) syncActionDisconnect.classList.remove('hide');
      if (syncActionConnect) syncActionConnect.classList.add('hide');
      if (syncActionNow) {
        syncActionNow.disabled = false;
        syncActionNow.style.opacity = '1';
        syncActionNow.style.pointerEvents = 'auto';
      }
    } else {
      if (syncActionDisconnect) syncActionDisconnect.classList.add('hide');
      if (syncActionConnect) syncActionConnect.classList.remove('hide');
      if (syncActionNow) {
        syncActionNow.disabled = true;
        syncActionNow.style.opacity = '0.5';
        syncActionNow.style.pointerEvents = 'none';
      }
    }

    // Load Last Sync Time
    const lastSyncTimeVal = SafeStorage.getItem(`aura-last-sync-time_${state.currentUser.uid}`);
    if (syncMenuLastTime) {
      syncMenuLastTime.textContent = lastSyncTimeVal ? new Date(Number(lastSyncTimeVal)).toLocaleString('he-IL') : "לא סונכרן מעולם";
    }

    // Populate local/cloud counts dynamically with Safe JSON Parsing (Phase 2 optimization)
    const uid = state.currentUser.uid;
    const safeParseArray = (storageKey) => {
      try {
        const item = SafeStorage.getItem(storageKey);
        if (!item) return [];
        const parsed = JSON.parse(item);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        console.warn(`JSON parse failed for ${storageKey}, falling back to []:`, err);
        return [];
      }
    };

    const localHistory = safeParseArray(`aura-workout-history_${uid}`);
    const localCustomEx = safeParseArray(`aura-custom-exercises_${uid}`);
    const localCustomLoc = safeParseArray(`aura-custom-locations_${uid}`);
    const localFavorites = safeParseArray(`aura-favorite-exercises_${uid}`);
    const localFuture = safeParseArray(`aura-future-workouts_${uid}`);

    if (statHistory) statHistory.textContent = `${localHistory.length} אימונים`;
    if (statCustomEx) statCustomEx.textContent = `${localCustomEx.length} תרגילים`;
    if (statCustomLoc) statCustomLoc.textContent = `${localCustomLoc.length} מיקומים`;
    if (statFavorites) statFavorites.textContent = `${localFavorites.length} תרגילים`;
    if (statFuture) statFuture.textContent = `${localFuture.length} אימונים`;

    // Populate toggles checkboxes state from state.cloudSyncToggles
    const togglesState = state.cloudSyncToggles || {};
    if (toggles.history) toggles.history.checked = togglesState.workoutHistory !== false;
    if (toggles.customEx) toggles.customEx.checked = togglesState.customExercises !== false;
    if (toggles.customLoc) toggles.customLoc.checked = togglesState.customLocations !== false;
    if (toggles.favorites) toggles.favorites.checked = togglesState.favoriteExercises !== false;
    if (toggles.defaults) toggles.defaults.checked = togglesState.exerciseDefaults !== false;
    if (toggles.future) toggles.future.checked = togglesState.futureWorkouts !== false;
    if (toggles.messages) toggles.messages.checked = togglesState.messages !== false;
  };

  if (goToSyncBtn && settingsMainView && syncView) {
    goToSyncBtn.addEventListener('click', () => {
      settingsMainView.classList.add('hide');
      syncView.classList.remove('hide');
      updateSyncUI();
    });
  }

  if (backFromSyncBtn && settingsMainView && syncView) {
    backFromSyncBtn.addEventListener('click', () => {
      syncView.classList.add('hide');
      settingsMainView.classList.remove('hide');
    });
  }

  // Bind change listeners to toggles to immediately update preferences
  Object.values(toggles).forEach(toggle => {
    if (toggle) {
      toggle.addEventListener('change', () => {
        saveTogglesState();
        updateSyncUI();
      });
    }
  });

  // Action: Sync Now
  if (syncActionNow) {
    syncActionNow.addEventListener('click', async () => {
      if (!state.currentUser) return;
      syncActionNow.disabled = true;
      syncActionNow.textContent = "מסתנכרן... ⏳";
      try {
        const { syncUserSession } = await import("../utils/db.js");
        await syncUserSession(state.currentUser.uid, true);
        SafeStorage.setItem(`aura-last-sync-time_${state.currentUser.uid}`, Date.now().toString());
      } catch (err) {
        console.error("Manual sync failed:", err);
      } finally {
        syncActionNow.disabled = false;
        syncActionNow.textContent = "🔄 סנכרן כעת ורענן נתונים";
        updateSyncUI();
      }
    });
  }

  // Action: Disconnect Sync
  if (syncActionDisconnect) {
    syncActionDisconnect.addEventListener('click', () => {
      state.cloudSyncEnabled = false;
      SafeStorage.setItem('aura-cloud-sync-enabled', 'false');
      showPremiumToast("הסנכרון לענן כובד. המידע יישמר רק על גבי המכשיר.", "info");
      updateSyncUI();
    });
  }

  // Action: Connect Sync
  if (syncActionConnect) {
    syncActionConnect.addEventListener('click', async () => {
      state.cloudSyncEnabled = true;
      SafeStorage.setItem('aura-cloud-sync-enabled', 'true');
      
      syncActionConnect.disabled = true;
      syncActionConnect.textContent = "מתחבר לענן... ⏳";
      try {
        const { syncUserSession } = await import("../utils/db.js");
        await syncUserSession(state.currentUser.uid, true);
        SafeStorage.setItem(`aura-last-sync-time_${state.currentUser.uid}`, Date.now().toString());
        showPremiumToast("הסנכרון לענן הופעל והנתונים הועלו בהצלחה! ⚡", "success");
      } catch (err) {
        console.error("Reconnecting sync failed:", err);
      } finally {
        syncActionConnect.disabled = false;
        syncActionConnect.textContent = "⚡ הפעל סנכרון ענן והעלה נתונים";
        updateSyncUI();
      }
    });
  }

  // Action: Delete Cloud Data
  if (syncActionDelete) {
    syncActionDelete.addEventListener('click', async () => {
      if (!state.currentUser) return;
      if (confirm("האם אתה בטוח שברצונך למחוק את כל הנתונים השמורים בענן? פעולה זו תמחק רק את הגיבוי בענן ולא תפגע במידע שבמכשיר שלך.")) {
        syncActionDelete.disabled = true;
        syncActionDelete.textContent = "מוחק מהענן... ⏳";
        try {
          const { deleteCloudDataOnly } = await import("../utils/db.js");
          await deleteCloudDataOnly(state.currentUser.uid);
          showPremiumToast("כל הנתונים בענן נמחקו בהצלחה! המידע המקומי שמור במכשיר.", "success");
          SafeStorage.removeItem(`aura-last-sync-time_${state.currentUser.uid}`);
        } catch (err) {
          console.error("Deleting cloud data failed:", err);
          showPremiumToast("מחיקת הנתונים מהענן נכשלה.", "error");
        } finally {
          syncActionDelete.disabled = false;
          syncActionDelete.textContent = "🗑️ מחק את כל הנתונים השמורים בענן";
          updateSyncUI();
        }
      }
    });
  }

  // Initial update
  updateSyncUI();

  // Expose updates for state changes (e.g. login)
  window.updateSyncUI = updateSyncUI;
}

// Binds global configurations
export function initSettingsModule() {
  window.initPremiumSettings = initPremiumSettings;
  window.showUpdateStateInSettings = showUpdateStateInSettings;
}

