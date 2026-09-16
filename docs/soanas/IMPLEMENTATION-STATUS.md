# Soanas — Implementation Status

**Updated:** 2026-09-16  
**Base:** Open Mercato 0.7.0 @ `30d509eeb`  
**Branch:** `cursor/soanas-retail-gate-validation-4347`  
**Strategy:** Retail Vertical Slice first — do **not** open empty packages.

<!-- soanas:derived-counts:start -->
```
Blueprint coverage (IDs): ANALYZED 229 | IMPLEMENTED 36 | TESTED 18 | VALIDATED 20 / 303
Validated (DoD completa): 6.6%
```
<!-- soanas:derived-counts:end -->

## Vertical Slices

Progress = checklist items done / total. **Primary** product metric (not Blueprint %).

### Retail Sale v1

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Cash register exists (CRUD) | done |
| 2 | Cash session opens | done |
| 3 | Product can be added to sale | done |
| 4 | Sale creates SalesOrder | done (via `completePosSale`) |
| 5 | Inventory is affected correctly | done (WMS adjust in saga) |
| 6 | PaymentTender is recorded | done (CASH) |
| 7 | Cash ledger is updated on sale | done (`record_sale`) |
| 8 | PosTransaction completes | done |
| 9 | Receipt is generated (mock) | done (`MockReceiptPrinter`) |
| 10 | Cash session closes | done |
| 11 | Expected vs counted cash reconciles | done |
| 12 | Blind closing works | done |
| 13 | Idempotent completeSale | done (planner + orphan order adopt + unit tests) |
| 14 | Recovery after crash mid-complete | done (`/recover` + checkpoints) |
| 15 | Concurrent stock contention deterministic | done (API race on ephemeral Postgres + `PESSIMISTIC_WRITE`) |
| 16 | Sales history UI | done |
| 17 | E2E Playwright retail path | done (`TC-SOANAS-RETAIL-001` + CONCURRENCY + RECOVERY + UI-001 green on ephemeral Postgres) |

**Retail Sale v1:** VALIDATED (17/17) — ephemeral migrate + API + concurrency + recovery + browser UI  
**Retail Sale + Pix:** 0%  
**Retail Fiscal NFC-e:** 0%  
**Retail Offline:** 0%  
**Restaurant Table Service:** 0%

## Cash DoD (domain)

| Item | Status |
|------|--------|
| Register/Drawer/Session/Supply/Sangria/Reverse | done |
| Count + blind close + reconciliation + approvals | done |
| Basic UI | done |
| Unit tests (36) | done |
| Migration applied on DB | done (ephemeral `open-mercato-soanas-ephemeral`) |

## POS DoD (domain)

| Item | Status |
|------|--------|
| PosTerminal CRUD + UI | done |
| PosTransaction + lines + state machine | done |
| PaymentTender CASH + change | done |
| completePosSale saga (Sales+WMS+Cash) | done |
| Recovery / replay | done |
| Mock receipt | done |
| Sell + history UI | done |
| Unit tests (51) | done |
| Integration API `TC-SOANAS-RETAIL-001` + UI-001 | green on ephemeral Postgres |
| Hold/resume | done (`HELD` status + hold/resume API; `TC-SOANAS-POS-HOLD-001` green; transfer/stock reserve pending) |
| Migration applied on DB | done (ephemeral `open-mercato-soanas-ephemeral`) |

## Priority order (locked)

1. ~~Finish Cash~~  
2. ~~Build `soanas-pos` + integrations~~  
3. Apply migrations in disposable DB + run `TC-SOANAS-RETAIL-001`  
4. Mark Retail Vertical Slice v1 VALIDATED only after E2E green  
5. External contracts + mocks (Pix/TEF/Fiscal) — **only after** step 4  

## Evidence

- Review: `docs/soanas/audit/07-code-review-findings.md`
- ADR-007: `docs/soanas/adr/ADR-007-pos-completion-saga.md`
- Cash: `packages/soanas-cash/`
- POS: `packages/soanas-pos/`
- APIs cash: `/api/soanas_cash/...`
- APIs POS: `/api/soanas_pos/...`
- UI: `/backend/soanas/cash/*`, `/backend/soanas/pos/*`
- Scenario: `.ai/qa/scenarios/TC-SOANAS-RETAIL-001-cash-pos-sale.md`
