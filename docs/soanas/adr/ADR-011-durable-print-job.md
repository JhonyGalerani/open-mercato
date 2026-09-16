# ADR-011 — Durable PrintJob spooler (Gate 0)

**Date:** 2026-09-16  
**Status:** Accepted  
**Context:** Receipt printing after `completePosSale` was an in-process `MockReceiptPrinter`
call. A printer failure could not be retried independently of the sale, and a successful
print was not durable across process restarts.

## Decision

1. Completing a POS sale persists a `PosPrintJob` (`QUEUED` → `PRINTING` → `PRINTED|FAILED|…`)
   **before** invoking the `ReceiptPrinter` port.
2. Printer failures mark the job `FAILED` and **never** roll back or duplicate the
   `COMPLETED` commercial sale / SalesOrder / WMS / Cash effects.
3. Idempotency key `sale_receipt:<transactionId>` prevents duplicate jobs on complete replay.
4. Hardware Agent (`soanas-hardware`) will later drain the same table / port; until then
   MockReceiptPrinter remains the default DI adapter (ADR-009).

## Consequences

- UI/API can re-attempt failed jobs without reopening the sale
- TD-007 partially closed; ESC/POS adapters remain future work
