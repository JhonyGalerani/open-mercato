# ADR-003 — Cash is an append-only ledger

**Status:** Accepted  
**Date:** 2026-09-15

## Context

Cash register balance must never be a mutable scalar without history. Sangria/supply/closing require full audit.

## Decision

- Expected cash derives from `CashMovement` ledger:
  `opening + cashSales + supplies - withdrawals - cashRefunds - otherOut = expected`
- Confirmed movements are immutable; corrections via reversing movements.
- Denominations, approvals, destinations, and print artifacts are first-class fields/events.

## Consequences

- Closing reconciliation is deterministic and testable.
- Slightly more storage; required for retail trust.
