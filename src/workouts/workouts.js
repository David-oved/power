import { state } from "../state.js";
import { SafeStorage } from "../utils/storage.js";
import { triggerLocalNotification, showPremiumToast, requestNotificationPermissionSafely } from "../utils/helpers.js";

export const GYM_EXERCISES = [
  { name: 'לחיצת חזה עם מוט', category: 'חזה' },
  { name: 'לחיצת חזה בשיפוע חיובי', category: 'חזה' },
  { name: 'פרפר בכבלים', category: 'חזה' },
  { name: 'לחיצת חזה במכונה', category: 'חזה' },
  { name: 'דדליפט', category: 'גב' },
  { name: 'משיכת פולי עליון', category: 'גב' },
  { name: 'חתירה בכבלים', category: 'גב' },
  { name: 'מתח', category: 'גב' },
  { name: 'חתירה עם משקולת יד', category: 'גב' },
  { name: 'לחיצת כתפיים עם משקולות', category: 'כתפיים' },
  { name: 'הרחקת זרועות לצדדים', category: 'כתפיים' },
  { name: 'הרמת ידיים לפנים', category: 'כתפיים' },
  { name: 'פרפר אחורי במכונה', category: 'כתפיים' },
  { name: 'פייס פולס', category: 'כתפיים' },
  { name: 'משיכת כתפיים (Shrugs)', category: 'כתפיים' },
  { name: 'סקוואט עם מוט', category: 'רגליים' },
  { name: 'לחיצת רגליים במכונה', category: 'רגליים' },
  { name: 'פשיטת ברכיים', category: 'רגליים' },
  { name: 'כפיפת ברכיים', category: 'רגליים' },
  { name: 'דדליפט רומני', category: 'רגליים' },
  { name: 'הרמת עקבים (Calves)', category: 'רגליים' },
  { name: 'כפיפת מרפקים עם מוט', category: 'ידיים' },
  { name: 'כפיפת מרפקים פטישים', category: 'ידיים' },
  { name: 'כפיפת מרפקים בכור כומר', category: 'ידיים' },
  { name: 'פשיטת מרפקים בפולי', category: 'ידיים' },
  { name: 'פשיטת מרפקים מעל הראש', category: 'ידיים' },
  { name: 'כפיפות בטן', category: 'בטן' },
  { name: 'פלאנק', category: 'בטן' },
  { name: 'הרמת רגליים בתלייה', category: 'בטן' },
  { name: 'ריצה על הליכון', category: 'אירובי' }
];

export const PARK_EXERCISES = [
  { name: 'מתח רגיל', category: 'מתח' },
  { name: 'מתח באחיזה הפוכה (Chin-ups)', category: 'מתח' },
  { name: 'מאסל-אפ (Muscle-ups)', category: 'מתח' },
  { name: 'חתירה אוסטרלית', category: 'מתח' },
  { name: 'מקבילים (Dips)', category: 'דחיפה' },
  { name: 'שכיבות שמיכה', category: 'דחיפה' },
  { name: 'שכיבות שמיכה יהלום', category: 'דחיפה' },
  { name: 'שכיבות שמיכה בשיפוע שלילי', category: 'דחיפה' },
  { name: 'שכיבות שמיכה פייק', category: 'דחיפה' },
  { name: 'מקבילים אחוריים על ספסל', category: 'דחיפה' },
  { name: 'פיסטול סקוואט', category: 'רגליים' },
  { name: 'סקוואט משקל גוף', category: 'רגליים' },
  { name: 'לאנג׳ים', category: 'רגליים' },
  { name: 'עליות מדרגה', category: 'רגליים' },
  { name: 'הרמת עקבים', category: 'רגליים' },
  { name: 'פלאנק', category: 'ליבה ואירובי' },
  { name: 'הרמת רגליים על ספסל', category: 'ליבה ואירובי' },
  { name: 'ברפיז (Burpees)', category: 'ליבה ואירובי' },
  { name: 'אל-סיט (L-Sit)', category: 'ליבה ואירובי' },
  { name: 'מטפס הרים', category: 'ליבה ואירובי' }
];

export const HEBREW_QUOTES = [
  "אין קיצורי דרך למקומות ששווה להגיע אליהם! 🔥",
  "כל חזרה מקרבת אותך לגרסה הטובה ביותר של עצמך. 💪",
  "הכאב של היום הוא הכוח של מחר! ⚡",
  "אל תפסיק כשזה קשה, תפסיק כשסיימת. 🏆",
  "המשמעת העצמית שלך היא המפתח לברזל! 🏋️‍♂️",
  "אתה נלחם נגד עצמך של אתמול, לא נגד אף אחד אחר. 🌟",
  "הפוך את התירוצים שלך לתוצאות בקצה הברזל! 🔥",
  "המנוחה מכינה אותך לסט המושלם הבא. תתרכז! 🎯"
];

// Helper to save active workout state
export function saveActiveWorkoutState() {
  if (state.currentUser && state.activeWorkout) {
    SafeStorage.setItem(`aura-active-workout_${state.currentUser.uid}`, JSON.stringify(state.activeWorkout));
  }
}

// Unified Exercises LocalStorage Helpers
export function getAllExercises() {
  if (!state.currentUser) {
    return [...GYM_EXERCISES, ...PARK_EXERCISES];
  }
  const key = `aura-all-exercises_${state.currentUser.uid}`;
  let list = SafeStorage.getItem(key);
  if (!list) {
    const combined = [];
    const names = new Set();
    [...GYM_EXERCISES, ...PARK_EXERCISES].forEach(item => {
      if (!names.has(item.name)) {
        names.add(item.name);
        combined.push(item);
      }
    });
    SafeStorage.setItem(key, JSON.stringify(combined));
    return combined;
  }
  try {
    return JSON.parse(list);
  } catch (e) {
    console.error("Failed to parse aura-all-exercises from storage:", e);
    return [...GYM_EXERCISES, ...PARK_EXERCISES];
  }
}

export function saveAllExercises(list) {
  if (!state.currentUser) return;
  const key = `aura-all-exercises_${state.currentUser.uid}`;
  SafeStorage.setItem(key, JSON.stringify(list));
}

// Initialize workouts state on user auth
export function initWorkouts() {
  if (!state.currentUser) return;

  const key = `aura-all-exercises_${state.currentUser.uid}`;
  if (!SafeStorage.getItem(key)) {
    const combined = [];
    const names = new Set();
    [...GYM_EXERCISES, ...PARK_EXERCISES].forEach(item => {
      if (!names.has(item.name)) {
        names.add(item.name);
        combined.push(item);
      }
    });
    SafeStorage.setItem(key, JSON.stringify(combined));
  }
  
  // Load History
  const historyData = SafeStorage.getItem(`aura-workout-history_${state.currentUser.uid}`);
  if (historyData) {
    try {
      state.workoutHistory = JSON.parse(historyData);
    } catch (e) {
      console.error("Failed to parse workout history, resetting:", e);
      state.workoutHistory = [];
    }
  } else {
    state.workoutHistory = [];
  }
  
  // Load Custom Locations
  const locsData = SafeStorage.getItem(`aura-custom-locations_${state.currentUser.uid}`);
  if (locsData) {
    try {
      state.customLocations = JSON.parse(locsData);
    } catch (e) {
      console.error("Failed to parse custom locations:", e);
      state.customLocations = [];
    }
  } else {
    state.customLocations = [];
  }
  
  // Load Custom Exercises
  const exsData = SafeStorage.getItem(`aura-custom-exercises_${state.currentUser.uid}`);
  if (exsData) {
    try {
      state.customExercises = JSON.parse(exsData);
    } catch (e) {
      console.error("Failed to parse custom exercises:", e);
      state.customExercises = [];
    }
  } else {
    state.customExercises = [];
  }
  
  // Load Favorite Exercises
  const favsData = SafeStorage.getItem(`aura-favorite-exercises_${state.currentUser.uid}`);
  if (favsData) {
    try {
      state.favoriteExercises = JSON.parse(favsData);
    } catch (e) {
      console.error("Failed to parse favorite exercises:", e);
      state.favoriteExercises = [];
    }
  } else {
    state.favoriteExercises = [];
  }
  
  // Render History Logs
  if (window.renderWorkoutHistory) window.renderWorkoutHistory();
  
  // Render location grid dynamically
  renderLocationSelectorGrid();
  populateLocationSelects();
  
  // Restore Active Workout if any (anti-data loss on reload)
  const activeData = SafeStorage.getItem(`aura-active-workout_${state.currentUser.uid}`);
  if (activeData) {
    try {
      state.activeWorkout = JSON.parse(activeData);
      if (state.activeWorkout && state.activeWorkout.startTime) {
        if (!state.activeWorkout.exercises || !Array.isArray(state.activeWorkout.exercises)) {
          state.activeWorkout.exercises = [];
        }
        console.log("Restored active workout from storage, resuming timer...");
        resumeWorkoutTimer();
      }
    } catch (e) {
      console.error("Failed to parse restored active workout:", e);
      state.activeWorkout = null;
    }
  }
}

// Clear workout session on logout
export function clearWorkoutSession() {
  if (state.activeTimerInterval) {
    clearInterval(state.activeTimerInterval);
    state.activeTimerInterval = null;
  }
  
  stopRestTimer();

  state.activeWorkout = null;
  state.workoutHistory = [];
  state.editingWorkout = null;
  
  const activeView = document.getElementById('workout-active-view');
  const idleView = document.getElementById('workout-idle-view');
  const locationGrid = document.getElementById('location-selector-grid');
  const startBtn = document.getElementById('start-workout-btn');
  
  if (activeView) activeView.classList.add('hide');
  if (idleView) {
    idleView.classList.add('active');
    idleView.classList.remove('hide');
  }
  if (locationGrid) locationGrid.classList.add('hide');
  if (startBtn) startBtn.classList.remove('hide');
  
  const historyList = document.getElementById('workout-history-list');
  if (historyList) historyList.innerHTML = '';
}

// Dynamic Location Selector Grid Render
export function renderLocationSelectorGrid() {
  const container = document.getElementById('location-tiles-container');
  if (!container) return;
  container.innerHTML = '';
  
  // Default Gym Tile
  const gymTile = document.createElement('button');
  gymTile.className = 'location-tile';
  gymTile.innerHTML = `
    <span class="tile-icon">🏋️‍♂️</span>
    <span class="tile-label">חדר כושר</span>
  `;
  gymTile.addEventListener('click', () => startNewWorkout('gym'));
  container.appendChild(gymTile);

  // Default Park Tile
  const parkTile = document.createElement('button');
  parkTile.className = 'location-tile';
  parkTile.innerHTML = `
    <span class="tile-icon">🌳</span>
    <span class="tile-label">פארק</span>
  `;
  parkTile.addEventListener('click', () => startNewWorkout('park'));
  container.appendChild(parkTile);

  // Render Custom Locations
  state.customLocations.forEach(loc => {
    const tile = document.createElement('button');
    tile.className = 'location-tile';
    tile.innerHTML = `
      <span class="tile-icon">${loc.emoji || '💪'}</span>
      <span class="tile-label">${loc.name}</span>
    `;
    tile.addEventListener('click', () => startNewWorkout(loc.id, loc.name, loc.emoji));
    container.appendChild(tile);
  });

  // Add Custom Location Tile
  const addTile = document.createElement('button');
  addTile.className = 'location-tile add-custom-location-tile';
  addTile.innerHTML = `
    <span class="tile-icon">➕</span>
    <span class="tile-label">סוג אימון חדש</span>
  `;
  addTile.addEventListener('click', () => {
    const modal = document.getElementById('custom-location-modal');
    if (modal) modal.classList.remove('hide');
  });
  container.appendChild(addTile);
}

// Dynamic Custom Locations populator for filter & schedule selects
export function populateLocationSelects() {
  const filterSelect = document.getElementById('filter-location-select');
  const scheduleSelect = document.getElementById('schedule-location-select');
  if (filterSelect) {
    filterSelect.innerHTML = `
      <option value="all">כל המיקומים 📍</option>
      <option value="gym">🏋️‍♂️ חדר כושר</option>
      <option value="park">🌳 פארק</option>
    `;
    state.customLocations.forEach(loc => {
      filterSelect.innerHTML += `<option value="${loc.id}">${loc.emoji || '💪'} ${loc.name}</option>`;
    });
  }
  if (scheduleSelect) {
    scheduleSelect.innerHTML = `
      <option value="gym">🏋️‍♂️ חדר כושר</option>
      <option value="park">🌳 פארק</option>
    `;
    state.customLocations.forEach(loc => {
      scheduleSelect.innerHTML += `<option value="${loc.id}">${loc.emoji || '💪'} ${loc.name}</option>`;
    });
    scheduleSelect.innerHTML += `<option value="custom">✍️ סוג אימון מותאם אישית...</option>`;
  }
}

export function startNewWorkout(location, name = '', emoji = '') {
  if (!state.currentUser) return;
  
  // Proactively request notification permissions for PWA background tracking support
  requestNotificationPermissionSafely();
  
  let dispName = 'חדר כושר';
  let dispEmoji = '🏋️‍♂️';
  
  if (location === 'gym') {
    dispName = 'חדר כושר';
    dispEmoji = '🏋️‍♂️';
  } else if (location === 'park') {
    dispName = 'פארק';
    dispEmoji = '🌳';
  } else {
    dispName = name || 'אימון מותאם';
    dispEmoji = emoji || '💪';
  }
  
  state.activeWorkout = {
    startTime: Date.now(),
    location: location,
    locationName: dispName,
    locationEmoji: dispEmoji,
    exercises: []
  };
  
  SafeStorage.setItem(`aura-active-workout_${state.currentUser.uid}`, JSON.stringify(state.activeWorkout));
  
  const idleView = document.getElementById('workout-idle-view');
  const activeView = document.getElementById('workout-active-view');
  
  if (idleView) {
    idleView.classList.remove('active');
    idleView.classList.add('hide');
  }
  if (activeView) activeView.classList.remove('hide');
  
  const locationGrid = document.getElementById('location-selector-grid');
  const startWorkoutBtn = document.getElementById('start-workout-btn');
  if (locationGrid) locationGrid.classList.add('hide');
  if (startWorkoutBtn) startWorkoutBtn.classList.remove('hide');
  
  const badgeIcon = document.getElementById('active-location-icon');
  const badgeText = document.getElementById('active-location-text');
  if (badgeIcon) badgeIcon.textContent = dispEmoji;
  if (badgeText) badgeText.textContent = dispName;
  
  const timerDisplay = document.getElementById('active-timer');
  if (timerDisplay) timerDisplay.textContent = '00:00:00';
  
  if (state.activeTimerInterval) clearInterval(state.activeTimerInterval);
  state.activeTimerInterval = setInterval(updateActiveTimer, 1000);
  
  renderExercises();
  
  if (window.collapseNav) window.collapseNav();
}

export function resumeWorkoutTimer() {
  const activeView = document.getElementById('workout-active-view');
  const idleView = document.getElementById('workout-idle-view');
  
  if (idleView) {
    idleView.classList.remove('active');
    idleView.classList.add('hide');
  }
  if (activeView) activeView.classList.remove('hide');
  
  const badgeIcon = document.getElementById('active-location-icon');
  const badgeText = document.getElementById('active-location-text');
  const dispEmoji = state.activeWorkout.locationEmoji || (state.activeWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳');
  const dispName = state.activeWorkout.locationName || (state.activeWorkout.location === 'gym' ? 'חדר כושר' : 'פארק');
  
  if (badgeIcon) badgeIcon.textContent = dispEmoji;
  if (badgeText) badgeText.textContent = dispName;
  
  if (state.activeTimerInterval) clearInterval(state.activeTimerInterval);
  state.activeTimerInterval = setInterval(updateActiveTimer, 1000);
  updateActiveTimer();
  
  renderExercises();
}

export function updateActiveTimer() {
  if (!state.activeWorkout || !state.activeWorkout.startTime) return;
  
  const diffMs = Date.now() - state.activeWorkout.startTime;
  const totalSecs = Math.floor(diffMs / 1000);
  
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  
  const pad = (num) => String(num).padStart(2, '0');
  
  const timerDisplay = document.getElementById('active-timer');
  if (timerDisplay) {
    timerDisplay.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
}

export function renderExercisePickerFilters() {
  const container = document.getElementById('exercise-category-filters');
  if (!container || !state.activeWorkout) return;
  container.innerHTML = '';
  
  let categories = ['הכל'];
  if (state.favoriteExercises.length > 0) {
    categories.push('⭐ מועדפים');
  }
  categories.push('חזה', 'גב', 'כתפיים', 'רגליים', 'ידיים', 'בטן', 'אירובי', 'ליבה');
  if (state.customExercises.length > 0) {
    categories.push('תרגילים שלי');
  }
  categories.push('אחר');
  
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `category-filter-btn ${state.currentActiveCategoryFilter === cat ? 'active' : ''}`;
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      state.currentActiveCategoryFilter = cat;
      renderExercisePickerFilters();
      renderExercisePickerList();
    });
    container.appendChild(btn);
  });
}

export function renderExercisePickerList() {
  const container = document.getElementById('exercise-picker-list');
  if (!container || !state.activeWorkout) return;
  container.innerHTML = '';
  
  const searchInput = document.getElementById('exercise-search-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  
  let fullList = getAllExercises();
  
  const seen = new Set();
  fullList = fullList.filter(ex => {
    const k = ex.name.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  
  if (state.currentActiveCategoryFilter === '⭐ מועדפים') {
    fullList = fullList.filter(ex => state.favoriteExercises.includes(ex.name));
  } else if (state.currentActiveCategoryFilter === 'תרגילים שלי') {
    fullList = fullList.filter(ex => state.customExercises.some(c => c.name.trim().toLowerCase() === ex.name.trim().toLowerCase()));
  } else if (state.currentActiveCategoryFilter !== 'הכל') {
    fullList = fullList.filter(ex => ex.category === state.currentActiveCategoryFilter);
  }
  
  if (query) {
    fullList = fullList.filter(ex => ex.name.toLowerCase().includes(query));
  }
  
  if (fullList.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'exercise-picker-empty';
    noResults.textContent = 'לא נמצאו תרגילים מתאימים';
    container.appendChild(noResults);
    return;
  }
  
  const categoryColors = {
    'חזה':      { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
    'גב':       { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
    'כתפיים':    { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc' },
    'רגליים':    { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
    'ידיים':    { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c' },
    'בטן':      { bg: 'rgba(234,179,8,0.15)',   color: '#facc15' },
    'אירובי':    { bg: 'rgba(20,184,166,0.15)',  color: '#2dd4bf' },
    'ליבה':      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
    'מתח':      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
    'דחיפה':    { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
    'ליבה ואירובי': { bg: 'rgba(20,184,166,0.15)', color: '#2dd4bf' },
    'מותאם אישית': { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8' },
  };
  
  fullList.forEach(ex => {
    const itemWrapper = document.createElement('div');
    itemWrapper.className = 'exercise-list-item-wrapper';
    itemWrapper.style.cssText = 'position: relative; display: flex; align-items: center; gap: 8px; direction: rtl;';

    const item = document.createElement('button');
    item.className = 'exercise-list-item';
    item.style.flex = '1';
    
    const catStyle = categoryColors[ex.category] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' };
    const emoji = ex.emoji ? `<span class="ex-list-emoji">${ex.emoji}</span>` : '';
    const isFav = state.favoriteExercises.includes(ex.name);
    
    item.innerHTML = `
      <div class="ex-list-info">
        ${emoji}
        <span class="ex-list-name">${ex.name}</span>
      </div>
      <div class="ex-list-right">
        <span class="ex-category-badge" style="background: ${catStyle.bg}; color: ${catStyle.color};">${ex.category || 'תרגיל'}</span>
        <span class="ex-list-arrow">←</span>
      </div>
    `;
    item.addEventListener('click', () => {
      state.selectedExerciseForAdding = ex.name;
      
      const pickerModal = document.getElementById('exercise-picker-modal');
      if (pickerModal) pickerModal.classList.add('hide');
      
      const metricModal = document.getElementById('metric-selector-modal');
      if (metricModal) metricModal.classList.remove('hide');

      // Reset targetSets selection in metric selector modal to 3
      const display = document.getElementById('metric-sets-display');
      if (display) display.textContent = '3';
      const chipsContainer = document.getElementById('sets-chips-container');
      if (chipsContainer) {
        chipsContainer.querySelectorAll('.sets-option-chip').forEach(chip => {
          const val = parseInt(chip.getAttribute('data-sets'), 10);
          if (val === 3) {
            chip.classList.add('active');
            chip.style.border = '1px solid var(--electric-blue)';
            chip.style.background = 'var(--electric-blue-light)';
          } else {
            chip.classList.remove('active');
            chip.style.border = '1px solid rgba(255,255,255,0.1)';
            chip.style.background = 'rgba(255,255,255,0.05)';
          }
        });
      }

      if (window.checkAndShowPreviousPerformance) {
        window.checkAndShowPreviousPerformance(ex.name);
      }
    });

    const starBtn = document.createElement('button');
    starBtn.className = `ex-fav-star-btn ${isFav ? 'active' : ''}`;
    starBtn.title = isFav ? 'הסר ממועדפים' : 'הוסף למועדפים';
    starBtn.innerHTML = isFav ? '⭐' : '☆';
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = state.favoriteExercises.indexOf(ex.name);
      if (idx > -1) {
        state.favoriteExercises.splice(idx, 1);
        starBtn.innerHTML = '☆';
        starBtn.classList.remove('active');
        starBtn.title = 'הוסף למועדפים';
      } else {
        state.favoriteExercises.push(ex.name);
        starBtn.innerHTML = '⭐';
        starBtn.classList.add('active');
        starBtn.title = 'הסר ממועדפים';
      }
      if (state.currentUser) {
        SafeStorage.setItem(`aura-favorite-exercises_${state.currentUser.uid}`, JSON.stringify(state.favoriteExercises));
      }
      renderExercisePickerFilters();
      if (state.currentActiveCategoryFilter === '⭐ מועדפים') {
        renderExercisePickerList();
      }
    });

    itemWrapper.appendChild(starBtn);
    itemWrapper.appendChild(item);
    container.appendChild(itemWrapper);
  });
}

export function renderExercises() {
  const container = document.getElementById('exercises-container');
  if (!container || !state.activeWorkout) return;
  
  container.innerHTML = '';
  
  const hasUncompleted = state.activeWorkout.exercises.some(ex => !ex.completed && ex.sets.some(s => s.completed));
  const addExerciseBtn = document.getElementById('add-exercise-btn');
  
  if (addExerciseBtn) {
    if (hasUncompleted) {
      addExerciseBtn.disabled = true;
      addExerciseBtn.style.opacity = '0.4';
      addExerciseBtn.style.cursor = 'not-allowed';
    } else {
      addExerciseBtn.disabled = false;
      addExerciseBtn.style.opacity = '1';
      addExerciseBtn.style.cursor = 'pointer';
    }
  }
  
  state.activeWorkout.exercises.forEach((ex, exIdx) => {
    const card = document.createElement('div');
    card.className = `exercise-card ${ex.completed ? 'saved' : ''}`;
    
    const metricType = ex.metricType || 'both';
    
    const header = document.createElement('div');
    header.className = 'exercise-card-header';
    
    const titleContainer = document.createElement('div');
    titleContainer.className = 'exercise-title-container';
    
    if (!ex.completed) {
      const removeExBtn = document.createElement('button');
      removeExBtn.className = 'remove-exercise-btn';
      removeExBtn.innerHTML = '🗑️';
      removeExBtn.title = 'מחק תרגיל';
      removeExBtn.addEventListener('click', () => {
        state.activeWorkout.exercises.splice(exIdx, 1);
        saveActiveWorkoutState();
        renderExercises();
      });
      titleContainer.appendChild(removeExBtn);
    }
    
    const nameLabel = document.createElement('span');
    nameLabel.className = 'exercise-name-label';
    nameLabel.style.fontSize = '1.15rem';
    nameLabel.style.fontWeight = '800';
    nameLabel.style.color = '#ffffff';
    nameLabel.textContent = ex.name;
    titleContainer.appendChild(nameLabel);
    
    let metricLabel = '⚖️ משקל וחזרות';
    if (metricType === 'reps') metricLabel = '🔢 חזרות בלבד';
    if (metricType === 'weight') metricLabel = '🏋️‍♂️ משקל בלבד';
    
    const metricBadge = document.createElement('span');
    metricBadge.className = 'badge-mini';
    metricBadge.style.marginRight = '8px';
    metricBadge.style.fontSize = '0.75rem';
    metricBadge.style.background = 'rgba(255,255,255,0.06)';
    metricBadge.style.color = 'var(--text-muted)';
    metricBadge.style.padding = '3px 8px';
    metricBadge.style.borderRadius = '20px';
    metricBadge.textContent = metricLabel;
    titleContainer.appendChild(metricBadge);
    
    header.appendChild(titleContainer);
    
    const actionBtn = document.createElement('button');
    if (ex.completed) {
      actionBtn.className = 'btn edit-exercise-btn';
      actionBtn.textContent = 'ערוך תרגיל ✏️';
      actionBtn.addEventListener('click', () => {
        ex.completed = false;
        saveActiveWorkoutState();
        renderExercises();
      });
    } else {
      actionBtn.className = 'btn save-exercise-btn';
      actionBtn.textContent = 'סיום תרגיל ✓';
      actionBtn.addEventListener('click', () => {
        const hasCompletedSets = ex.sets.some(s => s.completed);
        if (!hasCompletedSets) {
          alert('אנא השלם לפחות סט אחד.');
          return;
        }
        ex.completed = true;
        ex.sets = ex.sets.filter(s => s.completed);
        saveActiveWorkoutState();
        renderExercises();
      });
    header.appendChild(actionBtn);
    card.appendChild(header);
    
    // Inline targetSetsCount stepper for active exercise card
    if (!ex.completed) {
      const targetSets = ex.targetSetsCount || 3;
      
      const stepperWrapper = document.createElement('div');
      stepperWrapper.className = 'inline-sets-stepper-wrapper';
      stepperWrapper.style.cssText = 'display: flex; align-items: center; gap: 8px; margin: 8px 12px 12px 12px; font-size: 0.9rem; color: var(--text-muted); font-weight: 600; direction: rtl;';
      
      const stepperLabel = document.createElement('span');
      stepperLabel.textContent = 'סטים מתוכננים:';
      stepperWrapper.appendChild(stepperLabel);
      
      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: #fff; cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 1.1rem; font-weight: bold; line-height: 1; outline: none; transition: all 0.2s;';
      minusBtn.textContent = '-';
      minusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ex.targetSetsCount = Math.max(1, (ex.targetSetsCount || 3) - 1);
        saveActiveWorkoutState();
        renderExercises();
      });
      stepperWrapper.appendChild(minusBtn);
      
      const countVal = document.createElement('span');
      countVal.style.cssText = 'color: #ffffff; font-weight: 800; min-width: 16px; text-align: center; font-size: 1.05rem;';
      countVal.textContent = targetSets;
      stepperWrapper.appendChild(countVal);
      
      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: #fff; cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 1.1rem; font-weight: bold; line-height: 1; outline: none; transition: all 0.2s;';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ex.targetSetsCount = Math.min(12, (ex.targetSetsCount || 3) + 1);
        saveActiveWorkoutState();
        renderExercises();
      });
      stepperWrapper.appendChild(plusBtn);
      
      // Let's also display progress label
      const progressLabel = document.createElement('span');
      progressLabel.style.marginRight = '8px';
      progressLabel.style.color = 'var(--electric-blue-light)';
      progressLabel.style.fontSize = '0.85rem';
      const completedCount = ex.sets ? ex.sets.filter(s => s.completed).length : 0;
      progressLabel.textContent = `(${completedCount}/${targetSets} הושלמו)`;
      stepperWrapper.appendChild(progressLabel);
      
      card.appendChild(stepperWrapper);
    }
    
    const setsArea = document.createElement('div');
    setsArea.className = 'sets-area';
    
    const completedSets = ex.sets.filter(s => s.completed);
    if (completedSets.length > 0) {
      const chipsContainer = document.createElement('div');
      chipsContainer.className = 'completed-sets-chips-container';
      chipsContainer.style.display = 'flex';
      chipsContainer.style.flexWrap = 'wrap';
      chipsContainer.style.gap = '8px';
      chipsContainer.style.marginTop = '10px';
      chipsContainer.style.direction = 'rtl';
      
      completedSets.forEach((set, idx) => {
        const chip = document.createElement('div');
        chip.className = 'completed-set-chip';
        chip.style.display = 'inline-flex';
        chip.style.alignItems = 'center';
        chip.style.background = 'rgba(255,255,255,0.06)';
        chip.style.border = '1px solid rgba(255,255,255,0.08)';
        chip.style.padding = '6px 12px';
        chip.style.borderRadius = '12px';
        chip.style.fontSize = '0.88rem';
        chip.style.color = '#ffffff';
        chip.style.gap = '6px';
        
        let valueStr = '';
        if (metricType === 'both') {
          valueStr = `${set.weight || 0} ק״ג × ${set.reps || 0}`;
        } else if (metricType === 'weight') {
          valueStr = `${set.weight || 0} ק״ג`;
        } else {
          valueStr = `${set.reps || 0} חזרות`;
        }
        
        const realIdx = ex.sets.indexOf(set);
        chip.innerHTML = `
          <span style="font-weight: 700; color: var(--electric-blue);">סט ${realIdx + 1}:</span>
          <span>${valueStr}</span>
        `;
        
        if (!ex.completed) {
          chip.style.cursor = 'pointer';
          chip.title = 'לחץ לביטול הסט';
          chip.addEventListener('click', () => {
            if (confirm(`האם ברצונך לבטל את סט ${realIdx + 1}?`)) {
              set.completed = false;
              saveActiveWorkoutState();
              renderExercises();
            }
          });
        }
        chipsContainer.appendChild(chip);
      });
      setsArea.appendChild(chipsContainer);
    }
    
    if (!ex.completed) {
      const enterSetBtn = document.createElement('button');
      enterSetBtn.className = 'enter-set-data-btn';
      enterSetBtn.style.width = '100%';
      enterSetBtn.style.padding = '12px';
      enterSetBtn.style.borderRadius = '14px';
      enterSetBtn.style.background = 'var(--electric-blue, #4f46e5)';
      enterSetBtn.style.color = '#ffffff';
      enterSetBtn.style.border = 'none';
      enterSetBtn.style.fontWeight = '700';
      enterSetBtn.style.fontSize = '0.95rem';
      enterSetBtn.style.cursor = 'pointer';
      enterSetBtn.style.marginTop = '12px';
      enterSetBtn.style.display = 'block';
      
      const nextIncompleteIdx = ex.sets.findIndex(s => !s.completed);
      const activeSetIdx = nextIncompleteIdx !== -1 ? nextIncompleteIdx : ex.sets.length;
      
      enterSetBtn.textContent = `➕ רישום סט ${activeSetIdx + 1}`;
      enterSetBtn.addEventListener('click', () => {
        openSetLoggingModal(ex);
      });
      setsArea.appendChild(enterSetBtn);
    }
    
    card.appendChild(setsArea);
    container.appendChild(card);
  });
}

// REST TIMER ENGINE
export function startRestTimer(seconds = 90) {
  stopRestTimer();

  // Proactively request permissions when the user begins a rest period
  requestNotificationPermissionSafely();

  state.restTimerSecondsLeft = seconds;
  state.restTimerTotalDuration = seconds;
  
  const bubble = document.getElementById('rest-timer-bubble');
  if (bubble) {
    bubble.classList.remove('hide');
    bubble.classList.remove('expired');
  }

  const quoteEl = document.getElementById('rest-timer-quote');
  if (quoteEl) {
    const randIdx = Math.floor(Math.random() * HEBREW_QUOTES.length);
    quoteEl.textContent = `"${HEBREW_QUOTES[randIdx]}"`;
  }

  updateRestTimerUI();

  // Save the target end timestamp for PWA background freeze recovery
  const endTime = Date.now() + seconds * 1000;
  SafeStorage.setItem('aura-rest-timer-end-time', String(endTime));

  // Schedule background notification via Service Worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      action: 'scheduleRestNotification',
      delayMs: seconds * 1000
    });
  }

  state.restTimerInterval = setInterval(() => {
    state.restTimerSecondsLeft--;
    if (state.restTimerSecondsLeft <= 0) {
      state.restTimerSecondsLeft = 0;
      updateRestTimerUI();
      handleRestTimerExpiration();
    } else {
      updateRestTimerUI();
    }
  }, 1000);
}

export function stopRestTimer() {
  if (state.restTimerInterval) {
    clearInterval(state.restTimerInterval);
    state.restTimerInterval = null;
  }
  SafeStorage.removeItem('aura-rest-timer-end-time');
  
  // Cancel background notification via Service Worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ action: 'cancelRestNotification' });
  }

  const bubble = document.getElementById('rest-timer-bubble');
  if (bubble) {
    bubble.style.transform = ''; // Reset transform so PWA transition works cleanly
    bubble.classList.add('hide');
    bubble.classList.remove('expired');
  }
}

export function updateRestTimerUI() {
  const countdownDisplay = document.getElementById('rest-timer-countdown');
  if (!countdownDisplay) return;

  const mins = Math.floor(state.restTimerSecondsLeft / 60);
  const secs = state.restTimerSecondsLeft % 60;
  countdownDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const progressCircle = document.getElementById('rest-timer-progress-circle');
  if (progressCircle) {
    const pct = state.restTimerTotalDuration > 0 ? state.restTimerSecondsLeft / state.restTimerTotalDuration : 0;
    const offset = Math.max(0, Math.min(283, 283 * (1 - pct)));
    progressCircle.style.strokeDashoffset = offset;
  }
}

export function playRestAlarmSynth() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const startTime = ctx.currentTime;
    
    // Play 4 beautiful double beeps (987Hz B5)
    for (let i = 0; i < 4; i++) {
      const timeOffset = i * 0.7;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, startTime + timeOffset);
      gain1.gain.setValueAtTime(0, startTime + timeOffset);
      gain1.gain.linearRampToValueAtTime(0.35, startTime + timeOffset + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, startTime + timeOffset + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(startTime + timeOffset);
      osc1.stop(startTime + timeOffset + 0.25);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, startTime + timeOffset + 0.25);
      gain2.gain.setValueAtTime(0, startTime + timeOffset + 0.25);
      gain2.gain.linearRampToValueAtTime(0.35, startTime + timeOffset + 0.25 + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + timeOffset + 0.25 + 0.22);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(startTime + timeOffset + 0.25);
      osc2.stop(startTime + timeOffset + 0.25 + 0.25);
    }
  } catch (e) {
    console.error("Failed to play dynamic synthesized rest alarm:", e);
  }
}

export function handleRestTimerExpiration() {
  if (state.restTimerInterval) {
    clearInterval(state.restTimerInterval);
    state.restTimerInterval = null;
  }
  SafeStorage.removeItem('aura-rest-timer-end-time');

  const bubble = document.getElementById('rest-timer-bubble');
  if (bubble) {
    bubble.classList.add('expired');
  }

  // Play alarm sound synthesize
  playRestAlarmSynth();

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    triggerLocalNotification("המנוחה נגמרה! ⏱️💪", "הגיע הזמן לסט הבא. קדימה, לעבודה!");
  }

  // Fallback / Reinforcement visual toast to guarantee visibility
  showPremiumToast("המנוחה נגמרה! הגיע הזמן לסט הבא! ⏱️💪", "success");

  if (navigator.vibrate) {
    navigator.vibrate([300, 150, 300, 150, 300]);
  }

  // Automatically dismiss the rest timer bubble and return to the workout screen after 5 seconds
  setTimeout(() => {
    const currentBubble = document.getElementById('rest-timer-bubble');
    if (currentBubble && currentBubble.classList.contains('expired')) {
      stopRestTimer();
    }
  }, 5000);
}

// SET LOGGING MODAL
export function openSetLoggingModal(ex) {
  state.currentLoggingExercise = ex;

  const nextIncompleteIdx = ex.sets.findIndex(s => !s.completed);
  state.currentLoggingSetIndex = nextIncompleteIdx !== -1 ? nextIncompleteIdx : ex.sets.length;

  const nameDisplay = document.getElementById('set-log-exercise-name');
  const setNumDisplay = document.getElementById('set-log-set-number');
  if (nameDisplay) nameDisplay.textContent = ex.name;
  if (setNumDisplay) setNumDisplay.textContent = `סט ${state.currentLoggingSetIndex + 1}`;

  const weightGroup = document.getElementById('set-log-weight-group');
  const repsGroup = document.getElementById('set-log-reps-group');
  const metricType = ex.metricType || 'both';

  if (weightGroup) {
    if (metricType === 'reps') {
      weightGroup.classList.add('slider-group-hidden');
    } else {
      weightGroup.classList.remove('slider-group-hidden');
    }
  }
  if (repsGroup) {
    if (metricType === 'weight') {
      repsGroup.classList.add('slider-group-hidden');
    } else {
      repsGroup.classList.remove('slider-group-hidden');
    }
  }

  const completedSets = ex.sets.filter(s => s.completed);
  const previousSet = completedSets[completedSets.length - 1];

  let initialWeight = 60;
  let initialReps = 10;

  if (previousSet) {
    initialWeight = parseFloat(previousSet.weight) || 60;
    initialReps = parseInt(previousSet.reps, 10) || 10;
  }

  const weightSlider = document.getElementById('weight-range-slider');
  const weightValueText = document.getElementById('weight-slider-value');
  const repsSlider = document.getElementById('reps-range-slider');
  const repsValueText = document.getElementById('reps-slider-value');

  if (weightSlider) {
    weightSlider.value = initialWeight;
    if (weightValueText) weightValueText.textContent = initialWeight;
  }
  if (repsSlider) {
    repsSlider.value = initialReps;
    if (repsValueText) repsValueText.textContent = initialReps;
  }

  const setLogModal = document.getElementById('set-log-modal');
  if (setLogModal) {
    setLogModal.classList.remove('hide');
  }
}

// PLATE CALCULATOR
export function calculatePlates(targetWeight) {
  const displayTarget = document.getElementById('plate-calc-target-weight');
  if (displayTarget) displayTarget.textContent = targetWeight;

  const stack = document.getElementById('plates-stack-left');
  const list = document.getElementById('plates-list-needed');

  if (stack) stack.innerHTML = '';
  if (list) list.innerHTML = '';

  const bar = 20;
  if (targetWeight <= bar) {
    if (list) list.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">מוט ריק בלבד (20 ק״ג) 🏋️‍♂️</span>';
    return;
  }

  let weightPerSide = (targetWeight - bar) / 2;
  const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
  const needed = [];

  let temp = weightPerSide;
  for (const p of plates) {
    const count = Math.floor(temp / p);
    if (count > 0) {
      needed.push({ weight: p, count: count });
      temp = Math.round((temp - p * count) * 100) / 100;
    }
  }

  if (needed.length === 0) {
    if (list) list.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">אין שילוב פלטות מתאים</span>';
    return;
  }

  needed.forEach(item => {
    const chip = document.createElement('span');
    chip.className = 'plate-chip';
    chip.textContent = `${item.weight} ק״ג × ${item.count}`;
    if (list) list.appendChild(chip);
  });

  const colors = {
    25: '#dc2626',
    20: '#2563eb',
    15: '#eab308',
    10: '#16a34a',
    5: '#94a3b8',
    2.5: '#475569',
    1.25: '#1e293b'
  };

  const heights = { 25: 86, 20: 80, 15: 72, 10: 62, 5: 50, 2.5: 42, 1.25: 34 };
  const widths = { 25: 18, 20: 16, 15: 14, 10: 12, 5: 10, 2.5: 8, 1.25: 6 };

  needed.forEach(item => {
    for (let i = 0; i < item.count; i++) {
      const plate = document.createElement('div');
      const h = heights[item.weight] || 40;
      const w = widths[item.weight] || 8;
      const c = colors[item.weight] || '#ffffff';

      plate.style.cssText = `
        width: ${w}px;
        height: ${h}px;
        background: ${c};
        border-radius: 4px;
        box-shadow: 0 0 8px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.25);
        border: 1px solid rgba(0, 0, 0, 0.4);
        transition: transform 0.2s ease;
      `;
      plate.title = `${item.weight} ק״ג`;
      if (stack) stack.appendChild(plate);
    }
  });
}

// ACCORDION HISTORIC LOG EDITOR SYSTEM
export function openEditModal(workoutId) {
  const original = state.workoutHistory.find(w => String(w.id) === String(workoutId));
  const editModal = document.getElementById('workout-edit-modal');
  if (!original || !editModal) return;
  
  state.editingWorkout = JSON.parse(JSON.stringify(original));
  
  const metaContainer = document.getElementById('modal-workout-meta');
  if (metaContainer) {
    const dateObj = new Date(state.editingWorkout.date);
    const dateText = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
    
    let durationText = '';
    if (state.editingWorkout.duration < 60) {
      durationText = 'פחות מדקה';
    } else if (state.editingWorkout.duration < 3600) {
      durationText = `${Math.floor(state.editingWorkout.duration / 60)} דקות`;
    } else {
      const hrs = Math.floor(state.editingWorkout.duration / 3600);
      const mins = Math.floor((state.editingWorkout.duration % 3600) / 60);
      durationText = `${hrs} שעות ו-${mins} דק׳`;
    }
    
    const dispName = state.editingWorkout.locationName || (state.editingWorkout.location === 'gym' ? 'חדר כושר' : 'פארק');
    const dispEmoji = state.editingWorkout.locationEmoji || (state.editingWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳');
    metaContainer.innerHTML = `
      <div>📍 <strong>${dispEmoji} ${dispName}</strong></div>
      <div>⏱️ משך: <strong>${durationText}</strong></div>
      <div>📅 תאריך: <strong>${dateText}</strong></div>
    `;
  }
  
  renderModalExercises();
  
  editModal.classList.remove('hide');
}

export function renderModalExercises() {
  const container = document.getElementById('modal-exercises-container');
  if (!container || !state.editingWorkout) return;
  
  container.innerHTML = '';
  
  state.editingWorkout.exercises.forEach((ex, exIdx) => {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.style.background = 'rgba(255, 255, 255, 0.03)';
    
    const header = document.createElement('div');
    header.className = 'exercise-card-header';
    
    const titleContainer = document.createElement('div');
    titleContainer.className = 'exercise-title-container';
    
    const removeExBtn = document.createElement('button');
    removeExBtn.className = 'remove-exercise-btn';
    removeExBtn.innerHTML = '🗑️';
    removeExBtn.addEventListener('click', () => {
      state.editingWorkout.exercises.splice(exIdx, 1);
      renderModalExercises();
    });
    titleContainer.appendChild(removeExBtn);
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'exercise-name-input';
    nameInput.placeholder = 'שם התרגיל';
    nameInput.value = ex.name;
    nameInput.addEventListener('input', (e) => {
      ex.name = e.target.value;
    });
    titleContainer.appendChild(nameInput);
    header.appendChild(titleContainer);
    
    card.appendChild(header);
    
    const setsArea = document.createElement('div');
    setsArea.className = 'sets-area';
    
    const metricType = ex.metricType || 'both';

    const setsHeader = document.createElement('div');
    if (metricType === 'both') {
      setsHeader.className = 'sets-header-row grid-4-cols';
      setsHeader.innerHTML = `
        <div>מחק</div>
        <div>משקל</div>
        <div>חזרות</div>
        <div>סט</div>
      `;
    } else {
      setsHeader.className = 'sets-header-row grid-3-cols';
      setsHeader.innerHTML = `
        <div>מחק</div>
        <div>${metricType === 'reps' ? 'חזרות' : 'משקל'}</div>
        <div>סט</div>
      `;
    }
    setsArea.appendChild(setsHeader);
    
    ex.sets.forEach((set, setIdx) => {
      const setRow = document.createElement('div');
      setRow.className = `set-row completed ${metricType === 'both' ? 'grid-4-cols' : 'grid-3-cols'}`;
      
      const removeSetBtn = document.createElement('button');
      removeSetBtn.className = 'remove-set-btn';
      removeSetBtn.innerHTML = '✕';
      removeSetBtn.addEventListener('click', () => {
        if (ex.sets.length > 1) {
          ex.sets.splice(setIdx, 1);
          renderModalExercises();
        } else {
          alert('תרגיל חייב להכיל לפחות סט אחד.');
        }
      });
      setRow.appendChild(removeSetBtn);
      
      if (metricType === 'both' || metricType === 'weight') {
        const weightWrapper = document.createElement('div');
        weightWrapper.className = 'set-input-wrapper';
        const weightInput = document.createElement('input');
        weightInput.type = 'number';
        weightInput.className = 'set-input';
        weightInput.value = set.weight;
        weightInput.addEventListener('input', (e) => {
          set.weight = e.target.value;
        });
        weightWrapper.appendChild(weightInput);
        setRow.appendChild(weightWrapper);
      }
      
      if (metricType === 'both' || metricType === 'reps') {
        const repsWrapper = document.createElement('div');
        repsWrapper.className = 'set-input-wrapper';
        const repsInput = document.createElement('input');
        repsInput.type = 'number';
        repsInput.className = 'set-input';
        repsInput.value = set.reps;
        repsInput.addEventListener('input', (e) => {
          set.reps = e.target.value;
        });
        repsWrapper.appendChild(repsInput);
        setRow.appendChild(repsWrapper);
      }
      
      const setLabelWrapper = document.createElement('div');
      setLabelWrapper.className = 'set-input-wrapper';
      const setLabel = document.createElement('span');
      setLabel.className = 'set-number-label';
      setLabel.textContent = String(setIdx + 1);
      setLabelWrapper.appendChild(setLabel);
      setRow.appendChild(setLabelWrapper);
      
      setsArea.appendChild(setRow);
    });
    
    const addSetBtn = document.createElement('button');
    addSetBtn.className = 'add-set-btn';
    addSetBtn.textContent = '➕ הוסף סט';
    addSetBtn.addEventListener('click', () => {
      const lastSet = ex.sets[ex.sets.length - 1];
      ex.sets.push({
        reps: lastSet ? lastSet.reps : '',
        weight: lastSet ? lastSet.weight : '',
        completed: true
      });
      renderModalExercises();
    });
    setsArea.appendChild(addSetBtn);
    
    card.appendChild(setsArea);
    container.appendChild(card);
  });
  
  const addExBtn = document.createElement('button');
  addExBtn.className = 'btn btn-secondary';
  addExBtn.style.width = '100%';
  addExBtn.style.marginTop = '10px';
  addExBtn.textContent = '➕ הוסף תרגיל חדש';
  addExBtn.addEventListener('click', () => {
    state.editingWorkout.exercises.push({
      id: Date.now(),
      name: '',
      completed: true,
      sets: [{ reps: '', weight: '', completed: true }]
    });
    renderModalExercises();
  });
  container.appendChild(addExBtn);
}

export function deleteWorkoutFromHistory(workoutId) {
  if (!state.currentUser) return;
  
  state.workoutHistory = state.workoutHistory.filter(w => String(w.id) !== String(workoutId));
  SafeStorage.setItem(`aura-workout-history_${state.currentUser.uid}`, JSON.stringify(state.workoutHistory));
  
  if (window.renderWorkoutHistory) window.renderWorkoutHistory();
  
  const editModal = document.getElementById('workout-edit-modal');
  if (editModal) editModal.classList.add('hide');
  state.editingWorkout = null;
}

// BIND ALL GENERAL ACTIONS & INTERACTIVE ELEMENTS
export function initWorkoutsModule() {
  // Bind global compatibility triggers
  window.initWorkouts = initWorkouts;
  window.clearWorkoutSession = clearWorkoutSession;
  window.startRestTimer = startRestTimer;
  window.stopRestTimer = stopRestTimer;
  window.renderExercises = renderExercises;
  window.openEditModal = openEditModal;
  window.renderModalExercises = renderModalExercises;
  window.deleteWorkoutFromHistory = deleteWorkoutFromHistory;
  window.exercisesList = getAllExercises();
  window.renderExercisePickerList = renderExercisePickerList;

  // Setup click bindings on DOM
  const startWorkoutBtn = document.getElementById('start-workout-btn');
  const cancelLocationBtn = document.getElementById('cancel-location-btn');
  const locationGrid = document.getElementById('location-selector-grid');

  if (startWorkoutBtn && locationGrid) {
    startWorkoutBtn.addEventListener('click', () => {
      startWorkoutBtn.classList.add('hide');
      locationGrid.classList.remove('hide');
    });
  }

  if (cancelLocationBtn && startWorkoutBtn && locationGrid) {
    cancelLocationBtn.addEventListener('click', () => {
      locationGrid.classList.add('hide');
      startWorkoutBtn.classList.remove('hide');
    });
  }

  const pickerModal = document.getElementById('exercise-picker-modal');
  if (pickerModal) {
    pickerModal.addEventListener('click', (e) => {
      if (e.target === pickerModal) pickerModal.classList.add('hide');
    });
  }

  const metricModal = document.getElementById('metric-selector-modal');
  if (metricModal) {
    metricModal.addEventListener('click', (e) => {
      if (e.target === metricModal) {
        metricModal.classList.add('hide');
        state.selectedExerciseForAdding = null;
      }
    });
  }

  // Estimated Sets Selection Event Listeners inside metric selector modal
  const setsChipsContainer = document.getElementById('sets-chips-container');
  const metricSetsDisplay = document.getElementById('metric-sets-display');
  const metricSetsMinus = document.getElementById('metric-sets-minus');
  const metricSetsPlus = document.getElementById('metric-sets-plus');

  function updateSetsUI(value) {
    const targetSets = Math.max(1, Math.min(12, value));
    if (metricSetsDisplay) {
      metricSetsDisplay.textContent = targetSets;
    }
    
    // Sync chips
    if (setsChipsContainer) {
      setsChipsContainer.querySelectorAll('.sets-option-chip').forEach(chip => {
        const val = parseInt(chip.getAttribute('data-sets'), 10);
        if (val === targetSets) {
          chip.classList.add('active');
          chip.style.border = '1px solid var(--electric-blue)';
          chip.style.background = 'var(--electric-blue-light)';
        } else {
          chip.classList.remove('active');
          chip.style.border = '1px solid rgba(255,255,255,0.1)';
          chip.style.background = 'rgba(255,255,255,0.05)';
        }
      });
    }
  }

  if (setsChipsContainer) {
    setsChipsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.sets-option-chip');
      if (!chip) return;
      const val = parseInt(chip.getAttribute('data-sets'), 10);
      updateSetsUI(val);
    });
  }

  if (metricSetsMinus) {
    metricSetsMinus.addEventListener('click', () => {
      const currentSets = metricSetsDisplay ? parseInt(metricSetsDisplay.textContent, 10) || 3 : 3;
      updateSetsUI(currentSets - 1);
    });
  }

  if (metricSetsPlus) {
    metricSetsPlus.addEventListener('click', () => {
      const currentSets = metricSetsDisplay ? parseInt(metricSetsDisplay.textContent, 10) || 3 : 3;
      updateSetsUI(currentSets + 1);
    });
  }
  
  const closePickerBtn = document.getElementById('close-exercise-picker-btn');
  if (closePickerBtn) {
    closePickerBtn.addEventListener('click', () => {
      if (pickerModal) pickerModal.classList.add('hide');
    });
  }

  const closeCustomLocBtn = document.getElementById('close-custom-location-btn');
  if (closeCustomLocBtn) {
    closeCustomLocBtn.addEventListener('click', () => {
      const modal = document.getElementById('custom-location-modal');
      if (modal) modal.classList.add('hide');
    });
  }

  const closeMetricBtn = document.getElementById('close-metric-selector-btn');
  if (closeMetricBtn) {
    closeMetricBtn.addEventListener('click', () => {
      if (metricModal) metricModal.classList.add('hide');
      state.selectedExerciseForAdding = null;
    });
  }

  const saveCustomLocBtn = document.getElementById('save-custom-location-btn');
  if (saveCustomLocBtn) {
    saveCustomLocBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('custom-location-name-input');
      const emojiInput = document.getElementById('custom-location-emoji-input');
      
      if (!nameInput || nameInput.value.trim() === '') {
        alert('אנא הזן שם לסוג האימון.');
        return;
      }
      
      const newLoc = {
        id: 'custom_' + Date.now(),
        name: nameInput.value.trim(),
        emoji: emojiInput ? emojiInput.value.trim() || '💪' : '💪'
      };
      
      state.customLocations.push(newLoc);
      if (state.currentUser) {
        SafeStorage.setItem(`aura-custom-locations_${state.currentUser.uid}`, JSON.stringify(state.customLocations));
      }
      
      nameInput.value = '';
      if (emojiInput) emojiInput.value = '';
      
      const modal = document.getElementById('custom-location-modal');
      if (modal) modal.classList.add('hide');
      
      renderLocationSelectorGrid();
      populateLocationSelects();
    });
  }

  const openCustomExModalBtn = document.getElementById('open-custom-exercise-modal-btn');
  if (openCustomExModalBtn) {
    openCustomExModalBtn.addEventListener('click', () => {
      const customExModal = document.getElementById('custom-exercise-modal');
      if (customExModal) {
        const nameInput = document.getElementById('new-custom-exercise-name-input');
        if (nameInput) nameInput.value = '';
        
        document.querySelectorAll('#custom-ex-category-selector .muscle-card').forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.category === 'חזה') btn.classList.add('active');
        });
        
        document.querySelectorAll('#custom-ex-emoji-selector .emoji-pick-btn').forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.emoji === '') btn.classList.add('active');
        });
        
        customExModal.classList.remove('hide');
        setTimeout(() => { if (nameInput) nameInput.focus(); }, 100);
      }
    });
  }

  const categoryPillContainer = document.getElementById('custom-ex-category-selector');
  if (categoryPillContainer) {
    categoryPillContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.muscle-card');
      if (!pill) return;
      categoryPillContainer.querySelectorAll('.muscle-card').forEach(b => b.classList.remove('active'));
      pill.classList.add('active');
    });
  }

  const emojiSelectorContainer = document.getElementById('custom-ex-emoji-selector');
  if (emojiSelectorContainer) {
    emojiSelectorContainer.addEventListener('click', (e) => {
      const emojiBtn = e.target.closest('.emoji-pick-btn');
      if (!emojiBtn) return;
      emojiSelectorContainer.querySelectorAll('.emoji-pick-btn').forEach(b => b.classList.remove('active'));
      emojiBtn.classList.add('active');
    });
  }

  const closeCustomExModalBtn = document.getElementById('close-custom-exercise-modal-btn');
  if (closeCustomExModalBtn) {
    closeCustomExModalBtn.addEventListener('click', () => {
      const customExModal = document.getElementById('custom-exercise-modal');
      if (customExModal) customExModal.classList.add('hide');
    });
  }

  const customExModal = document.getElementById('custom-exercise-modal');
  if (customExModal) {
    customExModal.addEventListener('click', (e) => {
      if (e.target === customExModal) customExModal.classList.add('hide');
    });
  }

  const saveCustomExBtn = document.getElementById('save-custom-exercise-btn');
  if (saveCustomExBtn) {
    saveCustomExBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('new-custom-exercise-name-input');
      if (!nameInput || nameInput.value.trim() === '') {
        alert('אנא הזן שם לתרגיל המותאם אישית.');
        if (nameInput) nameInput.focus();
        return;
      }
      
      const exName = nameInput.value.trim();
      const activeCatPill = document.querySelector('#custom-ex-category-selector .muscle-card.active');
      const selectedCategory = activeCatPill ? activeCatPill.dataset.category : 'מותאם אישית';
      const activeEmojiBtn = document.querySelector('#custom-ex-emoji-selector .emoji-pick-btn.active');
      const selectedEmoji = activeEmojiBtn ? activeEmojiBtn.dataset.emoji : '';
      
      const newEx = {
        name: exName,
        category: selectedCategory,
        locationType: state.activeWorkout ? state.activeWorkout.location : 'custom',
        emoji: selectedEmoji || ''
      };
      
      state.customExercises.push(newEx);
      if (state.currentUser) {
        SafeStorage.setItem(`aura-custom-exercises_${state.currentUser.uid}`, JSON.stringify(state.customExercises));
        let allExs = getAllExercises();
        if (!allExs.some(ex => ex.name.trim().toLowerCase() === exName.trim().toLowerCase())) {
          allExs.push(newEx);
          saveAllExercises(allExs);
        }
      }
      
      if (customExModal) customExModal.classList.add('hide');
      
      state.selectedExerciseForAdding = exName;
      
      if (pickerModal) pickerModal.classList.add('hide');
      if (metricModal) metricModal.classList.remove('hide');
      
      renderExercisePickerList();
      if (window.renderExercisesManager) window.renderExercisesManager();
    });
  }

  document.querySelectorAll('.metric-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const metricType = tile.getAttribute('data-metric');
      console.log("Metric tile clicked:", metricType, "selectedExerciseForAdding:", state.selectedExerciseForAdding);
      
      if (!state.selectedExerciseForAdding) {
        alert('שגיאה: לא נבחר תרגיל. אנא בחר תרגיל שוב.');
        return;
      }
      
      if (!state.activeWorkout) return;
      
      const activeRestChip = document.querySelector('#rest-time-chips-container .rest-option-chip.active');
      const seconds = activeRestChip ? parseInt(activeRestChip.getAttribute('data-rest'), 10) : 90;

      // Extract chosen targetSetsCount from modal UI
      const metricSetsDisplay = document.getElementById('metric-sets-display');
      const targetSets = metricSetsDisplay ? parseInt(metricSetsDisplay.textContent, 10) || 3 : 3;

      const newExercise = {
        name: state.selectedExerciseForAdding,
        metricType: metricType,
        restTime: seconds,
        targetSetsCount: targetSets,
        completed: false,
        sets: []
      };

      state.activeWorkout.exercises.push(newExercise);
      saveActiveWorkoutState();
      
      if (metricModal) metricModal.classList.add('hide');
      state.selectedExerciseForAdding = null;
      
      renderExercises();
    });
  });

  const restChipsContainer = document.getElementById('rest-time-chips-container');
  if (restChipsContainer) {
    restChipsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.rest-option-chip');
      if (!chip) return;
      restChipsContainer.querySelectorAll('.rest-option-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  }

  const addExerciseBtn = document.getElementById('add-exercise-btn');
  if (addExerciseBtn) {
    addExerciseBtn.addEventListener('click', () => {
      if (!state.activeWorkout) return;
      
      state.activeWorkout.exercises = state.activeWorkout.exercises.filter(ex => {
        return ex.sets.some(s => s.completed);
      });
      saveActiveWorkoutState();
      renderExercises();
      
      const hasActive = state.activeWorkout.exercises.some(ex => !ex.completed);
      if (hasActive) {
        alert('נא לסיים את התרגיל הנוכחי לפני הוספת תרגיל חדש.');
        return;
      }
      
      if (pickerModal) {
        pickerModal.classList.remove('hide');
        const searchInput = document.getElementById('exercise-search-input');
        if (searchInput) searchInput.value = '';
        state.currentActiveCategoryFilter = 'הכל';
        renderExercisePickerFilters();
        renderExercisePickerList();
      }
    });
  }

  const finishWorkoutBtn = document.getElementById('finish-workout-btn');
  if (finishWorkoutBtn) {
    finishWorkoutBtn.addEventListener('click', () => {
      if (!state.activeWorkout) return;
      
      state.activeWorkout.exercises.forEach(ex => {
        if (!ex.completed && ex.name.trim() !== '') {
          ex.sets.forEach(set => {
            if (!set.completed) {
              const hasReps = set.reps !== '' && Number(set.reps) > 0;
              const hasWeight = set.weight !== '' && Number(set.weight) >= 0;
              if (hasReps || hasWeight) {
                set.completed = true;
              }
            }
          });
          const hasCompletedSets = ex.sets.some(s => s.completed);
          if (hasCompletedSets) {
            ex.completed = true;
          }
        }
      });

      const sanitizedExercises = state.activeWorkout.exercises.map(ex => {
        const clonedEx = JSON.parse(JSON.stringify(ex));
        clonedEx.sets = clonedEx.sets.filter(s => {
          const hasReps = s.reps !== null && String(s.reps).trim() !== '' && Number(s.reps) > 0;
          const hasWeight = s.weight !== null && String(s.weight).trim() !== '' && Number(s.weight) >= 0;
          return s.completed && (hasReps || hasWeight);
        });
        return clonedEx;
      }).filter(ex => ex.name.trim() !== '' && ex.sets.length > 0);

      if (sanitizedExercises.length === 0) {
        if (confirm('אין תרגילים תקפים שהושלמו באימון זה. האם ברצונך לבטל את האימון ולחזור למסך הראשי?')) {
          if (state.activeTimerInterval) {
            clearInterval(state.activeTimerInterval);
            state.activeTimerInterval = null;
          }
          stopRestTimer();
          state.activeWorkout = null;
          if (state.currentUser) {
            SafeStorage.removeItem(`aura-active-workout_${state.currentUser.uid}`);
          }
          const activeView = document.getElementById('workout-active-view');
          const idleView = document.getElementById('workout-idle-view');
          if (activeView) activeView.classList.add('hide');
          if (idleView) {
            idleView.classList.add('active');
            idleView.classList.remove('hide');
          }
        }
        return;
      }
      
      const durationSeconds = Math.floor((Date.now() - state.activeWorkout.startTime) / 1000);
      
      const workoutLog = {
        id: Date.now(),
        date: Date.now(),
        location: state.activeWorkout.location,
        locationName: state.activeWorkout.locationName || (state.activeWorkout.location === 'gym' ? 'חדר כושר' : 'פארק'),
        locationEmoji: state.activeWorkout.locationEmoji || (state.activeWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳'),
        duration: durationSeconds,
        exercises: sanitizedExercises
      };
      
      state.workoutHistory.push(workoutLog);
      SafeStorage.setItem(`aura-workout-history_${state.currentUser.uid}`, JSON.stringify(state.workoutHistory));
      
      SafeStorage.removeItem(`aura-active-workout_${state.currentUser.uid}`);
      stopRestTimer();

      if (state.activeTimerInterval) {
        clearInterval(state.activeTimerInterval);
        state.activeTimerInterval = null;
      }
      state.activeWorkout = null;
      
      const activeView = document.getElementById('workout-active-view');
      const idleView = document.getElementById('workout-idle-view');
      if (activeView) activeView.classList.add('hide');
      if (idleView) {
        idleView.classList.add('active');
        idleView.classList.remove('hide');
      }
      
      if (window.renderWorkoutHistory) window.renderWorkoutHistory();
      
      const analyticsTabBtn = document.querySelector('.ios-bottom-nav .nav-tab[data-tab="analytics"]');
      if (analyticsTabBtn) {
        analyticsTabBtn.click();
      }
      
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        triggerLocalNotification("אימון נשמר בהצלחה! 💪", "הנתונים שלך מוגנים ומאובטחים לצמיתות במכשיר.");
      }
    });
  }

  // Edit Modal Event Handlers
  const editModal = document.getElementById('workout-edit-modal');
  const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
  const saveEditedWorkoutBtn = document.getElementById('save-edited-workout-btn');
  const deleteWorkoutBtn = document.getElementById('delete-workout-btn');

  if (closeEditModalBtn && editModal) {
    closeEditModalBtn.addEventListener('click', () => {
      editModal.classList.add('hide');
      state.editingWorkout = null;
    });
    
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        editModal.classList.add('hide');
        state.editingWorkout = null;
      }
    });
  }

  if (saveEditedWorkoutBtn) {
    saveEditedWorkoutBtn.addEventListener('click', () => {
      if (!state.editingWorkout || !state.currentUser) return;
      
      if (state.editingWorkout.exercises.length === 0) {
        if (confirm('לא נותרו תרגילים באימון זה. האם ברצונך למחוק אותו לגמרי מההיסטוריה?')) {
          deleteWorkoutFromHistory(state.editingWorkout.id);
        }
        return;
      }
      
      for (let i = 0; i < state.editingWorkout.exercises.length; i++) {
        const ex = state.editingWorkout.exercises[i];
        if (!ex.name.trim()) {
          alert('אנא ודא שלכל התרגילים יש שם.');
          return;
        }
        
        ex.sets = ex.sets.filter(s => {
          const hasReps = s.reps !== null && String(s.reps).trim() !== '' && Number(s.reps) > 0;
          const hasWeight = s.weight !== null && String(s.weight).trim() !== '' && Number(s.weight) >= 0;
          return hasReps || hasWeight;
        });
        
        if (ex.sets.length === 0) {
          alert(`התרגיל "${ex.name}" חייב להכיל לפחות סט אחד בעל ערכים תקינים.`);
          return;
        }
        
        ex.sets.forEach(s => s.completed = true);
        ex.completed = true;
      }
      
      const originalIdx = state.workoutHistory.findIndex(w => w.id === state.editingWorkout.id);
      if (originalIdx !== -1) {
        state.workoutHistory[originalIdx] = state.editingWorkout;
        SafeStorage.setItem(`aura-workout-history_${state.currentUser.uid}`, JSON.stringify(state.workoutHistory));
        
        if (window.renderWorkoutHistory) window.renderWorkoutHistory();
        
        if (editModal) editModal.classList.add('hide');
        state.editingWorkout = null;
      }
    });
  }

  if (deleteWorkoutBtn) {
    deleteWorkoutBtn.addEventListener('click', () => {
      if (!state.editingWorkout) return;
      if (confirm('האם אתה בטוח שברצונך למחוק את האימון הזה לצמיתות מההיסטוריה? פעולה זו אינה ניתנת לביטול.')) {
        deleteWorkoutFromHistory(state.editingWorkout.id);
      }
    });
  }

  // Rest Timer Interactive Elements
  const closeRestBtn = document.getElementById('close-rest-timer-btn');
  const plus30Btn = document.getElementById('rest-timer-plus-30');
  const minus30Btn = document.getElementById('rest-timer-minus-30');

  if (closeRestBtn) closeRestBtn.addEventListener('click', stopRestTimer);

  if (plus30Btn) {
    plus30Btn.addEventListener('click', () => {
      state.restTimerSecondsLeft += 30;
      state.restTimerTotalDuration = Math.max(state.restTimerTotalDuration, state.restTimerSecondsLeft);
      if (state.restTimerSecondsLeft > 0 && !state.restTimerInterval) {
        const bubble = document.getElementById('rest-timer-bubble');
        if (bubble) bubble.classList.remove('expired');
        
        state.restTimerInterval = setInterval(() => {
          state.restTimerSecondsLeft--;
          if (state.restTimerSecondsLeft <= 0) {
            state.restTimerSecondsLeft = 0;
            updateRestTimerUI();
            handleRestTimerExpiration();
          } else {
            updateRestTimerUI();
          }
        }, 1000);
      }
      updateRestTimerUI();
    });
  }

  if (minus30Btn) {
    minus30Btn.addEventListener('click', () => {
      state.restTimerSecondsLeft = Math.max(0, state.restTimerSecondsLeft - 30);
      updateRestTimerUI();
      if (state.restTimerSecondsLeft === 0) {
        handleRestTimerExpiration();
      }
    });
  }

  // Set Logging Micro adjustments
  const setLogModal = document.getElementById('set-log-modal');
  const weightSlider = document.getElementById('weight-range-slider');
  const weightValueText = document.getElementById('weight-slider-value');
  const repsSlider = document.getElementById('reps-range-slider');
  const repsValueText = document.getElementById('reps-slider-value');

  const weightMinusBtn = document.getElementById('weight-minus-btn');
  const weightPlusBtn = document.getElementById('weight-plus-btn');
  const repsMinusBtn = document.getElementById('reps-minus-btn');
  const repsPlusBtn = document.getElementById('reps-plus-btn');

  const confirmSetBtn = document.getElementById('set-log-confirm-btn');
  const cancelSetBtn = document.getElementById('set-log-cancel-btn');

  if (weightSlider && weightValueText) {
    weightSlider.addEventListener('input', () => {
      weightValueText.textContent = weightSlider.value;
    });
  }
  if (repsSlider && repsValueText) {
    repsSlider.addEventListener('input', () => {
      repsValueText.textContent = repsSlider.value;
    });
  }

  if (weightMinusBtn && weightSlider && weightValueText) {
    weightMinusBtn.addEventListener('click', () => {
      let val = parseFloat(weightSlider.value) || 0;
      val = Math.max(0, val - 2.5);
      val = parseFloat(val.toFixed(1));
      weightSlider.value = val;
      weightValueText.textContent = val;
    });
  }
  if (weightPlusBtn && weightSlider && weightValueText) {
    weightPlusBtn.addEventListener('click', () => {
      let val = parseFloat(weightSlider.value) || 0;
      val = Math.min(250, val + 2.5);
      val = parseFloat(val.toFixed(1));
      weightSlider.value = val;
      weightValueText.textContent = val;
    });
  }

  if (repsMinusBtn && repsSlider && repsValueText) {
    repsMinusBtn.addEventListener('click', () => {
      let val = parseInt(repsSlider.value, 10) || 0;
      val = Math.max(0, val - 1);
      repsSlider.value = val;
      repsValueText.textContent = val;
    });
  }
  if (repsPlusBtn && repsSlider && repsValueText) {
    repsPlusBtn.addEventListener('click', () => {
      let val = parseInt(repsSlider.value, 10) || 0;
      val = Math.min(50, val + 1);
      repsSlider.value = val;
      repsValueText.textContent = val;
    });
  }

  if (setLogModal) {
    setLogModal.addEventListener('click', (e) => {
      if (e.target === setLogModal) {
        setLogModal.classList.add('hide');
        state.currentLoggingExercise = null;
        state.currentLoggingSetIndex = -1;
      }
    });
  }

  if (confirmSetBtn) {
    confirmSetBtn.addEventListener('click', () => {
      if (!state.currentLoggingExercise) return;

      const metricType = state.currentLoggingExercise.metricType || 'both';
      let repsVal = '';
      let weightVal = '';

      if (metricType === 'both' || metricType === 'reps') {
        repsVal = repsSlider ? repsSlider.value : '10';
      }
      if (metricType === 'both' || metricType === 'weight') {
        weightVal = weightSlider ? weightSlider.value : '60';
      }

      const loggedSet = {
        reps: repsVal,
        weight: weightVal,
        completed: true
      };

      if (!state.currentLoggingExercise.sets) {
        state.currentLoggingExercise.sets = [];
      }

      state.currentLoggingExercise.sets = state.currentLoggingExercise.sets.filter(s => s.completed);
      state.currentLoggingExercise.sets.push(loggedSet);

      saveActiveWorkoutState();

      const completedSetsCount = state.currentLoggingExercise.sets.filter(s => s.completed).length;
      const targetSetsCount = state.currentLoggingExercise.targetSetsCount || 3;

      if (completedSetsCount >= targetSetsCount) {
        state.currentLoggingExercise.completed = true;
        // Clean up any remaining uncompleted sets
        state.currentLoggingExercise.sets = state.currentLoggingExercise.sets.filter(s => s.completed);
        
        saveActiveWorkoutState();
        
        if (setLogModal) setLogModal.classList.add('hide');
        
        // Start 2-minute transition rest timer
        startRestTimer(120);
        
        // Premium toast notification indicating completion
        showPremiumToast(`התרגיל הושלם בהצלחה! מעבר לתרגיל הבא בעוד 2 דקות מנוחה ⏱️💪`, "success");
      } else {
        if (setLogModal) setLogModal.classList.add('hide');
        const restSeconds = state.currentLoggingExercise.restTime || 90;
        startRestTimer(restSeconds);
      }

      state.currentLoggingExercise = null;
      state.currentLoggingSetIndex = -1;

      renderExercises();
    });
  }

  if (cancelSetBtn) {
    cancelSetBtn.addEventListener('click', () => {
      if (setLogModal) setLogModal.classList.add('hide');
      state.currentLoggingExercise = null;
      state.currentLoggingSetIndex = -1;
    });
  }

  // Plate Calculator bindings
  const calcTrigger = document.getElementById('trigger-plate-calc-btn');
  const calcModal = document.getElementById('plate-calculator-modal');
  const calcClose = document.getElementById('close-plate-calc-btn');

  if (calcTrigger && calcModal) {
    calcTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const slider = document.getElementById('weight-range-slider');
      const target = slider ? parseFloat(slider.value) || 60 : 60;
      calculatePlates(target);
      calcModal.classList.remove('hide');
    });
  }

  const dismissCalc = () => {
    if (calcModal) calcModal.classList.add('hide');
  };

  if (calcClose) calcClose.addEventListener('click', dismissCalc);
  if (calcModal) {
    calcModal.addEventListener('click', (e) => {
      if (e.target === calcModal) dismissCalc();
    });
  }

  // Initialize premium interactive Rest Timer gestures & alarms
  initRestTimerInteraction();
}

// ⏱️ Premium Interactive Rest Timer Gesture & Drag Controller
export function initRestTimerInteraction() {
  const bubble = document.getElementById('rest-timer-bubble');
  if (!bubble) return;

  let isDragging = false;
  let startX = 0, startY = 0;
  let currentX = 0, currentY = 0;
  let scale = 1;
  let initialDistance = 0;
  let initialScale = 1;

  // Touch handlers for mobile dragging & pinch-to-size
  bubble.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - currentX;
      startY = e.touches[0].clientY - currentY;
      bubble.style.transition = 'none'; // absolute raw tracking
    } else if (e.touches.length === 2) {
      isDragging = false;
      initialDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialScale = scale;
    }
  }, { passive: true });

  bubble.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
      e.preventDefault(); // Stop mobile rubber banding
      currentX = e.touches[0].clientX - startX;
      currentY = e.touches[0].clientY - startY;
      updateBubbleTransform();
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (initialDistance > 0) {
        const factor = currentDistance / initialDistance;
        scale = Math.max(0.6, Math.min(1.8, initialScale * factor)); // safety scaling caps
        updateBubbleTransform();
      }
    }
  }, { passive: false });

  bubble.addEventListener('touchend', () => {
    isDragging = false;
    bubble.style.transition = 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.1)';
  });

  // Mouse drag handlers for desktop accessibility
  bubble.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // only left click
    if (e.target.closest('button')) return; // do not drag on button clicks

    isDragging = true;
    startX = e.clientX - currentX;
    startY = e.clientY - currentY;
    bubble.style.transition = 'none';
    bubble.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    currentX = e.clientX - startX;
    currentY = e.clientY - startY;
    updateBubbleTransform();
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      bubble.style.transition = 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.1)';
      bubble.style.cursor = 'grab';
    }
  });

  // Mouse wheel scroll to resize on desktop
  bubble.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    scale = Math.max(0.6, Math.min(1.8, scale + delta));
    updateBubbleTransform();
  }, { passive: false });

  // PWA Background rest timer recovery logic
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const endTimeStr = SafeStorage.getItem('aura-rest-timer-end-time');
      if (endTimeStr) {
        const endTime = parseInt(endTimeStr, 10);
        const remaining = Math.round((endTime - Date.now()) / 1000);
        if (remaining > 0) {
          state.restTimerSecondsLeft = remaining;
          updateRestTimerUI();
          
          if (!state.restTimerInterval) {
            state.restTimerInterval = setInterval(() => {
              state.restTimerSecondsLeft--;
              if (state.restTimerSecondsLeft <= 0) {
                state.restTimerSecondsLeft = 0;
                updateRestTimerUI();
                handleRestTimerExpiration();
              } else {
                updateRestTimerUI();
              }
            }, 1000);
          }
        } else {
          // Timer expired in the background
          SafeStorage.removeItem('aura-rest-timer-end-time');
          state.restTimerSecondsLeft = 0;
          updateRestTimerUI();
          handleRestTimerExpiration();
        }
      }
    }
  });

  // Ensure close button is bound
  const closeBtn = document.getElementById('close-rest-timer-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stopRestTimer();
    });
  }

  function updateBubbleTransform() {
    bubble.style.transform = `translate(calc(-50% + ${currentX}px), ${currentY}px) scale(${scale})`;
  }
}
