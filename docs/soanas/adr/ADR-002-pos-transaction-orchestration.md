# ADR-002 — PosTransaction orchestrates; SalesOrder remains commercial truth

**Status:** Accepted  
**Date:** 2026-09-15

## Context

Blueprint §106 forbids duplicating SalesOrder as the POS aggregate.

## Decision

`PosTransaction` is an operational orchestrator holding references:

- `salesOrderId`
- `cashSessionId`
- `terminalId`
- `paymentTenderIds[]`
- `fiscalDocumentId`
- `syncState`

Commercial totals, lines, and customer commitment live on Mercato `SalesOrder` (created/updated by POS commands). Cash and fiscal are separate aggregates.

## Consequences

- More moving parts; clearer audit and reconciliation.
- Cancellation/refund use compensating commands across domains.
