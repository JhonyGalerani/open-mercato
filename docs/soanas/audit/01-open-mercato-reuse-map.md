# 01 — Open Mercato Reuse Map

Mapeamento do que o Blueprint Soanas deve **reutilizar** vs **estender** vs **construir**.

## Reutilizar diretamente (🟢)

| Capacidade Blueprint | Módulo / Package | Notas |
|----------------------|------------------|-------|
| Tenant | `directory` | `Tenant` entity |
| Organization hierarchy | `directory` | parent, ancestors, descendants |
| Auth / sessions | `auth` | users, roles, sessions |
| RBAC feature ACL | `auth` + `acl.ts` | feature IDs imutáveis |
| Staff | `staff` | teams, timesheets |
| Audit logs | `audit_logs` | action + access |
| Catalog products/variants/prices | `catalog` | price kinds, media, channels availability |
| Customers CRM | `customers` | people, companies, addresses, tags, CF |
| Sales quotes/orders | `sales` | lines, adjustments, shipments |
| Invoices / credit memos | `sales` | document factory |
| Sales payments / allocations | `sales` | commercial payments |
| Payment Gateway Hub | `payment_gateways` | sessions, capture, refund, webhooks, idempotency |
| Stripe adapter | `gateway-stripe` | referência de provider package |
| Checkout pay-links | `checkout` | **só** orquestração de pagamento web — não UI PDV |
| WMS phase 1 | `wms` | warehouses, zones, locations, lots, balances, reservations, movements |
| Workflows | `workflows` | definitions, instances, tasks |
| Business rules | `business_rules` | no-code conditions |
| Notifications / messages | `notifications`, `messages` | |
| Communication channels | `communication_channels` + `channel-*` | |
| Feature toggles | `feature_toggles` | global + tenant |
| Integrations hub | `integrations`, `data_sync`, `sync_excel` | |
| Webhooks | `webhooks` | Standard Webhooks |
| API keys | `api_keys` | |
| Custom fields / entities | `entities` | EAV + `ce.ts` |
| Events bus | `events` | DOM/portal bridges |
| Queue / scheduler | `queue`, `scheduler` | |
| Search | `search` | |
| AI assistant | `ai-assistant` | fora do caminho crítico da venda |
| Onboarding wizard framework | `onboarding` | |
| Dashboards framework | `dashboards` | |
| Currencies | `currencies` | BRL via config |
| Devices (mobile push) | `devices` | **não** é hardware PDV |
| Telemetry | `telemetry` | OTLP optional |
| UI / CrudForm / DataTable | `ui` | admin UX |
| Create standalone app | `create-app` | Soanas Cloud app |

## Estender (🟡)

| Capacidade | Base Mercato | Extensão Soanas |
|------------|--------------|-----------------|
| Estabelecimento BR | Organization | `FiscalEstablishment` (soanas_establishments) |
| Produto fiscal BR | catalog + CF | NCM/CEST/IBS/CBS rules + TaxSnapshot |
| Preços multi-canal loja | catalog prices | regras Soanas prioridade/aprovação |
| Inventário UX | wms cycle-count | inventário cego/rotativo/mobile |
| Devoluções | sales credit memo + wms | UX POS + motivos + quarentena |
| Descontos/promoções | sales adjustments + business_rules | limites POS + aprovação |
| Cliente BR | customers | CPF/CNPJ/LGPD fields |
| Orçamento UX | SalesQuote | WhatsApp/PDF fluxo loja |
| Delivery pedido | SalesOrder | soanas_delivery estados/entregador |
| Pagamentos BR | payment_gateways | Pix/TEF adapters + PaymentTender |
| Auditoria sensível | audit_logs | campos terminal/aprovador/motivo |
| Planos SaaS | feature_toggles | soanas_saas billing/quotas |
| Relatórios | dashboards | soanas_reporting read models |

## Construir (🔴)

| Domínio | Package alvo | Motivo |
|---------|--------------|--------|
| Establishments BR | `soanas-establishments` | CNPJ/fiscal config |
| POS terminal + UI + PosTransaction | `soanas-pos` | SPEC-022 não implementado |
| Cash ledger (sangria/suprimento/fecho) | `soanas-cash` | buraco crítico |
| Offline-first + sync | `soanas-offline` | inexistente |
| Hardware agent | `soanas-hardware` | devices ≠ PDV HW |
| Fiscal BR (NFC-e/NF-e/NFS-e) | `soanas-fiscal-br` | inexistente |
| Payments BR (Pix/TEF tenders) | `soanas-payments-br` | inexistente |
| Restaurant / mesas / comandas | `soanas-restaurant` | inexistente |
| KDS | `soanas-kds` | inexistente |
| Procurement | `soanas-procurement` | WMS marca procurement futuro |
| Finance (AR/AP/conciliação) | `soanas-finance` | SPEC-024 não implementado |
| Loyalty | `soanas-loyalty` | inexistente |
| Delivery ops | `soanas-delivery` | parcial via sales |
| Reporting | `soanas-reporting` | analytics separados de OLTP |
| Integrations BR | `soanas-integrations` | adapters locais |
| SaaS billing | `soanas-saas` | planos Soanas |
| Core shared Soanas | `soanas-core` | IDs, errors, ACL seeds, events helpers |

## WMS caution

| Confiável agora | Verificar antes de depender |
|-----------------|----------------------------|
| Warehouse, zone, location | ASN completo |
| Inventory balance / reservation | Putaway workflow completo |
| Lot / serial profile / movements | Pick wave / packing tasks |
| Receive / adjust / move / cycle-count APIs | Yard / dock / reverse logistics avançada |

Specs: `.ai/specs/2026-04-15-wms-*.md` (Draft).

## Anti-patterns (proibidos)

- `SoanasProduct` / `SoanasCustomer` / `SoanasOrder` / `SoanasStock` duplicando Mercato
- Transformar `packages/checkout` em tela de caixa
- Relação ORM direta entre módulos Soanas ↔ core
- Importar código de `packages/enterprise`
- Regras fiscais espalhadas em UI
