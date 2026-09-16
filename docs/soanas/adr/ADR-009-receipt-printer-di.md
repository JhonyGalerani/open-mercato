# ADR-009 — ReceiptPrinter as a DI port

**Date:** 2026-09-16  
**Status:** Accepted  
**Context:** Completion saga previously hard-wired `new MockReceiptPrinter()`.

## Decision

`ReceiptPrinter` is a **port** resolved from the Awilix request container:

- DI key: `receiptPrinter`
- Default registrar: `packages/soanas-pos/.../di.ts` → `MockReceiptPrinter`
- Future `@open-mercato/soanas-hardware` (or app `di.ts`) re-registers the same key
  with `EscPosReceiptPrinter` / Device Agent adapter

The completion saga (`completePosSale`) calls `resolveReceiptPrinter(ctx)` and never
imports a concrete ESC/POS driver. Printing failure must not invent a second sale;
v1 treats print as best-effort after `COMPLETED` (receipt document is still returned).

## Consequences

- `yarn generate` must pick up `soanas_pos/di.ts`
- Tests may register a fresh mock on the container or rely on the fail-open mock
- Tech debt TD-007: promote print to a durable `PrintJob` once Hardware Agent exists
