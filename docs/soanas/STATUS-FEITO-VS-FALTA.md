# Soanas — O que foi feito × O que falta

**Data:** 2026-09-15  
**Base Open Mercato:** `0.7.0` @ `30d509eeb`  
**Branch:** `cursor/soanas-blueprint-foundation-5019`  
**PR:** https://github.com/JhonyGalerani/open-mercato/pull/1  
**SSOT funcional:** Blueprint Funcional Completo  
**Matriz rastreável:** [`BLUEPRINT-COVERAGE.md`](./BLUEPRINT-COVERAGE.md) · [`blueprint-coverage.json`](./blueprint-coverage.json)

---

## 1. Resumo executivo

| Métrica | Valor |
|--------|------:|
| Total de requisitos (IDs) | **303** |
| ANALYZED (mapeados, sem código suficiente) | **251** |
| IMPLEMENTED (código parcial/scaffold) | **43** |
| TESTED (com teste unitário relevante) | **9** |
| VALIDATED (definição de done completa) | **0** |
| Pronto para conectar SEFAZ / Pix / TEF / hardware real | **Não** |

**Conclusão:** a fundação documental e os primeiros pacotes Soanas existem. **Não** está pronto para homologação externa nem operação comercial. Falta a maior parte do produto (POS, fiscal, pagamentos BR, offline, hardware, restaurante, compras, financeiro, etc.).

---

## 2. O que foi feito

### 2.1 Documentação e governança

| Artefato | Caminho |
|----------|---------|
| Índice Soanas | `docs/soanas/README.md` |
| Auditoria do repositório | `docs/soanas/audit/00` … `06` |
| Mapa de reuso Mercato | `docs/soanas/audit/01-open-mercato-reuse-map.md` |
| Gap analysis | `docs/soanas/audit/03-gap-analysis.md` |
| Riscos de arquitetura | `docs/soanas/audit/04-architecture-risks.md` |
| Mapa de dependências | `docs/soanas/audit/05-dependency-map.md` |
| Baseline de testes Mercato | `docs/soanas/audit/06-baseline-tests.md` |
| Matriz do Blueprint (303 IDs) | `docs/soanas/BLUEPRINT-COVERAGE.md` |
| Roadmap técnico | `docs/soanas/ROADMAP.md` |
| Status de implementação | `docs/soanas/IMPLEMENTATION-STATUS.md` |
| Risk register | `docs/soanas/RISK-REGISTER.md` |
| Tech debt | `docs/soanas/TECH-DEBT.md` |
| Licenças | `docs/licenses/DEPENDENCY_LICENSES.md`, `THIRD_PARTY_NOTICES.md` |
| Runbooks (stubs) | `docs/soanas/runbooks/*` |
| ADRs 001–006 | `docs/soanas/adr/` |
| Specs Fase 0–2 | `.ai/specs/2026-09-15-soanas-{foundation,cash,pos,fiscal-br}.md` |
| Gerador da matriz | `scripts/soanas-generate-blueprint-coverage.mjs` |

### 2.2 Decisões arquiteturais registradas (ADRs)

1. Pacotes `soanas-*` fora de `packages/core` (upstream-friendly)
2. `PosTransaction` orquestra; `SalesOrder` continua sendo a verdade comercial
3. Caixa = ledger append-only
4. Fiscal BR isolado e versionado
5. POS local-first + outbox/sync
6. SPEC-022 Mercato POS não será implementado no core; Soanas POS é o produto

### 2.3 Pacotes de código criados

| Package | Módulo | O que contém |
|---------|--------|----------------|
| `@open-mercato/soanas-core` | `soanas_core` | CNPJ alfanumérico, error model, perfis, catálogo ACL POS |
| `@open-mercato/soanas-establishments` | `soanas_establishments` | `FiscalEstablishment`, validators, commands CRUD, API, events, migration, i18n |
| `@open-mercato/soanas-cash` | `soanas_cash` | `CashRegister` / `CashDrawer` / `CashSession` / `CashMovement`, ledger, open session, sangria, APIs, migration, i18n |

**Wiring:** habilitados em `apps/mercato/src/modules.ts` + deps em `apps/mercato/package.json`.  
**Regra respeitada:** nenhum domínio Soanas adicionado em `packages/core`.

### 2.4 APIs já expostas

| Método | Rota | Função |
|--------|------|--------|
| CRUD | `/api/soanas_establishments/establishments` | Estabelecimento fiscal |
| POST | `/api/soanas_cash/sessions/open` | Abrir sessão de caixa |
| POST | `/api/soanas_cash/withdrawals` | Criar sangria |

### 2.5 Testes executados

| Suite | Resultado |
|-------|-----------|
| Baseline `@open-mercato/shared` | 1931 PASS |
| Baseline `module-decoupling` | 12 PASS |
| `@open-mercato/soanas-core` | 4 PASS (CNPJ) |
| `@open-mercato/soanas-establishments` | 2 PASS (validators) |
| `@open-mercato/soanas-cash` | 3 PASS (ledger) |
| `yarn generate` | módulos Soanas descobertos |

### 2.6 IDs do Blueprint com progresso (IMPLEMENTED / TESTED)

> **Atenção:** vários itens marcados IMPLEMENTED são **scaffold** (campos/ACL/API parcial), não “VALIDATED” nem prontos para produção.

#### Establishments (EST-*)
- Entidade + campos BR (razão, fantasia, CNPJ string, IE/IM, CNAE, CRT, endereço, contador, ambiente, séries, CSC ref, certificado ref, políticas, etc.)
- CNPJ alfanumérico **TESTED**

#### Auth / ACL Soanas (AUTH-*)
- Catálogo de features POS (abrir/fechar caixa, sangria, desconto, fiscal, estoque, etc.)
- Lista de perfis padrão (owner…suporte)
- Feature de aprovação gerencial (declaração ACL; fluxo PIN completo ainda não)

#### Cash (CASH-*)
- Estrutura de entidades + ledger esperado **TESTED**
- Abertura de sessão (fundo, denominações, idempotency)
- Sangria (valor, motivo, destino, saldo insuficiente, limite, dupla custódia, denominações)

#### Architecture (ARCH-*)
- Pacotes Soanas sem poluir core
- Commands + idempotência iniciais
- Money em centavos (`bigint`) **TESTED**
- Política de licenças
- Modelo de erro (helpers)

### 2.7 Commits nesta branch

1. `docs(soanas): audit repository and create blueprint coverage matrix`
2. `feat(soanas): scaffold soanas-core and fiscal establishments`
3. `feat(soanas-cash): add cash ledger, session open, and sangria`

---

## 3. O que falta (e o que precisa)

### 3.1 Para “conectar ao externo” (bloqueadores)

Sem estes itens, **não** dá para homologar Pix/SEFAZ/TEF/hardware:

| Necessidade | Package alvo | Status |
|-------------|--------------|--------|
| Contratos `PixProvider` + mock + webhook/polling | `soanas-payments-br` | Não iniciado |
| Contratos `PaymentTerminalProvider` (TEF) + mock | `soanas-payments-br` / `soanas-hardware` | Não iniciado |
| `FiscalCore` + `TaxEngine` + `TaxSnapshot` | `soanas-fiscal-br` | Não iniciado |
| Adapters NFC-e / NF-e / NFS-e + schemas versionados | `soanas-fiscal-br` | Não iniciado |
| `CertificateService` A1 (upload, criptografia, alertas) | `soanas-fiscal-br` | Só referência de ID no establishment |
| `SefazTransport` + fila + contingência + idempotência | `soanas-fiscal-br` | Não iniciado |
| Device Agent (impressora/gaveta/balança/leitor/pinpad) | `soanas-hardware` | Não iniciado |
| PrintJob spooler persistente | `soanas-hardware` | Não iniciado |
| Offline DB + Outbox + Sync engine versionado | `soanas-offline` | Não iniciado |
| Feature flags + status `CODE_READY` / `SANDBOX_READY` / `CERTIFICATION_PENDING` | `soanas-saas` + toggles | Não iniciado |
| Credenciais reais (SEFAZ, CSC, certificado, PSP, adquirente) | Ops / secrets | Externos — depois dos adapters |

### 3.2 Domínios ainda só ANALYZED (falta implementar)

| Domínio | IDs | O que precisa |
|---------|----:|---------------|
| Tenant/Org Soanas (billing/planos/isolamento fino) | 22 | `soanas_saas` + políticas por establishment |
| Catalog fiscal BR / tipos produto | 12 | extensão catalog + FiscalRule |
| Preços avançados Soanas | 7 | regras prioridade/aprovação |
| Inventory UX / inventário | 18 | UX sobre WMS + inventário cego/rotativo |
| Procurement | 11 | fornecedor→RFQ→PO→recebimento→XML |
| **POS** (terminal, UI venda, hold, state machine) | 11 | `soanas-pos` completo |
| Cash restante (suprimento, fechamento, turno, gaveta, conciliação) | ~9 | completar `soanas-cash` |
| Payments / tenders / Pix / split / unknown | 13 | `soanas-payments-br` + PaymentTender |
| Discounts / promoções | 4 | rules + UX POS |
| Customers BR / LGPD fields | 5 | CF/validators |
| Loyalty | 3 | `soanas-loyalty` |
| Finance (AR/AP/fiado/conciliação) | 9 | `soanas-finance` |
| **Fiscal BR** | 13 | `soanas-fiscal-br` |
| Hardware | 9 | `soanas-hardware` |
| Offline | 6 | `soanas-offline` |
| Restaurant | 10 | `soanas-restaurant` |
| KDS | 4 | `soanas-kds` |
| Delivery | 3 | `soanas-delivery` |
| Retail verticals / quotes UX / picking / transfer | 8 | POS + WMS orchestration |
| Reporting / dashboards | 7 | `soanas-reporting` |
| Audit sensível / LGPD / Security hardening | 11 | `soanas-core` + auth |
| Automations / IO / Integrations BR | 13 | rules + adapters |
| Printing / SaaS / Observability / Perf / A11y / AI | 16 | vários pacotes |
| Suítes de teste E2E Blueprint §94–111 | 11 | QA Playwright + falhas |

### 3.3 Pacotes ainda não criados

```
soanas-pos
soanas-offline
soanas-hardware
soanas-fiscal-br
soanas-payments-br
soanas-restaurant
soanas-kds
soanas-procurement
soanas-finance
soanas-loyalty
soanas-delivery
soanas-reporting
soanas-integrations
soanas-saas
```

### 3.4 Lacunas importantes no que já existe (dívida explícita)

| Item | Situação real |
|------|----------------|
| ACL POS | Features declaradas; **sem** UI de PIN/aprovação remota completa |
| EST certificado / Pix / adquirente | Campos de referência; **sem** upload A1 nem provider |
| Sangria | Create + validações; reversão/comprovante/impressão/relatórios **incompletos** |
| Suprimento / fechamento / turno | **Não** implementados |
| CashCount / CashReconciliation / CashApproval | Entidades parcialmente previstas; fluxo completo **não** |
| UI admin / UI POS | **Não** existem telas Soanas |
| Integração com SalesOrder / estoque na venda | **Não** |
| Demo seed / onboarding wizard Soanas | **Não** |
| Migration aplicada em DB de ambiente | Arquivos criados; `db:migrate` **não** foi pedido/aplicado aqui |
| VALIDATED = 0 | Nenhum item passou na Definition of Done completa do prompt mestre |

### 3.5 O que o Open Mercato já cobre (não reimplementar)

Reusable agora: Tenant/Organization, Auth/RBAC/Staff, Audit, Catalog, CRM, Sales (quote/order/invoice/credit memo/payments), Payment Gateway Hub, WMS fase 1, Workflows, Business Rules, Notifications, Feature toggles, Webhooks, Integrations hub, AI Assistant (fora do caminho crítico).

**Não** usar como PDV: `packages/checkout` (pay-links).  
**Não** copiar: `@open-mercato/enterprise`.

---

## 4. Ordem recomendada do que falta (próximos passos)

1. **Completar Cash** — suprimento, fechamento cego, reversão, CRUD de registers, UI mínima  
2. **`soanas-pos`** — PosTerminal + PosTransaction + UI venda + ligação SalesOrder  
3. **Contratos externos + mocks** — Pix / TEF / Fiscal / Printer (antes de credenciais reais)  
4. **Fase 2 Fiscal SP + Pix** — certificado, TaxEngine, NFC-e, contingência  
5. **Fase 3 Offline + Hardware Agent**  
6. **Fase 4 Restaurant + KDS**  
7. **Fase 5 Procurement + Finance**  
8. **Fase 6–8** escala, reporting, loyalty, SaaS, hardening → gate VALIDATED

Detalhe: [`ROADMAP.md`](./ROADMAP.md).

---

## 5. Critério de “pronto de verdade”

O Soanas só estará concluído quando:

- `NOT_STARTED` = 0 e `ANALYZED` = 0 e `IN_PROGRESS` = 0  
- Todo ID em `VALIDATED` **ou** `BLOCKED_EXTERNAL` com adapter+mock+testes+doc do bloqueio  
- E2E varejo / restaurante / offline / falhas (§108–111) passando  
- Auditoria final PASS em todas as áreas do prompt mestre  

**Estado atual:** longe desse gate. Progresso real ≈ fundação + início de caixa (~17% IDs com algum código; **0% VALIDATED**).

---

## 6. Como acompanhar

```bash
# regenerar matriz (estrutura)
node scripts/soanas-generate-blueprint-coverage.mjs

# status machine-readable
cat docs/soanas/blueprint-coverage.json | jq '[.rows[].status] | group_by(.) | map({status:.[0], count:length})'

# testes Soanas
yarn workspace @open-mercato/soanas-core test
yarn workspace @open-mercato/soanas-establishments test
yarn workspace @open-mercato/soanas-cash test
```

Índice geral: [`README.md`](./README.md).
