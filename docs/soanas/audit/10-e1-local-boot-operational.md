# 10 — E1 operational local boot (2026-09-18)

**Branch:** `cursor/soanas-e0-e1-local-foundation-f03d`  
**SHA testado:** preencher após `yarn soanas:validate-local --full`  
**Dependência:** PR #5 Gates 0/1; PR #6 E0/E1 foundations  

## Escopo desta evidência

| Item | Estado |
|------|--------|
| `assertLocalOrigin` estrito (HTTP(S), IP literal, IPv6, anti-spoof, sem credenciais) | implementação + unit |
| Navigation guard Electron (navigate/redirect/window/resource) | implementação + unit |
| JSONL journal | **protótipo explícito** — NÃO autoridade de venda |
| Persistência operacional | Postgres via saga `soanas-pos` (ADR-013) |
| Boot health + auth + UI POS | `probeLocalBoot` + TC-SOANAS-E1-LOCAL-BOOT-001 |
| Reinício de **processo** (SIGKILL) + efeitos sem duplicar | TC-SOANAS-E1-LOCAL-BOOT-001 |
| WAN documentation address down + loopback up | no mesmo TC |
| `soanas:validate-local --full` Gate 0/1 + manuais + E1 | script atualizado |
| Instalador Windows | **ainda não produzido/validado** (`LOCAL_VALIDATION_PENDING`) |
| Hardware físico / NFC-e homologação | `BLOCKED_EXTERNAL` / local pending |

## Separação

- **Implementação pendente (Cloud):** Electron BrowserWindow real empacotado; outbox E3; instalar .exe
- **Validação externa pendente:** Windows limpo, dispositivos, certificado fiscal

## Coverage

Sem promoção VALIDATED (DoD de IDs offline/desktop ainda incompleto).
