# Soanas POS Domain (Phase 1 preview spec)

**Date:** 2026-09-15  
**Status:** Draft — implement in Phase 1  
**Coverage IDs:** POS-*, PAY-001, DISC-002

## TLDR

Operational POS with PosTerminal, PosTransaction orchestrator, fast UI, hold/resume, links to SalesOrder + CashSession + tenders + fiscal.

## Problem

SPEC-022 unimplemented; checkout is not a register. Need resilient retail selling surface.

## Scope

Terminal registry, sale UI, cart ops, totals, hold, state machine §40, keyboard/touch UX.

## Out of scope

Full offline engine (Phase 3), NFC-e (Phase 2), restaurant tabs (Phase 4).

## Architecture

ADR-002, ADR-005 (interfaces early), ADR-006.

## State machine

`DRAFT → CHECKOUT → PAYMENT_PENDING → PAID → FISCAL_PENDING → COMPLETED`  
Failures: `PAYMENT_UNKNOWN`, `FISCAL_REJECTED`, `SYNC_PENDING`, `CANCEL_PENDING`, `REFUND_PENDING`

## Changelog

| Date | Note |
|------|------|
| 2026-09-15 | Draft for Phase 1 |
