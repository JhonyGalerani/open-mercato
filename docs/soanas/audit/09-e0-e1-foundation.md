# 09 — E0/E1 foundation increment (2026-09-18)

**Branch:** `cursor/soanas-e0-e1-local-foundation-f03d`  
**Base dependência:** PR #5 head `670c535e39706aca7d4a71b13b5803a754b4bb1a`  
**main:** `8d38af7cafa6abd327c19cf7d36b0e2b7fb9a800`  
**Runner:** Cursor Cloud local — Node v24.21.0; Docker available (quick suite did not re-run Gate E2E).

## Diferenciação de evidências

| Evidência | Quando | Escopo |
|-----------|--------|--------|
| `audit/08-gates-0-1-final-closeout.md` | 2026-09-17 | Gate 0/1 Postgres efêmero — **anterior** |
| Este arquivo | 2026-09-18 | E0 SSOT + E1 desktop foundations + STORE_CREDIT disable — **nova** |

## Checks novos (esta sessão)

| Check | Exit | Notas |
|-------|------|-------|
| `yarn soanas:sync-status` | 0 | Contadores A229/I40/T27/V7 |
| `yarn soanas:check-stages` | 0 | 303 IDs → E0–E9 (E8=0 sem IDs de packaging) |
| `yarn soanas:check-coverage` | 0 | + exige `packages/soanas-desktop` |
| `yarn soanas:validate-local` (quick) | 0 | units pos 75, cash 42, payments-br 28, core 4, establishments 2, desktop 4 |
| Gate 0/1 E2E / migrations `--full` | **não reexecutado** nesta sessão | Docker OK; usar evidência 08 como histórica até rerun |

## Entregas

- ROADMAP canônico E0–E9 + mapeamento Gates/Phases
- EXECUTION-CHECKPOINT, RELEASE-CHECKLIST, PACKAGE-INVENTORY, stage-assignment
- ADR-013 store-local topology (Postgres loja + terminais LAN; Electron shell)
- `@open-mercato/soanas-desktop`: journal durável + rejeição de origem cloud + testes de reinício
- STORE_CREDIT desabilitado operacionalmente (UI + API) — TD-015
- Scripts: `soanas:check-stages`, `soanas:validate-local`; sync-status não força mais branch antiga

## Não entregue

- **instalador ainda não produzido/validado**
- Offline-first completo (E3) — journal E1 ≠ sync outbox Postgres
- Electron empacotado / Windows VM
- Homologação fiscal/hardware

## Coverage

Sem promoção VALIDATED. Continuam A229 I40 T27 V7 / 303.
