# 10 — E1 operational local boot (2026-09-18)

**Branch:** `cursor/soanas-e0-e1-local-foundation-f03d`  
**SHA testado:** `4ec8ecff4` (`yarn soanas:validate-local --full` PASS)  
**Dependência:** PR #5 Gates 0/1; este trabalho = PR #6  

## Resultado

| Item | Estado |
|------|--------|
| `assertLocalOrigin` estrito | CLOUD_VERIFIED (unit) |
| Navigation guard Electron | CLOUD_VERIFIED (unit) |
| JSONL journal | protótipo explícito — **não** autoridade |
| Persistência operacional | Postgres / saga POS (ADR-013) |
| Boot health + auth + UI POS | CLOUD_VERIFIED (`probeLocalBoot` + E1) |
| SIGKILL process restart + sem duplicar | CLOUD_VERIFIED (`TC-SOANAS-E1-LOCAL-BOOT-001`, 10.0s) |
| WAN TEST-NET down + loopback up | CLOUD_VERIFIED (mesmo TC) |
| Gate 0/1 + manuais + retail API | CLOUD_VERIFIED (18 tests specialized config) |
| `soanas:validate-local --full` | PASS — 24 steps, 0 failed @ `4ec8ecff4` |
| Instalador Windows | **ainda não produzido/validado** |
| Hardware / NFC-e homologação | validação externa pendente |

## Contagens da suíte full (evidência nova)

- Units: pos 75, cash 42, payments-br 28, core 4, establishments 2, desktop 8  
- Typecheck + build: 6 pacotes soanas  
- Playwright list: 9 IDs (Gate0/1 + manuais + retail + E1)  
- Gate matrix: 18 passed  
- E1 boot/restart: 1 passed  
- Coverage: **sem promoção VALIDATED** (A229 I40 T27 V7)

## Separação

- **Implementação pendente (Cloud):** Electron BrowserWindow empacotado; outbox E3; instalador E8  
- **Validação externa pendente:** Windows limpo; dispositivos; certificado fiscal  
