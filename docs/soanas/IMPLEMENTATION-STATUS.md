# Soanas — Implementation Status

**Updated:** 2026-09-15  
**Base:** Open Mercato 0.7.0 @ `30d509eeb`  
**Branch:** `cursor/soanas-blueprint-foundation-5019`

```
Overall progress: ~0.7%   (TESTED+VALIDATED / 303 IDs; foundation IMPLEMENTED ~12%)
```

| Domain group | Status |
|--------------|--------|
| Audit / docs / ADRs / coverage | Done (Phase 0.0) |
| `soanas-core` package | Scaffolded — CNPJ validators TESTED; ACL POS catalog IMPLEMENTED |
| `soanas-establishments` | FiscalEstablishment entity + CRUD API + commands + migration + unit tests |
| POS / Cash / Fiscal / Offline / … | ANALYZED only |

## Evidence (Phase 0.1–0.2)

| Item | Path |
|------|------|
| CNPJ validator | `packages/soanas-core/src/lib/cnpj.ts` |
| POS ACL features | `packages/soanas-core/src/modules/soanas_core/acl.ts` |
| FiscalEstablishment | `packages/soanas-establishments/src/modules/soanas_establishments/data/entities.ts` |
| API | `/api/soanas_establishments/establishments` |
| Commands | `soanas_establishments.establishments.create\|update\|delete` |
| Migration | `Migration20260915090000_soanas_fiscal_establishments.ts` |
| Tests | `soanas-core` 4 PASS; `soanas-establishments` validators 2 PASS |

## Next

Phase 0.3+ — admin UI for establishments, feature toggles wiring, catalog/CRM BR CF seeds, then Phase 1.1 PosTerminal.
