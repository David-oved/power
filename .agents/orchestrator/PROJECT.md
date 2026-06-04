# Project: Power Redesign

## Architecture
- **Front-end**: Single Page Application (SPA) using vanilla HTML, CSS, and JS.
- **State**: Managed in `src/state.js`.
- **Workouts**: Logic for active tracking and templates in `src/workouts/workouts.js`.
- **Metrics**: Data visualization and records in `src/metrics/metrics.js`.
- **Styling**: `style.css` containing app variables and layout rules.
- **Database/Backend**: Firebase integration (config in `firebase-config.js`).

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|---|---|---|---|---|
| 1 | E2E Test Suite Setup | Design & implement E2E testing framework & initial tests (E2E Track) | None | IN_PROGRESS | 907c479d-b34b-41b0-91c2-a64bc4e7a28d |
| 2 | Premium Active Workout UI (R1) | Redesign `#workout-active-view` with dynamic exercise cards, lava glow progress bar | None | IN_PROGRESS | 4b356a2d-7521-4d8d-9bbb-9ac8fa634859 |
| 3 | Advanced Log Inputs (R2) | Implement iOS-style bottom sheet modal (`#set-log-modal`) with responsive sliders and weight/reps/time settings | M2 | PLANNED | [TBD] |
| 4 | Snapping Rest Timer (R3) | Interactive glassmorphic snapping rest timer bubble with physics and loading animation | M2 | PLANNED | [TBD] |
| 5 | Dashboard & Analytics Sync (R4) | Integrate weekly/monthly stats and update metrics charts for time/PR metrics | M3, M4 | PLANNED | [TBD] |
| 6 | E2E Verification & Hardening | Run E2E test suite (Tiers 1-4) and perform Tier 5 Adversarial Coverage Hardening | M1, M2, M3, M4, M5 | PLANNED | [TBD] |

## Code Layout
- `index.html` - HTML structure & views.
- `style.css` - Global and component styles.
- `app.js` - Main application controller.
- `src/state.js` - State and DB synchronization.
- `src/workouts/workouts.js` - Active workout tracker logic.
- `src/metrics/metrics.js` - Charts and history page logic.

## Interface Contracts
### Active Workout view to Set Log Modal
- Event listener triggers `#set-log-modal` display.
- Inputs support: `weight` (number), `reps` (number), `time` (seconds, range slider 0-600s).

### Rest Timer Integration
- Floating Rest Timer UI component with snapping physics.
- Starts when a set is logged; counts down resting duration.
- Shows circular countdown SVG progress.
