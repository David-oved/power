import { SafeStorage } from "./utils/storage.js";

export const DEFAULT_MEAL_METRICS = [
  { key: 'calories', name: 'קלוריות', unit: 'קק"ל', goal: 2200, emoji: '🔥', isCustom: false },
  { key: 'protein', name: 'חלבון', unit: 'g', goal: 150, emoji: '🥩', isCustom: false },
  { key: 'carbs', name: 'פחמימות', unit: 'g', goal: 220, emoji: '🌾', isCustom: false },
  { key: 'fat', name: 'שומן', unit: 'g', goal: 70, emoji: '🥑', isCustom: false }
];

// AuraApp Shared State Container
export const state = {
  // Authentication State
  currentUser: null,
  isSensitiveDataVisible: false,
  firebaseEnabled: false,
  firebaseAuthResolved: false,
  app: null,
  auth: null,
  googleProvider: null,

  // Navigation State
  lastActiveMainTab: 'settings',
  activeSubTab: 'workouts',

  // Workouts State
  activeWorkout: null,
  activeTimerInterval: null,
  workoutHistory: [],
  editingWorkout: null,
  customLocations: [],
  customExercises: [],
  favoriteExercises: [],
  selectedExerciseForAdding: null,
  currentActiveCategoryFilter: 'הכל',

  // Rest Timer State
  restTimerInterval: null,
  restTimerSecondsLeft: 0,
  restTimerTotalDuration: 90,

  // Set Logging State
  currentLoggingExercise: null,
  currentLoggingSetIndex: -1,

  // Analytics & Metrics State
  filterTimeSelection: 'all',
  filterStartDate: null,
  filterEndDate: null,
  filterLocation: 'all',
  filterMuscleGroup: 'all',
  selectedAnalyticsExercise: null,
  activeChartType: '1rm',
  activeLogsSubView: 'calendar',
  currentCalendarDate: new Date(),
  filterSortSelection: 'date-desc',
  activeAnalyticsSegment: 'workouts', // 'workouts' or 'meals'
  activeMealsSubTab: 'meals-log', // 'meals-log', 'meals-calendar', 'meals-settings', 'meals-ai'

  // Meals State
  loggedMeals: [],
  mealMetrics: [...DEFAULT_MEAL_METRICS],

  loadMealMetrics() {
    if (this.currentUser) {
      const data = SafeStorage.getItem(`aura-meal-metrics_${this.currentUser.uid}`);
      if (data) {
        try {
          this.mealMetrics = JSON.parse(data);
          return;
        } catch (e) {
          console.error("Failed to parse meal metrics:", e);
        }
      }
    }
    this.mealMetrics = JSON.parse(JSON.stringify(DEFAULT_MEAL_METRICS));
  },

  saveMealMetrics() {
    if (this.currentUser) {
      SafeStorage.setItem(`aura-meal-metrics_${this.currentUser.uid}`, JSON.stringify(this.mealMetrics));
    }
  }
};

