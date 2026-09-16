# ADR-001 — Soanas as product packages over Open Mercato

**Status:** Accepted  
**Date:** 2026-09-15

## Context

Soanas must be a Brazilian retail/restaurant operational product, not “a POS screen inside Mercato admin”. Open Mercato already provides multi-tenant ERP foundations. Upstream updateability must be preserved.

## Decision

1. Implement Soanas in dedicated workspace packages: `packages/soanas-*` (module ids `soanas_*`).
2. Do **not** add Soanas domain code to `packages/core` unless an upstream extension point is genuinely insufficient (then log `UPSTREAM_MODIFICATION`).
3. Never copy `@open-mercato/enterprise` code.
4. Prefer standalone app wiring via `apps/mercato` modules.ts initially; later `create-mercato-app` Soanas cloud app.
5. Reuse Mercato entities for Product, Customer, SalesOrder, Inventory*; Soanas entities only for missing concepts (CashSession, FiscalDocument, PosTerminal, …).

## Consequences

- Clear package boundary for commercial licensing later.
- Slightly more boilerplate than putting code in core.
- Requires discipline on cross-module ID references and events.
