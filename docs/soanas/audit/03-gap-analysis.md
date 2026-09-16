# 03 — Gap Analysis

## Executive gap

| Camada | Cobertura estimada vs Blueprint | Gap principal |
|--------|--------------------------------:|---------------|
| Identidade / multi-tenant / RBAC | Alta | Perfis Soanas + aprovações POS |
| CRM / Catalog / Sales docs | Alta | Campos BR + orquestração PDV |
| Payment gateway genérico | Média-Alta | Pix/TEF/PaymentTender/split POS |
| WMS inventário | Média | UX inventário + picking avançado |
| POS / Cash / Offline / HW | **0%** | Construir integralmente |
| Fiscal BR | **0%** | Construir integralmente |
| Restaurant / KDS | **0%** | Construir integralmente |
| Procurement / Finance BR | **0%** | Construir integralmente |
| Loyalty / SaaS Soanas | **0%** | Construir |
| Reporting operacional | Baixa | Read models Soanas |

## Gaps por fase

### Fase 0 — Fundação
- Packages `soanas-*` inexistentes
- `FiscalEstablishment` inexistente
- Seeds de perfis/ACL Soanas inexistentes
- Branding/app Soanas inexistente
- Contratos versionados POS↔Cloud inexistentes
- Licenças third-party Soanas docs inexistentes (criando)

### Fase 1 — PDV Retail + Cash
- PosTerminal, PosTransaction, UI POS
- CashRegister ledger completo (sangria nível blueprint)
- Impressão básica (pode começar com mock printer)

### Fase 2 — Fiscal SP + Pix
- TaxEngine + TaxSnapshot
- NFC-e SP + certificado A1
- Pix dinâmico + conciliação

### Fase 3 — Offline + Hardware
- SQLite local, outbox, sync engine
- Device Agent ESC/POS/gaveta/balança/TEF

### Fase 4 — Restaurant + KDS
- Domínio completo mesas/comandas/modificadores/receitas
- KDS realtime

### Fase 5 — Procurement + Finance
- Supplier→RFQ→PO→GRN→AP
- AR/AP/conciliações

### Fase 6+ — Escala / reporting / loyalty / SaaS
- Multi-UF, NFS-e, marketplaces, analytics, planos

## Duplicação a evitar (gaps “negativos”)

Não criar gaps inventando paralelos a:
- CatalogProduct
- Customer (person/company)
- SalesOrder
- InventoryBalance

## Specs Mercato a reconciliar

| Spec | Ação Soanas |
|------|-------------|
| SPEC-022 POS | Não implementar como módulo core Mercato; Soanas POS é o produto. Documentar divergência em ADR. |
| SPEC-024 Financial | Soanas Finance cobre operacional BR; não depender da entrega Mercato. |
| WMS phases 2–5 | Consumir quando existirem; não bloquear Soanas em workarounds mínimos documentados. |
