# Soanas — Implementation Status

**Updated:** 2026-09-15  
**Base:** Open Mercato 0.7.0 @ `30d509eeb`  
**Branch:** `cursor/soanas-blueprint-foundation-5019`  
**Strategy:** Retail Vertical Slice first — do **not** open empty packages.

```
Blueprint coverage (IDs): ANALYZED 245 | IMPLEMENTED 47 | TESTED 11 | VALIDATED 0 / 303
Validated (DoD completa): 0%
```

## Vertical Slices

Progress = checklist items done / total. **Primary** product metric (not Blueprint %).

### Retail Sale v1

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Cash register exists (CRUD) | done |
| 2 | Cash session opens | done |
| 3 | Product can be added to sale | not started |
| 4 | Sale creates SalesOrder | not started |
| 5 | Inventory is affected correctly | not started |
| 6 | PaymentTender is recorded | not started |
| 7 | Cash ledger is updated on sale | partial (`record_sale` command ready) |
| 8 | PosTransaction completes | not started |
| 9 | Receipt is generated (mock) | partial (cash movement receipt abstract) |
| 10 | Cash session closes | done |
| 11 | Expected vs counted cash reconciles | done |
| 12 | Blind closing works | done |
| 13 | Idempotent completeSale | not started |
| 14 | Recovery after crash mid-complete | not started |
| 15 | Concurrent stock contention deterministic | not started |
| 16 | Sales history UI | not started |
| 17 | E2E Playwright retail path | not started |

**Retail Sale v1:** ~29% (5/17 done; 2 partial)  
**Retail Sale + Pix:** 0%  
**Retail Fiscal NFC-e:** 0%  
**Retail Offline:** 0%  
**Restaurant Table Service:** 0%

## Cash DoD (domain)

| Item | Status |
|------|--------|
| Register CRUD + policy limits | done |
| Drawer CRUD | done (API; UI deferred) |
| Open session + idempotency + unique open | done |
| Withdrawal + dual custody + server limit | done (PIN factor still missing) |
| Supply | done |
| Reverse (contramovimento) | done |
| Cash count | done |
| Blind closing | done |
| Reconciliation + discrepancy | done |
| Approval records | done (create path; no separate approve workflow UI) |
| record_sale movement (for POS) | done |
| Basic UI (registers + session ops) | done |
| Audit buildLog + events | done |
| Unit tests (36) | done |
| Migration v2 applied on DB | pending (Ask First) |

## Priority order (locked)

1. Finish Cash gaps that block POS (done enough to proceed)  
2. Build `soanas-pos`  
3. Integrate POS ↔ Sales ↔ WMS ↔ Cash  
4. Validate first full sale + E2E  
5. External contracts + mocks  
6. Fiscal BR + Pix → Offline → Restaurant → Finance  

## Evidence

- Review: `docs/soanas/audit/07-code-review-findings.md`
- Cash package: `packages/soanas-cash/`
- APIs: `/api/soanas_cash/registers|drawers|sessions/*|withdrawals|supplies|counts|movements/reverse`
- UI: `/backend/soanas/cash/registers`, `/backend/soanas/cash/session`
