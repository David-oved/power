import { state } from "../state.js";
import { SafeStorage } from "../utils/storage.js";
import { showPremiumToast } from "../utils/helpers.js";
import { saveFieldToCloud } from "../utils/db.js";

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

  const allTabs = document.querySelectorAll('.tab-content-container .tab-pane');
  const toggleDarkMode = document.getElementById('toggle-settings-dark-mode');
  const toggleNotifications = document.getElementById('toggle-settings-notifications');
  const settingsVer = document.getElementById('settings-system-version');
  const checkUpdateRow = document.getElementById('row-settings-check-update');
  const updateStatus = document.getElementById('settings-update-status');
  
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
            updateStatus.textContent = 'לא נתמך';
            checkUpdateRow.classList.remove('checking');
          }
        } catch (err) {
          console.error('Manual PWA update check failed:', err);
          updateStatus.textContent = 'שגיאה ⚠️';
          setTimeout(() => {
            updateStatus.textContent = 'בדוק';
            checkUpdateRow.classList.remove('checking');
          }, 3000);
        }
      } else {
        updateStatus.textContent = 'לא נתמך';
        checkUpdateRow.classList.remove('checking');
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

  // Initialize Health Questionnaire event handlers
  initHealthQuestionnaire();
}

// Binds global configurations
export function initSettingsModule() {
  window.initPremiumSettings = initPremiumSettings;
  window.showUpdateStateInSettings = showUpdateStateInSettings;
  window.showHealthQuestionnaireModal = showHealthQuestionnaireModal;
  window.hideHealthQuestionnaireModal = hideHealthQuestionnaireModal;
}

export function showHealthQuestionnaireModal() {
  const modal = document.getElementById('health-questionnaire-modal');
  if (!modal) return;
  
  // Pre-fill fields if questionnaire data exists
  if (state.healthQuestionnaire) {
    const data = state.healthQuestionnaire;
    if (document.getElementById('health-gender')) document.getElementById('health-gender').value = data.gender || '';
    if (document.getElementById('health-age')) document.getElementById('health-age').value = data.age || '';
    if (document.getElementById('health-height')) document.getElementById('health-height').value = data.height || '';
    if (document.getElementById('health-weight')) document.getElementById('health-weight').value = data.weight || '';
    if (document.getElementById('health-target-weight')) document.getElementById('health-target-weight').value = data.targetWeight || '';
    if (document.getElementById('health-goal')) document.getElementById('health-goal').value = data.goal || '';
  }
  
  modal.classList.remove('hide');
}

export function hideHealthQuestionnaireModal() {
  const modal = document.getElementById('health-questionnaire-modal');
  if (modal) {
    modal.classList.add('hide');
  }
}

export function initHealthQuestionnaire() {
  window.showHealthQuestionnaireModal = showHealthQuestionnaireModal;
  window.hideHealthQuestionnaireModal = hideHealthQuestionnaireModal;

  const editBtn = document.getElementById('edit-health-questionnaire-btn');
  const closeBtn = document.getElementById('close-health-modal-btn');
  const modal = document.getElementById('health-questionnaire-modal');
  const form = document.getElementById('health-questionnaire-form');

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      showHealthQuestionnaireModal();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideHealthQuestionnaireModal();
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideHealthQuestionnaireModal();
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const gender = document.getElementById('health-gender').value;
      const age = parseInt(document.getElementById('health-age').value);
      const height = parseInt(document.getElementById('health-height').value);
      const weight = parseFloat(document.getElementById('health-weight').value);
      const targetWeight = parseFloat(document.getElementById('health-target-weight').value);
      const goal = document.getElementById('health-goal').value;

      if (!gender || isNaN(age) || isNaN(height) || isNaN(weight) || isNaN(targetWeight) || !goal) {
        showPremiumToast("אנא מלא את כל השדות בצורה תקינה.", "error");
        return;
      }

      const data = {
        gender,
        age,
        height,
        weight,
        targetWeight,
        goal,
        updatedAt: Date.now()
      };

      state.healthQuestionnaire = data;

      const uid = state.currentUser ? state.currentUser.uid : null;
      const storageKey = uid ? `aura-health-questionnaire_${uid}` : 'aura-health-questionnaire_guest';
      
      SafeStorage.setItem(storageKey, JSON.stringify(data));

      if (uid) {
        showPremiumToast("שומר ומסנכרן לענן... ☁️", "info");
        await saveFieldToCloud('healthQuestionnaire', data);
      }

      showPremiumToast("פרופיל הבריאות נשמר בהצלחה! 📋✨", "success");
      hideHealthQuestionnaireModal();
    });
  }
}
