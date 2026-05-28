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

// Safe helper to update text contents safely
const setElText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};

// Initialize meals on user login
export function initMeals() {
  if (!state.currentUser) return;
  
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
  
  // Render Meals tab UI
  renderMealsDashboard();
  
  // Bind events for meals tab
  bindMealsEvents();
}

// Clear meals session on logout
export function clearMealsSession() {
  state.loggedMeals = [];
  loggedMealsList = document.getElementById('logged-meals-list');
  if (loggedMealsList) {
    loggedMealsList.innerHTML = `
      <div class="meals-empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; border: 1px dashed rgba(255, 255, 255, 0.08); border-radius: 18px; text-align: center; gap: 8px;">
        <span style="font-size: 2.2rem;">🥗</span>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted); direction: rtl;">לא נרשמו ארוחות היום. התחל להוסיף ארוחות כדי לעקוב אחר התזונה שלך!</p>
      </div>
    `;
  }
  // Reset summary counters
  updateSummaryUI(0, 0, 0, 0);
}

// Save meals to LocalStorage
export function saveMealsState() {
  if (state.currentUser) {
    SafeStorage.setItem(`aura-logged-meals_${state.currentUser.uid}`, JSON.stringify(state.loggedMeals));
  }
}

// Update summary dashboard counters and progress bars
export function updateSummaryUI(calories, protein, carbs, fat) {
  // Update texts
  setElText('calories-current', calories.toLocaleString());
  setElText('protein-current', protein.toLocaleString());
  setElText('carbs-current', carbs.toLocaleString());
  setElText('fat-current', fat.toLocaleString());
  
  // Calculate percentage widths (capped at 100)
  const caloriesPercent = Math.min(100, Math.round((calories / MACRO_GOALS.calories) * 100));
  const proteinPercent = Math.min(100, Math.round((protein / MACRO_GOALS.protein) * 100));
  const carbsPercent = Math.min(100, Math.round((carbs / MACRO_GOALS.carbs) * 100));
  const fatPercent = Math.min(100, Math.round((fat / MACRO_GOALS.fat) * 100));
  
  // Update progress bars
  const calBar = document.getElementById('calories-progress-bar');
  if (calBar) calBar.style.width = `${caloriesPercent}%`;
  
  const protBar = document.getElementById('protein-progress-bar');
  if (protBar) protBar.style.width = `${proteinPercent}%`;
  
  const carbsBar = document.getElementById('carbs-progress-bar');
  if (carbsBar) carbsBar.style.width = `${carbsPercent}%`;
  
  const fatBar = document.getElementById('fat-progress-bar');
  if (fatBar) fatBar.style.width = `${fatPercent}%`;
}

// Get meals logged today (local time YYYY-MM-DD)
export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Render the meals dashboard fully
export function renderMealsDashboard() {
  loggedMealsList = document.getElementById('logged-meals-list');
  if (!loggedMealsList) return;
  
  // Filter meals for today
  const todayStr = getTodayDateString();
  const todayMeals = state.loggedMeals.filter(m => m.date === todayStr);
  
  // Calculate totals
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  
  todayMeals.forEach(m => {
    totalCalories += Number(m.calories || 0);
    totalProtein += Number(m.protein || 0);
    totalCarbs += Number(m.carbs || 0);
    totalFat += Number(m.fat || 0);
  });
  
  // Update Summary UI
  updateSummaryUI(totalCalories, totalProtein, totalCarbs, totalFat);
  
  // Render meals list
  if (todayMeals.length === 0) {
    loggedMealsList.innerHTML = `
      <div class="meals-empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; border: 1px dashed rgba(255, 255, 255, 0.08); border-radius: 18px; text-align: center; gap: 8px;">
        <span style="font-size: 2.2rem;">🥗</span>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted); direction: rtl;">לא נרשמו ארוחות היום. התחל להוסיף ארוחות כדי לעקוב אחר התזונה שלך!</p>
      </div>
    `;
  } else {
    loggedMealsList.innerHTML = '';
    todayMeals.forEach((meal) => {
      const row = document.createElement('div');
      row.className = 'logged-meal-row';
      
      // Determine badge class
      let badgeClass = 'type-badge-breakfast';
      if (meal.type === 'צהריים') badgeClass = 'type-badge-lunch';
      if (meal.type === 'ערב') badgeClass = 'type-badge-dinner';
      if (meal.type === 'חטיף') badgeClass = 'type-badge-snack';
      
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.25rem;">${meal.type === 'בוקר' ? '🍳' : meal.type === 'צהריים' ? '🍗' : meal.type === 'ערב' ? '🥩' : '🍌'}</span>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 0.95rem; font-weight: 700; color: #ffffff;">${meal.name}</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="logged-meal-type-badge ${badgeClass}">${meal.type}</span>
              <span style="font-size: 0.78rem; color: var(--text-muted);">${meal.protein}g חלבון • ${meal.calories} קק"ל</span>
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

// Log a new meal
export function logMeal(name, type, calories, protein, carbs = 0, fat = 0) {
  const newMeal = {
    id: 'meal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    name: name.trim(),
    type: type,
    calories: Number(calories || 0),
    protein: Number(protein || 0),
    carbs: Number(carbs || 0),
    fat: Number(fat || 0),
    date: getTodayDateString(),
    timestamp: Date.now()
  };
  
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
  
  // Open modal
  if (triggerBtn && addModal) {
    triggerBtn.addEventListener('click', () => {
      document.getElementById('new-meal-name').value = '';
      document.getElementById('new-meal-calories').value = '';
      document.getElementById('new-meal-protein').value = '';
      document.getElementById('new-meal-carbs').value = '';
      document.getElementById('new-meal-fat').value = '';
      
      addModal.classList.remove('hide');
    });
  }
  
  // Close modal
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
      const calories = document.getElementById('new-meal-calories').value;
      const protein = document.getElementById('new-meal-protein').value;
      const carbs = document.getElementById('new-meal-carbs').value || 0;
      const fat = document.getElementById('new-meal-fat').value || 0;
      
      logMeal(name, type, calories, protein, carbs, fat);
      
      addModal.classList.add('hide');
    });
  }
  
  // Handle recommended meals quick logs
  const quickLogButtons = document.querySelectorAll('.quick-log-meal-btn');
  quickLogButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const name = btn.getAttribute('data-name');
      const calories = btn.getAttribute('data-calories');
      const protein = btn.getAttribute('data-protein');
      const carbs = btn.getAttribute('data-carbs') || 0;
      const fat = btn.getAttribute('data-fat') || 0;
      
      let type = 'צהריים';
      if (name.includes('דייסת')) type = 'בוקר';
      if (name.includes('שייק')) type = 'חטיף';
      if (name.includes('סלט סלמון')) type = 'ערב';
      
      logMeal(name, type, calories, protein, carbs, fat);
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
