# Soanas — Relatório de entrega

**Data:** 2026-09-16  
**Base:** Open Mercato 0.7.0 @ `9903c82f8`  
**Branch:** `cursor/soanas-rebaseline-gate0-9e05`  
**PR:** [#3](https://github.com/JhonyGalerani/open-mercato/pull/3) (merged)  
**Commits:**

| SHA | Mensagem |
|-----|----------|
| `9d6473bfc` | `fix(soanas): Gate 0 critical fixes + honest coverage rebaseline` |
| `20a6b4243` | `feat(soanas-pos): Gate 1 manual split tenders` |

---

## 1. Objetivo desta entrega

Continuar o Soanas a partir do estado real do repositório (não do zero), com foco em:

1. **Rebaseline honesta** dos 303 IDs do Blueprint  
2. **Gate 0** — correções críticas de segurança, recovery e integridade  
3. **Gate 1** — pagamentos manuais e divididos (maquininha externa)

Prioridade seguida: integridade financeira / estoque / isolamento / segurança / idempotência / recuperação — não “parecer completo”.

---

## 2. Estado confirmado no início

| Item | Valor |
|------|-------|
| Repo | `JhonyGalerani/open-mercato` |
| HEAD observado | `9903c82f81586802ae3f64d50a9e37c7a052c281` |
| PR anterior | #2 — Retail VALIDATED + POS advanced + Pix payments |
| Pacotes Soanas | `soanas-core`, `soanas-establishments`, `soanas-cash`, `soanas-pos`, `soanas-payments-br` |

Coverage **antes** da rebaseline:

```text
ANALYZED:    227
IMPLEMENTED:  36
TESTED:       20
VALIDATED:    20
Total:       303
```

Problema: vários IDs `VALIDATED` agrupavam funcionalidades ainda incompletas (evidência compartilhada do Retail Sale v1).

---

## 3. Rebaseline honesta

### Contadores depois

```text
ANALYZED:    229
IMPLEMENTED:  40
TESTED:       27
VALIDATED:     7
Total:       303
% VALIDATED: 2,3%
```

### IDs mantidos como VALIDATED (DoD real)

- `POS-001` — PosTerminal CRUD + API + UI  
- `POS-TXN-001` — saga `completePosSale` + recovery/idempotência  
- `CASH-001` — estrutura de caixa / ledger  
- `CASH-002` — register CRUD  
- `CASH-OPEN-001` — abertura de sessão  
- `CASH-OPEN-002` — denominações  
- `CASH-CLOSE-003` — expected vs counted + tolerância  

### Exemplos rebaixados (amostra)

| ID | De → Para | Motivo |
|----|-----------|--------|
| `POS-003` | VALIDATED → IMPLEMENTED | Offline/bloqueado/versão mínima não existem |
| `POS-UI-001` | VALIDATED → TESTED | Busca só SKU/barcode/nome |
| `POS-UI-002` | VALIDATED → TESTED | Sem peso/lote/serial na UI |
| `POS-UI-003` | VALIDATED → IMPLEMENTED | Remove sem motivo obrigatório |
| `CASH-OPEN-003` | VALIDATED → IMPLEMENTED | Aprovação de float parcial |
| `CASH-CLOSE-001` | VALIDATED → ANALYZED | Sem gate de pendências fiscais/Pix/offline |
| `CASH-CLOSE-002` | VALIDATED → TESTED | Multi-tender counting pendente |
| `CASH-CLOSE-004` | VALIDATED → ANALYZED | Sem PDF/e-mail/financeiro |
| `PAY-CASH-001` | VALIDATED → TESTED | Limite/cédulas/arredondamento incompletos |

### Documentos sincronizados

- `docs/soanas/blueprint-coverage.json`  
- `docs/soanas/BLUEPRINT-COVERAGE.md`  
- `docs/soanas/IMPLEMENTATION-STATUS.md`  
- `docs/soanas/STATUS-FEITO-VS-FALTA.md`  
- `docs/soanas/O-QUE-FOI-FEITO.md`  
- `docs/soanas/TECH-DEBT.md`  

### CI de coverage

- Script: `scripts/soanas-check-coverage.mjs`  
- Yarn: `yarn soanas:check-coverage` / `yarn soanas:sync-status`  
- Falha se contadores divergirem ou IDs proibidos voltarem a `VALIDATED`

---

## 4. Gate 0 — correções críticas

### 4.1 Webhook Pix mock

- Rota mock **não** fica pública em produção  
- Permitida só em `development`/`test`, ou com `SOANAS_PIX_MOCK_WEBHOOK_ENABLED=true` + secret (`x-soanas-pix-mock-secret`)  
- Arquivo: `packages/soanas-payments-br/.../lib/mockWebhookGuard.ts`

### 4.2 Isolamento organizacional Pix

- `loadPixChargeOrThrow` exige `tenantId + organizationId + txid`  
- Tenant A / Org A não acessa Org B do mesmo tenant  

### 4.3 Idempotência de cobranças Pix

- Migration: `Migration20260916120000_soanas_payments_pix_idempotency`  
- Unique parcial: `(tenant_id, provider, idempotency_key) WHERE deleted_at IS NULL`  
- Race concorrente adotada via unique violation  

### 4.4 Recovery WMS multi-location

- Plano congelado em `PosRecoveryState.allocationPlan`  
- Checkpoint por local (status `PENDING`/`COMPLETED`/`FAILED`, `movementId`, `idempotencyKey`)  
- Partial `wmsMovementId` **não** pula baixas restantes  
- Cenário A=3 / B=4 / venda=5 recuperável sem duplicar  

### 4.5 Aprovação gerencial (caixa)

- Aprovador derivado de `ctx.auth.sub` (sessão autenticada)  
- UUID de aprovador enviado pelo cliente **ignorado**  
- UI de sangria sem campo de UUID  
- ADR-012  

### 4.6 PrintJob persistente

- Entidade `PosPrintJob` (`QUEUED` → `PRINTING` → `PRINTED`/`FAILED`/…)  
- Enfileira **antes** de chamar a impressora  
- Falha de impressão **não** desfaz nem duplica a venda  
- ADR-011  

### 4.7 Estoque negativo (ALLOW)

- `ALLOW` removido da UI de criação de terminal  
- Coerção `ALLOW → BLOCK` no guard e no WMS (WMS rejeita negativo)  
- TD-012 registrado até existir contrato WMS  

### 4.8 Acoplamento ORM

- Mantido limitado (ADR-008) + TD-014 com plano de remoção  
- Sem expansão do acoplamento nesta entrega  

---

## 5. Gate 1 — pagamentos manuais e divididos

### Meios

```text
CASH
PIX_MANUAL
DEBIT_MANUAL
CREDIT_MANUAL
VOUCHER_MANUAL
STORE_CREDIT
OTHER
```

Aliases legados (`PIX`, `CARD_DEBIT`, `CARD_CREDIT`, `VOUCHER`) ainda aceitos na API e normalizados.

### Campos opcionais (maquininha)

`brand`, `installments`, `nsu`, `authorizationCode`, `acquirer`, `externalTerminal`, `externalReference`, `notes`, `confirmedByUserId`, `confirmedAt`

### Regras

- `sum(amountApplied) == total` para concluir  
- Dinheiro pode gerar troco  
- Meios não monetários **nunca** geram troco  
- Remoção de tender antes do `COMPLETED` (reabre `PAYMENT_PENDING` se necessário)  
- Estorno na maquininha continua responsabilidade externa (sem TEF nesta fase)

### APIs

- `POST /api/soanas_pos/transactions/[id]/tenders/manual`  
- `DELETE /api/soanas_pos/transactions/[id]/tenders/[tenderId]`  
- `POST .../tenders/cash` (já existia; mantido)

### UI

- Tela de venda: seletor de meio, lista de tenders, remoção, metadados opcionais  
- i18n `en` + `pt-BR`

### Migration

- `Migration20260916140000_soanas_pos_manual_tenders`

---

## 6. ADRs e tech debt

### ADRs novos

| ADR | Decisão |
|-----|---------|
| ADR-011 | PrintJob durável; falha de impressão ≠ rollback de venda |
| ADR-012 | Aprovador de caixa sempre da sessão autenticada |

### Tech debt atualizado

| ID | Tema |
|----|------|
| TD-007 | PrintJob mitigado; ESC/POS ainda pendente |
| TD-011 | Pix integrado não é caminho crítico; manual first |
| TD-012 | ALLOW desligado até WMS negativo |
| TD-013 | Over-validation corrigida + CI |
| TD-014 | ORM cross-module limitado (ADR-008) |

---

## 7. Migrations desta entrega

> **Não aplicadas localmente** nesta sessão (pedir ok antes de `yarn db:migrate`).

1. `Migration20260916120000_soanas_payments_pix_idempotency`  
2. `Migration20260916130000_soanas_pos_gate0` (allocation plan + print jobs)  
3. `Migration20260916140000_soanas_pos_manual_tenders`

---

## 8. Testes executados

| Pacote | Suites | Testes |
|--------|-------:|-------:|
| `@open-mercato/soanas-payments-br` | 4 | 28 |
| `@open-mercato/soanas-pos` | 12 | 67 |
| `@open-mercato/soanas-cash` | 6 | 38 |

Novos: `mockWebhookGuard.test.ts`, `allocationCheckpoints.test.ts`, `manualTender.test.ts`, planner parcial WMS.

Runner: local (`yarn workspace … test`) após `yarn install`.

---

## 9. O que ainda falta (próximos gates)

Ordem mantida do prompt mestre:

1. **Gate 2** — caixa completo (fechamento por meio, sangria/suprimento, PDF/térmica)  
2. **Gate 3** — POS operacional (busca completa, hold transfer, CRM, histórico rico)  
3. **Gate 4** — `@open-mercato/soanas-fiscal-br` (NFC-e SP homologação)  
4. **Gate 5+** — hardware, estoque avançado, offline, restaurante, etc.

Escopo de pagamentos do 1º lançamento permanece: **maquininha externa + registro manual** — sem TEF, sem webhook de adquirente, sem Pix integrado obrigatório.

---

## 10. Resposta à pergunta-guia

> Este trabalho deixa um fluxo real do Soanas mais correto, seguro, completo, comprovável e recuperável em produção?

**Sim, no trecho Gate 0 + Gate 1:**

- Pix mock não compromete produção  
- Escopo org respeitado  
- Recovery multi-local não duplica baixa  
- Aprovação de caixa não é spoofável por UUID  
- Impressão não é efeito fantasma  
- Pagamento dividido manual é registrável e removível antes da conclusão  
- Coverage deixa de mentir sobre `VALIDATED`

Não declara o produto 100% completo: `VALIDATED = 7/303` de forma intencional e auditável.
