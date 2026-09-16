# ADR-008 — Cross-module WMS consumption for Retail POS

**Date:** 2026-09-16  
**Status:** Accepted  
**Context:** Gate 0 review of Retail Sale v1 — `completePosSale` WMS step.

## Decision

### 1. Public write contract

POS **writes** stock only through `commandBus.execute('wms.inventory.adjust', …)`.
There is no Soanas-owned inventory table and no second stock engine.

### 2. Sales-order reference semantics

WMS `referenceType: 'so'` means **Sales Order**.

- `referenceId` MUST be the `salesOrderId`
- POS identity travels in `metadata.sourceTransactionId` (and related metadata)

Never set `referenceType=so` with `referenceId=<PosTransaction.id>`.

### 3. Multi-location consumption (Retail v1)

`wms.inventory.adjust` is one location per call. When aggregate stock covers the sale
across locations, POS plans a deterministic split via `planLocationDeductions`:

1. Available = onHand − reserved − allocated
2. Sort: available desc → locationId asc → lotId → serialNumber
3. Greedy take `min(remaining, available)` per bucket
4. Never overdraw a single location when another still has stock
   (A=3, B=4, sale=5 → B:-4 + A:-1)

Shortage remainder is only placed on a fallback location when the terminal
`stockPolicy` is `ALLOW` (operator already approved negative / unmanaged stock).

### 4. Temporary ORM read coupling

Until WMS exposes a public multi-location consume command, POS reads
`InventoryBalance` / `WarehouseLocation` through a single helper
(`loadVariantBalanceBuckets`) to **plan** adjustments. This is:

- justified (no public consume-split API yet)
- minimized (one helper, writes still via commandBus)
- covered by unit tests on the pure planner
- tracked as tech debt TD-006 for replacement when WMS Phase 3 / consume ships

Orphan `SalesOrder` adoption by `externalReference` also uses a scoped ORM read
inside the same EM as the local POS checkpoint — QueryEngine is not a substitute
for mid-saga transactional recovery.

## Consequences

- Integration / E2E must assert movement `referenceId === salesOrderId`
- Concurrent stock races still depend on WMS adjust transaction + POS stock policy
- Hardware / fiscal packages must not invent alternate stock writers
