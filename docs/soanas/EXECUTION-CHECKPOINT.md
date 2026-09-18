# Soanas — Execution Checkpoint

**Atualizado:** 2026-09-18  
**Uso:** retomada exata pelo próximo agente. Não substituir por planos genéricos.

## Identidade git

| Campo | Valor |
|-------|-------|
| Branch de trabalho | `cursor/soanas-e0-e1-local-foundation-f03d` |
| HEAD | `1c4547109` |
| Base / dependência | PR #5 `cursor/soanas-gates01-validation-desktop-foundation-9e05` @ `670c535e39706aca7d4a71b13b5803a754b4bb1a` |
| `main` observada | `8d38af7cafa6abd327c19cf7d36b0e2b7fb9a800` |
| PR desta linha | https://github.com/JhonyGalerani/open-mercato/pull/6 (draft; base = branch do PR #5) |
| PR dependência | https://github.com/JhonyGalerani/open-mercato/pull/5 — **aberto**; sem merge automático |
| SHA `e435f84fb` | **Ausente no remoto** — não depender |

## Etapa atual

| Campo | Valor |
|-------|-------|
| Etapa | **E0 CLOUD_VERIFIED** (docs/stages); **E1 IN_PROGRESS / parcial CLOUD_VERIFIED** (foundations) |
| Próximo foco | E1 aprofundar boot app+Postgres local + auth path; depois E2 lacunas (transfer/reserva) ou E3 outbox |
| IDs | Sem promoção VALIDATED; stage map cobre 303 |

## Implementações nesta branch

- Docs SSOT E0–E9, inventory, checkpoint, release checklist, ADR-013
- `stage-assignment.json` + `yarn soanas:check-stages`
- `yarn soanas:validate-local` (quick/full)
- `@open-mercato/soanas-desktop` journal + shell contract
- STORE_CREDIT operacionalmente desabilitado (TD-015)
- sync-status usa branch git atual (não hardcode legado)

## Testes (esta sessão)

| Suite | Resultado | Evidência |
|-------|-----------|-----------|
| `soanas:validate-local` quick | PASS ~12s | `audit/09-e0-e1-foundation.md` |
| Gate 0/1 E2E | **não reexecutado** | usar `audit/08` como histórico |
| Instalador Windows | N/A | **instalador ainda não produzido/validado** |

## Bloqueios

| Item | Estado |
|------|--------|
| Windows .exe/.msi | LOCAL_VALIDATION_PENDING |
| Offline sync completo | PENDING (E3) |
| NFC-e homologação | BLOCKED_EXTERNAL |
| Hardware físico | LOCAL_VALIDATION_PENDING |

## Próxima ação concreta

1. `yarn soanas:validate-local --full` quando for revalidar Gates no Postgres efêmero.
2. E1+: script de boot local que sobe app apontando UI para 127.0.0.1 e prova health + journal (sem URL cloud).
3. E2: transfer/reserva estoque; não reabilitar STORE_CREDIT sem ledger.
4. Não misturar sync amplo de upstream sem necessidade.

```bash
git checkout cursor/soanas-e0-e1-local-foundation-f03d
yarn soanas:validate-local
yarn soanas:check-stages
```
