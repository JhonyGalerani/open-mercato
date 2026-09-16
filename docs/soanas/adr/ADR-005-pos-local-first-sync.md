# ADR-005 — POS local-first with outbox sync

**Status:** Accepted  
**Date:** 2026-09-15

## Context

POS must survive cloud outages and process crashes without losing sales or duplicating payments/fiscal/stock.

## Decision

- Local encrypted DB holds session, catalog slice, cart, cash, outbox.
- Every mutating offline op creates `OfflineOutboxEntry` with UUID + idempotency key + sequence.
- Sync engine: incremental cursors, batching, backoff, conflict policies **per domain** (never blind LWW for money/fiscal/stock).
- Device Agent handles hardware; browser does not talk raw to all devices.

## Consequences

- Phase 3 is large; Phase 1 may run online-first with interfaces ready.
- Contract versioning between POS client and Cloud is mandatory (ARCH-013).
