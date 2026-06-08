import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore,
  doc,
  getDoc,
  setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from "../state.js";
import { SafeStorage } from "./storage.js";
import { showPremiumToast } from "./helpers.js";

let db = null;

// Initialize and get the Firestore instance with persistent cache support
export function getDb() {
  if (!db && state.app) {
    try {
      db = initializeFirestore(state.app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
      console.log("Firestore initialized successfully with persistent local cache.");
    } catch (e) {
      console.warn("Failed to initialize Firestore with persistent cache (possibly already initialized or unsupported):", e);
      try {
        db = getFirestore(state.app);
        console.log("Firestore initialized with standard getFirestore.");
      } catch (err) {
        console.error("Failed to get Firestore instance:", err);
      }
    }
  }
  return db;
}

// Save a specific field to the user's cloud document
export async function saveFieldToCloud(fieldName, data) {
  if (!state.currentUser) return;
  const uid = state.currentUser.uid;
  const firestoreDb = getDb();
  if (!firestoreDb) {
    console.warn("Firestore not initialized. Cannot sync field:", fieldName);
    return;
  }
  try {
    const docRef = doc(firestoreDb, "users", uid);
    await setDoc(docRef, {
      [fieldName]: data,
      updatedAt: Date.now()
    }, { merge: true });
    console.log(`Successfully synced ${fieldName} to Firestore.`);
  } catch (error) {
    console.error(`Failed to sync ${fieldName} to Firestore:`, error);
  }
}

// Fetch the user's entire cloud document
export async function loadUserDataFromCloud(uid) {
  const firestoreDb = getDb();
  if (!firestoreDb) {
    console.warn("Firestore not initialized. Cannot fetch user document.");
    return null;
  }
  try {
    const docRef = doc(firestoreDb, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("Failed to load user data from Firestore:", error);
  }
  return null;
}

// Upload local data to the cloud (used on first sync if cloud is empty)
export async function uploadLocalDataToCloud(uid) {
  const workoutHistory = SafeStorage.getItem(`aura-workout-history_${uid}`);
  const customLocations = SafeStorage.getItem(`aura-custom-locations_${uid}`);
  const customExercises = SafeStorage.getItem(`aura-custom-exercises_${uid}`);
  const favoriteExercises = SafeStorage.getItem(`aura-favorite-exercises_${uid}`);
  const exerciseDefaults = SafeStorage.getItem(`aura-exercise-defaults_${uid}`);
  const activeWorkout = SafeStorage.getItem(`aura-active-workout_${uid}`);
  const futureWorkouts = SafeStorage.getItem(`aura-future-workouts_${uid}`);

  const data = {};
  if (workoutHistory) data.workoutHistory = JSON.parse(workoutHistory);
  if (customLocations) data.customLocations = JSON.parse(customLocations);
  if (customExercises) data.customExercises = JSON.parse(customExercises);
  if (favoriteExercises) data.favoriteExercises = JSON.parse(favoriteExercises);
  if (exerciseDefaults) data.exerciseDefaults = JSON.parse(exerciseDefaults);
  if (activeWorkout) data.activeWorkout = JSON.parse(activeWorkout);
  if (futureWorkouts) data.futureWorkouts = JSON.parse(futureWorkouts);

  if (Object.keys(data).length > 0) {
    const firestoreDb = getDb();
    if (!firestoreDb) return;
    try {
      const docRef = doc(firestoreDb, "users", uid);
      await setDoc(docRef, {
        ...data,
        updatedAt: Date.now()
      }, { merge: true });
      console.log("Successfully uploaded local cache to Firestore.");
    } catch (e) {
      console.error("Failed to upload local cache to Firestore:", e);
    }
  }
}

// Merge cloud data with any existing local cache to prevent data loss, then update local state
export async function syncUserSession(uid) {
  try {
    console.log("Starting cloud data synchronization for uid:", uid);
    showPremiumToast("מסנכרן נתונים מהענן... ☁️", "info");

    const cloudData = await loadUserDataFromCloud(uid);
    if (!cloudData) {
      console.log("No cloud data found. Backup local data to cloud...");
      await uploadLocalDataToCloud(uid);
      showPremiumToast("הסנכרון הראשוני הושלם בהצלחה! ⚡", "success");
      return;
    }

    // 1. Merge Workout History
    const localHistory = JSON.parse(SafeStorage.getItem(`aura-workout-history_${uid}`) || "[]");
    const cloudHistory = cloudData.workoutHistory || [];
    const historyMap = new Map();
    localHistory.forEach(w => historyMap.set(String(w.id), w));
    cloudHistory.forEach(w => historyMap.set(String(w.id), w));
    const mergedHistory = Array.from(historyMap.values()).sort((a, b) => b.date - a.date);
    SafeStorage.setItem(`aura-workout-history_${uid}`, JSON.stringify(mergedHistory));
    state.workoutHistory = mergedHistory;

    // 2. Merge Custom Locations
    const localLocs = JSON.parse(SafeStorage.getItem(`aura-custom-locations_${uid}`) || "[]");
    const cloudLocs = cloudData.customLocations || [];
    const locsMap = new Map();
    localLocs.forEach(l => locsMap.set(String(l.id), l));
    cloudLocs.forEach(l => locsMap.set(String(l.id), l));
    const mergedLocs = Array.from(locsMap.values());
    SafeStorage.setItem(`aura-custom-locations_${uid}`, JSON.stringify(mergedLocs));
    state.customLocations = mergedLocs;

    // 3. Merge Custom Exercises
    const localExs = JSON.parse(SafeStorage.getItem(`aura-custom-exercises_${uid}`) || "[]");
    const cloudExs = cloudData.customExercises || [];
    const exsMap = new Map();
    localExs.forEach(e => exsMap.set(e.name.trim().toLowerCase(), e));
    cloudExs.forEach(e => exsMap.set(e.name.trim().toLowerCase(), e));
    const mergedExs = Array.from(exsMap.values());
    SafeStorage.setItem(`aura-custom-exercises_${uid}`, JSON.stringify(mergedExs));
    state.customExercises = mergedExs;

    // 4. Merge Favorite Exercises
    const localFavs = JSON.parse(SafeStorage.getItem(`aura-favorite-exercises_${uid}`) || "[]");
    const cloudFavs = cloudData.favoriteExercises || [];
    const mergedFavs = Array.from(new Set([...localFavs, ...cloudFavs]));
    SafeStorage.setItem(`aura-favorite-exercises_${uid}`, JSON.stringify(mergedFavs));
    state.favoriteExercises = mergedFavs;

    // 5. Merge Exercise Defaults Configurations
    const localDefaults = JSON.parse(SafeStorage.getItem(`aura-exercise-defaults_${uid}`) || "{}");
    const cloudDefaults = cloudData.exerciseDefaults || {};
    const mergedDefaults = { ...localDefaults, ...cloudDefaults };
    SafeStorage.setItem(`aura-exercise-defaults_${uid}`, JSON.stringify(mergedDefaults));

    // 6. Merge Active Workout
    const localActive = SafeStorage.getItem(`aura-active-workout_${uid}`);
    let mergedActive = null;
    if (cloudData.activeWorkout) {
      mergedActive = cloudData.activeWorkout;
    } else if (localActive) {
      try { mergedActive = JSON.parse(localActive); } catch(e) {}
    }
    if (mergedActive) {
      SafeStorage.setItem(`aura-active-workout_${uid}`, JSON.stringify(mergedActive));
    } else {
      SafeStorage.removeItem(`aura-active-workout_${uid}`);
    }
    state.activeWorkout = mergedActive;

    // 7. Merge Future Workouts
    const localFuture = JSON.parse(SafeStorage.getItem(`aura-future-workouts_${uid}`) || "[]");
    const cloudFuture = cloudData.futureWorkouts || [];
    const futureMap = new Map();
    localFuture.forEach(f => futureMap.set(String(f.id), f));
    cloudFuture.forEach(f => futureMap.set(String(f.id), f));
    const mergedFuture = Array.from(futureMap.values());
    SafeStorage.setItem(`aura-future-workouts_${uid}`, JSON.stringify(mergedFuture));

    // Upload merged data back to the cloud in case local had items the cloud didn't
    const mergedDoc = {
      workoutHistory: mergedHistory,
      customLocations: mergedLocs,
      customExercises: mergedExs,
      favoriteExercises: mergedFavs,
      exerciseDefaults: mergedDefaults,
      activeWorkout: mergedActive,
      futureWorkouts: mergedFuture,
      updatedAt: Date.now()
    };
    
    const firestoreDb = getDb();
    if (firestoreDb) {
      const docRef = doc(firestoreDb, "users", uid);
      await setDoc(docRef, mergedDoc, { merge: true });
    }

    showPremiumToast("הנתונים סונכרנו בהצלחה! ⚡", "success");
  } catch (error) {
    console.error("Error during cloud user sync session:", error);
    showPremiumToast("סנכרון הענן נכשל. עובד במצב לא מקוון.", "error");
  }
}
