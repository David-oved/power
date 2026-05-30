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

  // Group metrics
  const coreMetrics = state.mealMetrics.filter(m => !m.isCustom);
  const customMetrics = state.mealMetrics.filter(m => m.isCustom);

  // Calculate values
  const totals = {};
  state.mealMetrics.forEach(m => {
    totals[m.key] = 0;
    todayMeals.forEach(meal => {
      totals[m.key] += Number(meal[m.key] || 0);
    });
  });

  const getPercentage = (key) => {
    const metric = state.mealMetrics.find(m => m.key === key);
    if (!metric || metric.goal <= 0) return 0;
    return Math.min(100, Math.round((totals[key] / metric.goal) * 100));
  };

  const calGoal = state.mealMetrics.find(m => m.key === 'calories')?.goal || 2200;
  const proGoal = state.mealMetrics.find(m => m.key === 'protein')?.goal || 150;
  const carbGoal = state.mealMetrics.find(m => m.key === 'carbs')?.goal || 220;
  const fatGoal = state.mealMetrics.find(m => m.key === 'fat')?.goal || 70;

  const calPct = getPercentage('calories');
  const proPct = getPercentage('protein');
  const carbPct = getPercentage('carbs');
  const fatPct = getPercentage('fat');

  // Circs for Concentric Rings
  const offsetCal = 596.9 - (calPct / 100) * 596.9;
  const offsetPro = 483.8 - (proPct / 100) * 483.8;
  const offsetCarb = 377.0 - (carbPct / 100) * 377.0;
  const offsetFat = 270.2 - (fatPct / 100) * 270.2;

  // Build the unified hi-tech rings dashboard
  const ringsHTML = `
    <div class="hitech-rings-dashboard">
      <div class="rings-svg-container">
        <svg viewBox="0 0 220 220" class="hitech-rings-svg">
          <defs>
            <linearGradient id="cal-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#ff9500" /><stop offset="100%" stop-color="#ff3b30" />
            </linearGradient>
            <linearGradient id="pro-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#ec4899" /><stop offset="100%" stop-color="#e11d48" />
            </linearGradient>
            <linearGradient id="carb-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#34c759" /><stop offset="100%" stop-color="#30db5b" />
            </linearGradient>
            <linearGradient id="fat-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#a855f7" /><stop offset="100%" stop-color="#7c3aed" />
            </linearGradient>
            <filter id="glow-cal"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="glow-pro"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="glow-carb"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="glow-fat"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <!-- Background Circles -->
          <circle cx="110" cy="110" r="95" class="ring-bg" stroke="rgba(255,255,255,0.04)" stroke-width="12" fill="none" />
          <circle cx="110" cy="110" r="77" class="ring-bg" stroke="rgba(255,255,255,0.04)" stroke-width="10" fill="none" />
          <circle cx="110" cy="110" r="60" class="ring-bg" stroke="rgba(255,255,255,0.04)" stroke-width="10" fill="none" />
          <circle cx="110" cy="110" r="43" class="ring-bg" stroke="rgba(255,255,255,0.04)" stroke-width="10" fill="none" />
          
          <!-- Progress Circles (Active) -->
          <circle id="ring-cal" cx="110" cy="110" r="95" stroke="url(#cal-grad)" stroke-width="12" stroke-linecap="round" fill="none" stroke-dasharray="596.9" stroke-dashoffset="596.9" transform="rotate(-90 110 110)" filter="url(#glow-cal)" style="transition: stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1);" />
          <circle id="ring-pro" cx="110" cy="110" r="77" stroke="url(#pro-grad)" stroke-width="10" stroke-linecap="round" fill="none" stroke-dasharray="483.8" stroke-dashoffset="483.8" transform="rotate(-90 110 110)" filter="url(#glow-pro)" style="transition: stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1);" />
          <circle id="ring-carb" cx="110" cy="110" r="60" stroke="url(#carb-grad)" stroke-width="10" stroke-linecap="round" fill="none" stroke-dasharray="377.0" stroke-dashoffset="377.0" transform="rotate(-90 110 110)" filter="url(#glow-carb)" style="transition: stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1);" />
          <circle id="ring-fat" cx="110" cy="110" r="43" stroke="url(#fat-grad)" stroke-width="10" stroke-linecap="round" fill="none" stroke-dasharray="270.2" stroke-dashoffset="270.2" transform="rotate(-90 110 110)" filter="url(#glow-fat)" style="transition: stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1);" />
        </svg>
        <div class="rings-center-text">
          <span class="center-cal-value" id="center-cal-value">${totals.calories.toLocaleString()}</span>
          <span class="center-cal-label">קק"ל / <span id="center-cal-goal">${calGoal.toLocaleString()}</span></span>
          <span class="center-cal-percentage" style="font-size:0.75rem; color:#ff453a; font-weight:700;">${calPct}%</span>
        </div>
      </div>
      
      <div class="rings-legend-container">
        <div class="legend-item" data-key="calories">
          <div class="legend-dot color-cal"></div>
          <div class="legend-info">
            <span class="legend-name">🔥 קלוריות</span>
            <span class="legend-values"><strong id="legend-val-calories">${totals.calories.toLocaleString()}</strong> / <span id="legend-goal-calories">${calGoal.toLocaleString()}</span></span>
          </div>
        </div>
        <div class="legend-item" data-key="protein">
          <div class="legend-dot color-pro"></div>
          <div class="legend-info">
            <span class="legend-name">🥩 חלבון</span>
            <span class="legend-values"><strong id="legend-val-protein">${totals.protein}</strong> / <span id="legend-goal-protein">${proGoal}</span>g</span>
          </div>
        </div>
        <div class="legend-item" data-key="carbs">
          <div class="legend-dot color-carb"></div>
          <div class="legend-info">
            <span class="legend-name">🌾 פחמימות</span>
            <span class="legend-values"><strong id="legend-val-carbs">${totals.carbs}</strong> / <span id="legend-goal-carbs">${carbGoal}</span>g</span>
          </div>
        </div>
        <div class="legend-item" data-key="fat">
          <div class="legend-dot color-fat"></div>
          <div class="legend-info">
            <span class="legend-name">🥑 שומן</span>
            <span class="legend-values"><strong id="legend-val-fat">${totals.fat}</strong> / <span id="legend-goal-fat">${fatGoal}</span>g</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const dashboardWrapper = document.createElement('div');
  dashboardWrapper.innerHTML = ringsHTML.trim();
  container.appendChild(dashboardWrapper.firstChild);

  // Trigger SVG concentric animations
  setTimeout(() => {
    const elCal = document.getElementById('ring-cal');
    const elPro = document.getElementById('ring-pro');
    const elCarb = document.getElementById('ring-carb');
    const elFat = document.getElementById('ring-fat');

    if (elCal) elCal.style.strokeDashoffset = offsetCal;
    if (elPro) elPro.style.strokeDashoffset = offsetPro;
    if (elCarb) elCarb.style.strokeDashoffset = offsetCarb;
    if (elFat) elFat.style.strokeDashoffset = offsetFat;
  }, 50);

  // If there are custom metrics, render them below in a beautiful dynamic list
  if (customMetrics.length > 0) {
    const customTitle = document.createElement('div');
    customTitle.style.cssText = 'font-size: 0.9rem; font-weight: 800; color: #ffffff; text-align: right; direction: rtl; margin-top: 10px; margin-bottom: 4px;';
    customTitle.textContent = '📊 מדדים אישיים נוספים';
    container.appendChild(customTitle);

    const customGrid = document.createElement('div');
    customGrid.className = 'custom-metrics-dashboard-grid';
    customGrid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; direction: rtl; width: 100%;';
    container.appendChild(customGrid);

    customMetrics.forEach(metric => {
      const val = totals[metric.key] || 0;
      const percentage = metric.goal > 0 ? Math.min(100, Math.round((val / metric.goal) * 100)) : 0;
      
      const customCard = document.createElement('div');
      customCard.className = 'premium-gauge-card custom-metric-card';
      customCard.innerHTML = `
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: flex; align-items: center; gap: 4px; width: 100%;">
          <span style="font-size: 1rem;">${metric.emoji}</span>
          <span style="color: var(--text-heading); font-size: 0.8rem;">${metric.name}</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-start; width: 100%; margin-top: 6px;">
          <span style="font-size: 1.15rem; font-weight: 900; color: #ffffff;">${val.toLocaleString()} ${metric.unit}</span>
          <span style="font-size: 0.68rem; color: var(--text-muted);">יעד: ${metric.goal.toLocaleString()}</span>
        </div>
        <div class="custom-progress-bar-track" style="width: 100%; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; margin-top: 8px;">
          <div class="custom-progress-bar-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00f0ff, #007aff); box-shadow: 0 0 6px rgba(0, 240, 255, 0.4); border-radius: 3px; transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);"></div>
        </div>
        <span class="custom-pct-badge" style="position: absolute; top: 12px; left: 12px; font-size: 0.72rem; padding: 2px 6px; background: rgba(0,240,255,0.1); color:#00f0ff; border-radius: 6px; font-weight: 700;">${percentage}%</span>
      `;

      customGrid.appendChild(customCard);

      setTimeout(() => {
        const fillBar = customCard.querySelector('.custom-progress-bar-fill');
        if (fillBar) fillBar.style.width = `${percentage}%`;
      }, 50);
    });
  }
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
  
  // Dynamic cross-tab sync
  if (typeof window.renderMealsLogView === 'function') window.renderMealsLogView();
  if (typeof window.renderMealsCalendarView === 'function') window.renderMealsCalendarView();
  
  showPremiumToast("המדד נמחק בהצלחה.", "success");
}

// Log a new meal
export function logMeal(name, type, values = {}) {
  const newMeal = {
    id: 'meal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    name: name.trim() || "ארוחה מותאמת",
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
  
  // Dynamic cross-tab sync
  if (typeof window.renderMealsLogView === 'function') window.renderMealsLogView();
  if (typeof window.renderMealsCalendarView === 'function') window.renderMealsCalendarView();
  
  showPremiumToast("הארוחה נרשמה בהצלחה! 🍳", "success");
}

// Delete a logged meal
export function deleteLoggedMeal(id) {
  state.loggedMeals = state.loggedMeals.filter(m => m.id !== id);
  saveMealsState();
  renderMealsDashboard();
  
  // Dynamic cross-tab sync
  if (typeof window.renderMealsLogView === 'function') window.renderMealsLogView();
  if (typeof window.renderMealsCalendarView === 'function') window.renderMealsCalendarView();
  
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
      if (navigator.vibrate) navigator.vibrate(10);
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
      const nameInput = document.getElementById('new-meal-name');
      if (nameInput) nameInput.value = '✍️ ארוחה מותאמת';
      
      // Reset preset active state
      const presetButtons = document.querySelectorAll('#add-meal-modal .preset-btn');
      presetButtons.forEach(b => {
        b.classList.remove('active');
        if (b.getAttribute('data-name') === '✍️ ארוחה מותאמת') {
          b.classList.add('active');
        }
      });

      // Reset segmented control to lunch by default
      const hiddenType = document.getElementById('new-meal-type');
      if (hiddenType) hiddenType.value = 'צהריים';

      const typeBtns = document.querySelectorAll('#add-meal-modal .segmented-item');
      typeBtns.forEach(b => {
        b.classList.remove('active');
        if (b.getAttribute('data-value') === 'צהריים') {
          b.classList.add('active');
        }
      });
      
      // Reset sliders to default values
      renderAddMealSliders();
      
      addModal.classList.remove('hide');
      if (navigator.vibrate) navigator.vibrate(10);
    });
  }
  
  // Close add-meal modal
  if (closeBtn && addModal) {
    closeBtn.addEventListener('click', () => {
      addModal.classList.add('hide');
    });
  }
  
  // Preset Buttons Click Handler (Zero Typing)
  const presetButtons = document.querySelectorAll('#add-meal-modal .preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (navigator.vibrate) navigator.vibrate(12); // Premium micro-vibe haptic feedback
      
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const name = btn.getAttribute('data-name');
      const type = btn.getAttribute('data-type');
      
      // Autofill name and type inputs
      const nameInput = document.getElementById('new-meal-name');
      if (nameInput) nameInput.value = name;
      
      const hiddenTypeInput = document.getElementById('new-meal-type');
      if (hiddenTypeInput) hiddenTypeInput.value = type;
      
      const segmentedItems = document.querySelectorAll('#add-meal-modal .segmented-item');
      segmentedItems.forEach(b => {
        b.classList.remove('active');
        if (b.getAttribute('data-value') === type) {
          b.classList.add('active');
        }
      });
      
      // Autofill range sliders dynamically
      state.mealMetrics.forEach(metric => {
        const slider = document.getElementById(`slider-${metric.key}`);
        const badge = document.getElementById(`slider-val-${metric.key}`);
        if (slider) {
          const val = Number(btn.getAttribute(`data-${metric.key}`)) || 0;
          slider.value = val;
          slider.dispatchEvent(new Event('input'));
          if (badge) {
            badge.textContent = `${val} ${metric.unit}`;
          }
        }
      });
    });
  });

  // Segmented Control Item Clicks (Meal Type)
  const segmentedItems = document.querySelectorAll('#add-meal-modal .segmented-item');
  const hiddenTypeInput = document.getElementById('new-meal-type');
  segmentedItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (navigator.vibrate) navigator.vibrate(8); // Haptic vibration
      
      segmentedItems.forEach(b => b.classList.remove('active'));
      item.classList.add('active');
      
      if (hiddenTypeInput) {
        hiddenTypeInput.value = item.getAttribute('data-value');
      }
    });
  });

  // Handle form submission
  if (addForm && addModal) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = document.getElementById('new-meal-name').value || "ארוחה מותאמת";
      const type = document.getElementById('new-meal-type').value || "צהריים";
      
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
      
      // Dynamic cross-tab sync
      if (typeof window.renderMealsAnalytics === 'function') window.renderMealsAnalytics();
      
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
