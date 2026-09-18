# Soanas — Tudo que foi feito × O que falta × O que precisa

**Data:** 2026-09-18  
**Base Open Mercato:** `0.7.0` @ `8d38af7ca` (main)  
**Fork / repo:** `JhonyGalerani/open-mercato`  
**Branch de trabalho:** `cursor/soanas-e0-e1-local-foundation-f03d`  
**Dependência:** PR #5 head `670c535e3` (Gates 0/1) — sem merge automático  
**SSOT funcional:** Blueprint Funcional Completo do Soanas  
**Ordem canônica:** [`ROADMAP.md`](./ROADMAP.md) **E0–E9**  
**Retomada:** [`EXECUTION-CHECKPOINT.md`](./EXECUTION-CHECKPOINT.md)  
**Matriz rastreável:** [`BLUEPRINT-COVERAGE.md`](./BLUEPRINT-COVERAGE.md) · [`blueprint-coverage.json`](./blueprint-coverage.json)

> Contadores derivados via `yarn soanas:sync-status`. Narrativa histórica de Phases/Gates nas seções longas não reabre pacotes já existentes.

---

## 0. Resposta rápida

| Pergunta | Resposta |
|----------|----------|
| Terminou o Blueprint? | **Não** |
| Estratégia atual | **E0–E9** — E0 SSOT + E1 local/desktop foundations; Gates 0/1 = E2 parcial |
| Tem fundação documental? | **Sim** (ROADMAP E0–E9, checkpoint, inventory, stage map) |
| Tem código Soanas? | **Sim** — `core`, `establishments`, `cash`, `pos`, `payments-br`, + `soanas-desktop` foundations |
| Retail Vertical Slice v1 (cash-only) | Checklist E2E verde em Postgres efêmero; ≠ offline-first |
| Pronto para SEFAZ / Pix integrado / TEF / hardware real? | **Não** (manuais OK; Pix integrado fora do caminho crítico) |
| Instalador Windows? | **instalador ainda não produzido/validado** |
| Métrica principal | Checklist em `IMPLEMENTATION-STATUS.md` → Vertical Slices (não só % da matriz) |
| `%` `VALIDATED` (Definition of Done) | **2.3%** (7/303) — **não** é % de código pronto |

---

## 1. Números da matriz (303 IDs)

<!-- soanas:derived-counts:start -->
| Status | Qtd | Significado |
|----------|----:|-------------|
| `ANALYZED` | **229** | Mapeado; sem código Soanas suficiente |
| `IMPLEMENTED` | **40** | Código/scaffold existe (muitos ainda parciais) |
| `TESTED` | **27** | Há teste unitário relevante |
| `VALIDATED` | **7** | DoD completa do prompt mestre |
| `NOT_STARTED` / `IN_PROGRESS` / `BLOCKED_EXTERNAL` | **0** | Ainda não usados nesta fase |

**% IDs com algum código (`IMPLEMENTED`+`TESTED`+`VALIDATED`):** ~24% (74/303)

### Por módulo-alvo (resumo)

| Módulo | Total | ANALYZED | IMPLEMENTED | TESTED | VALIDATED |
|--------|------:|---------:|------------:|-------:|----------:|
| `soanas_core` | 37 | 16 | 19 | 2 | 0 |
| `soanas_pos` | 25 | 7 | 2 | 14 | 2 |
| `soanas_establishments` | 23 | 8 | 14 | 1 | 0 |
| `soanas_cash` | 21 | 5 | 5 | 6 | 5 |
| `soanas_fiscal_br` | 13 | 13 | 0 | 0 | 0 |
| `soanas_core/wms-ux` | 12 | 12 | 0 | 0 | 0 |
| `soanas_hardware` | 12 | 12 | 0 | 0 | 0 |
| `soanas_saas` | 11 | 11 | 0 | 0 | 0 |
| `soanas_procurement` | 11 | 11 | 0 | 0 | 0 |
| `soanas_payments_br` | 11 | 7 | 0 | 4 | 0 |
| `qa` | 11 | 11 | 0 | 0 | 0 |
| `directory` | 10 | 10 | 0 | 0 | 0 |
| `soanas_restaurant` | 10 | 10 | 0 | 0 | 0 |
| `soanas_finance` | 9 | 9 | 0 | 0 | 0 |
| `soanas_core/catalog-extension` | 8 | 8 | 0 | 0 | 0 |
| `soanas_reporting` | 7 | 7 | 0 | 0 | 0 |
| `catalog` | 6 | 6 | 0 | 0 | 0 |
| `wms` | 6 | 6 | 0 | 0 | 0 |
| `soanas_offline` | 6 | 6 | 0 | 0 | 0 |
| `telemetry/soanas_core` | 6 | 6 | 0 | 0 | 0 |
| `soanas_pos/soanas_core` | 5 | 5 | 0 | 0 | 0 |
| `auth/soanas_core` | 5 | 5 | 0 | 0 | 0 |
| `soanas_integrations` | 5 | 5 | 0 | 0 | 0 |
| `auth/staff` | 4 | 4 | 0 | 0 | 0 |
| `soanas_kds` | 4 | 4 | 0 | 0 | 0 |
| `data_sync/soanas_integrations` | 4 | 4 | 0 | 0 | 0 |
| `sales` | 3 | 3 | 0 | 0 | 0 |
| `soanas_core/customers-extension` | 3 | 3 | 0 | 0 | 0 |
| `soanas_loyalty` | 3 | 3 | 0 | 0 | 0 |
| `soanas_delivery` | 3 | 3 | 0 | 0 | 0 |
| `payment_gateways` | 2 | 2 | 0 | 0 | 0 |
| `soanas_pos/business_rules` | 2 | 2 | 0 | 0 | 0 |
| `customers` | 2 | 2 | 0 | 0 | 0 |
| `workflows/business_rules/notifications` | 2 | 2 | 0 | 0 | 0 |
| `audit_logs` | 1 | 1 | 0 | 0 | 0 |
<!-- soanas:derived-counts:end -->

---

## 2. O que foi feito

### 2.1 Ordem executada (obrigatória do prompt)

1. Auditoria do repositório (sem código Soanas pré-existente)
2. Matriz `BLUEPRINT-COVERAGE` com **303 IDs** estáveis
3. ADRs + specs + roadmap + riscos + licenças + runbooks
4. Baseline de testes Mercato
5. Só então implementação Fase 0 + início Fase 1 (cash)

### 2.2 Documentação criada

| Artefato | Caminho |
|----------|---------|
| Índice Soanas | `docs/soanas/README.md` |
| Este status (feito × falta × precisa) | `docs/soanas/STATUS-FEITO-VS-FALTA.md` |
| Auditoria overview | `docs/soanas/audit/00-repository-overview.md` |
| Mapa de reuso Mercato | `docs/soanas/audit/01-open-mercato-reuse-map.md` |
| Código Soanas existente (antes = nenhum) | `docs/soanas/audit/02-soanas-existing-code.md` |
| Gap analysis | `docs/soanas/audit/03-gap-analysis.md` |
| Riscos de arquitetura | `docs/soanas/audit/04-architecture-risks.md` |
| Mapa de dependências | `docs/soanas/audit/05-dependency-map.md` |
| Baseline de testes | `docs/soanas/audit/06-baseline-tests.md` |
| Matriz humana | `docs/soanas/BLUEPRINT-COVERAGE.md` |
| Matriz machine-readable | `docs/soanas/blueprint-coverage.json` |
| Roadmap técnico | `docs/soanas/ROADMAP.md` |
| Status de implementação | `docs/soanas/IMPLEMENTATION-STATUS.md` |
| Risk register | `docs/soanas/RISK-REGISTER.md` |
| Tech debt | `docs/soanas/TECH-DEBT.md` |
| Licenças / notices | `docs/licenses/DEPENDENCY_LICENSES.md`, `THIRD_PARTY_NOTICES.md` |
| Gerador da matriz | `scripts/soanas-generate-blueprint-coverage.mjs` |

### 2.3 ADRs (decisões travadas)

| ADR | Decisão |
|-----|---------|
| ADR-001 | Pacotes `soanas-*` **fora** de `packages/core` (upstream-friendly) |
| ADR-002 | `PosTransaction` orquestra; `SalesOrder` = verdade comercial |
| ADR-003 | Caixa = ledger **append-only** |
| ADR-004 | Fiscal BR isolado e versionado |
| ADR-005 | POS local-first + outbox/sync |
| ADR-006 | SPEC-022 Mercato POS **não** no core; Soanas POS é o produto |

Arquivos: `docs/soanas/adr/ADR-001-…` … `ADR-006-…`

### 2.4 Specs

| Spec | Escopo |
|------|--------|
| `.ai/specs/2026-09-15-soanas-foundation.md` | Fundação / core / establishments |
| `.ai/specs/2026-09-15-soanas-cash.md` | Caixa / ledger / sangria |
| `.ai/specs/2026-09-15-soanas-pos.md` | POS (Retail Sale v1 em código) |
| `.ai/specs/2026-09-15-soanas-fiscal-br.md` | Fiscal BR (ainda não implementado) |

### 2.5 Runbooks (stubs)

`docs/soanas/runbooks/`:

- `cash-discrepancy.md`
- `certificate-expired.md`
- `offline-sync-stuck.md`
- `payment-duplicate-investigation.md`
- `pix-payment-unknown.md`
- `printer-failure.md`
- `sefaz-outage.md`

### 2.6 Pacotes de código criados

| Package npm | Módulo id | Conteúdo real |
|-------------|-----------|---------------|
| `@open-mercato/soanas-core` | `soanas_core` | CNPJ alfanumérico, error model, perfis, catálogo ACL POS |
| `@open-mercato/soanas-establishments` | `soanas_establishments` | `FiscalEstablishment` + validators + commands CRUD + API + events + migration + i18n |
| `@open-mercato/soanas-cash` | `soanas_cash` | Register/Drawer/Session/Movement, ledger em centavos (`bigint`), open session, sangria, APIs, migration, i18n |

**Wiring app:**

- `apps/mercato/src/modules.ts` — módulos Soanas habilitados
- `apps/mercato/package.json` — deps dos pacotes

**Regra respeitada:** nenhum domínio Soanas em `packages/core`. Enterprise **não** copiado. Checkout **não** usado como PDV.

### 2.7 Árvore de código (principal)

```
packages/soanas-core/
  src/lib/{cnpj,errors,roles}.ts
  src/modules/soanas_core/{acl,index,setup}.ts
  src/__tests__/cnpj.test.ts

packages/soanas-establishments/
  src/modules/soanas_establishments/
    data/{entities,validators}.ts
    api/establishments/{route,openapi}.ts
    commands/establishments.ts
    migrations/Migration20260915090000_soanas_fiscal_establishments.ts
    events.ts, acl.ts, setup.ts, index.ts
    __tests__/validators.test.ts

packages/soanas-cash/
  src/modules/soanas_cash/
    data/{entities,validators}.ts
    lib/ledger.ts
    api/sessions/open/route.ts
    api/withdrawals/route.ts
    commands/cash.ts
    migrations/Migration20260915100000_soanas_cash.ts
    events.ts, acl.ts, setup.ts, index.ts
    __tests__/ledger.test.ts
```

### 2.8 APIs já expostas

| Método | Rota | Função |
|--------|------|--------|
| CRUD | `/api/soanas_establishments/establishments` | Estabelecimento fiscal |
| POST | `/api/soanas_cash/sessions/open` | Abrir sessão de caixa |
| POST | `/api/soanas_cash/withdrawals` | Criar sangria |

### 2.9 Comportamentos já no código (honestidade)

**soanas-core**

- Validação CNPJ string alfanumérico (NT 2026)
- Helpers de erro (`errorCode` / retryable / operatorAction)
- Features ACL POS declaradas (`AUTH-POS-*`, aprovação gerencial)
- Lista de perfis padrão Soanas

**soanas-establishments**

- Entidade com campos BR (razão, fantasia, CNPJ, IE/IM, CNAE, CRT, endereço, contador, ambiente, séries, CSC ref, certificado ref, PSP/adquirente ref, políticas)
- Commands CRUD + API list/create/update/delete
- Migration SQL gerada no pacote

**soanas-cash**

- Entidades de caixa + movimentos
- Ledger append-only em **centavos** (`bigint`) — sem float
- Abertura de sessão: fundo, denominações, idempotency key
- Sangria: valor, motivo, destino, saldo insuficiente, limite, dupla custódia, denominações
- **Não** há (ainda): suprimento, fechamento cego completo, reversão de sangria, UI, impressão, CRUD admin de registers

### 2.10 IDs com progresso

#### TESTED (9)

| ID | Resumo |
|----|--------|
| EST-003 | CNPJ alfanumérico |
| CASH-001 | Modelo Register/Drawer/Session/Movement |
| CASH-OPEN-001 | Abrir sessão (caixa/operador/fundo) |
| CASH-SANGRIA-001…004 | Criar sangria + saldo/limites/dupla custódia/denominações/ledger |
| ARCH-007 | Money sem float |
| ARCH-015 | Modelo de erro |

#### IMPLEMENTED (43) — scaffold / parcial

- **EST-001,002,004–015** — campos/entity/API establishment (certificado/Pix/adquirente = só refs)
- **AUTH-005**, **AUTH-POS-001…016**, **AUTH-APR-001** — ACL declarada (sem PIN UI / fluxo remoto completo)
- **CASH-002**, **CASH-OPEN-002…004**, **CASH-SANGRIA-005…006** — parcial (reversão/comprovante/relatórios incompletos)
- **ARCH-001,003,005,006,010** — pacotes, commands, idempotência, licenças

> Vários `IMPLEMENTED` **não** significam prontos para produção. Só `VALIDATED` fecha o ID.

### 2.11 Testes executados nesta branch

| Suite | Resultado |
|-------|-----------|
| `@open-mercato/shared` (baseline) | **1931 PASS** |
| `module-decoupling` (baseline) | **12 PASS** |
| `@open-mercato/soanas-core` | **4 PASS** |
| `@open-mercato/soanas-establishments` | **2 PASS** |
| `@open-mercato/soanas-cash` | **3 PASS** |
| `yarn generate` | módulos Soanas descobertos |

**Nota de ambiente:** Node **24** via nvm (engines do monorepo). Migrations **criadas**, `yarn db:migrate` **não** aplicado neste ambiente (Ask First).

### 2.12 Commits desta branch

1. `docs(soanas): audit repository and create blueprint coverage matrix`
2. `feat(soanas): scaffold soanas-core and fiscal establishments`
3. `feat(soanas-cash): add cash ledger, session open, and sangria`
4. `docs(soanas): add done-vs-missing status report` (+ atualizações deste arquivo)

---

## 3. O que falta

### 3.1 Pacotes ainda **não** criados

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

### 3.2 Domínios só `ANALYZED` (precisa implementar)

| Domínio | ~IDs | O que falta |
|---------|-----:|------------|
| Tenant/Org Soanas (planos/billing/isolamento fino) | 22 | `soanas-saas` + políticas por establishment |
| Catalog fiscal BR / tipos produto | 12 | extensão catalog + FiscalRule |
| Preços avançados Soanas | 7 | prioridade / aprovação |
| Inventory UX / inventário | 18 | UX sobre WMS + inventário cego/rotativo |
| Procurement | 11 | fornecedor → RFQ → PO → recebimento → XML |
| **POS** | 11+ | `PosTerminal`, `PosTransaction`, UI venda → `SalesOrder` |
| Cash restante | ~9 | suprimento, fechamento, turno, gaveta, conciliação, CRUD registers, UI |
| Payments / Pix / TEF / split | 13 | `soanas-payments-br` + tenders |
| Discounts / promoções | 4 | rules + UX POS |
| Customers BR / LGPD | 5 | CF / validators |
| Loyalty | 3 | `soanas-loyalty` |
| Finance (AR/AP/fiado) | 9 | `soanas-finance` |
| **Fiscal BR** | 13 | TaxEngine, NFC-e/NF-e/NFS-e, SEFAZ, A1, contingência |
| Hardware | 9+ | Device Agent, spooler, pinpad, balança |
| Offline | 6 | DB local + outbox + sync versionado |
| Restaurant / KDS / Delivery | 17 | módulos dedicados |
| Reporting | 7 | dashboards / fechamento |
| Audit / LGPD / Security | 11 | hardening + fluxos sensíveis |
| Integrations / automations BR | 13 | adapters + rules |
| Printing / SaaS / Observability / Perf / A11y / AI | 16 | vários |
| Suítes E2E Blueprint §94–111 | 11 | Playwright + cenários de falha |

### 3.3 Dívida no que **já** existe

| Item | Situação real |
|------|----------------|
| ACL POS | Features no catálogo; **sem** UI PIN / aprovação remota |
| EST certificado / Pix / adquirente | Campos de referência; **sem** upload A1 nem provider |
| Sangria | Create + validações; reversão / comprovante / impressão / relatórios **incompletos** |
| Suprimento / fechamento / turno | **Não** implementados |
| CashCount / CashReconciliation / CashApproval | Fluxo completo **não** |
| UI admin / UI POS | **Não** existem telas Soanas |
| Ligação venda → SalesOrder / estoque | **Não** |
| Demo seed / onboarding Soanas | **Não** |
| Migration no DB do ambiente | Arquivos existem; migrate **não** rodado |
| Integração / E2E Soanas | **Não** |
| `VALIDATED` | **0** |

### 3.4 Bloqueadores para “conectar ao externo”

Sem isto **não** homologa Pix / SEFAZ / TEF / hardware:

| Necessidade | Package | Status |
|-------------|---------|--------|
| `PixProvider` + mock + webhook/polling | `soanas-payments-br` | Não iniciado |
| `PaymentTerminalProvider` (TEF) + mock | `soanas-payments-br` / `soanas-hardware` | Não iniciado |
| `FiscalCore` + `TaxEngine` + `TaxSnapshot` | `soanas-fiscal-br` | Não iniciado |
| Adapters NFC-e / NF-e / NFS-e + schemas versionados | `soanas-fiscal-br` | Não iniciado |
| `CertificateService` A1 (upload, crypto, alertas) | `soanas-fiscal-br` | Só ref no EST |
| `SefazTransport` + fila + contingência + idempotência | `soanas-fiscal-br` | Não iniciado |
| Device Agent (impressora/gaveta/balança/leitor/pinpad) | `soanas-hardware` | Não iniciado |
| PrintJob spooler persistente | `soanas-hardware` | Não iniciado |
| Offline DB + Outbox + Sync | `soanas-offline` | Não iniciado |
| Feature flags `CODE_READY` / `SANDBOX_READY` / `CERTIFICATION_PENDING` | `soanas-saas` | Não iniciado |

---

## 4. O que **precisa** (de você / do ambiente / próximos agentes)

### 4.1 Para continuar o código (já possível sem credenciais externas)

1. Completar **cash** (suprimento, fechamento cego, reversão, CRUD registers, UI mínima)
2. Criar **`soanas-pos`** (terminal + transação + UI + orquestração `SalesOrder`)
3. Criar **contratos + mocks** de Pix / TEF / Fiscal / Printer **antes** de secrets reais
4. Atualizar `blueprint-coverage.json` a cada entrega + testes
5. Aplicar migrations quando autorizado (`yarn db:migrate` — Ask First)

### 4.2 Para sandbox / homologação (depois dos adapters)

| Item | Quem |
|------|------|
| Certificado A1 de testes + senha (secret store) | Ops / contabilidade |
| CSC + idCSC NFC-e (SEFAZ SP ou UF alvo) | Contabilidade / SEFAZ |
| Credenciais PSP Pix (sandbox) | Financeiro / PSP |
| Credenciais adquirente / TEF sandbox | Adquirente |
| Ambiente SEFAZ homologação | Contabilidade |
| Máquina/agent com impressora térmica / gaveta (lab) | Ops / QA |
| Decisão de UF piloto e CRT | Produto / fiscal |
| Política LGPD / retenção de logs fiscais | Jurídico / produto |

### 4.3 O que **não** fazer

- Não adicionar domínio Soanas em `packages/core`
- Não copiar `@open-mercato/enterprise`
- Não usar `packages/checkout` como PDV
- Não marcar `VALIDATED` sem DoD (teste + doc + integração onde couber)
- Não pedir credenciais reais antes de contratos + mocks + status `CODE_READY`

### 4.4 O que o Mercato já cobre (reutilizar)

Tenant/Organization, Auth/RBAC/Staff, Audit, Catalog, CRM, Sales (quote/order/invoice/credit memo/payments), Payment Gateway Hub, WMS fase 1, Workflows, Business Rules, Notifications, Feature toggles, Webhooks, Integrations hub, AI Assistant (fora do caminho crítico do caixa).

---

## 5. Ordem recomendada (próximos passos)

1. **Completar Cash** — suprimento, fechamento, reversão, CRUD, UI mínima  
2. **`soanas-pos`** — PosTerminal + PosTransaction + UI venda → SalesOrder  
3. **Contratos externos + mocks** — Pix / TEF / Fiscal / Printer  
4. **Fase 2 Fiscal SP + Pix** — A1, TaxEngine, NFC-e, contingência  
5. **Fase 3 Offline + Hardware Agent**  
6. **Fase 4 Restaurant + KDS**  
7. **Fase 5 Procurement + Finance**  
8. **Fases 6–8** reporting, loyalty, SaaS, hardening → gate `VALIDATED`

Detalhe: [`ROADMAP.md`](./ROADMAP.md).

---

## 6. Critério de “pronto de verdade”

O Soanas só estará concluído quando:

- `ANALYZED` = 0 e `IN_PROGRESS` = 0  
- Todo ID em `VALIDATED` **ou** `BLOCKED_EXTERNAL` com adapter + mock + testes + doc do bloqueio  
- E2E varejo / restaurante / offline / falhas (§108–111) passando  
- Auditoria final PASS em todas as áreas do prompt mestre  

**Estado atual:** fundação + início de caixa. Longe do gate final.

---

## 7. Como acompanhar / regenerar

```bash
# regenerar estrutura da matriz
node scripts/soanas-generate-blueprint-coverage.mjs

# contagem por status
node -e "const d=require('./docs/soanas/blueprint-coverage.json'); const b={}; for (const r of d.rows) b[r.status]=(b[r.status]||0)+1; console.log(b)"

# testes Soanas
yarn workspace @open-mercato/soanas-core test
yarn workspace @open-mercato/soanas-establishments test
yarn workspace @open-mercato/soanas-cash test
```

Índice geral: [`README.md`](./README.md).
