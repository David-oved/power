# Scope: E2E Testing Track

## Architecture
- Opaque-box, requirement-driven E2E test suite.
- Test runner: Node.js built-in `node:test` framework with mock-DOM or jsdom if installable, running offline in CODE_ONLY mode.
- Target features: Active workout view, set logging modal, snapping rest timer, dashboard & analytics.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Test Infra Setup | Create `TEST_INFRA.md` and implement testing harness | None | IN_PROGRESS |
| 2 | Tier 1 Tests | Implement 5+ Feature Coverage tests per major feature | M1 | PLANNED |
| 3 | Tier 2 & 3 Tests | Implement Boundary, Corner, and Cross-Feature interaction tests | M2 | PLANNED |
| 4 | Tier 4 Tests | Implement real-world workload application scenarios | M3 | PLANNED |
