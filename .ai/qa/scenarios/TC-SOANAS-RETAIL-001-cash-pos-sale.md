# Test Scenario: Retail Cash + POS Sale Vertical Slice v1

## Test ID
TC-SOANAS-RETAIL-001

## Category
Soanas Retail

## Priority
High

## Type
API Test (+ UI path documented)

## Description
Validates the first Soanas retail vertical slice: open cash, sell via POS with cash tender, complete sale (SalesOrder + WMS + cash ledger), idempotent replay, close cash with count.

## Prerequisites
- Modules enabled: `soanas_pos`, `soanas_cash`, `sales`, `wms`, `catalog`
- Migrations applied for soanas_cash + soanas_pos
- Admin (or role) with `soanas_cash.*`, `soanas_pos.*`, WMS/Sales/Catalog features

## API paths
- `POST /api/soanas_cash/registers`
- `POST /api/soanas_cash/sessions/open`
- `POST /api/soanas_pos/terminals`
- `POST /api/soanas_pos/transactions`
- `POST /api/soanas_pos/transactions/:id/lines`
- `POST /api/soanas_pos/transactions/:id/checkout`
- `POST /api/soanas_pos/transactions/:id/tenders/cash`
- `POST /api/soanas_pos/transactions/:id/complete` (twice)
- `POST /api/soanas_cash/sessions/close`

## UI path (manual / future Playwright UI)
1. Login
2. `/backend/soanas/cash/registers` create register
3. `/backend/soanas/cash/session` open session
4. `/backend/soanas/pos/terminals` create terminal
5. `/backend/soanas/pos/sell` add product, checkout cash, complete
6. `/backend/soanas/pos/sales` see history
7. Close cash with count + reconciliation

## Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed warehouse + stock + product | Balances available |
| 2 | Create register + open session | Session open |
| 3 | Create terminal linked to register/warehouse | Terminal active |
| 4 | Create DRAFT transaction + line | Totals recalculated server-side |
| 5 | Checkout + cash tender (100.00 for 82.50) | Change 17.50 |
| 6 | Complete | COMPLETED + salesOrderId + receipt |
| 7 | Replay complete | Same salesOrderId, replayed=true, no double stock/cash |
| 8 | Close session with count | Reconciliation persisted |

## Edge Cases
- Insufficient stock with BLOCK policy
- Crash/recovery via `/recover`
- Two terminals competing for last unit (deterministic BLOCK)

## Executable
`packages/soanas-pos/src/modules/soanas_pos/__integration__/TC-SOANAS-RETAIL-001.spec.ts`
