# Soanas — Release Checklist

Critérios para instalar e liberar. Itens sem evidência permanecem abertos.  
Estados: `PENDING` | `IN_PROGRESS` | `CLOUD_VERIFIED` | `BLOCKED_EXTERNAL` | `LOCAL_VALIDATION_PENDING` | `RELEASE_READY`.

## Identidade do artefato

| Campo | Valor atual |
|-------|-------------|
| Versão produto | ainda não versionada para release |
| SHA | ver checkpoint |
| Checksum instalador | **N/A — instalador ainda não produzido/validado** |
| SO suportados | meta: Windows 10/11 x64 (não validado) |
| Artefato | **ausente** |

## Pré-requisitos de produto

| # | Critério | Estado | Evidência |
|---|----------|--------|-----------|
| R1 | E0 SSOT sem contradições | IN_PROGRESS | ROADMAP E0–E9, stage map |
| R2 | Caixa+PDV jornada visual (E2) | CLOUD_VERIFIED parcial | Gate 0/1 + Retail v1 (Postgres efêmero) |
| R3 | Pagamentos manuais (sem TEF) | CLOUD_VERIFIED parcial | Gate 1 tenders |
| R4 | STORE_CREDIT só com ledger real | CLOUD_VERIFIED (desabilitado) | TD-015 |
| R5 | Offline: venda+reinício+sync sem duplicar (E3) | PENDING | — |
| R6 | Hardware: fila/simuladores (E4 cloud) | PENDING | — |
| R7 | Hardware físico homologado | LOCAL_VALIDATION_PENDING | — |
| R8 | Fiscal NFC-e implementado+fixtures (E5) | PENDING | — |
| R9 | Fiscal homologação SEFAZ | BLOCKED_EXTERNAL | certificado |
| R10 | Instalador Windows limpo (E8) | PENDING | instalador ainda não produzido/validado |
| R11 | Aceite E9 em instalação limpa | PENDING | — |

## Instalação Windows (E8)

- [ ] Assistente instala sem Node/Docker manual pelo lojista
- [ ] Serviços locais sobem com a app visual
- [ ] Dados separados dos binários
- [ ] Instância única / portas documentadas
- [ ] Update com integridade verificável
- [ ] Backup antes de migration crítica; restore testado
- [ ] Desinstalação preserva dados por padrão
- [ ] Logs redigidos; export diagnóstico sem segredos
- [ ] Assinatura: distinguir build interno não assinado vs release assinada

## Aceite integrado (E9)

- [ ] Setup → abertura caixa → venda manual dividida
- [ ] Desconexão (WAN) → nova venda → reinício → recovery
- [ ] Reconexão/sync sem duplicar efeitos
- [ ] Impressão (simulador ou físico) → fechamento → relatório
- [ ] Backup/restauração
- [ ] Upgrade a partir da versão suportada (quando existir)

## Declaração

**Não declarar `RELEASE_READY` até R10–R11 (e R5 se offline no escopo do lançamento) tiverem evidência.**  
Não declarar “100% sem bugs”. Declarar escopo e ambientes aceitos.
