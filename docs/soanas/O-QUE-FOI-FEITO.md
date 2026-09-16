# Soanas — O que foi feito

**Data:** 2026-09-16  
**Base:** Open Mercato `0.7.0` @ `30d509eeb`  
**Branch:** `cursor/soanas-retail-gate-validation-4347`  
**PR:** https://github.com/JhonyGalerani/open-mercato/pull/1  

Documento de entrega: o que já existe no repositório.  
Para “o que falta”, ver [`IMPLEMENTATION-STATUS.md`](./IMPLEMENTATION-STATUS.md) e [`STATUS-FEITO-VS-FALTA.md`](./STATUS-FEITO-VS-FALTA.md).

---

## 1. Resumo em uma frase

Foi entregue a **fundação Soanas** (auditoria + matriz + ADRs) e o **Retail Vertical Slice v1 em código** (Cash completo + POS com venda em dinheiro orquestrando Sales + WMS + Cash), ainda **sem** `VALIDATED` nem E2E verde em ambiente com migrations aplicadas.

---

## 2. Números

<!-- soanas:derived-counts:start -->
| Métrica | Valor |
|---------|------:|
| IDs do Blueprint | 303 |
| ANALYZED | 233 |
| IMPLEMENTED | 52 |
| TESTED | 18 |
| VALIDATED | **0** |
<!-- soanas:derived-counts:end -->

**Métrica principal do produto:** checklist Vertical Slice em [`IMPLEMENTATION-STATUS.md`](./IMPLEMENTATION-STATUS.md) — não o percentual bruto da matriz.

---

## 3. Estratégia adotada

1. Auditoria do Mercato → matriz rastreável → ADRs/specs → baseline  
2. Pacotes `soanas-*` **fora** de `packages/core` (upstream-friendly)  
3. Pivot para **vertical slice real** (evitar módulos vazios)  
4. Ordem travada: Cash → POS → Sale E2E → só depois Pix/Fiscal/Hardware  

---

## 4. Documentação e governança

| Artefato | Caminho |
|----------|---------|
| Índice | `docs/soanas/README.md` |
| Este relatório | `docs/soanas/O-QUE-FOI-FEITO.md` |
| Feito × falta | `docs/soanas/STATUS-FEITO-VS-FALTA.md` |
| Status + Vertical Slices | `docs/soanas/IMPLEMENTATION-STATUS.md` |
| Matriz Blueprint | `docs/soanas/BLUEPRINT-COVERAGE.md` + `blueprint-coverage.json` |
| Auditoria 00–07 | `docs/soanas/audit/` |
| ADRs 001–007 | `docs/soanas/adr/` |
| Roadmap / riscos / tech debt | `docs/soanas/ROADMAP.md`, `RISK-REGISTER.md`, `TECH-DEBT.md` |
| Licenças | `docs/licenses/` |
| Specs | `.ai/specs/2026-09-15-soanas-{foundation,cash,pos,fiscal-br}.md` |
| Cenário E2E | `.ai/qa/scenarios/TC-SOANAS-RETAIL-001-cash-pos-sale.md` |
| Gerador da matriz | `scripts/soanas-generate-blueprint-coverage.mjs` |

### ADRs registrados

| ADR | Decisão |
|-----|---------|
| 001 | Pacotes `soanas-*` fora do core |
| 002 | `PosTransaction` orquestra; `SalesOrder` = verdade comercial |
| 003 | Caixa = ledger append-only (centavos `bigint`) |
| 004 | Fiscal BR isolado |
| 005 | POS local-first / sync |
| 006 | SPEC-022 não no core; Soanas POS é o produto |
| 007 | Saga idempotente POS → Sales → WMS → Cash (sem TX global) |
| 008 | Consumo WMS retail: `referenceId=salesOrderId` + split multi-location |
| 009 | `ReceiptPrinter` via DI (`receiptPrinter`); default Mock |

---

## 5. Pacotes de código

### `@open-mercato/soanas-core`
- CNPJ alfanumérico (TESTED)
- Modelo de erro operacional
- Catálogo ACL POS (`soanas.pos.*`)
- Perfis padrão Soanas

### `@open-mercato/soanas-establishments`
- Entidade `FiscalEstablishment` (campos BR)
- CRUD + commands + API + events + migration + i18n
- Correção de delete com escopo tenant/org

### `@open-mercato/soanas-cash`
- Entidades: Register, Drawer, Session, Movement, Count, Reconciliation, Approval  
- Políticas no register (limites, blind closing, tolerância)  
- Abrir sessão (idempotência + unique de sessão aberta)  
- Sangria + suprimento + reversão por contramovimento  
- Contagem + fechamento cego + reconciliação + divergência  
- `record_sale` para o POS  
- UI: `/backend/soanas/cash/registers`, `/backend/soanas/cash/session`  
- Migrations v1 + v2  
- 36 testes unitários  

### `@open-mercato/soanas-pos`
- Entidades: Terminal, Transaction, Line, PaymentTender, StateTransition, RecoveryState  
- State machine (sem fiscal fake)  
- Carrinho com totais recalculados no servidor  
- Tender CASH (recebido / aplicado / troco)  
- `completePosSale` (SalesOrder + payment + WMS adjust + cash ledger + receipt)  
- Recovery / replay idempotente  
- `MockReceiptPrinter`  
- UI: terminais, venda (`/backend/soanas/pos/sell`), histórico  
- Spec Playwright API `TC-SOANAS-RETAIL-001`  
- 51 testes unitários  

### Wiring
- `apps/mercato/src/modules.ts`  
- deps em `apps/mercato/package.json`  

---

## 6. APIs principais

### Cash
- `CRUD /api/soanas_cash/registers`
- `CRUD /api/soanas_cash/drawers`
- `POST /api/soanas_cash/sessions/open`
- `GET  /api/soanas_cash/sessions/current`
- `POST /api/soanas_cash/sessions/close`
- `POST /api/soanas_cash/withdrawals`
- `POST /api/soanas_cash/supplies`
- `POST /api/soanas_cash/counts`
- `POST /api/soanas_cash/movements/reverse`

### POS
- `CRUD /api/soanas_pos/terminals`
- `GET/POST /api/soanas_pos/transactions`
- `GET /api/soanas_pos/transactions/:id`
- `POST .../lines` · `.../checkout` · `.../tenders/cash`
- `POST .../complete` · `.../recover` · `.../cancel`
- `GET /api/soanas_pos/catalog/search`

### Establishments
- `CRUD /api/soanas_establishments/establishments`

---

## 7. Fluxo retail entregue (código)

```
abrir caixa
→ terminal POS
→ criar venda
→ adicionar produto
→ checkout
→ dinheiro (recebido + troco)
→ completePosSale
   → SalesOrder + SalesPayment
   → baixa WMS
   → movimento cash_sale
   → recibo mock
→ histórico
→ fechar caixa (contagem + reconciliação)
```

---

## 8. Commits principais nesta branch

1. `docs(soanas): audit repository and create blueprint coverage matrix`  
2. `feat(soanas): scaffold soanas-core and fiscal establishments`  
3. `feat(soanas-cash): add cash ledger, session open, and sangria`  
4. `docs(soanas): add/expand done-vs-missing status report`  
5. `feat(soanas-cash): complete cash DoD for retail vertical slice`  
6. `feat(soanas-pos): scaffold POS package…`  
7. `feat(soanas-pos): add POS APIs, operator UI and app wiring`  
8. `fix(soanas-pos): aggregate WMS deductions… orphaned sales orders`  
9. `feat(soanas-pos): close retail vertical slice loop with E2E spec and metrics`  

---

## 9. O que explicitamente **não** foi feito (ainda)

- Migrations aplicadas no DB deste ambiente  
- E2E Playwright executado com sucesso em app efêmero  
- QUALQUER ID em `VALIDATED`  
- Pix / TEF / Fiscal SEFAZ / Offline / Hardware / Restaurant / KDS / Finance  
- PIN gerencial completo na UI  
- Hold/resume de venda completo  

---

## 10. Como navegar

```bash
# status executável
cat docs/soanas/IMPLEMENTATION-STATUS.md

# testes
yarn workspace @open-mercato/soanas-cash test
yarn workspace @open-mercato/soanas-pos test

# contagem da matriz
node -e "const d=require('./docs/soanas/blueprint-coverage.json'); const b={}; for (const r of d.rows) b[r.status]=(b[r.status]||0)+1; console.log(b)"
```
