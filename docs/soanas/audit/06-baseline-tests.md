# 06 — Baseline Tests

**Date:** 2026-09-15  
**Commit under test:** `30d509eeb481ae4778be771d6c3992042add2d1a`  
**Runner:** local (Node 24.21.0 via nvm; no compose `app` container)  
**Prep:** `yarn install` + `yarn build:packages` (required — Jest resolves package `dist/`)

## Results

| Suite | Status | Notes |
|-------|--------|-------|
| Environment install | PASS | `yarn install` with warnings (peer deps pre-existing) |
| `yarn build:packages` | PASS | 25/25 tasks |
| `yarn workspace @open-mercato/shared test` | PASS | 179 suites, **1931** tests |
| `yarn workspace @open-mercato/core test --testPathPatterns=module-decoupling` | PASS | 12 tests |
| Full monorepo `yarn test` | SKIPPED | Deferred (time); TD-004 |
| Typecheck / lint full | SKIPPED | Deferred to Phase 0 package CI gate |

## Interpretation

Open Mercato foundation is healthy for shared + decoupling invariants before Soanas packages are introduced. Pre-build is mandatory for accurate unit baselines.

## Commands used

```bash
source ~/.nvm/nvm.sh && nvm use 24
yarn install
yarn build:packages
yarn workspace @open-mercato/shared test
yarn workspace @open-mercato/core test --testPathPatterns=module-decoupling
```
