# Handoff Report — Dashboard, Calendar, and Analytics Sync (R4) Investigation

## 1. Observation

Direct observations from examining the codebase:

### A. Weekly/Monthly/Last Workout Stats
In `src/workouts/workouts.js`, the function `updateWorkoutDashboardStats` (lines 211–272) is responsible for updating the stats displayed on the main Workouts tab:
```javascript
export function updateWorkoutDashboardStats() {
  if (!state.currentUser) return;

  const history = state.workoutHistory || [];

  // 1. Weekly Workouts (workouts within last 7 days)
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const weeklyCount = history.filter(w => w.date >= oneWeekAgo).length;

  // 2. Total duration in minutes
  const totalMinutes = Math.round(history.reduce((sum, w) => sum + (w.duration || 0), 0) / 60);

  // 3. Monthly Workouts (current calendar month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyCount = history.filter(w => {
    const d = new Date(w.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  // 4. Last workout details
  let lastWorkoutText = "אין";
  if (history.length > 0) {
    const sorted = [...history].sort((a, b) => b.date - a.date);
    const last = sorted[0];
    const diffMs = now - last.date;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    let timeAgo = "";
    if (diffDays === 0) timeAgo = "היום";
    else if (diffDays === 1) timeAgo = "אתמול";
    else if (diffDays === 2) timeAgo = "שלשום";
    else timeAgo = `לפני ${diffDays} ימים`;

    lastWorkoutText = `${last.locationEmoji || '💪'} ${timeAgo}`;
  }

  // Update DOM elements safely
  const weeklyEl = document.getElementById('workout-stats-weekly');
  const minutesEl = document.getElementById('workout-stats-minutes');
  const monthlyEl = document.getElementById('workout-stats-monthly');
  const lastEl = document.getElementById('workout-stats-last');
  const userNameEl = document.getElementById('workout-user-name');
  const quoteEl = document.getElementById('workout-daily-quote');

  if (weeklyEl) weeklyEl.textContent = weeklyCount;
  if (minutesEl) minutesEl.textContent = totalMinutes;
  if (monthlyEl) monthlyEl.textContent = monthlyCount;
  if (lastEl) lastEl.textContent = lastWorkoutText;

  if (userNameEl && state.currentUser) {
    userNameEl.textContent = state.currentUser.displayName || "מתאמן";
  }

  // Set a random Hebrew quote if not already set for this session
  if (quoteEl && !quoteEl.dataset.initialized) {
    const randIdx = Math.floor(Math.random() * HEBREW_QUOTES.length);
    quoteEl.textContent = `"${HEBREW_QUOTES[randIdx]}"`;
    quoteEl.dataset.initialized = "true";
  }
}
```

### B. Personal Record (PR) Calculations
PR calculations happen in multiple places:
1. **Analytics Dashboard (Bezier curve visualization)** in `src/metrics/metrics.js` (lines 176–218) for the selected exercise:
   - **Weight PR**: Calculated as the maximum weight across all completed sets in the queried exercise's history.
   - **One-Rep Max (1RM)**: Uses the **Epley Formula** (`weight * (1 + reps / 30)`) unless `reps === 1` where it simply uses the `weight` value:
     ```javascript
     const oneRM = r === 1 ? w : w * (1 + r / 30);
     if (oneRM > sessionMax1RM) sessionMax1RM = oneRM;
     ```
   - **Total Volume**: Calculated as the sum of `weight * reps` across all completed sets in the exercise's history.
   - Values are updated inside DOM elements:
     - `dashboard-pr-value` (Hebrew: `X ק״ג`)
     - `dashboard-1rm-value` (Hebrew: `Math.round(max1RM) ק״ג`)
     - `dashboard-vol-value` (Hebrew: `totalVolume.toLocaleString() ק״ג`)
2. **Workout Logs View** in `src/metrics/metrics.js` (`renderWorkoutsLog`):
   - Computes overall max weights, reps, and times for all exercises:
     ```javascript
     const maxWeights = {};
     const maxReps = {};
     const maxTimes = {};
     state.workoutHistory.forEach(w => {
       if (!w.exercises) return;
       w.exercises.forEach(ex => {
         if (!ex.sets) return;
         ex.sets.forEach(s => {
           if (s.completed) {
             const weight = parseFloat(s.weight) || 0;
             if (!maxWeights[ex.name] || weight > maxWeights[ex.name]) {
               maxWeights[ex.name] = weight;
             }
             const reps = parseInt(s.reps, 10) || 0;
             if (!maxReps[ex.name] || reps > maxReps[ex.name]) {
               maxReps[ex.name] = reps;
             }
             const time = parseInt(s.time, 10) || 0;
             if (!maxTimes[ex.name] || time > maxTimes[ex.name]) {
               maxTimes[ex.name] = time;
             }
           }
         });
       });
     });
     ```
   - Adds a `🏆 שיא אישי xCount` badge to workouts that match these all-time records.

### C. Calendar & Planner View
In `src/metrics/metrics.js`, `renderCalendarView` (lines 312–501) renders a monthly grid:
- Uses `state.currentCalendarDate` to query month/year.
- Formulates a list of historical completed workouts (via `getFilteredHistory(true)`) and scheduled future workouts (via `getFutureWorkouts()`).
- Injects a grid layout starting with `calendar-day-empty` placeholders matching `firstDayIndex` of the month.
- Injects day cells `calendar-day-cell`. If a cell corresponds to today's date, it gets the `.today` class.
- Inserts a absolute-positioned dot container (`dotsContainer`) at the bottom of the cell containing:
  - Red/Blue/Green dots depending on location (e.g. gym, park, home).
  - Normal style for past workouts, and border stroke for future workouts:
    ```javascript
    let dotClass = 'workout-dot gym';
    if (loc === 'park') dotClass = 'workout-dot park';
    else if (loc === 'home') dotClass = 'workout-dot home';
    dot.className = dotClass;
    ```
- Attaches click event listeners to cell elements having workouts, creating a `custom-calendar-alert-overlay` popover listing past workouts (with "Edit Workout" trigger button) and future workouts (with "Cancel Workout" trigger button).

### D. GitHub-Style Heatmap
In `src/metrics/metrics.js`, `renderHeatmapView` (lines 504–567) builds a 53x7 SVG grid:
- It maps workouts from the last 364 days to a dictionary `workoutsByDateStr` using local ISO strings `YYYY-MM-DD`.
- Renders an SVG grid element containing `rect` blocks representing individual days.
- Rect size is `10` with a gap of `3`.
- Sets cell opacity/color based on workout frequency:
  - 0 workouts: `rgba(255, 255, 255, 0.05)` (dark transparent grey)
  - 1 workout: `#fca5a5` (light pink)
  - 2 workouts: `#f87171` (medium red)
  - 3+ workouts: `#dc2626` (bright red)
- Code excerpt:
  ```javascript
  let color = 'rgba(255, 255, 255, 0.05)';
  if (count === 1) color = '#fca5a5';
  else if (count === 2) color = '#f87171';
  else if (count >= 3) color = '#dc2626';

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', String(week * (rectSize + gap)));
  rect.setAttribute('y', String(day * (rectSize + gap)));
  ...
  rect.setAttribute('fill', color);
  ```
- Tooltips are added via `title` attribute, and mouse hover transitions are configured.

### E. Bezier Curves SVG Graph
In `src/metrics/metrics.js`, `renderExerciseAnalyticsDashboard` (lines 130–309) constructs the regression graph:
- It maps the chronological exercise data to standard (x, y) coords.
- **Scaling Bounds**:
  ```javascript
  const minVal = Math.min(...points.map(p => p.value)) * 0.9;
  const maxVal = Math.max(...points.map(p => p.value)) * 1.1 || 100;
  const valRange = (maxVal - minVal) || 1;
  ```
- **Interpolation Coordinates**:
  ```javascript
  const svgCoords = points.map((p, idx) => {
    const x = points.length > 1 
      ? paddingX + (idx / (points.length - 1)) * (width - 2 * paddingX)
      : width / 2;
    const y = height - paddingY - ((p.value - minVal) / valRange) * (height - 2 * paddingY);
    return { x, y, val: p.value, date: p.date };
  });
  ```
- **Bezier Path Interpolation**: Uses cubic Bezier curves (`C` path notation) based on one-third step offsets:
  ```javascript
  const curr = svgCoords[i];
  const next = svgCoords[i + 1];
  const cpX1 = curr.x + (next.x - curr.x) / 3;
  const cpY1 = curr.y;
  const cpX2 = curr.x + 2 * (next.x - curr.x) / 3;
  const cpY2 = next.y;
  dLine += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
  ```
- Area path closed shape: `dArea = dLine + " L " + last.x + " " + height + " L " + first.x + " " + height + " Z"`.
- Appends:
  - Path element `#chart-area-path` (`d` attribute set to `dArea`).
  - Path element `#chart-line-path` (`d` attribute set to `dLine`).
  - Gridlines `#chart-gridlines`: 3 horizontal dashed SVG `line` elements drawn dynamically at `y = paddingY + (i / 2) * (height - 2 * paddingY)`.
  - Points group `#chart-points-group`: svg `circle` elements with hover triggers.

---

## 2. Logic Chain

1. **DOM Coupling**: The metrics rendering functions directly access the DOM via `document.getElementById` and `document.createElement`/`document.createElementNS`. They do not use a virtual DOM abstraction. Therefore, they *require* a DOM environment (like JSDOM) to run without throwing errors.
2. **Dimension Scaling**: `renderExerciseAnalyticsDashboard` relies on `chartSvg.clientWidth` and `chartSvg.clientHeight` to dynamically fit the SVG paths. If these properties are not defined (returning `0` in standard JSDOM), it falls back to standard values `320` and `160`. To test custom bounds scaling, we must override these properties via `Object.defineProperty` on the mocked elements.
3. **Storage Persistence**: State variables (like `state.workoutHistory`) are restored from storage inside `initWorkouts` using `SafeStorage.getItem` with dynamic user-based keys (`aura-workout-history_${uid}`). To populate or test these dependencies, we must either mock global `localStorage` or wrap the `SafeStorage` object calls.
4. **Interactive SVG Points**: Points are generated as SVG `circle` elements and appended to `#chart-points-group`. They have stateful hover event listeners. To test them, we must simulate events (`mouseover`, `mouseout`) and verify that attributes (`r` radius) change.

---

## 3. Caveats

- **No layout engine in JSDOM**: Real rendering measurements (`getBoundingClientRect()`, actual font size overflows) cannot be verified inside a standard node/JSDOM testing script. It only verifies DOM tree generation.
- **Firebase integration**: Cloud sync logic is bypassed. We assume offline/local storage state flow.

---

## 4. Conclusion

To successfully write tests for `src/metrics/metrics.js` and stats in `src/workouts/workouts.js`, developers must:
1. Initialize a JSDOM environment in Jest/Vitest.
2. Build mock container elements matching specific DOM selectors.
3. Overwrite `clientWidth`/`clientHeight` layout properties on mock canvas/SVG wrappers.
4. Stub `localStorage` or `SafeStorage` functions.
5. Provide a global mock of the `state` container.

---

## 5. Verification Method

To verify these rendering logics, inspect the following mock configuration and test script skeleton. This code can be used to set up a test environment (e.g. using Jest/Vitest):

### A. Mocking DOM Structure Setup
Before running the metric functions, inject target elements into JSDOM's document body:

```javascript
// Setup template matching index.html
document.body.innerHTML = `
  <!-- Workouts Tab Quick Stats -->
  <span id="workout-stats-weekly">0</span>
  <span id="workout-stats-minutes">0</span>
  <span id="workout-stats-monthly">0</span>
  <span id="workout-stats-last">אין</span>
  <span id="workout-user-name">מתאמן</span>
  <div id="workout-daily-quote"></div>

  <!-- Analytics Tab Elements -->
  <div id="chart-no-data" style="display: none;"></div>
  <span id="dashboard-pr-value">--</span>
  <span id="dashboard-1rm-value">--</span>
  <span id="dashboard-vol-value">--</span>
  
  <svg id="bezier-chart-svg" style="width: 320px; height: 160px;">
    <path id="chart-area-path" d=""></path>
    <path id="chart-line-path" d=""></path>
    <g id="chart-points-group"></g>
    <g id="chart-gridlines"></g>
  </svg>

  <div id="calendar-days-grid"></div>
  <div id="calendar-month-label"></div>
  <svg id="heatmap-svg"></svg>
`;
```

### B. Mocking SVG Client Dimensions
Override JSDOM's default `0` client bounds:

```javascript
const chartSvg = document.getElementById('bezier-chart-svg');
Object.defineProperty(chartSvg, 'clientWidth', { configurable: true, value: 500 });
Object.defineProperty(chartSvg, 'clientHeight', { configurable: true, value: 250 });
```

### C. Storage & State Mock Configuration
Populate standard workout logs and user details:

```javascript
import { state } from '../src/state.js';
import { SafeStorage } from '../src/utils/storage.js';

// Setup Mock State
state.currentUser = { uid: 'test-user-123', displayName: 'אורח' };
state.selectedAnalyticsExercise = 'לחיצת חזה עם מוט';
state.activeChartType = '1rm';
state.currentCalendarDate = new Date('2026-05-15');

// Mock Workouts Data
state.workoutHistory = [
  {
    id: 'w1',
    date: new Date('2026-05-10T10:00:00').getTime(),
    duration: 3600, // 60 minutes
    location: 'gym',
    locationName: 'חדר כושר',
    locationEmoji: '🏋️‍♂️',
    exercises: [
      {
        name: 'לחיצת חזה עם מוט',
        category: 'חזה',
        sets: [
          { weight: '60', reps: '10', completed: true },
          { weight: '70', reps: '8', completed: true }
        ]
      }
    ]
  },
  {
    id: 'w2',
    date: new Date('2026-05-12T10:00:00').getTime(),
    duration: 2700, // 45 minutes
    location: 'park',
    locationName: 'פארק',
    locationEmoji: '🌳',
    exercises: [
      {
        name: 'לחיצת חזה עם מוט',
        category: 'חזה',
        sets: [
          { weight: '80', reps: '5', completed: true }
        ]
      }
    ]
  }
];

// Mock SafeStorage for Calendar scheduled workouts
const futureWorkoutsMock = [
  {
    id: 'f1',
    date: '2026-05-20',
    time: '18:00',
    location: 'gym',
    reminderMinutes: 15
  }
];
SafeStorage.setItem(`aura-future-workouts_${state.currentUser.uid}`, JSON.stringify(futureWorkoutsMock));
```

### D. Assertion Testing Flow
Verify outputs in test scripts:

```javascript
// Test 1: updateWorkoutDashboardStats
updateWorkoutDashboardStats();
console.assert(document.getElementById('workout-stats-weekly').textContent === '2', 'Weekly workouts count is incorrect');
console.assert(document.getElementById('workout-stats-minutes').textContent === '105', 'Minutes calculation is incorrect');

// Test 2: renderExerciseAnalyticsDashboard (Bezier graph)
renderExerciseAnalyticsDashboard();

// Peak values verification:
// Max weight is 80 (from workout 2)
// One rep max for set 2 in w1: 70 * (1 + 8/30) = 88.66. For w2: 80 * (1 + 5/30) = 93.33. Max 1RM = 93
console.assert(document.getElementById('dashboard-pr-value').textContent === '80 ק״ג', 'PR value did not match max weight');
console.assert(document.getElementById('dashboard-1rm-value').textContent === '93 ק״ג', '1RM calculation did not match Epley formula');

// SVG Elements confirmation
const linePath = document.getElementById('chart-line-path');
const areaPath = document.getElementById('chart-area-path');
console.assert(linePath.getAttribute('d').includes('C'), 'Bezier path string does not contain Cubic control points command (C)');
console.assert(areaPath.getAttribute('d').endsWith('Z'), 'Area path string is not correctly closed with Z command');

// Test 3: renderCalendarView
renderCalendarView();
const calendarDays = document.getElementById('calendar-days-grid').children;
// Ensure dots are appended
const daysWithDots = Array.from(calendarDays).filter(day => day.querySelector('.workout-dot'));
console.assert(daysWithDots.length === 3, 'Calendar did not append workout dots to 3 workout days');
```
