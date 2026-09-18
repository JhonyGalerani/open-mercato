# Soanas — Execution Checkpoint

**Atualizado:** 2026-09-18  
**Uso:** retomada exata pelo próximo agente.

## Identidade git

| Campo | Valor |
|-------|-------|
| Branch de trabalho | `cursor/soanas-e0-e1-local-foundation-f03d` |
| HEAD | atualizar após push desta fatia E1 operacional |
| Base / dependência | PR #5 @ `670c535e3`; este trabalho = PR #6 |
| PR desta linha | https://github.com/JhonyGalerani/open-mercato/pull/6 |
| PR dependência | https://github.com/JhonyGalerani/open-mercato/pull/5 — aberto; sem merge automático |

## Etapa atual

| Campo | Valor |
|-------|-------|
| Etapa | **E0 CLOUD_VERIFIED**; **E1 IN_PROGRESS** (fatia operacional integrada) |
| Implementação Cloud | assertLocalOrigin estrito; navigation guard; probeLocalBoot; restartStoreLocalAppProcess (SIGKILL); TC-SOANAS-E1-LOCAL-BOOT-001; journal JSONL = protótipo only |
| Validação | `yarn soanas:validate-local --full` (Gate 0/1 + manuais + E1) — ver `audit/10` |
| Coverage | Sem promoção VALIDATED |

## Pendências (separadas)

| Tipo | Item |
|------|------|
| Implementação pendente (Cloud) | Electron BrowserWindow empacotado; outbox E3; instalador |
| Validação externa pendente | Windows limpo; hardware físico; NFC-e homologação |
| instalador | **ainda não produzido/validado** |

## Próxima ação

1. Confirmar `--full` verde no SHA testado; atualizar `audit/10` + este checkpoint.
2. Seguir E2 lacunas (transfer/reserva) ou E3 outbox Postgres — sem merge automático.

```bash
git checkout cursor/soanas-e0-e1-local-foundation-f03d
yarn soanas:validate-local --full
```
