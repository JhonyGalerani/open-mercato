# Soanas Cash Domain (Phase 1 preview spec)

**Date:** 2026-09-15  
**Status:** Draft — implement in Phase 1  
**Coverage IDs:** CASH-*

## TLDR

Append-only cash ledger with sessions, withdrawals (sangria), supplies, drawer opens, blind close, reconciliation, approvals, offline sync hooks.

## Problem

Mercato has no cash register domain. Retail cannot operate without mathematical cash integrity.

## Scope

Entities: CashRegister, CashDrawer, CashSession, CashMovement, CashCount, CashReconciliation, CashApproval.  
Commands: open/close session, createWithdrawal, createSupply, reverseMovement, openDrawerNoSale.  
Full Blueprint §13–19 depth for sangria.

## Out of scope

Bank GL accounting (soanas_finance), TEF settlement.

## Architecture

See ADR-003. Movements immutable; expected balance derived.

## State machine (session)

`CLOSED → OPENING → OPEN → CLOSING → CLOSED | RECONCILIATION_REQUIRED`

## Events

`soanas.cash.session.opened|closed`, `soanas.cash.withdrawal.created`, `soanas.cash.supply.created`, `soanas.cash.discrepancy.detected`

## Changelog

| Date | Note |
|------|------|
| 2026-09-15 | Draft for Phase 1 |
