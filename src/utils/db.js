import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { state } from "../state.js";
import { SafeStorage } from "./storage.js";
import { showPremiumToast, triggerLocalNotification } from "./helpers.js";

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
  if (!state.cloudSyncEnabled) {
    console.log("Cloud sync is disabled. Skipping save to cloud for:", fieldName);
    return;
  }

  const toggleMap = {
    workoutHistory: 'workoutHistory',
    activeWorkout: 'workoutHistory',
    customLocations: 'customLocations',
    customExercises: 'customExercises',
    favoriteExercises: 'favoriteExercises',
    exerciseDefaults: 'exerciseDefaults',
    futureWorkouts: 'futureWorkouts',
    messages: 'messages'
  };

  const toggleKey = toggleMap[fieldName];
  if (toggleKey && state.cloudSyncToggles && state.cloudSyncToggles[toggleKey] === false) {
    console.log(`Cloud sync is disabled for data type: ${toggleKey}. Skipping save to cloud.`);
    return;
  }

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
  if (!state.cloudSyncEnabled) {
    console.log("Cloud sync is disabled. Skipping uploadLocalDataToCloud.");
    return;
  }
  const data = {};
  const toggles = state.cloudSyncToggles || {};

  if (toggles.workoutHistory !== false) {
    const workoutHistory = SafeStorage.getItem(`aura-workout-history_${uid}`);
    if (workoutHistory) data.workoutHistory = JSON.parse(workoutHistory);
    const activeWorkout = SafeStorage.getItem(`aura-active-workout_${uid}`);
    if (activeWorkout) data.activeWorkout = JSON.parse(activeWorkout);
  }
  if (toggles.customLocations !== false) {
    const customLocations = SafeStorage.getItem(`aura-custom-locations_${uid}`);
    if (customLocations) data.customLocations = JSON.parse(customLocations);
  }
  if (toggles.customExercises !== false) {
    const customExercises = SafeStorage.getItem(`aura-custom-exercises_${uid}`);
    if (customExercises) data.customExercises = JSON.parse(customExercises);
  }
  if (toggles.favoriteExercises !== false) {
    const favoriteExercises = SafeStorage.getItem(`aura-favorite-exercises_${uid}`);
    if (favoriteExercises) data.favoriteExercises = JSON.parse(favoriteExercises);
  }
  if (toggles.exerciseDefaults !== false) {
    const exerciseDefaults = SafeStorage.getItem(`aura-exercise-defaults_${uid}`);
    if (exerciseDefaults) data.exerciseDefaults = JSON.parse(exerciseDefaults);
  }
  if (toggles.futureWorkouts !== false) {
    const futureWorkouts = SafeStorage.getItem(`aura-future-workouts_${uid}`);
    if (futureWorkouts) data.futureWorkouts = JSON.parse(futureWorkouts);
  }
  if (toggles.messages !== false) {
    const messages = SafeStorage.getItem(`aura-messages_${uid}`);
    if (messages) data.messages = JSON.parse(messages);
  }

  const firestoreDb = getDb();
  if (!firestoreDb) return;
  try {
    const docRef = doc(firestoreDb, "users", uid);
    
    // Determine profile and role
    const email = state.currentUser ? state.currentUser.email : "";
    const displayName = state.currentUser ? state.currentUser.displayName : "";
    const role = (email && email.toLowerCase() === 'wbddwd55@gmail.com') ? 'admin' : 'user';
    state.userRole = role;

    await setDoc(docRef, {
      ...data,
      email,
      displayName,
      role,
      updatedAt: Date.now()
    }, { merge: true });
    console.log("Successfully uploaded local cache to Firestore with user profile.");
  } catch (e) {
    console.error("Failed to upload local cache to Firestore:", e);
  }
}

// Merge cloud data with any existing local cache to prevent data loss, then update local state
export async function syncUserSession(uid, isManual = false) {
  if (!state.cloudSyncEnabled && !isManual) {
    console.log("Cloud sync is disabled. Skipping user session sync.");
    const email = state.currentUser ? state.currentUser.email : "";
    state.userRole = (email && email.toLowerCase() === 'wbddwd55@gmail.com') ? 'admin' : 'user';
    return;
  }
  
  setBgSyncing(true, 'מסנכרן תרגילים ונתונים מהענן... ☁️');

  try {
    console.log("Starting cloud data synchronization for uid:", uid);
    if (isManual) {
      showPremiumToast("מסנכרן נתונים מהענן... ☁️", "info");
    }

    const cloudData = await loadUserDataFromCloud(uid);

    // Determine profile and role
    const email = state.currentUser ? state.currentUser.email : "";
    const displayName = state.currentUser ? state.currentUser.displayName : "";
    const role = (email && email.toLowerCase() === 'wbddwd55@gmail.com') ? 'admin' : (cloudData?.role || 'user');
    state.userRole = role;

    if (!cloudData) {
      console.log("No cloud data found. Backup local data to cloud...");
      await uploadLocalDataToCloud(uid);
      if (isManual) {
        showPremiumToast("הסנכרון הראשוני הושלם בהצלחה! ⚡", "success");
      }
      return;
    }

    const localLastSync = parseInt(SafeStorage.getItem(`aura-last-sync_${uid}`) || "0");
    const cloudLastUpdate = cloudData.updatedAt || 0;

    if (cloudLastUpdate > 0 && cloudLastUpdate <= localLastSync && !isManual) {
      console.log("Local data is already up-to-date with cloud. Skipping heavy sync.");
      return;
    }

    if (!isManual) {
      showPremiumToast("מסנכרן שינויים מהענן... ⚡", "info");
    }

    const toggles = state.cloudSyncToggles || {};

    // 1. Merge Workout History
    let mergedHistory = state.workoutHistory;
    if (toggles.workoutHistory !== false) {
      const localHistory = JSON.parse(SafeStorage.getItem(`aura-workout-history_${uid}`) || "[]");
      const cloudHistory = cloudData.workoutHistory || [];
      const historyMap = new Map();
      localHistory.forEach(w => historyMap.set(String(w.id), w));
      cloudHistory.forEach(w => historyMap.set(String(w.id), w));
      mergedHistory = Array.from(historyMap.values()).sort((a, b) => b.date - a.date);
      SafeStorage.setItem(`aura-workout-history_${uid}`, JSON.stringify(mergedHistory));
      state.workoutHistory = mergedHistory;
    }

    // 2. Merge Custom Locations
    let mergedLocs = state.customLocations;
    if (toggles.customLocations !== false) {
      const localLocs = JSON.parse(SafeStorage.getItem(`aura-custom-locations_${uid}`) || "[]");
      const cloudLocs = cloudData.customLocations || [];
      const locsMap = new Map();
      localLocs.forEach(l => locsMap.set(String(l.id), l));
      cloudLocs.forEach(l => locsMap.set(String(l.id), l));
      mergedLocs = Array.from(locsMap.values());
      SafeStorage.setItem(`aura-custom-locations_${uid}`, JSON.stringify(mergedLocs));
      state.customLocations = mergedLocs;
    }

    // 3. Merge Custom Exercises
    let mergedExs = state.customExercises;
    if (toggles.customExercises !== false) {
      const localExs = JSON.parse(SafeStorage.getItem(`aura-custom-exercises_${uid}`) || "[]");
      const cloudExs = cloudData.customExercises || [];
      const exsMap = new Map();
      localExs.forEach(e => exsMap.set(e.name.trim().toLowerCase(), e));
      cloudExs.forEach(e => exsMap.set(e.name.trim().toLowerCase(), e));
      mergedExs = Array.from(exsMap.values());
      SafeStorage.setItem(`aura-custom-exercises_${uid}`, JSON.stringify(mergedExs));
      state.customExercises = mergedExs;
    }

    // 4. Merge Favorite Exercises
    let mergedFavs = state.favoriteExercises;
    if (toggles.favoriteExercises !== false) {
      const localFavs = JSON.parse(SafeStorage.getItem(`aura-favorite-exercises_${uid}`) || "[]");
      const cloudFavs = cloudData.favoriteExercises || [];
      mergedFavs = Array.from(new Set([...localFavs, ...cloudFavs]));
      SafeStorage.setItem(`aura-favorite-exercises_${uid}`, JSON.stringify(mergedFavs));
      state.favoriteExercises = mergedFavs;
    }

    // 5. Merge Exercise Defaults Configurations
    let mergedDefaults = JSON.parse(SafeStorage.getItem(`aura-exercise-defaults_${uid}`) || "{}");
    if (toggles.exerciseDefaults !== false) {
      const localDefaults = mergedDefaults;
      const cloudDefaults = cloudData.exerciseDefaults || {};
      mergedDefaults = { ...localDefaults, ...cloudDefaults };
      SafeStorage.setItem(`aura-exercise-defaults_${uid}`, JSON.stringify(mergedDefaults));
    }

    // 6. Merge Active Workout
    let mergedActive = state.activeWorkout;
    if (toggles.workoutHistory !== false) {
      const localActive = SafeStorage.getItem(`aura-active-workout_${uid}`);
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
    }

    // 7. Merge Future Workouts
    let mergedFuture = [];
    if (toggles.futureWorkouts !== false) {
      const localFuture = JSON.parse(SafeStorage.getItem(`aura-future-workouts_${uid}`) || "[]");
      const cloudFuture = cloudData.futureWorkouts || [];
      const futureMap = new Map();
      localFuture.forEach(f => futureMap.set(String(f.id), f));
      cloudFuture.forEach(f => futureMap.set(String(f.id), f));
      mergedFuture = Array.from(futureMap.values());
      SafeStorage.setItem(`aura-future-workouts_${uid}`, JSON.stringify(mergedFuture));
    }

    // 8. Merge Messages
    let mergedMessages = state.userMessages;
    if (toggles.messages !== false) {
      const localMessages = JSON.parse(SafeStorage.getItem(`aura-messages_${uid}`) || "[]");
      const cloudMessages = cloudData.messages || [];

      // Trigger local push notification on new unread cloud messages (Choice A1)
      const localMsgIds = new Set(localMessages.map(m => String(m.id)));
      const newCloudMessages = cloudMessages.filter(m => !localMsgIds.has(String(m.id)));
      if (newCloudMessages.length > 0) {
        const unreadNew = newCloudMessages.filter(m => !m.read);
        if (unreadNew.length > 0 && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          unreadNew.forEach(m => {
            try {
              triggerLocalNotification(
                m.title || "הודעה חדשה מהמערכת ✉️",
                m.content || "כנס לאפליקציה לצפייה בהודעה."
              );
            } catch(err) {
              console.warn("Failed to fire push notification:", err);
            }
          });
        }
      }

      const messagesMap = new Map();
      localMessages.forEach(m => messagesMap.set(String(m.id), m));
      cloudMessages.forEach(m => messagesMap.set(String(m.id), m));
      mergedMessages = Array.from(messagesMap.values()).sort((a, b) => b.date - a.date);
      SafeStorage.setItem(`aura-messages_${uid}`, JSON.stringify(mergedMessages));
      state.userMessages = mergedMessages;
    }

    // Upload merged data back to the cloud in case local had items the cloud didn't
    if (state.cloudSyncEnabled) {
      const mergedDoc = {
        email,
        displayName,
        role,
        updatedAt: Date.now()
      };
      if (toggles.workoutHistory !== false) {
        mergedDoc.workoutHistory = mergedHistory;
        mergedDoc.activeWorkout = mergedActive;
      }
      if (toggles.customLocations !== false) mergedDoc.customLocations = mergedLocs;
      if (toggles.customExercises !== false) mergedDoc.customExercises = mergedExs;
      if (toggles.favoriteExercises !== false) mergedDoc.favoriteExercises = mergedFavs;
      if (toggles.exerciseDefaults !== false) mergedDoc.exerciseDefaults = mergedDefaults;
      if (toggles.futureWorkouts !== false) mergedDoc.futureWorkouts = mergedFuture;
      if (toggles.messages !== false) mergedDoc.messages = mergedMessages;
      
      const firestoreDb = getDb();
      if (firestoreDb) {
        const docRef = doc(firestoreDb, "users", uid);
        await setDoc(docRef, mergedDoc, { merge: true });
      }
    }

    SafeStorage.setItem(`aura-last-sync_${uid}`, Date.now().toString());

    if (isManual || cloudLastUpdate > localLastSync) {
      showPremiumToast("הסנכרון הושלם! ✨", "success");
    }
  } catch (error) {
    console.error("Error during cloud user sync session:", error);
    if (isManual) {
      showPremiumToast("סנכרון הענן נכשל. עובד במצב לא מקוון.", "error");
    }
  } finally {
    setBgSyncing(false);
  }
}

export async function deleteSpecificCloudCategory(uid, categoryKey) {
  const firestoreDb = getDb();
  if (!firestoreDb) return;
  try {
    const docRef = doc(firestoreDb, "users", uid);
    await setDoc(docRef, {
      [categoryKey]: deleteField(),
      updatedAt: Date.now()
    }, { merge: true });
    console.log(`Successfully deleted category ${categoryKey} from cloud.`);
  } catch (error) {
    console.error(`Failed to delete category ${categoryKey} from cloud:`, error);
  }
}

export async function deleteSpecificCloudItem(uid, categoryKey, itemKey) {
  const cloudData = await loadUserDataFromCloud(uid);
  if (!cloudData || !cloudData[categoryKey]) return;

  const categoryData = cloudData[categoryKey];
  let updatedData;

  if (Array.isArray(categoryData)) {
    updatedData = categoryData.filter(item => String(item.id) !== String(itemKey) && String(item.name).toLowerCase() !== String(itemKey).toLowerCase());
  } else if (typeof categoryData === 'object') {
    updatedData = { ...categoryData };
    delete updatedData[itemKey];
  } else {
    return;
  }

  const firestoreDb = getDb();
  if (!firestoreDb) return;
  try {
    const docRef = doc(firestoreDb, "users", uid);
    await setDoc(docRef, {
      [categoryKey]: updatedData,
      updatedAt: Date.now()
    }, { merge: true });
    console.log(`Successfully deleted item ${itemKey} from category ${categoryKey} in cloud.`);
  } catch (error) {
    console.error(`Failed to delete item ${itemKey} from category ${categoryKey} in cloud:`, error);
  }
}

// Delete all cloud data for the user
export async function deleteCloudDataOnly(uid) {
  const firestoreDb = getDb();
  if (!firestoreDb) {
    throw new Error("Firestore not initialized.");
  }
  const docRef = doc(firestoreDb, "users", uid);
  await deleteDoc(docRef);
  console.log(`Successfully deleted cloud data for user: ${uid}`);
}
