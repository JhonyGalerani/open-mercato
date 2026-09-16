# ADR-007 — POS completion saga across Sales / WMS / Cash

**Date:** 2026-09-15  
**Status:** Accepted  
**Context:** Retail Vertical Slice v1 — `completePosSale` crosses module boundaries.

## Decision

There is **no global distributed transaction** across Sales, WMS, and Soanas Cash.

`completePosSale` is an **idempotent saga / orchestrator** owned by `soanas_pos`:

1. Validate PosTransaction state + tenders (local)
2. Persist state transition → `COMPLETING` (local)
3. Create/confirm `SalesOrder` + `SalesPayment` via Sales commands (idempotent by `externalReference` / metadata `sourceTransactionId`)
4. Apply WMS inventory adjust (idempotent by movement key / referenceId)
5. Record cash_sale movement on open CashSession (idempotent by `soanas_cash.movements.record_sale`)
6. Mark PosTransaction `COMPLETED` + write recovery checkpoint clear
7. Emit receipt via DI `receiptPrinter` port (default `MockReceiptPrinter`, ADR-009)

Each step records progress on `PosRecoveryState` / `PosStateTransition` with a shared **correlationId**.

On retry: skip steps already completed (detect by stored salesOrderId / movement refs / cash movement idempotency key).

On mid-failure: leave status `FAILED_RECOVERABLE` or `PAYMENT_PENDING` / `SYNC_PENDING` as appropriate; **never** auto-recharge or invent a second tender.

Compensation (v1):

- If Sales created but WMS/Cash failed → keep SalesOrder id on transaction; retry remaining steps only.
- Do **not** auto-cancel SalesOrder on partial failure without operator action (audit trail).

Local MikroORM transactions cover only Soanas POS entity writes. Cross-module steps are sequential commandBus calls.

## Consequences

- Integration tests must cover replay / crash / concurrency.
- Operators need recovery UI for stuck `FAILED_RECOVERABLE`.
- Fiscal / Pix later plug into the same orchestrator as additional steps (not fake fiscal now).
