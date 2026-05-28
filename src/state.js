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
  activeAnalyticsSegment: 'workouts', // 'workouts', 'calendar', 'exercises', 'ai'

  // Meals State
  loggedMeals: [],
};
