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

// Color Adjustment Helper Functions
function adjustColorBrightness(hex, percent) {
  let num = parseInt(hex.replace('#', ''), 16);
  let r = Math.min(255, Math.max(0, (num >> 16) + Math.round(255 * (percent / 100))));
  let g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + Math.round(255 * (percent / 100))));
  let b = Math.min(255, Math.max(0, (num & 0x0000FF) + Math.round(255 * (percent / 100))));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function hexToRgba(hex, alpha = 0.25) {
  let num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16);
  let g = ((num >> 8) & 0x00FF);
  let b = (num & 0x0000FF);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgbValues(hex) {
  let num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16);
  let g = ((num >> 8) & 0x00FF);
  let b = (num & 0x0000FF);
  return `${r}, ${g}, ${b}`;
}

// Cloud Sync Helper for Display Preferences
function saveAllDisplaySettingsToCloud() {
  import("../utils/db.js").then(({ saveFieldToCloud }) => {
    saveFieldToCloud("displaySettings", {
      theme: state.displayTheme || (state.outdoorMode ? 'outdoor' : (SafeStorage.getItem('settings_dark_mode') !== 'false' ? 'dark' : 'light')),
      opacity: state.displayOpacity,
      accentColor: state.accentColor,
      cardColor: state.cardBgColor,
      wallpaper: state.wallpaper,
      showGlows: state.showGlows,
      navStyle: state.navStyle
    });
  });
}

export function applyDisplayPreferences() {
  // 1. Apply Opacity (0% to 100%)
  const opacityVal = (state.displayOpacity !== undefined) ? state.displayOpacity : 85;
  const opacityAlpha = opacityVal / 100;
  document.documentElement.style.setProperty('--card-bg-opacity', opacityAlpha);

  const opacitySlider = document.getElementById('display-opacity-slider');
  const opacityText = document.getElementById('display-opacity-value-text');
  if (opacitySlider) opacitySlider.value = opacityVal;
  if (opacityText) opacityText.textContent = `${opacityVal}%`;

  // 2. Apply Primary Accent Color
  const accentColor = state.accentColor || '#007aff';
  const lightColor = adjustColorBrightness(accentColor, 25);
  const glowColor = hexToRgba(accentColor, 0.25);

  document.documentElement.style.setProperty('--electric-blue', accentColor);
  document.documentElement.style.setProperty('--accent', accentColor);
  document.documentElement.style.setProperty('--electric-blue-light', lightColor);
  document.documentElement.style.setProperty('--accent-light', lightColor);
  document.documentElement.style.setProperty('--electric-blue-glow', glowColor);
  document.documentElement.style.setProperty('--accent-glow', glowColor);

  const colorPicker = document.getElementById('display-custom-color-picker');
  if (colorPicker) colorPicker.value = accentColor;

  const swatches = document.querySelectorAll('.accent-color-swatch');
  swatches.forEach(s => {
    if (s.dataset.color && s.dataset.color.toLowerCase() === accentColor.toLowerCase()) {
      s.classList.add('active');
    } else {
      s.classList.remove('active');
    }
  });

  // 3. Apply Card Tint Color Theme
  const cardColor = state.cardBgColor || '#16161c';
  const cardRgb = hexToRgbValues(cardColor);
  document.documentElement.style.setProperty('--card-bg-rgb', cardRgb);

  const cardColorPicker = document.getElementById('display-custom-card-color-picker');
  if (cardColorPicker) cardColorPicker.value = cardColor;

  const cardSwatches = document.querySelectorAll('.card-color-swatch');
  cardSwatches.forEach(s => {
    if (s.dataset.cardColor && s.dataset.cardColor.toLowerCase() === cardColor.toLowerCase()) {
      s.classList.add('active');
    } else {
      s.classList.remove('active');
    }
  });

  // 4. Theme Mode (Dark / Light / Outdoor)
  const currentTheme = state.displayTheme || (state.outdoorMode ? 'outdoor' : (SafeStorage.getItem('settings_dark_mode') !== 'false' ? 'dark' : 'light'));
  const allTabs = document.querySelectorAll('.tab-pane');

  if (currentTheme === 'dark') {
    document.body.classList.remove('outdoor-mode');
    allTabs.forEach(tab => tab.classList.add('dark-theme'));
  } else if (currentTheme === 'light') {
    document.body.classList.remove('outdoor-mode');
    allTabs.forEach(tab => tab.classList.remove('dark-theme'));
  } else if (currentTheme === 'outdoor') {
    document.body.classList.add('outdoor-mode');
    allTabs.forEach(tab => tab.classList.remove('dark-theme'));
  }

  const themeSegmentBtns = document.querySelectorAll('.theme-segment-btn');
  themeSegmentBtns.forEach(btn => {
    if (btn.dataset.theme === currentTheme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 5. Apply Background Wallpaper (100% Offline Gradient Presets + Base64 Custom)
  const wp = state.wallpaper || 'default';
  let wpUrl = 'none';
  if (wp === 'cyberpunk_gym') {
    wpUrl = 'linear-gradient(135deg, #ff007f 0%, #7928ca 50%, #00dfd8 100%)';
  } else if (wp === 'deep_space') {
    wpUrl = 'linear-gradient(135deg, #0d1b2a 0%, #1b263b 40%, #415a77 70%, #778da9 100%)';
  } else if (wp === 'slate_mesh') {
    wpUrl = 'linear-gradient(135deg, #1f2937 0%, #111827 50%, #374151 100%)';
  } else if (wp === 'high_contrast') {
    wpUrl = 'linear-gradient(135deg, #f97316 0%, #b91c1c 50%, #431407 100%)';
  } else if (wp.startsWith('data:image/') || wp.startsWith('http://') || wp.startsWith('https://')) {
    wpUrl = `url("${wp}")`;
  }

  if (wp === 'default' || wpUrl === 'none') {
    document.documentElement.style.removeProperty('--app-wallpaper');
    document.body.style.removeProperty('--app-wallpaper');
    document.body.classList.remove('has-custom-wallpaper');
  } else {
    document.documentElement.style.setProperty('--app-wallpaper', wpUrl);
    document.body.style.setProperty('--app-wallpaper', wpUrl);
    document.body.classList.add('has-custom-wallpaper');
  }

  const wpCards = document.querySelectorAll('.wallpaper-preset-card');
  wpCards.forEach(c => {
    if (c.dataset.wallpaper === wp || (c.dataset.wallpaper === 'custom' && wp.startsWith('data:image/'))) {
      c.classList.add('active');
      if (c.dataset.wallpaper === 'custom' && wp.startsWith('data:image/')) {
        const customPreview = document.getElementById('wp-custom-preview');
        if (customPreview) {
          customPreview.style.backgroundImage = `url("${wp}")`;
          customPreview.style.backgroundSize = 'cover';
          customPreview.textContent = '';
        }
      }
    } else {
      c.classList.remove('active');
    }
  });

  // 6. Update Live Interactive Preview Boxes
  const livePreviewBox = document.getElementById('display-live-preview');
  if (livePreviewBox) {
    if (wp !== 'default' && wpUrl !== 'none') {
      livePreviewBox.style.backgroundImage = wpUrl;
      livePreviewBox.style.backgroundSize = 'cover';
    } else {
      livePreviewBox.style.backgroundImage = 'none';
      livePreviewBox.style.backgroundColor = (currentTheme === 'light') ? '#f2f2f7' : '#0b0c10';
    }
  }

  const fullPreviewDemo = document.getElementById('full-preview-screen-demo');
  if (fullPreviewDemo) {
    if (wp !== 'default' && wpUrl !== 'none') {
      fullPreviewDemo.style.backgroundImage = wpUrl;
      fullPreviewDemo.style.backgroundSize = 'cover';
    } else {
      fullPreviewDemo.style.backgroundImage = 'none';
      fullPreviewDemo.style.backgroundColor = (currentTheme === 'light') ? '#f2f2f7' : '#0b0c10';
    }
  }
}
window.applyDisplayPreferences = applyDisplayPreferences;

// Initializer for the settings tab preferences
export function initPremiumSettings() {
  console.log("Initializing premium iOS Settings View...");

  // Apply startup display preferences
  applyDisplayPreferences();

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

  const toggleNotifications = document.getElementById('toggle-settings-notifications');
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

  // Bind Theme Segmented Control Buttons
  const themeSegmentBtns = document.querySelectorAll('.theme-segment-btn');
  themeSegmentBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const chosenTheme = e.currentTarget.dataset.theme;
      if (!chosenTheme) return;
      state.displayTheme = chosenTheme;
      state.outdoorMode = (chosenTheme === 'outdoor');
      SafeStorage.setItem('aura-display-theme', chosenTheme);
      SafeStorage.setItem('settings_dark_mode', chosenTheme === 'dark' ? 'true' : 'false');
      SafeStorage.setItem('aura-outdoor-mode', chosenTheme === 'outdoor' ? 'true' : 'false');
      applyDisplayPreferences();
      saveAllDisplaySettingsToCloud();
    });
  });

  if (toggleNotifications) {
    const isNotificationsEnabled = SafeStorage.getItem('settings_notifications_enabled') !== 'false';
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

  if (toggleShowGlows) {
    toggleShowGlows.checked = state.showGlows;
    toggleShowGlows.addEventListener('change', (e) => {
      state.showGlows = e.target.checked;
      SafeStorage.setItem('aura-show-glows', state.showGlows ? 'true' : 'false');
      if (!state.showGlows) {
        document.body.classList.add('hide-glows');
      } else {
        document.body.classList.remove('hide-glows');
      }
      saveAllDisplaySettingsToCloud();
    });
  }

  // Bind Opacity Slider
  const opacitySlider = document.getElementById('display-opacity-slider');
  if (opacitySlider) {
    opacitySlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      state.displayOpacity = val;
      SafeStorage.setItem('aura-display-opacity', val);
      applyDisplayPreferences();
    });
    opacitySlider.addEventListener('change', () => {
      saveAllDisplaySettingsToCloud();
    });
  }

  // Bind Card Tint Color Swatches & Custom Card Color Picker
  const cardSwatches = document.querySelectorAll('.card-color-swatch');
  cardSwatches.forEach(s => {
    s.addEventListener('click', (e) => {
      const color = e.currentTarget.dataset.cardColor;
      if (!color) return;
      state.cardBgColor = color;
      SafeStorage.setItem('aura-card-bg-color', color);
      applyDisplayPreferences();
      saveAllDisplaySettingsToCloud();
      showPremiumToast(`גוון הכרטיסיות עודכן! 🎨`, 'success');
    });
  });

  const customCardColorPicker = document.getElementById('display-custom-card-color-picker');
  if (customCardColorPicker) {
    customCardColorPicker.addEventListener('input', (e) => {
      const color = e.target.value;
      state.cardBgColor = color;
      SafeStorage.setItem('aura-card-bg-color', color);
      applyDisplayPreferences();
    });
    customCardColorPicker.addEventListener('change', () => {
      saveAllDisplaySettingsToCloud();
      showPremiumToast(`גוון כרטיסיות אישי נשמר! 🎨`, 'success');
    });
  }

  // Bind Full Screen Preview Modal Open & Close Buttons
  const openFullPreviewBtn = document.getElementById('open-full-preview-btn');
  const closeFullPreviewBtn = document.getElementById('close-full-preview-btn');
  const fullPreviewModal = document.getElementById('display-full-preview-modal');

  if (openFullPreviewBtn && fullPreviewModal) {
    openFullPreviewBtn.addEventListener('click', () => {
      applyDisplayPreferences();
      fullPreviewModal.classList.remove('hide');
      fullPreviewModal.classList.add('show');
    });
  }

  if (closeFullPreviewBtn && fullPreviewModal) {
    closeFullPreviewBtn.addEventListener('click', () => {
      fullPreviewModal.classList.remove('show');
      fullPreviewModal.classList.add('hide');
    });
  }

  if (fullPreviewModal) {
    fullPreviewModal.addEventListener('click', (e) => {
      if (e.target === fullPreviewModal) {
        fullPreviewModal.classList.remove('show');
        fullPreviewModal.classList.add('hide');
      }
    });
  }

  // Bind Accent Color Swatches & Custom Picker
  const swatches = document.querySelectorAll('.accent-color-swatch');
  swatches.forEach(s => {
    s.addEventListener('click', (e) => {
      const color = e.currentTarget.dataset.color;
      if (!color) return;
      state.accentColor = color;
      SafeStorage.setItem('aura-accent-color', color);
      applyDisplayPreferences();
      saveAllDisplaySettingsToCloud();
      showPremiumToast(`צבע נושא עודכן! 🎨`, 'success');
    });
  });

  const customColorPicker = document.getElementById('display-custom-color-picker');
  if (customColorPicker) {
    customColorPicker.addEventListener('input', (e) => {
      const color = e.target.value;
      state.accentColor = color;
      SafeStorage.setItem('aura-accent-color', color);
      applyDisplayPreferences();
    });
    customColorPicker.addEventListener('change', () => {
      saveAllDisplaySettingsToCloud();
      showPremiumToast(`צבע מותאם אישית נשמר! 🎨`, 'success');
    });
  }

  // Bind Wallpaper Preset Cards & Custom Wallpaper Card Click
  const wpCards = document.querySelectorAll('.wallpaper-preset-card');
  wpCards.forEach(card => {
    card.addEventListener('click', (e) => {
      const wp = e.currentTarget.dataset.wallpaper;
      if (wp === 'custom') {
        const fileInput = document.getElementById('display-wallpaper-upload-input');
        if (fileInput) fileInput.click();
        return;
      }
      if (!wp) return;
      state.wallpaper = wp;
      SafeStorage.setItem('aura-wallpaper', wp);
      applyDisplayPreferences();
      saveAllDisplaySettingsToCloud();
      showPremiumToast(`תמונת רקע עודכנה! 🖼️`, 'success');
    });
  });

  // Bind Wallpaper Image File Upload (with automatic canvas compression to Base64)
  const wallpaperInput = document.getElementById('display-wallpaper-upload-input');
  if (wallpaperInput) {
    wallpaperInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      showPremiumToast("מעבד תמונה ואיכות... 🖼️", "info");

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
          state.wallpaper = compressedBase64;
          SafeStorage.setItem('aura-wallpaper', compressedBase64);
          applyDisplayPreferences();
          saveAllDisplaySettingsToCloud();

          showPremiumToast(`תמונה אישית הועלתה ונשמרה בענן! 📸☁️`, 'success');
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
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

