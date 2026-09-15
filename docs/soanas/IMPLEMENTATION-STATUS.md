# Soanas — Implementation Status

**Updated:** 2026-09-15  
**Base:** Open Mercato 0.7.0 @ `30d509eeb`  
**Branch:** `cursor/soanas-blueprint-foundation-5019`

```
Coverage (blueprint-coverage.json):
  ANALYZED 250 | IMPLEMENTED 43 | TESTED 9 | VALIDATED 0 / 303
```

## Done

| Milestone | Evidence |
|-----------|----------|
| Audit + coverage + ADRs | `docs/soanas/` |
| `soanas-core` | CNPJ TESTED; POS ACL catalog |
| `soanas-establishments` | FiscalEstablishment CRUD + migration |
| `soanas-cash` | Ledger math TESTED; open session + sangria commands/APIs; migration |

## Cash APIs

- `POST /api/soanas_cash/sessions/open`
- `POST /api/soanas_cash/withdrawals`

## Next

1. Supply + close session + register CRUD UI
2. `soanas-pos` PosTerminal / PosTransaction
3. Continue Blueprint phases
