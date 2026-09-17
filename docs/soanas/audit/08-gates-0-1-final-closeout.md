# Gates 0/1 — Final Closeout

**Date:** 2026-09-17  
**PR:** https://github.com/JhonyGalerani/open-mercato/pull/5  
**Branch:** `cursor/soanas-gates01-validation-desktop-foundation-9e05`  
**Base:** `origin/main`  
**Observed HEAD before this closeout:** `5e4ca8e2319df523d825aeff780fe25d4b503d39`

## Commits created in this closeout

| SHA | Summary |
|-----|---------|
| `b96ca1989` | Dual custody session operator, org-scoped idempotency, PrintJob claim/fencing |
| `38bd5ce8b` | Recovery failure lookups scoped by tenant+org |
| `0e5288fd6` | Expose movement `operatorUserId`; widen Gate 0/1 Playwright discovery |
| `a3595e529` | Defer stock BLOCK when warehouse has no balance rows (recovery path) |
| `5336231f1` | Tender idempotent replay without pessimistic lock outside a transaction |
| `fb34172e9` | Restore empty-ledger stock BLOCK; recovery seed/drain/reseed fixture |

## Findings corrected

1. **Supply dual custody used wrong operator** — sangria/suprimento now compare against `session.operatorUserId`; approver is only `ctx.auth.sub`.
2. **Org isolation / idempotency** — cash movements/sessions, POS tenders/approvals/transactions, PrintJob, recovery failure path: lookups use `tenantId + organizationId`; cross-org unique collisions → safe 409.
3. **PrintJob concurrency** — atomic claim (`QUEUED|FAILED` or abandoned `PRINTING` past lease) → fencing via `attempts` → finalize only by token owner.
4. **Sessions/current** — movements expose `operatorUserId` for ADR-012 observability.
5. **Tender unique-violation replay** — uses non-locking scoped read outside DB transactions (avoids MikroORM 500).
6. **Recovery DRAFT stuck** — recovery integration now seeds stock for BLOCK line-add, drains on-hand before complete so WMS allocation shortfalls after the sales checkpoint, then reseeds for `/recover`.

## Isolation scan (Gate 0/1 packages)

Audited `soanas-cash`, `soanas-pos`, `soanas-payments-br` (+ Sales/WMS call sites in `completePosSale`):

- CashMovement / CashSession / CashApproval / CashRegister totals and idempotency: org-scoped.
- PosTransaction / PaymentTender / PosPrintJob / PosRecoveryState / PosApprovalRequest: org-scoped.
- PixCharge: preserved prior `tenant + org + txid/idempotency` treatment.
- Unique indexes that remain `(tenant, key)` return conflict on cross-org collision (never foreign org rows).

### False positives noted

- `captureAfter` / audit `findOne({ id })` after a successful write of a known local id.
- CRUD update `findOne({ id })` followed by scoped update with tenant+org (existing register/drawer/terminal pattern).

## Tests executed (ephemeral PostgreSQL via testcontainers)

| Suite | Result |
|-------|--------|
| Units soanas-cash | 42 passed |
| Units soanas-pos | 74 passed |
| Units soanas-payments-br | 28 passed |
| `yarn soanas:check-coverage` | A229 I40 T27 V7 (honest, unchanged) |
| Typecheck + build soanas packages | OK |
| Playwright `--list` (specialized config) | **18 tests / 8 files** (includes cash + Pix outside soanas-pos) |
| `yarn soanas:validate-migrations` | OK (RETAIL-001) |
| TC-SOANAS-RETAIL-001 | passed |
| TC-SOANAS-RETAIL-CONCURRENCY | passed |
| TC-SOANAS-RETAIL-RECOVERY | passed |
| TC-SOANAS-GATE0-MULTILOC-001 | passed |
| TC-SOANAS-GATE0-PRINTJOB-001 | passed |
| TC-SOANAS-GATE0-CASH-APPROVAL-001 | 3/3 passed |
| TC-SOANAS-GATE0-PIX-SCOPE-001 | passed |
| TC-SOANAS-POS-MANUAL-TENDERS-001 | 9/9 passed |

**Ephemeral DB:** Docker testcontainers PostgreSQL (local Node 24 runner). Migrations not applied to shared/dev/prod.

**Rollback:** project has MikroORM `down()` on Gate 0/1 migrations; not exercised in this closeout (no shared DB). Documented honestly.

## Coverage

```
ANALYZED: 229 | IMPLEMENTED: 40 | TESTED: 27 | VALIDATED: 7 | Total: 303
```

VALIDATED was **not** increased merely because suites passed.

## Open reviews

- Prior Bugbot findings (dual custody, tender replay lock, session operator identity, empty-ledger stock bypass): **corrigidos no código**; check `Cursor Bugbot` em `655c95833` concluiu **success** sem novos comentários após `fb34172e9`.
- Comentários antigos do Bugbot permanecem no PR como histórico; o comportamento apontado já não está presente no HEAD.

## Remaining limitations

- Gate 2 **not started** (restaurant/KDS/offline/hardware/TEF/desktop out of scope).
- Receipt printer remains Mock DI (ADR-009); durable claim/fencing is in-DB only.
- Payments remain manual; Pix mock is opt-in; no TEF / acquirer auto-confirm.
- ALLOW stock still coerced to BLOCK until WMS negative-stock contract exists.

## Declaration

Gate 2 was **not** started. No automatic merge.

**Status:** PR #5 pronto para revisão final.
