# Soanas — Implementation Status

**Updated:** 2026-09-18  
**Base:** Open Mercato 0.7.0 @ `8d38af7ca` (main)  
**Branch de trabalho:** `cursor/soanas-e0-e1-local-foundation-f03d` (baseado no head do PR #5)  
**Dependência:** PR #5 @ `670c535e3` — Gates 0/1 closeout (sem merge automático)  
**Estratégia canônica:** ROADMAP **E0–E9**. Etapa atual: E0→E1.  
**PR:** https://github.com/JhonyGalerani/open-mercato/pull/5  
**Gate 0/1 (legado → E2 parcial):** Postgres efêmero — **não** implica offline-first nem instalador Windows.  
**Instalador:** ainda não produzido/validado.

<!-- soanas:derived-counts:start -->
```
Blueprint coverage (IDs): ANALYZED 229 | IMPLEMENTED 40 | TESTED 27 | VALIDATED 7 / 303
Validated (DoD completa): 2.3%
```
<!-- soanas:derived-counts:end -->

## Gate 0/1 validation evidence (2026-09-17)

Runner: local Node 24 + Docker (storage-driver `vfs`) + PostgreSQL efêmero via testcontainers.  
**Não** promove contadores de coverage; pagamentos permanecem manuais (maquininha externa, sem TEF).  
Closeout definitivo: `docs/soanas/audit/08-gates-0-1-final-closeout.md`.

| Check | Result |
|-------|--------|
| `yarn install --immutable` | OK |
| `yarn soanas:check-coverage` | OK — A229 I40 T27 V7 (inalterado) |
| `@open-mercato/soanas-pos` unit | 74 passed |
| `@open-mercato/soanas-cash` unit | 42 passed |
| `@open-mercato/soanas-payments-br` unit | 28 passed |
| typecheck soanas-pos / cash / payments-br | OK |
| Playwright specialized `--list` | 18 tests / 8 files (cash + Pix + retail + Gate0/1) |
| Docker disponível | OK (`docker info`) |
| `yarn soanas:validate-migrations` | OK — migrations Soanas + `TC-SOANAS-RETAIL-001` green |
| Gate 0 E2E (`TC-SOANAS-GATE0-*`) | OK — CASH-APPROVAL 3/3, PIX-SCOPE, MULTILOC, PRINTJOB |
| Retail concurrency / recovery | OK |
| Gate 1 E2E (`TC-SOANAS-POS-MANUAL-TENDERS-001`) | OK — 9/9 (split tenders manuais; sem TEF) |

### Fixes do closeout definitivo (após HEAD `5e4ca8e23`)

1. Dual custody ADR-012: sangria **e** suprimento usam `session.operatorUserId`; aprovador só `ctx.auth.sub`
2. Idempotência/isolamento org em cash, tenders, approvals, transactions, PrintJob, recovery
3. PrintJob: claim atômico + lease + fencing `attempts`
4. `sessions/current` expõe `operatorUserId` nos movimentos
5. Replay de tender sem `PESSIMISTIC_WRITE` fora de transação
6. Recovery integration: seed → drain on-hand before complete → reseed + recover (sem bypass de stock policy)
7. Playwright Gate 0/1 descobre specs em cash e payments-br

### Fixes desta rodada (commit remoto `e435f84fb` **não existia**; equivalentes + follow-ups)

1. `PosApprovalRequest` create: `createdAt`/`updatedAt` explícitos (typecheck MikroORM)
2. `yarn soanas:validate-migrations`: `--filter TC-SOANAS-RETAIL-001` (não `--` nu)
3. `soanas-establishments`: `EntityManager` de `@mikro-orm/postgresql` + undo recreate completo
4. `dynamicLoader`: `turbopackIgnore` em probes FS (Next 16 tracing)
5. CLI ephemeral: rejeita `JWT_SECRET` placeholder do `.env` em `NODE_ENV=production`
6. Gate0 fixture: skip WMS adjust quando `initialStock=0`
7. Pix audit snapshot: `centsToString` (PG bigint → JSON; evita 500 em `pix.create`)
8. `MockPixProvider` process-scoped + fallback DB no `pix.get` (create→get cross-request)

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
| 17 | E2E Playwright retail path | done (`TC-SOANAS-RETAIL-001` revalidado 2026-09-16 em Postgres efêmero) |

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
| Unit tests (38) | done |
| Migration applied on DB | done (ephemeral Postgres 2026-09-16) |

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
| Unit tests (68) | done |
| Integration API `TC-SOANAS-RETAIL-001` + UI-001 | green on ephemeral Postgres |
| Hold/resume | done (`HELD` status + hold/resume API; `TC-SOANAS-POS-HOLD-001` green; transfer/stock reserve pending) |
| Migration applied on DB | done (ephemeral Postgres 2026-09-16) |

## Priority order (locked)

1. ~~Finish Cash~~  
2. ~~Build `soanas-pos` + integrations~~  
3. ~~Apply migrations in disposable DB + run `TC-SOANAS-RETAIL-001`~~  
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
