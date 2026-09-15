# 02 — Soanas Existing Code

**Resultado:** não há código Soanas no repositório na data da auditoria.

## Searches performed

| Pattern | Matches |
|---------|---------|
| `soanas` (case-insensitive paths/content) | 0 (pré-docs) |
| `nfce` / `nfc-e` / `nfe` BR SEFAZ | 0 implementação fiscal BR |
| `sangria` | 0 |
| `kds` kitchen display | 0 |
| modules named `pos` | 0 (apenas specs SPEC-022*) |

## Partial / adjacent artifacts (not Soanas)

| Artifact | Path | Relevance |
|----------|------|-----------|
| POS module spec | `.ai/specs/SPEC-022-2026-02-07-pos-module.md` | Proposta genérica POS Mercato — Soanas supersede/alinhar |
| POS tile browsing | `.ai/specs/SPEC-022a-2026-02-09-pos-tile-browsing.md` | UX ideas |
| Financial module spec | `.ai/specs/SPEC-024-*` (se presente) | Financeiro genérico — não BR AR/AP Soanas |
| Checkout package | `packages/checkout` | Pay-link only |
| Payment gateways | `packages/core/src/modules/payment_gateways` | Hub a reutilizar |
| WMS | `packages/core/src/modules/wms` | Estoque base |

## Decision

Tratar o repositório como **greenfield Soanas** sobre **Mercato maduro**. Todo código Soanas nasce após esta auditoria, com rastreabilidade via `BLUEPRINT-COVERAGE.md`.
