/**
 * proposed_workout_test.js
 * Offline integration test suite for AuraApp Workout Module.
 * Runs in zero-dependency Node.js environment using standard node:test runner.
 * 
 * Usage:
 *   node --import ./proposed_mock_env.js proposed_workout_test.js
 */

import test from 'node:test';
import assert from 'node:assert';
import './proposed_mock_env.js'; // Ensure DOM environment is mocked

// Resolve ESM imports dynamically or directly
import { state } from '../../src/state.js';
import { SafeStorage } from '../../src/utils/storage.js';
import { 
  initWorkouts, 
  startNewWorkout, 
  startRestTimer, 
  stopRestTimer,
  openSetLoggingModal,
  clearWorkoutSession
} from '../../src/workouts/workouts.js';

test('AuraApp Workout Flow Tests', async (t) => {
  
  // Set up mock authenticated user in state
  state.currentUser = {
    uid: 'user123_test',
    displayName: 'אלי כהן',
    email: 'eli.cohen@gmail.com'
  };

  await t.test('1. initWorkouts - Load or create initial state structures', () => {
    // Clear storage before init
    SafeStorage.removeItem(`aura-all-exercises_${state.currentUser.uid}`);
    SafeStorage.removeItem(`aura-workout-history_${state.currentUser.uid}`);

    initWorkouts();

    // Verify default exercises were loaded into storage
    const storedExercises = SafeStorage.getItem(`aura-all-exercises_${state.currentUser.uid}`);
    assert.ok(storedExercises, 'Exercises should be initialized in storage');
    assert.ok(JSON.parse(storedExercises).length > 0, 'Exercise list shouldn\'t be empty');

    // Verify empty history
    assert.deepStrictEqual(state.workoutHistory, [], 'History should start empty');
  });

  await t.test('2. startNewWorkout - Transition from Idle to Active', () => {
    // Get mock elements to assert visibility changes
    const idleView = document.getElementById('workout-idle-view');
    const activeView = document.getElementById('workout-active-view');
    const timerDisplay = document.getElementById('active-timer');

    // Trigger Gym Workout
    startNewWorkout('gym');

    // Verify state mutation
    assert.ok(state.activeWorkout, 'Active workout object should be created');
    assert.strictEqual(state.activeWorkout.location, 'gym', 'Location code should match');
    assert.strictEqual(state.activeWorkout.locationName, 'חדר כושר', 'Location display name should translate correctly');
    assert.ok(Array.isArray(state.activeWorkout.exercises), 'Active exercises list must be initialized');

    // Verify storage has the active workout (anti-data-loss protection)
    const storedActive = SafeStorage.getItem(`aura-active-workout_${state.currentUser.uid}`);
    assert.ok(storedActive, 'Active workout state must be written to SafeStorage');
  });

  await t.test('3. Add Exercise & Configure Metrics', () => {
    // Simulate selection of exercise
    state.selectedExerciseForAdding = 'לחיצת חזה עם מוט';

    // Simulate metric selection confirmed (3 sets of weight & reps)
    const newEx = {
      name: state.selectedExerciseForAdding,
      metrics: ['weight', 'reps'],
      metricType: 'both',
      restTime: 90,
      targetSetsCount: 3,
      completed: false,
      sets: []
    };

    state.activeWorkout.exercises.push(newEx);
    SafeStorage.setItem(`aura-active-workout_${state.currentUser.uid}`, JSON.stringify(state.activeWorkout));

    assert.strictEqual(state.activeWorkout.exercises.length, 1, 'Exercise should be added to the workout');
    assert.strictEqual(state.activeWorkout.exercises[0].name, 'לחיצת חזה עם מוט');
  });

  await t.test('4. openSetLoggingModal (R2) & Log Completed Sets', () => {
    const activeEx = state.activeWorkout.exercises[0];

    // Open logging modal for the first set
    openSetLoggingModal(activeEx);

    assert.strictEqual(state.currentLoggingExercise.name, 'לחיצת חזה עם מוט', 'Current exercise pointer should be set');
    assert.strictEqual(state.currentLoggingSetIndex, 0, 'Logging index should start at 0 (set 1)');

    // Simulate input adjustments (Sliders)
    const weightSlider = document.getElementById('weight-range-slider');
    const repsSlider = document.getElementById('reps-range-slider');
    weightSlider.value = 80; // 80kg
    repsSlider.value = 8;   // 8 reps

    // Simulate confirm button click handler logic
    const loggedSet = {
      reps: parseInt(repsSlider.value, 10),
      weight: parseFloat(weightSlider.value),
      time: 0,
      completed: true
    };

    activeEx.sets.push(loggedSet);
    
    // Check next incomplete set index calculation
    const nextIncompleteIdx = activeEx.sets.findIndex(s => !s.completed);
    const nextSetIndex = nextIncompleteIdx !== -1 ? nextIncompleteIdx : activeEx.sets.length;

    assert.strictEqual(activeEx.sets.length, 1, 'One set should be logged');
    assert.strictEqual(nextSetIndex, 1, 'Next set to log should be index 1 (set 2)');
    assert.strictEqual(activeEx.sets[0].weight, 80, 'Logged weight should match input value');
    assert.strictEqual(activeEx.sets[0].reps, 8, 'Logged reps should match input value');
  });

  await t.test('5. Rest Timer Engine control', () => {
    // Start 90s timer
    startRestTimer(90);

    assert.strictEqual(state.restTimerSecondsLeft, 90, 'Timer duration should be configured');
    assert.ok(state.restTimerInterval, 'Timer interval must be running');

    // Terminate timer
    stopRestTimer();
    assert.strictEqual(state.restTimerInterval, null, 'Timer interval must be cleared');
  });

  await t.test('6. Finish and Log Workout to history', () => {
    // Finish workout manually, simulating user action
    const sanitizedExercises = state.activeWorkout.exercises.filter(
      ex => ex.sets.some(s => s.completed)
    );

    const log = {
      id: Date.now(),
      date: Date.now(),
      location: state.activeWorkout.location,
      locationName: state.activeWorkout.locationName,
      locationEmoji: state.activeWorkout.locationEmoji,
      duration: 600, // 10 minutes (mocked)
      exercises: sanitizedExercises
    };

    state.workoutHistory.push(log);
    SafeStorage.setItem(`aura-workout-history_${state.currentUser.uid}`, JSON.stringify(state.workoutHistory));
    
    // Reset active workout state
    state.activeWorkout = null;
    SafeStorage.removeItem(`aura-active-workout_${state.currentUser.uid}`);

    // Verify history written
    const savedHistory = JSON.parse(SafeStorage.getItem(`aura-workout-history_${state.currentUser.uid}`));
    assert.strictEqual(savedHistory.length, 1, 'History storage should contain logged workout');
    assert.strictEqual(savedHistory[0].exercises[0].name, 'לחיצת חזה עם מוט');
    assert.strictEqual(state.activeWorkout, null, 'Active workout state should be reset to null');
  });
});
