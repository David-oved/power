import { state } from "../state.js";
import { SafeStorage } from "../utils/storage.js";
import { showPremiumToast } from "../utils/helpers.js";

// DOM Elements inside meals pane
let loggedMealsList;

export const MACRO_GOALS = {
  calories: 2200,
  protein: 150,
  carbs: 220,
  fat: 70
};

// Initialize meals on user login
export function initMeals() {
  if (!state.currentUser) return;
  
  // Load metrics from LocalStorage per user
  state.loadMealMetrics();
  
  // Load meals from LocalStorage
  const mealsData = SafeStorage.getItem(`aura-logged-meals_${state.currentUser.uid}`);
  if (mealsData) {
    try {
      state.loggedMeals = JSON.parse(mealsData);
    } catch (e) {
      console.error("Failed to parse logged meals:", e);
      state.loggedMeals = [];
    }
  } else {
    state.loggedMeals = [];
  }
  
  // Render dynamic components
  renderAddMealSliders();
  renderMealsDashboard();
  renderMealSettings();
  
  // Bind events for meals tab
  bindMealsEvents();
}

// Clear meals session on logout
export function clearMealsSession() {
  state.loggedMeals = [];
  loggedMealsList = document.getElementById('logged-meals-list');
  if (loggedMealsList) {
    loggedMealsList.innerHTML = `
      <div class="meals-empty-state-card">
        <span style="font-size: 2rem;">🥗</span>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted); direction: rtl;">לא נרשמו ארוחות היום. התחל להוסיף ארוחות כדי לעקוב אחר התזונה שלך!</p>
      </div>
    `;
  }
  
  const container = document.getElementById('meals-gauges-container');
  if (container) container.innerHTML = '';
}

// Save meals to LocalStorage
export function saveMealsState() {
  if (state.currentUser) {
    SafeStorage.setItem(`aura-logged-meals_${state.currentUser.uid}`, JSON.stringify(state.loggedMeals));
  }
}

// Get meals logged today (local time YYYY-MM-DD)
export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Render dynamic components
export function renderMealsDashboard() {
  loggedMealsList = document.getElementById('logged-meals-list');
  if (!loggedMealsList) return;
  
  // Filter meals for today
  const todayStr = getTodayDateString();
  const todayMeals = state.loggedMeals.filter(m => m.date === todayStr);
  
  // Update date badge
  const dateBadge = document.getElementById('meals-today-date-badge');
  if (dateBadge) {
    const d = new Date();
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    dateBadge.textContent = `📅 יום ${dayNames[d.getDay()]}, ${d.getDate()} ב${monthNames[d.getMonth()]}`;
  }
  
  // Update meals count badge
  const countBadge = document.getElementById('meals-count-badge');
  const countText = document.getElementById('meals-count-text');
  if (countBadge && countText) {
    countText.textContent = `${todayMeals.length} ארוחות`;
    if (todayMeals.length > 0) {
      countBadge.classList.add('has-data');
    } else {
      countBadge.classList.remove('has-data');
    }
  }
  
  // Render Dynamic Gauges Grid
  renderGauges();
  
  // Render meals list
  if (todayMeals.length === 0) {
    loggedMealsList.innerHTML = `
      <div class="meals-empty-state-card">
        <span style="font-size: 2rem;">🥗</span>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted); direction: rtl;">לא נרשמו ארוחות היום. התחל להוסיף ארוחות כדי לעקוב אחר התזונה שלך!</p>
      </div>
    `;
  } else {
    loggedMealsList.innerHTML = '';
    todayMeals.forEach((meal) => {
      const row = document.createElement('div');
      
      // Determine badge class & dynamic category class
      let badgeClass = 'type-badge-breakfast';
      let typeClass = 'meal-type-breakfast';
      if (meal.type === 'צהריים') {
        badgeClass = 'type-badge-lunch';
        typeClass = 'meal-type-lunch';
      }
      if (meal.type === 'ערב') {
        badgeClass = 'type-badge-dinner';
        typeClass = 'meal-type-dinner';
      }
      if (meal.type === 'חטיף') {
        badgeClass = 'type-badge-snack';
        typeClass = 'meal-type-snack';
      }
      row.className = `logged-meal-row ${typeClass}`;
      
      // Build micro-nutrition description dynamically
      let descString = `${meal.protein || 0}g חלבון • ${meal.calories || 0} קק"ל`;
      
      // Add custom metrics values if present
      state.mealMetrics.forEach(m => {
        if (m.isCustom && meal[m.key] > 0) {
          descString += ` • ${meal[m.key]}${m.unit} ${m.name}`;
        }
      });
      
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.25rem;">${meal.type === 'בוקר' ? '🍳' : meal.type === 'צהריים' ? '🍗' : meal.type === 'ערב' ? '🥩' : '🍌'}</span>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-heading);">${meal.name}</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="logged-meal-type-badge ${badgeClass}">${meal.type}</span>
              <span style="font-size: 0.78rem; color: var(--text-muted);">${descString}</span>
            </div>
          </div>
        </div>
        <button class="delete-meal-btn" data-id="${meal.id}" aria-label="מחק ארוחה">🗑️</button>
      `;
      
      // Bind delete button listener
      row.querySelector('.delete-meal-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteLoggedMeal(meal.id);
      });
      
      loggedMealsList.appendChild(row);
    });
  }
}

// Draw dynamic semi-circle gauges for each active metric
export function renderGauges() {
  const container = document.getElementById('meals-gauges-container');
  if (!container) return;

  container.innerHTML = '';
  
  const todayStr = getTodayDateString();
  const todayMeals = state.loggedMeals.filter(m => m.date === todayStr);

  state.mealMetrics.forEach(metric => {
    // Calculate total for this specific metric
    let total = 0;
    todayMeals.forEach(meal => {
      total += Number(meal[metric.key] || 0);
    });

    const percentage = metric.goal > 0 ? Math.min(100, Math.round((total / metric.goal) * 100)) : 0;
    const strokeDashoffset = 251.3 - (percentage / 100) * 251.3;

    const gaugeId = `gauge-fill-${metric.key}`;
    const gradientId = `grad-${metric.key}`;
    
    let gradientColors = '';
    if (metric.key === 'calories') {
      gradientColors = `<stop offset="0%" stop-color="#ff9500" /><stop offset="100%" stop-color="#ff3b30" />`;
    } else if (metric.key === 'protein') {
      gradientColors = `<stop offset="0%" stop-color="#ec4899" /><stop offset="100%" stop-color="#e11d48" />`;
    } else if (metric.key === 'carbs') {
      gradientColors = `<stop offset="0%" stop-color="#f59e0b" /><stop offset="100%" stop-color="#d97706" />`;
    } else if (metric.key === 'fat') {
      gradientColors = `<stop offset="0%" stop-color="#a855f7" /><stop offset="100%" stop-color="#7c3aed" />`;
    } else {
      // Electric blue/neon for custom
      gradientColors = `<stop offset="0%" stop-color="#00f0ff" /><stop offset="100%" stop-color="#007aff" />`;
    }

    const gaugeHTML = `
      <div class="premium-gauge-card">
        <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); display: flex; align-items: center; gap: 6px; margin-bottom: 6px; direction: rtl;">
          <span style="font-size: 1rem;">${metric.emoji}</span>
          <span style="color: var(--text-heading); letter-spacing: 0.3px; font-size: 0.82rem;">${metric.name}</span>
        </div>
        
        <div style="position: relative; width: 100%; max-width: 120px; text-align: center;">
          <svg viewBox="0 0 200 120" style="width: 100%; height: auto; display: block;">
            <defs>
              <linearGradient id="${gradientId}" x1="0%" y1="100%" x2="100%" y2="0%">
                ${gradientColors}
              </linearGradient>
            </defs>
            <!-- Background Arc -->
            <path class="gauge-bg-arc" d="M20,110 A80,80 0 0,1 180,110" fill="none" stroke-width="12" stroke-linecap="round"/>
            <!-- Progress Arc -->
            <path id="${gaugeId}" class="gauge-progress-arc progress-${metric.key}" d="M20,110 A80,80 0 0,1 180,110" fill="none" stroke="url(#${gradientId})" stroke-width="12" stroke-linecap="round" stroke-dasharray="251.3" stroke-dashoffset="251.3" style="transition: stroke-dashoffset 1s cubic-bezier(0.1, 0.8, 0.25, 1);"/>
          </svg>
          
          <div style="position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; width: 100%;">
            <span style="font-size: 1rem; font-weight: 900; color: var(--text-heading); font-family: var(--font-display);">${total.toLocaleString()} ${metric.unit}</span>
            <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 600; margin-top: 1px;">יעד: ${metric.goal.toLocaleString()}</span>
          </div>
        </div>
        <span class="meals-percentage-badge">${percentage}%</span>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = gaugeHTML.trim();
    const element = wrapper.firstChild;
    container.appendChild(element);

    // Trigger animation with a tiny timeout to execute after DOM mounting
    setTimeout(() => {
      const path = document.getElementById(gaugeId);
      if (path) {
        path.style.strokeDashoffset = strokeDashoffset;
      }
    }, 50);
  });
}

// Generate the beautiful premium slider elements dynamically
export function renderAddMealSliders() {
  const container = document.getElementById('add-meal-sliders-container');
  if (!container) return;

  container.innerHTML = '';
  
  state.loadMealMetrics();

  state.mealMetrics.forEach(metric => {
    let max = 100;
    let step = 1;
    let def = 0;

    if (metric.key === 'calories') {
      max = 2000;
      step = 10;
      def = 350;
    } else if (metric.key === 'protein') {
      max = 150;
      step = 1;
      def = 25;
    } else if (metric.key === 'carbs') {
      max = 250;
      step = 1;
      def = 40;
    } else if (metric.key === 'fat') {
      max = 100;
      step = 1;
      def = 10;
    } else {
      // Custom metric
      max = Math.max(metric.goal * 2, 100);
      step = 1;
      def = Math.round(metric.goal / 3) || 0;
    }

    const sliderGroup = document.createElement('div');
    sliderGroup.className = 'slider-group-container';
    sliderGroup.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; direction: rtl; margin-bottom: 4px;">
        <span style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted);">${metric.emoji} ${metric.name}</span>
        <span class="slider-display-badge" id="slider-val-${metric.key}">${def} ${metric.unit}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; direction: ltr;">
        <button type="button" class="slider-adjust-btn minus-btn" data-key="${metric.key}">-</button>
        <input type="range" class="premium-range-slider" id="slider-${metric.key}" data-key="${metric.key}" min="0" max="${max}" step="${step}" value="${def}">
        <button type="button" class="slider-adjust-btn plus-btn" data-key="${metric.key}">+</button>
      </div>
    `;

    container.appendChild(sliderGroup);
  });

  // Bind slider micro-adjustment controls
  bindSliderMicroAdjustments();
}

// Logic for range input micro-adjustments
function bindSliderMicroAdjustments() {
  const container = document.getElementById('add-meal-sliders-container');
  if (!container) return;

  const sliders = container.querySelectorAll('.premium-range-slider');
  sliders.forEach(slider => {
    const key = slider.getAttribute('data-key');
    const badge = document.getElementById(`slider-val-${key}`);
    const metric = state.mealMetrics.find(m => m.key === key);
    
    slider.addEventListener('input', () => {
      if (badge && metric) {
        badge.textContent = `${slider.value} ${metric.unit}`;
      }
    });
  });

  const minusButtons = container.querySelectorAll('.minus-btn');
  minusButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const key = btn.getAttribute('data-key');
      const slider = document.getElementById(`slider-${key}`);
      if (slider) {
        const step = Number(slider.getAttribute('step')) || 1;
        const min = Number(slider.getAttribute('min')) || 0;
        const currentVal = Number(slider.value);
        const newVal = Math.max(min, currentVal - step);
        slider.value = newVal;
        slider.dispatchEvent(new Event('input'));
      }
    });
  });

  const plusButtons = container.querySelectorAll('.plus-btn');
  plusButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const key = btn.getAttribute('data-key');
      const slider = document.getElementById(`slider-${key}`);
      if (slider) {
        const step = Number(slider.getAttribute('step')) || 1;
        const max = Number(slider.getAttribute('max')) || 100;
        const currentVal = Number(slider.value);
        const newVal = Math.min(max, currentVal + step);
        slider.value = newVal;
        slider.dispatchEvent(new Event('input'));
      }
    });
  });
}

// Render Settings Modal Fields
export function renderMealSettings() {
  state.loadMealMetrics();

  // Goal settings list
  const goalsContainer = document.getElementById('settings-goals-list');
  if (goalsContainer) {
    goalsContainer.innerHTML = '';
    state.mealMetrics.forEach(metric => {
      const row = document.createElement('div');
      row.className = 'settings-metric-row';
      row.innerHTML = `
        <span class="settings-metric-label">
          <span>${metric.emoji}</span>
          <span>${metric.name} (${metric.unit})</span>
        </span>
        <input type="number" class="metric-goal-input" data-key="${metric.key}" value="${metric.goal}">
      `;
      goalsContainer.appendChild(row);
    });
  }

  // Custom metrics view/delete list
  const customListContainer = document.getElementById('settings-custom-metrics-list');
  if (customListContainer) {
    customListContainer.innerHTML = '';
    const customMetrics = state.mealMetrics.filter(m => m.isCustom);
    
    if (customMetrics.length === 0) {
      customListContainer.innerHTML = `
        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">אין מדדים מותאמים אישית כרגע.</p>
      `;
    } else {
      customMetrics.forEach(metric => {
        const row = document.createElement('div');
        row.className = 'settings-custom-metric-row';
        row.innerHTML = `
          <span class="settings-metric-label">
            <span>${metric.emoji}</span>
            <span>${metric.name}</span>
          </span>
          <button type="button" class="delete-custom-metric-btn btn" data-key="${metric.key}">🗑️</button>
        `;
        row.querySelector('.delete-custom-metric-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          deleteCustomMetric(metric.key);
        });
        customListContainer.appendChild(row);
      });
    }
  }
}

// Delete Custom Metric
export function deleteCustomMetric(key) {
  state.mealMetrics = state.mealMetrics.filter(m => m.key !== key);
  state.saveMealMetrics();
  
  // Re-render
  renderMealSettings();
  renderAddMealSliders();
  renderMealsDashboard();
  showPremiumToast("המדד נמחק בהצלחה.", "success");
}

// Log a new meal
export function logMeal(name, type, values = {}) {
  const newMeal = {
    id: 'meal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    name: name.trim(),
    type: type,
    date: getTodayDateString(),
    timestamp: Date.now()
  };

  // Assign values for each active metric
  state.mealMetrics.forEach(metric => {
    newMeal[metric.key] = Number(values[metric.key] || 0);
  });
  
  state.loggedMeals.unshift(newMeal);
  saveMealsState();
  renderMealsDashboard();
  showPremiumToast("הארוחה נרשמה בהצלחה! 🍳", "success");
}

// Delete a logged meal
export function deleteLoggedMeal(id) {
  state.loggedMeals = state.loggedMeals.filter(m => m.id !== id);
  saveMealsState();
  renderMealsDashboard();
  showPremiumToast("הארוחה נמחקה.", "success");
}

// Bind interactive event listeners for Meals tab
let mealsEventsBound = false;
export function bindMealsEvents() {
  if (mealsEventsBound) return;
  
  const triggerBtn = document.getElementById('add-meal-trigger-btn');
  const addModal = document.getElementById('add-meal-modal');
  const closeBtn = document.getElementById('close-add-meal-modal-btn');
  const addForm = document.getElementById('add-meal-form');
  
  // Settings modal buttons
  const settingsBtn = document.getElementById('meal-settings-btn');
  const settingsModal = document.getElementById('meal-settings-modal');
  const closeSettingsBtn = document.getElementById('close-meal-settings-modal-btn');
  
  // Open settings modal
  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
      renderMealSettings();
      settingsModal.classList.remove('hide');
    });
  }
  
  // Close settings modal
  if (closeSettingsBtn && settingsModal) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.classList.add('hide');
    });
  }
  
  // Open add-meal modal
  if (triggerBtn && addModal) {
    triggerBtn.addEventListener('click', () => {
      document.getElementById('new-meal-name').value = '';
      
      // Reset sliders to default values
      renderAddMealSliders();
      
      addModal.classList.remove('hide');
    });
  }
  
  // Close add-meal modal
  if (closeBtn && addModal) {
    closeBtn.addEventListener('click', () => {
      addModal.classList.add('hide');
    });
  }
  
  // Handle form submission
  if (addForm && addModal) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = document.getElementById('new-meal-name').value;
      const type = document.getElementById('new-meal-type').value;
      
      // Collect slider values dynamically
      const values = {};
      state.mealMetrics.forEach(metric => {
        const slider = document.getElementById(`slider-${metric.key}`);
        if (slider) {
          values[metric.key] = Number(slider.value);
        }
      });
      
      logMeal(name, type, values);
      
      addModal.classList.add('hide');
    });
  }
  
  // Save Settings Modal Button
  const saveSettingsBtn = document.getElementById('save-meal-settings-btn');
  if (saveSettingsBtn && settingsModal) {
    saveSettingsBtn.addEventListener('click', () => {
      const goalInputs = document.querySelectorAll('.metric-goal-input');
      goalInputs.forEach(input => {
        const key = input.getAttribute('data-key');
        const value = Number(input.value);
        const metric = state.mealMetrics.find(m => m.key === key);
        if (metric && value > 0) {
          metric.goal = value;
        }
      });

      state.saveMealMetrics();
      
      renderMealsDashboard();
      renderAddMealSliders();
      settingsModal.classList.add('hide');
      showPremiumToast("היעדים וההגדרות נשמרו בהצלחה! 🎯", "success");
    });
  }

  // Create Custom Metric Button
  const createCustomMetricBtn = document.getElementById('create-custom-metric-btn');
  if (createCustomMetricBtn) {
    createCustomMetricBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('custom-metric-name');
      const unitInput = document.getElementById('custom-metric-unit');
      const goalInput = document.getElementById('custom-metric-goal');
      const emojiInput = document.getElementById('custom-metric-emoji');

      const name = nameInput.value.trim();
      const unit = unitInput.value.trim();
      const goal = Number(goalInput.value);
      const emoji = emojiInput.value.trim() || '📊';

      if (!name || !unit || !goal) {
        showPremiumToast("אנא מלא את כל השדות ליצירת מדד.", "error");
        return;
      }

      const key = 'custom_' + Date.now();
      const newMetric = {
        key: key,
        name: name,
        unit: unit,
        goal: goal,
        emoji: emoji,
        isCustom: true
      };

      state.mealMetrics.push(newMetric);
      state.saveMealMetrics();

      // Clear inputs
      nameInput.value = '';
      unitInput.value = '';
      goalInput.value = '';
      emojiInput.value = '';

      // Re-render
      renderMealSettings();
      renderAddMealSliders();
      renderMealsDashboard();
      showPremiumToast(`המדד "${name}" נוצר בהצלחה! ✨`, "success");
    });
  }
  
  // Handle recommended meals quick logs
  const quickLogButtons = document.querySelectorAll('.quick-log-meal-btn');
  quickLogButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const name = btn.getAttribute('data-name');
      const calories = Number(btn.getAttribute('data-calories') || 0);
      const protein = Number(btn.getAttribute('data-protein') || 0);
      const carbs = Number(btn.getAttribute('data-carbs') || 0);
      const fat = Number(btn.getAttribute('data-fat') || 0);
      
      let type = 'צהריים';
      if (name.includes('דייסת')) type = 'בוקר';
      if (name.includes('שייק')) type = 'חטיף';
      if (name.includes('סלט סלמון')) type = 'ערב';
      
      logMeal(name, type, { calories, protein, carbs, fat });
    });
  });
  
  mealsEventsBound = true;
}

// Main Module Initializer Hook
export function initMealsModule() {
  window.initMeals = initMeals;
  window.clearMealsSession = clearMealsSession;
  window.logMeal = logMeal;
  window.deleteLoggedMeal = deleteLoggedMeal;
}
