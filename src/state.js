import { SafeStorage } from "./utils/storage.js";

// AuraApp Shared State Container
export const state = {
  // Authentication State
  currentUser: null,
  userRole: 'user',
  isSensitiveDataVisible: false,
  firebaseEnabled: false,
  firebaseAuthResolved: false,
  app: null,
  auth: null,
  googleProvider: null,

  // Admin & User Communication State
  userMessages: [],
  usersList: [],
  feedbacksList: [],

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
  editingActiveExerciseIndex: null,
  configuringExerciseDefaults: null,

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
  activeChartTypeTab3: '1rm',
  activeInspectorMetric: 'weight',
  activeLogsSubView: 'calendar',
  currentCalendarDate: new Date(),
  filterSortSelection: 'date-desc',
  activeAnalyticsSegment: 'workouts', // Only workouts is supported now

  // Location-based Run Tracker State
  isTrackingRun: false,
  runWatchPositionId: null,
  runTrackerState: "run", // "run" | "walk" | "rest"
  runTrackerSegments: [],
  runTrackerMetrics: {
    totalDistance: 0,
    runDistance: 0,
    walkDistance: 0,
    totalDuration: 0,
    runDuration: 0,
    walkDuration: 0,
    restDuration: 0
  }
};

