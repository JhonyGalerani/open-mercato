# Soanas — Implementation Status

**Updated:** 2026-09-15  
**Base:** Open Mercato 0.7.0 @ `30d509eeb`  
**Branch:** `cursor/soanas-blueprint-foundation-5019`  
**Strategy:** Retail Vertical Slice first — do **not** open empty packages.

```
Blueprint coverage (IDs): ANALYZED 233 | IMPLEMENTED 52 | TESTED 18 | VALIDATED 0 / 303
Validated (DoD completa): 0%
```

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
| 15 | Concurrent stock contention deterministic | done (policy + lock unit tests; full DB race pending env) |
| 16 | Sales history UI | done |
| 17 | E2E Playwright retail path | in progress (`TC-SOANAS-RETAIL-001` API spec written; needs migrations + ephemeral run) |

**Retail Sale v1:** ~94% (16/17 done; E2E executable pending migrate/ephemeral)  
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
| Migration applied on DB | pending (Ask First) |

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
| Integration API `TC-SOANAS-RETAIL-001` | written; run pending env |
| Hold/resume | not done (not required for slice gate if draft cancel works) |
| Migration applied on DB | pending (Ask First) |

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
