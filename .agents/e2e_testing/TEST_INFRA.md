# E2E Test Infra: AuraApp Premium Training System

## Test Philosophy
- Opaque-box, requirement-driven. Exercises the app's components, state, and UI flows without depending on private/hidden implementation details where possible.
- Offline-ready, zero-dependency. Runs inside Node.js using `node:test` and a custom mocked browser DOM environment (mocking window, document, localStorage, event handling, etc.).
- Methodology: Category-Partition (feature coverage) + Boundary Value Analysis (extreme values) + Pairwise Interaction Testing (cross-feature) + Real-World Workload Testing (end-to-end workout session flows).

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Active Workout UI | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Log Inputs Modal | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 3 | Snapping Rest Timer | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 4 | Dashboard & Analytics | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |

## Test Architecture
- **Test Runner**: Node.js built-in `node:test` framework. Invoke via `node .agents/e2e_testing/run-tests.js`.
- **Harness & Mock DOM**: A custom Javascript bootstrap script (`harness.js`) that constructs a mock DOM tree from `index.html` structure, simulates browser events, and stub/mock modules.
- **Pass/Fail Semantics**: Assertions using Node's `node:assert` library. Clean execution (exit code 0) signifies a successful run.
- **Directory Layout**:
  ```
  .agents/e2e_testing/
  ├── TEST_INFRA.md        # Test infrastructure plan (this file)
  ├── TEST_READY.md        # Test suite status & coverage summary
  ├── run-tests.js         # Test runner & bootstrap script
  ├── test-harness.js      # Mock DOM & Firebase helper library
  ├── tests/               # Test suites
  │   ├── tier1_features.test.js
  │   ├── tier2_boundaries.test.js
  │   ├── tier3_combinations.test.js
  │   └── tier4_workloads.test.js
  └── progress.md          # Execution progress
  ```

## Detailed Test Cases

### Tier 1: Feature Coverage (>=5 cases per feature)

#### Feature 1: Active Workout UI
- **T1_F1_01**: Start workout transitioning from idle to active workout view.
- **T1_F1_02**: Add exercise dynamically from the exercise picker sheet to active workout list.
- **T1_F1_03**: Complete an exercise, verifying visual feedback (completion state, progress bar update).
- **T1_F1_04**: Delete an exercise from the active list, verifying list updates and progress bar recalculation.
- **T1_F1_05**: Complete workout, transitioning back to dashboard and resetting active states.

#### Feature 2: Log Inputs Modal
- **T2_F2_01**: Open Log Inputs bottom sheet for a specific set in active workout.
- **T2_F2_02**: Adjust weight input via the range slider and increment/decrement buttons.
- **T2_F2_03**: Adjust reps input via range slider and adjust buttons.
- **T2_F2_04**: Toggle and adjust time-based inputs (seconds) via dedicated sliders.
- **T2_F2_05**: Save set logs, confirming values are updated on the exercise card.

#### Feature 3: Snapping Rest Timer
- **T3_F3_01**: Trigger rest timer bubble visibility on set completion.
- **T3_F3_02**: Adjust rest duration from rest config modal (30s, 60s, 90s, custom).
- **T3_F3_03**: Simulate rest timer completion, triggering notifications and hiding bubble.
- **T3_F3_04**: Drag rest timer bubble and verify snapping physics (closest edge with 16px offset).
- **T3_F3_05**: Cancel/stop rest timer manually.

#### Feature 4: Dashboard & Analytics
- **T4_F4_01**: Verify weekly and monthly workout counters update dynamically on the dashboard tab.
- **T4_F4_02**: Check that the 'Last Workout' display details change correctly based on history.
- **T4_F4_03**: Verify PR (Personal Record) calculations for weight, 1RM, and total volume.
- **T4_F4_04**: Render muscle volume split graph and check proportional bar heights.
- **T4_F4_05**: Add scheduled future workout and check calendar view indicators.

### Tier 2: Boundary & Corner Cases (>=5 cases per feature)

#### Feature 1: Active Workout UI
- **T2_F1_01**: Finish workout with zero exercises logged (empty list boundary).
- **T2_F1_02**: Add multiple instances of the same exercise.
- **T2_F1_03**: Deleting all exercises mid-workout and verifying progress bar stays at 0%.
- **T2_F1_04**: Triggering start workout when an active workout is already running (resume behavior).
- **T2_F1_05**: High count of exercises added to list (overflow viewport test).

#### Feature 2: Log Inputs Modal
- **T2_F2_01**: Set weight to minimum boundary (0 kg) and maximum boundary (250 kg).
- **T2_F2_02**: Set reps to minimum boundary (0 reps) and maximum boundary (50 reps).
- **T2_F2_03**: Set time to minimum boundary (0 seconds) and maximum boundary (600 seconds).
- **T2_F2_04**: Validate fractional weight entries (e.g., 62.5 kg).
- **T2_F2_05**: Close modal without saving (cancel operation) and verify previous set values are preserved.

#### Feature 3: Snapping Rest Timer
- **T3_F3_01**: Start rest timer with minimum boundary (5s custom rest) and maximum boundary (600s custom rest).
- **T3_F3_02**: Position bubble at exact coordinates representing screen corners, testing snapping to 16px margin.
- **T3_F3_03**: Start rest timer and let it tick down multiple times, checking accuracy.
- **T3_F3_04**: Toggle custom rest seconds input with invalid values (negative, non-numeric, overflow).
- **T3_F3_05**: Start new rest timer while previous rest timer is already active.

#### Feature 4: Dashboard & Analytics
- **T4_F4_01**: Perform analytics calculation with empty workout history.
- **T4_F4_02**: Calculate 1RM with 0 reps (boundary division safety).
- **T4_F4_03**: Filter history with start date after end date (date range sanity check).
- **T4_F4_04**: Schedule future workout on past date and verify warning or fallback handling.
- **T4_F4_05**: Volume calculations with extremely high weight/rep combinations (integer overflow safety).

### Tier 3: Cross-Feature Combinations (Pairwise Coverage)
- **T3_COMB_01**: Logging a set with custom time (F2) triggers snapping rest timer (F3) with custom duration.
- **T3_COMB_02**: Completing workout with multiple exercise types (F1) synchronizes dashboard stats (F4) and renders corresponding muscle volume splits.
- **T3_COMB_03**: Scheduling a workout (F4) and initiating active tracking (F1) updates scheduled status.
- **T3_COMB_04**: Modifying weights in log modal (F2) immediately recalculates PRs in analytics view (F4).
- **T3_COMB_05**: Stopping rest timer (F3) while logging a new set (F2) resolves timer states correctly without console errors.

### Tier 4: Real-World Application Scenarios (Workload Testing)
- **T4_WORK_01**: Full training session flow: User signs in, views empty dashboard, starts a Gym workout, adds "Bench Press", logs 3 sets (60kg x 10, 70kg x 8, 80kg x 6) with rest timers ticking in between, completes workout, views updated dashboard counters, checks Bench Press analytics graph for new PR, and signs out.

## Coverage Thresholds
- **Tier 1**: ≥20 total test cases (5 cases × 4 features)
- **Tier 2**: ≥20 total test cases (5 cases × 4 features)
- **Tier 3**: ≥5 cross-feature combination test cases
- **Tier 4**: ≥1 comprehensive multi-step application workload scenario
- **Total E2E test cases**: 46 cases
