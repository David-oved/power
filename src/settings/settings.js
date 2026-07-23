import { state } from "../state.js";
import { SafeStorage } from "../utils/storage.js";
import { showPremiumToast } from "../utils/helpers.js";

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

  const allTabs = document.querySelectorAll('.tab-content-container .tab-pane');
  const toggleDarkMode = document.getElementById('toggle-settings-dark-mode');
  const toggleNotifications = document.getElementById('toggle-settings-notifications');
  const toggleOutdoorMode = document.getElementById('toggle-settings-outdoor-mode');
  const toggleShowGlows = document.getElementById('toggle-settings-show-glows');
  const settingsVer = document.getElementById('settings-system-version');
  const checkUpdateRow = document.getElementById('row-settings-check-update');
  const updateStatus = document.getElementById('settings-update-status');
  
  // Display Settings sub-view navigation
  const goToDisplayBtn = document.getElementById('go-to-display-settings-btn');
  const backFromDisplayBtn = document.getElementById('back-from-display-btn');
  const settingsMainView = document.getElementById('settings-main-view');
  const displayView = document.getElementById('settings-display-view');

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
  
  const isDarkMode = SafeStorage.getItem('settings_dark_mode') === 'true';
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
    toggleNotifications.addEventListener('change', (e) => {
      SafeStorage.setItem('settings_notifications_enabled', e.target.checked);
      console.log('Saved notifications preference:', e.target.checked);
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

  // Nav Bar Style Segmented Picker binding
  const navStyleSegmented = document.getElementById('nav-style-segmented-control');
  const navStyleDetailText = document.getElementById('nav-style-detail-text');

  const updateNavStyleUI = (style) => {
    if (!navStyleSegmented) return;
    const btns = navStyleSegmented.querySelectorAll('.segmented-btn');
    btns.forEach(btn => {
      if (btn.dataset.navStyle === style) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    if (navStyleDetailText) {
      navStyleDetailText.textContent = style === 'fixed' ? 'קבוע לתחתית 📌' : 'מרחף (דינמי) 🎈';
    }
  };

  if (navStyleSegmented) {
    updateNavStyleUI(state.navStyle);
    const btns = navStyleSegmented.querySelectorAll('.segmented-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const selectedStyle = btn.dataset.navStyle || 'floating';
        updateNavStyleUI(selectedStyle);
        if (window.applyNavStyle) {
          window.applyNavStyle(selectedStyle);
        }
        showPremiumToast(
          selectedStyle === 'fixed' 
            ? 'סגנון הסרגל עודכן: קבוע לתחתית המסך 📌' 
            : 'סגנון הסרגל עודכן: מרחף ודינמי 🎈',
          'success'
        );
      });
    });
  }

  if (settingsVer) {
    const mainBadge = document.getElementById('app-version-display');
    if (mainBadge && mainBadge.textContent) {
      settingsVer.textContent = mainBadge.textContent;
    } else {
      settingsVer.textContent = 'v1.2';
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
  const syncView = document.getElementById('settings-sync-view');
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

    // Populate local/cloud counts dynamically
    const uid = state.currentUser.uid;
    const localHistory = JSON.parse(SafeStorage.getItem(`aura-workout-history_${uid}`) || "[]");
    const localCustomEx = JSON.parse(SafeStorage.getItem(`aura-custom-exercises_${uid}`) || "[]");
    const localCustomLoc = JSON.parse(SafeStorage.getItem(`aura-custom-locations_${uid}`) || "[]");
    const localFavorites = JSON.parse(SafeStorage.getItem(`aura-favorite-exercises_${uid}`) || "[]");
    const localFuture = JSON.parse(SafeStorage.getItem(`aura-future-workouts_${uid}`) || "[]");

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

