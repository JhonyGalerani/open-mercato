# Soanas — Code Review Findings (2026-09-15)

Review of `soanas-core`, `soanas-establishments`, `soanas-cash` before completing Cash DoD and starting POS.

**Strategy shift:** prioritize Retail Vertical Slice v1 over package sprawl. See `IMPLEMENTATION-STATUS.md` → Vertical Slices.

## Critical (fixed or fixing in this iteration)

| ID | Issue | Location | Action |
|----|-------|----------|--------|
| REV-001 | Withdrawal approval threshold controlled by client (`maxWithoutApprovalCents` in body) | `soanas-cash/.../commands/cash.ts`, validators | Server-side policy on `CashRegister` |
| REV-002 | Approver not feature-checked (any UUID ≠ operator) | withdrawal command | Require `soanas.pos.approval.manager` / cash approval feature when threshold exceeded |
| REV-003 | `operatorUserId` spoofable via API body | `api/sessions/open`, `api/withdrawals` | Force `auth.sub` |
| REV-004 | Race: concurrent open sessions on same register | session open + migration | Partial unique index + transactional lock |
| REV-005 | Race: concurrent withdrawals exceed balance | withdrawal command | Lock session row / serialize on session |
| REV-006 | Session idempotency without DB unique | migration | Unique `(tenant_id, idempotency_key)` WHERE NOT NULL |
| REV-007 | ACL POS catalog unused by cash routes | `soanas-core` ACL vs cash route features | Keep cash features; alias/document mapping; enforce approval feature |
| REV-008 | Establishment delete without tenant/org scope | `establishments` delete command | Scope by tenantId (+ org when present) |
| REV-009 | Cash events never emitted; no `buildLog` | cash commands | Emit + audit on mutations |
| REV-010 | Soft-delete on movements vs append-only ADR | `CashMovement.deletedAt` | Never soft-delete confirmed movements; reverse only |
| REV-011 | Opening denominations not validated vs float | open session | Use `sumDenominationCents` |
| REV-012 | Coverage marked sangria PIN as TESTED without PIN | coverage JSON | Downgrade notes; only raise with evidence |

## Gaps (Cash DoD — implementing now)

Register/Drawer CRUD, supply, reverse, close, CashCount, blind closing, CashReconciliation, CashApproval, UI, full tests.

## Keep

- bigint cents ledger math
- package isolation from `packages/core`
- establishment CRUD pattern
- CNPJ alfanumérico tests
