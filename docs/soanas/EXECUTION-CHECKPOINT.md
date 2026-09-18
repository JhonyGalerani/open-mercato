# Soanas — Execution Checkpoint

**Atualizado:** 2026-09-18  
**Uso:** retomada exata pelo próximo agente.

## Identidade git

| Campo | Valor |
|-------|-------|
| Branch | `cursor/soanas-e0-e1-local-foundation-f03d` |
| HEAD testado | `4ec8ecff4` (`yarn soanas:validate-local --full` PASS) |
| PR | https://github.com/JhonyGalerani/open-mercato/pull/6 |
| Dependência | PR #5 @ `670c535e3` — aberto; sem merge automático |

## Etapa

| Campo | Valor |
|-------|-------|
| E0 | CLOUD_VERIFIED |
| E1 | CLOUD_VERIFIED para fatia operacional (boot+Postgres+auth+UI+SIGKILL restart); **IN_PROGRESS** para Electron empacotado / instalador |
| Coverage | Sem promoção VALIDATED |

## Evidências

- Nova: `docs/soanas/audit/10-e1-local-boot-operational.md` @ SHA `4ec8ecff4`
- Histórica Gate 0/1: `docs/soanas/audit/08-gates-0-1-final-closeout.md`

## Pendências separadas

| Tipo | Item |
|------|------|
| Implementação Cloud | Outbox E3; Electron empacotado; E2 lacunas (transfer/reserva); instalador |
| Validação externa | Windows; hardware; NFC-e homologação |
| Instalador | **ainda não produzido/validado** |

## Próxima ação

1. E2: transfer/reserva de estoque em hold/resume; manter STORE_CREDIT desabilitado.  
2. Ou E3: outbox Postgres transacional (substituir qualquer uso operacional de JSONL).  
3. Não declarar RELEASE_READY; não merge automático.

```bash
git checkout cursor/soanas-e0-e1-local-foundation-f03d
yarn soanas:validate-local --full
```
