# Soanas — Blueprint Coverage Matrix

> **SSOT funcional:** Blueprint Funcional Completo (prompt mestre).  
> **Gerado em:** 2026-09-15  
> **Open Mercato base:** v0.7.0 @ `30d509eeb481ae4778be771d6c3992042add2d1a` (`main`)  
> **Regenerar:** `node scripts/soanas-generate-blueprint-coverage.mjs`

## Summary

<!-- soanas:coverage-summary:start -->
| Métrica | Valor |
|--------|------:|
| Total de IDs | 303 |
| ANALYZED | 227 |
| NOT_STARTED | 0 |
| IN_PROGRESS | 0 |
| IMPLEMENTED | 36 |
| TESTED | 20 |
| VALIDATED | 20 |
| BLOCKED_EXTERNAL | 0 |

```
Blueprint coverage (IDs): ANALYZED 227 | IMPLEMENTED 36 | TESTED 20 | VALIDATED 20 / 303
Validated (DoD completa): 6.6%
Derived at commit: 01e1ca952
```
<!-- soanas:coverage-summary:end -->

### Progresso overall

```
Overall progress: 6.6% VALIDATED (gate)
Derived from blueprint-coverage.json @ 01e1ca952
```

Percentuais de domínio em `IMPLEMENTATION-STATUS.md` são derivados desta matriz.

### Status válidos

`NOT_STARTED` · `ANALYZED` · `IN_PROGRESS` · `IMPLEMENTED` · `TESTED` · `VALIDATED` · `BLOCKED_EXTERNAL`

`BLOCKED_EXTERNAL` só para dependência externa real (credencial SEFAZ, adquirente, parceria iFood, etc.), com adapter+mock+testes prontos.

## Domínios

| Domínio | IDs |
|---------|----:|
| Architecture | 15 |
| Audit | 3 |
| Auth/RBAC | 26 |
| Automation | 4 |
| Cash | 21 |
| Catalog | 12 |
| Customers | 5 |
| Delivery | 3 |
| Discounts | 4 |
| Establishments | 15 |
| Finance | 9 |
| FiscalBR | 13 |
| Hardware | 9 |
| Integrations | 5 |
| Inventory | 12 |
| InventoryCount | 6 |
| IO | 4 |
| KDS | 4 |
| LGPD | 3 |
| Loyalty | 3 |
| Observability | 6 |
| Offline | 6 |
| Payments | 13 |
| POS | 11 |
| Prices | 7 |
| Printing | 3 |
| Procurement | 11 |
| Reporting | 7 |
| Restaurant | 10 |
| Retail | 3 |
| SaaS | 7 |
| SalesDocs | 5 |
| Security | 5 |
| Tenant/Org | 22 |
| Testing | 11 |

## Matrix

| ID | Domínio | Funcionalidade | Subfunção | Origem | Status | Módulo | Backend | Frontend | Database | API | Tests | Documentação | Dependências | Observações |
|----|---------|----------------|-----------|--------|--------|--------|---------|----------|----------|-----|-------|--------------|--------------|-------------|
| TENANT-001 | Tenant/Org | Tenant | Criar tenant | MERCATO | ANALYZED | directory | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | directory.Tenant | directory.Tenant |
| TENANT-002 | Tenant/Org | Tenant | Ativar/desativar tenant | MERCATO | ANALYZED | directory | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | isActive / soft patterns | isActive / soft patterns |
| TENANT-007 | Tenant/Org | Organization | Criar organização matriz | MERCATO | ANALYZED | directory | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | Organization hierarchy | Organization hierarchy |
| TENANT-008 | Tenant/Org | Organization | Criar filiais | MERCATO | ANALYZED | directory | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | parent/ancestors | parent/ancestors |
| TENANT-009 | Tenant/Org | Organization | Criar unidades operacionais | MERCATO | ANALYZED | directory | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | org tree | org tree |
| TENANT-010 | Tenant/Org | Organization | Organizar hierarquia | MERCATO | ANALYZED | directory | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | raiz/ancestrais/descendentes | raiz/ancestrais/descendentes |
| TENANT-011 | Tenant/Org | Visibility | Usuário ver uma ou várias orgs | MERCATO | ANALYZED | directory | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | auth ACL org scope | auth ACL org scope |
| TENANT-012 | Tenant/Org | Visibility | Visão consolidada de grupo | MERCATO | ANALYZED | directory | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | org descendants | org descendants |
| TENANT-013 | Tenant/Org | UX | Troca rápida de organização | MERCATO | ANALYZED | directory | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | org switcher UI | org switcher UI |
| TENANT-014 | Tenant/Org | Security | Bloquear dados entre tenants | MERCATO | ANALYZED | directory | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | tenant_id scoping | tenant_id scoping |
| TENANT-003 | Tenant/Org | Billing | Suspender tenant por billing | SOANAS | ANALYZED | soanas_saas | NO | NO | NO | NO | NO | AUDIT | soanas_saas | soanas_saas |
| TENANT-004 | Tenant/Org | Billing | Definir plano contratado | SOANAS | ANALYZED | soanas_saas | NO | NO | NO | NO | NO | AUDIT | soanas_saas | soanas_saas |
| TENANT-005 | Tenant/Org | Billing | Definir limites do plano | SOANAS | ANALYZED | soanas_saas | NO | NO | NO | NO | NO | AUDIT | feature toggles + quotas | feature toggles + quotas |
| TENANT-006 | Tenant/Org | Billing | Definir organizações permitidas | SOANAS | ANALYZED | soanas_saas | NO | NO | NO | NO | NO | AUDIT | plan limits | plan limits |
| TENANT-015 | Tenant/Org | Isolation | Isolar dados fiscais por estabelecimento | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | FiscalEstablishment | FiscalEstablishment |
| TENANT-016 | Tenant/Org | Isolation | Isolar caixa por estabelecimento | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | CashRegister scope | CashRegister scope |
| TENANT-017 | Tenant/Org | Isolation | Isolar estoque por estabelecimento/depósito | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | WMS warehouse + establishment | WMS warehouse + establishment |
| TENANT-018 | Tenant/Org | Config | Estoque compartilhado entre unidades | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | config flag | config flag |
| TENANT-019 | Tenant/Org | Config | Preços diferentes por unidade | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | catalog price + org | catalog price + org |
| TENANT-020 | Tenant/Org | Config | Cardápios diferentes por unidade | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | soanas_restaurant | soanas_restaurant |
| TENANT-021 | Tenant/Org | Config | Meios de pagamento por unidade | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | soanas_payments_br | soanas_payments_br |
| TENANT-022 | Tenant/Org | Config | Tributação diferente por CNPJ | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | FiscalEstablishment | FiscalEstablishment |
| EST-001 | Establishments | FiscalEstablishment | Entidade FiscalEstablishment | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | não poluir Organization | não poluir Organization |
| EST-002 | Establishments | Identificação | Razão social / nome fantasia | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | - | - |
| EST-003 | Establishments | Identificação | CNPJ como string alfanumérico | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | NT 2026 | NT 2026 |
| EST-004 | Establishments | Identificação | IE / IM / CNAE principal e secundários | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | - | - |
| EST-005 | Establishments | Identificação | CRT / regime tributário / regime especial | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | - | - |
| EST-006 | Establishments | Endereço | IBGE / UF / endereço / CEP / telefone / e-mail fiscal | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | - | - |
| EST-007 | Establishments | Contador | Contador responsável + CRC | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | - | - |
| EST-008 | Establishments | Ambiente | Homologação / produção | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | - | - |
| EST-009 | Establishments | Config | Depósito principal / tabela preço / canal padrão | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | FK IDs | FK IDs |
| EST-010 | Establishments | Config fiscal | Séries e numeração NFC-e / NF-e | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | - | - |
| EST-011 | Establishments | Config fiscal | CSC NFC-e + ID CSC | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | secret | secret |
| EST-012 | Establishments | Config | Certificado digital referência | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | soanas_fiscal_br | soanas_fiscal_br |
| EST-013 | Establishments | Config | PSP Pix / adquirentes | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | soanas_payments_br | soanas_payments_br |
| EST-014 | Establishments | Config | Impressora padrão / timezone / moeda BRL | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | - | - |
| EST-015 | Establishments | Políticas | Estoque negativo / caixa / descontos / cancelamentos | SOANAS | ANALYZED | soanas_establishments | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-001 | Auth/RBAC | Auth | Autenticação usuários | MERCATO | ANALYZED | auth/staff | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | auth module | auth module |
| AUTH-002 | Auth/RBAC | Staff | Funcionários / times | MERCATO | ANALYZED | auth/staff | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | staff module | staff module |
| AUTH-003 | Auth/RBAC | RBAC | ACL feature-based | MERCATO | ANALYZED | auth/staff | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | acl.ts pattern | acl.ts pattern |
| AUTH-004 | Auth/RBAC | Audit | Audit logs base | MERCATO | ANALYZED | auth/staff | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | audit_logs | audit_logs |
| AUTH-005 | Auth/RBAC | Perfis | Perfis padrão Soanas (proprietário…suporte) | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | role seed | role seed |
| AUTH-POS-001 | Auth/RBAC | Permissão POS | abrir/fechar caixa | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-002 | Auth/RBAC | Permissão POS | sangria / suprimento | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-003 | Auth/RBAC | Permissão POS | abrir gaveta sem venda | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-004 | Auth/RBAC | Permissão POS | cancelar item / venda | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-005 | Auth/RBAC | Permissão POS | desconto + limite percentual | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-006 | Auth/RBAC | Permissão POS | desconto acima limite com aprovação | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-007 | Auth/RBAC | Permissão POS | alterar preço / vender abaixo custo | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-008 | Auth/RBAC | Permissão POS | vender sem estoque | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-009 | Auth/RBAC | Permissão POS | editar/reabrir venda | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-010 | Auth/RBAC | Permissão POS | estornar pagamento / devolver / crédito | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-011 | Auth/RBAC | Permissão POS | cancelar documento fiscal / inutilizar | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-012 | Auth/RBAC | Permissão POS | ajustar/inventariar estoque | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-013 | Auth/RBAC | Permissão POS | visualizar custo/margem/faturamento/lucro | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-014 | Auth/RBAC | Permissão POS | visualizar fechamento outros caixas | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-015 | Auth/RBAC | Permissão POS | cadastrar clientes / limite crédito / fiado | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-POS-016 | Auth/RBAC | Permissão POS | editar config fiscal / hardware | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-APR-001 | Auth/RBAC | Aprovação | PIN gerente / senha / supervisor | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-APR-002 | Auth/RBAC | Aprovação | Aprovação remota | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-APR-003 | Auth/RBAC | Aprovação | Motivo + quem solicitou/aprovou + terminal + hora | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-APR-004 | Auth/RBAC | Aprovação | Valor antes/depois | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUTH-APR-005 | Auth/RBAC | Aprovação | Dupla custódia (impedir self-approve) | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| CAT-001 | Catalog | Produto | Cadastro básico (nome, SKU, GTIN, categoria…) | MERCATO | ANALYZED | catalog | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | catalog products | catalog products |
| CAT-002 | Catalog | Produto | Imagens / status / disponibilidade canais | MERCATO | ANALYZED | catalog | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| CAT-003 | Catalog | Variantes | Variantes/SKU/preço/estoque próprio | MERCATO | ANALYZED | catalog | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | CatalogProductVariant | CatalogProductVariant |
| CAT-004 | Catalog | Preços | Price kinds / faixas / validade / moeda | MERCATO | ANALYZED | catalog | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| CAT-005 | Catalog | Tipos | Tipos produto (kit, combo, peso, serial, lote…) | SOANAS | ANALYZED | soanas_core/catalog-extension | NO | NO | NO | NO | NO | AUDIT | extension + CF | extension + CF |
| CAT-FISCAL-001 | Catalog | Fiscal produto | NCM/CEST/origem/CFOP/CST/CSOSN | SOANAS | ANALYZED | soanas_core/catalog-extension | NO | NO | NO | NO | NO | AUDIT | - | - |
| CAT-FISCAL-002 | Catalog | Fiscal produto | ICMS/ST/FCP/PIS/COFINS/IPI | SOANAS | ANALYZED | soanas_core/catalog-extension | NO | NO | NO | NO | NO | AUDIT | - | - |
| CAT-FISCAL-003 | Catalog | Fiscal produto | IBS/CBS/IS / classificação RTC | SOANAS | ANALYZED | soanas_core/catalog-extension | NO | NO | NO | NO | NO | AUDIT | Reforma 2026 | Reforma 2026 |
| CAT-FISCAL-004 | Catalog | Fiscal produto | Benefícios / códigos estaduais / GTIN tributável | SOANAS | ANALYZED | soanas_core/catalog-extension | NO | NO | NO | NO | NO | AUDIT | - | - |
| CAT-FISCAL-005 | Catalog | Fiscal produto | Tributação por UF/regime + versionamento | SOANAS | ANALYZED | soanas_core/catalog-extension | NO | NO | NO | NO | NO | AUDIT | FiscalRule | FiscalRule |
| CAT-006 | Catalog | Códigos | PLU / código barras secundário / código interno | SOANAS | ANALYZED | soanas_core/catalog-extension | NO | NO | NO | NO | NO | AUDIT | - | - |
| CAT-007 | Catalog | Canais | Disponível PDV / ecommerce / delivery | SOANAS | ANALYZED | soanas_core/catalog-extension | NO | NO | NO | NO | NO | AUDIT | flags | flags |
| PRICE-001 | Prices | Tabelas | Preço padrão / kinds / faixas | MERCATO | ANALYZED | catalog | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| PRICE-002 | Prices | Regras | Validade temporal de preços | MERCATO | ANALYZED | catalog | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| PRICE-003 | Prices | Tabelas | Atacado/varejo/ecommerce/delivery/filial/canal/grupo | SOANAS | ANALYZED | soanas_pos/soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| PRICE-004 | Prices | Tabelas | Especial/temporário/promocional/quantidade | SOANAS | ANALYZED | soanas_pos/soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| PRICE-005 | Prices | Regras | Dia semana / horário / min-max qty / prioridade | SOANAS | ANALYZED | soanas_pos/soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| PRICE-006 | Prices | Regras | Fallback / impedir negativo / alerta abaixo custo | SOANAS | ANALYZED | soanas_pos/soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| PRICE-007 | Prices | Regras | Margem mínima / aprovação preço manual | SOANAS | ANALYZED | soanas_pos/soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| INV-001 | Inventory | Depósitos | Warehouse / zones / locations | MERCATO | ANALYZED | wms | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | WMS phase 1 | WMS phase 1 |
| INV-002 | Inventory | Saldo | Físico/reservado/alocado/disponível | MERCATO | ANALYZED | wms | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | InventoryBalance | InventoryBalance |
| INV-003 | Inventory | Movimentos | Ledger append-only | MERCATO | ANALYZED | wms | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | InventoryMovement | InventoryMovement |
| INV-004 | Inventory | Lotes | Lot / validade / status | MERCATO | ANALYZED | wms | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | InventoryLot | InventoryLot |
| INV-005 | Inventory | Seriais | Serial tracking base | MERCATO | ANALYZED | wms | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | profile flags | profile flags |
| INV-006 | Inventory | Reorder | Reorder point / safety stock | MERCATO | ANALYZED | wms | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | ProductInventoryProfile | ProductInventoryProfile |
| INV-007 | Inventory | Depósitos tipados | Vendas/cozinha/bar/recebimento/avarias/quarentena/central/trânsito | SOANAS | ANALYZED | soanas_core/wms-ux | NO | NO | NO | NO | NO | AUDIT | config overlay | config overlay |
| INV-008 | Inventory | Saldo estendido | Em trânsito/avariado/bloqueado/vencido/futuro | SOANAS | ANALYZED | soanas_core/wms-ux | NO | NO | NO | NO | NO | AUDIT | - | - |
| INV-009 | Inventory | Movimentos UX | Venda/devolução/perda/quebra/produção/desmontagem | SOANAS | ANALYZED | soanas_core/wms-ux | NO | NO | NO | NO | NO | AUDIT | orchestration | orchestration |
| INV-010 | Inventory | Lotes avançados | FEFO / bloquear vencido / rastrear venda | SOANAS | ANALYZED | soanas_core/wms-ux | NO | NO | NO | NO | NO | AUDIT | - | - |
| INV-011 | Inventory | Seriais avançados | Garantia / histórico / cliente comprador | SOANAS | ANALYZED | soanas_core/wms-ux | NO | NO | NO | NO | NO | AUDIT | - | - |
| INV-012 | Inventory | Alertas | Mín/máx/segurança/reposição/lead time/sugestão compra | SOANAS | ANALYZED | soanas_core/wms-ux | NO | NO | NO | NO | NO | AUDIT | - | - |
| INVCOUNT-001 | InventoryCount | Inventário | Abrir inventário / escopo loja-depósito-categoria | MERCATO+SOANAS | ANALYZED | soanas_core/wms-ux | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | cycle-count API existe; UX inventário Soanas não | cycle-count API existe; UX inventário Soanas não |
| INVCOUNT-002 | InventoryCount | Contagem | Total/parcial/cega/visível | SOANAS | ANALYZED | soanas_core/wms-ux | NO | NO | NO | NO | NO | AUDIT | - | - |
| INVCOUNT-003 | InventoryCount | Fluxo | 1ª contagem / recontagem / divergência / aprovação | SOANAS | ANALYZED | soanas_core/wms-ux | NO | NO | NO | NO | NO | AUDIT | - | - |
| INVCOUNT-004 | InventoryCount | Ops | Bloqueio movimentação / contínuo / rotativo | SOANAS | ANALYZED | soanas_core/wms-ux | NO | NO | NO | NO | NO | AUDIT | - | - |
| INVCOUNT-005 | InventoryCount | Captura | Barcode / mobile / import-export planilha | SOANAS | ANALYZED | soanas_core/wms-ux | NO | NO | NO | NO | NO | AUDIT | - | - |
| INVCOUNT-006 | InventoryCount | Audit | Auditor / motivo / perdas / trilha | SOANAS | ANALYZED | soanas_core/wms-ux | NO | NO | NO | NO | NO | AUDIT | - | - |
| PROC-SUP-001 | Procurement | Fornecedor | Cadastro completo (CNPJ, IE, contatos, prazos…) | SOANAS | ANALYZED | soanas_procurement | NO | NO | NO | NO | NO | AUDIT | CRM company + SupplierProfile | CRM company + SupplierProfile |
| PROC-SUP-002 | Procurement | Fornecedor | Produtos fornecidos / código fornecedor / preços | SOANAS | ANALYZED | soanas_procurement | NO | NO | NO | NO | NO | AUDIT | - | - |
| PROC-SUP-003 | Procurement | Fornecedor | Avaliação / status / histórico preços | SOANAS | ANALYZED | soanas_procurement | NO | NO | NO | NO | NO | AUDIT | - | - |
| PROC-REQ-001 | Procurement | Solicitação | Manual / auto mínimo / previsão / ruptura / produção | SOANAS | ANALYZED | soanas_procurement | NO | NO | NO | NO | NO | AUDIT | - | - |
| PROC-REQ-002 | Procurement | Solicitação | Prioridade / solicitante / justificativa / aprovação | SOANAS | ANALYZED | soanas_procurement | NO | NO | NO | NO | NO | AUDIT | - | - |
| PROC-RFQ-001 | Procurement | Cotação | Múltiplos fornecedores / comparação / seleção | SOANAS | ANALYZED | soanas_procurement | NO | NO | NO | NO | NO | AUDIT | - | - |
| PROC-PO-001 | Procurement | Pedido compra | PO completo + aprovação + PDF + e-mail/WhatsApp | SOANAS | ANALYZED | soanas_procurement | NO | NO | NO | NO | NO | AUDIT | - | - |
| PROC-RCV-001 | Procurement | Recebimento | Parcial/integral/divergência/cego/lotes/seriais | SOANAS | ANALYZED | soanas_procurement | NO | NO | NO | NO | NO | AUDIT | - | - |
| PROC-RCV-002 | Procurement | Recebimento | Entrada estoque + custo atualizado | SOANAS | ANALYZED | soanas_procurement | NO | NO | NO | NO | NO | AUDIT | WMS receive | WMS receive |
| PROC-NFE-001 | Procurement | NF-e entrada | Importar XML / chave / mapear SKU / AP | SOANAS | ANALYZED | soanas_procurement | NO | NO | NO | NO | NO | AUDIT | - | - |
| PROC-NFE-002 | Procurement | NF-e entrada | Validar qty / gerar entrada / AP / arquivar / duplicidade | SOANAS | ANALYZED | soanas_procurement | NO | NO | NO | NO | NO | AUDIT | - | - |
| POS-001 | POS | Terminal | Entidade PosTerminal | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | - | - |
| POS-002 | POS | Terminal | Cadastro (código, estabelecimento, hardware, versão…) | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | - | - |
| POS-003 | POS | Terminal | Online/offline / ativo/bloqueado / versão mínima | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | - | - |
| POS-UI-001 | POS | Venda | Busca barcode/SKU/PLU/nome/fuzzy/favoritos/teclas | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | - | - |
| POS-UI-002 | POS | Venda | Adicionar item (qty, peso, variante, lote, serial…) | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | - | - |
| POS-UI-003 | POS | Venda | Alterar/remover/cancelar item com motivo | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | - | - |
| POS-UI-004 | POS | Venda | Totais (subtotal, descontos, impostos, troco…) | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | Sales totals + POS | Sales totals + POS |
| POS-TXN-001 | POS | PosTransaction | Orquestrador (não duplicar SalesOrder) | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | ADR | ADR |
| POS-TXN-002 | POS | State machine | DRAFT→…→COMPLETED + failure states | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | - | - |
| POS-HOLD-001 | POS | Pré-venda | Suspender/nomear/retomar/transferir/expirar | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | - | - |
| POS-HOLD-002 | POS | Pré-venda | Reservar estoque opcional / auditar | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-001 | Cash | Estrutura | CashRegister / Drawer / Session / Movement / Count / Reconciliation / Approval | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-002 | Cash | Caixa lógico | Código / estabelecimento / terminal / gaveta / depósito | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-OPEN-001 | Cash | Abertura | Selecionar caixa / operador / fundo inicial | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-OPEN-002 | Cash | Abertura | Contagem por denominações BRL | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-OPEN-003 | Cash | Abertura | Comparar fundo esperado / justificar / gerente | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-OPEN-004 | Cash | Abertura | Sessão única / timestamps server+local / offline | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-SANGRIA-001 | Cash | Sangria | Criar sangria (valor, motivo, destino, responsável) | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-SANGRIA-002 | Cash | Sangria | Validar saldo físico / limites / aprovação / PIN | SOANAS | IMPLEMENTED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | Server-side register limit + dual custody + physical balance check; PIN factor not implemented | Server-side register limit + dual custody + physical balance check; PIN factor not implemented |
| CASH-SANGRIA-003 | Cash | Sangria | Dupla custódia / sessão aberta / sem edição pós-confirmação | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-SANGRIA-004 | Cash | Sangria | Denominações / ledger / não alterar faturamento | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-SANGRIA-005 | Cash | Sangria | Reversão (não exclusão) + vínculo | SOANAS | IMPLEMENTED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | Reversal command appends a compensating movement and flags the original | Reversal command appends a compensating movement and flags the original |
| CASH-SANGRIA-006 | Cash | Sangria | Comprovante térmico / auditoria / sync / alertas / relatórios | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-SUPPLY-001 | Cash | Suprimento | Criar suprimento (origem, motivo, denominações, aprovação) | SOANAS | IMPLEMENTED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | Supply command with origin, approval policy, denominations and idempotency | Supply command with origin, approval policy, denominations and idempotency |
| CASH-SUPPLY-002 | Cash | Suprimento | Comprovante / saldo esperado / reversão / auditoria | SOANAS | IMPLEMENTED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | Abstract receipt payload + reversal; thermal rendering pending | Abstract receipt payload + reversal; thermal rendering pending |
| CASH-DRAWER-001 | Cash | Gaveta | Abertura sem venda (permissão, motivo, evento, alertas) | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-CLOSE-001 | Cash | Fechamento | Bloquear vendas / pendências Pix/cartão/fiscal/offline | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-CLOSE-002 | Cash | Fechamento | Contagem meios + fechamento cego | SOANAS | IMPLEMENTED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | Closing count with blind mode; multi-tender counting pending | Closing count with blind mode; multi-tender counting pending |
| CASH-CLOSE-003 | Cash | Fechamento | Conciliação matemática expected vs counted | SOANAS | IMPLEMENTED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | CashReconciliation expected vs counted with register tolerance | CashReconciliation expected vs counted with register tolerance |
| CASH-CLOSE-004 | Cash | Fechamento | Resultado por pagamento / PDF / e-mail / financeiro | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-SHIFT-001 | Cash | Turno | Troca operador mantendo caixa / exigindo fechamento | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| CASH-SHIFT-002 | Cash | Turno | Pausa / bloqueio / login rápido PIN / comissão | SOANAS | ANALYZED | soanas_cash | NO | NO | NO | NO | NO | AUDIT | - | - |
| PAY-GW-001 | Payments | Gateway Hub | Sessão / auth-capture / cancel / refund / webhooks / idempotência | MERCATO | ANALYZED | payment_gateways | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| PAY-SALES-001 | Payments | SalesPayment | Pagamentos comerciais + allocations | MERCATO | ANALYZED | payment_gateways | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | sales | sales |
| PAY-001 | Payments | PaymentTender | Tender operacional POS separado de SalesPayment | SOANAS | ANALYZED | soanas_payments_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| PAY-CASH-001 | Payments | Dinheiro | Recebido / troco / limite / arredondamento / cédulas | SOANAS | ANALYZED | soanas_payments_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| PAY-CARD-001 | Payments | Débito/Crédito | TEF/SmartPOS/POS externo / NSU / bandeira / parcelas | SOANAS | ANALYZED | soanas_payments_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| PAY-PIX-001 | Payments | Pix | QR dinâmico / copia-cola / txid / expiração / webhook / polling | SOANAS | ANALYZED | soanas_payments_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| PAY-PIX-002 | Payments | Pix | Conciliação / duplicidade / devolução parcial / recibo | SOANAS | ANALYZED | soanas_payments_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| PAY-SPLIT-001 | Payments | Split | N formas / restante tempo real / cancelar parcela | SOANAS | ANALYZED | soanas_payments_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| PAY-VOUCHER-001 | Payments | Voucher | VR/VA/interno/convênio/gift | SOANAS | ANALYZED | soanas_payments_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| PAY-ERR-001 | Payments | Erros | Estados iniciado…requer conciliação | SOANAS | ANALYZED | soanas_payments_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| PAY-ERR-002 | Payments | Erros | PAYMENT_UNKNOWN — não re-cobrar / idempotency / conciliação | SOANAS | ANALYZED | soanas_payments_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| PAY-CANCEL-001 | Payments | Cancelamento venda | Antes/depois pagamento e fiscal / estorno / estoque | SOANAS | ANALYZED | soanas_payments_br | NO | NO | NO | NO | NO | AUDIT | orchestration | orchestration |
| PAY-RETURN-001 | Payments | Devolução | Localizar venda / parcial / restituição / auditoria | MERCATO+SOANAS | ANALYZED | soanas_payments_br | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | Sales credit memo + UX | Sales credit memo + UX |
| DISC-001 | Discounts | Adjustments | Desconto/acréscimo sales adjustments | MERCATO | ANALYZED | sales | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| DISC-002 | Discounts | Manual | Percentual/valor/item/venda + limites/aprovação | SOANAS | ANALYZED | soanas_pos/business_rules | NO | NO | NO | NO | NO | AUDIT | - | - |
| DISC-003 | Discounts | Promoções | X por Y / leve-pague / combo / happy hour / cupom… | SOANAS | ANALYZED | soanas_pos/business_rules | NO | NO | NO | NO | NO | AUDIT | business_rules | business_rules |
| DISC-004 | Discounts | Promoções | Prioridade / empilhamento / limites uso | SOANAS | ANALYZED | soanas_pos/business_rules | NO | NO | NO | NO | NO | AUDIT | - | - |
| CRM-001 | Customers | CRM | Pessoas / empresas / endereços / tags / atividades | MERCATO | ANALYZED | customers | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| CRM-002 | Customers | CRM | Custom fields | MERCATO | ANALYZED | customers | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | entities | entities |
| CRM-003 | Customers | Brasil PF | CPF / nascimento / WhatsApp / LGPD consent | SOANAS | ANALYZED | soanas_core/customers-extension | NO | NO | NO | NO | NO | AUDIT | CF + validators | CF + validators |
| CRM-004 | Customers | Brasil PJ | CNPJ / IE / indicador IE | SOANAS | ANALYZED | soanas_core/customers-extension | NO | NO | NO | NO | NO | AUDIT | - | - |
| CRM-005 | Customers | Histórico | Compras / ticket / favoritos / pontos / crédito | SOANAS | ANALYZED | soanas_core/customers-extension | NO | NO | NO | NO | NO | AUDIT | reporting + loyalty | reporting + loyalty |
| LOY-001 | Loyalty | Pontos | Acúmulo / resgate / validade / níveis | SOANAS | ANALYZED | soanas_loyalty | NO | NO | NO | NO | NO | AUDIT | - | - |
| LOY-002 | Loyalty | Cashback | Saldo / extrato / estorno devolução | SOANAS | ANALYZED | soanas_loyalty | NO | NO | NO | NO | NO | AUDIT | - | - |
| LOY-003 | Loyalty | Campanhas | Aniversário / indicação / antifraude | SOANAS | ANALYZED | soanas_loyalty | NO | NO | NO | NO | NO | AUDIT | - | - |
| FIN-CREDIT-001 | Finance | Fiado | Limite / saldo / vencimento / parcelas / aprovação | SOANAS | ANALYZED | soanas_finance | NO | NO | NO | NO | NO | AUDIT | - | - |
| FIN-CREDIT-002 | Finance | Fiado | Juros/multa/renegociação/parcial/inadimplência | SOANAS | ANALYZED | soanas_finance | NO | NO | NO | NO | NO | AUDIT | - | - |
| FISCAL-001 | FiscalBR | Arquitetura | FiscalCore / TaxEngine / adapters / Certificate / Sefaz / Queue / Storage | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| FISCAL-RULE-001 | FiscalBR | FiscalRule | Regra versionada (estabelecimento, UF, NCM, vigência…) | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| FISCAL-ENG-001 | FiscalBR | Engine | Calcular / simular / explicar / TaxSnapshot | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | nunca recalcular histórico | nunca recalcular histórico |
| FISCAL-CERT-001 | FiscalBR | Certificado | A1 PFX upload / senha criptografada / validar CNPJ | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| FISCAL-CERT-002 | FiscalBR | Certificado | Alertas 60/30/15/7/vencido / rotação / trilha | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| FISCAL-NFCE-001 | FiscalBR | NFC-e | Emissão modelo 65 completa | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | SP 2026 | SP 2026 |
| FISCAL-NFCE-002 | FiscalBR | NFC-e | Status / rejeições amigáveis / correção | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| FISCAL-NFCE-003 | FiscalBR | NFC-e | Contingência + fila retransmissão + idempotência | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| FISCAL-NFCE-004 | FiscalBR | NFC-e | Cancelamento / inutilização / XML storage | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| FISCAL-NFE-001 | FiscalBR | NF-e | Modelo 55 B2B/transferência/devolução/remessa… | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| FISCAL-NFE-002 | FiscalBR | NF-e | CC-e / contingência / IBS-CBS / schemas versionados | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| FISCAL-NFSE-001 | FiscalBR | NFS-e | Padrão nacional + adaptadores municipais | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| FISCAL-NFSE-002 | FiscalBR | NFS-e | ISS / retenções / IBS-CBS / cancelamento | SOANAS | ANALYZED | soanas_fiscal_br | NO | NO | NO | NO | NO | AUDIT | - | - |
| HW-001 | Hardware | Agent | Soanas Device Agent local | SOANAS | ANALYZED | soanas_hardware | NO | NO | NO | NO | NO | AUDIT | não usar devices Mercato | não usar devices Mercato |
| HW-PRT-001 | Hardware | Impressora | ESC/POS multi-transport / fabricantes | SOANAS | ANALYZED | soanas_hardware | NO | NO | NO | NO | NO | AUDIT | - | - |
| HW-PRT-002 | Hardware | Impressão | Cupom/DANFE/cozinha/sangria/fechamento… | SOANAS | ANALYZED | soanas_hardware | NO | NO | NO | NO | NO | AUDIT | - | - |
| HW-PRT-003 | Hardware | Spool | PrintJob queue estados + retry + reimpressão | SOANAS | ANALYZED | soanas_hardware | NO | NO | NO | NO | NO | AUDIT | - | - |
| HW-DRW-001 | Hardware | Gaveta | Pulso / abrir em dinheiro/sangria/suprimento/manual | SOANAS | ANALYZED | soanas_hardware | NO | NO | NO | NO | NO | AUDIT | - | - |
| HW-SCN-001 | Hardware | Leitor | HID/serial / pesável / debounce | SOANAS | ANALYZED | soanas_hardware | NO | NO | NO | NO | NO | AUDIT | - | - |
| HW-SCL-001 | Hardware | Balança | Protocolos / estabilidade / tara / kg-g | SOANAS | ANALYZED | soanas_hardware | NO | NO | NO | NO | NO | AUDIT | - | - |
| HW-TEF-001 | Hardware | Pinpad/TEF | PaymentTerminalProvider abstraction | SOANAS | ANALYZED | soanas_hardware | NO | NO | NO | NO | NO | AUDIT | - | - |
| HW-DSP-001 | Hardware | Display cliente | Produto/totais/QR Pix/agradecimento | SOANAS | ANALYZED | soanas_hardware | NO | NO | NO | NO | NO | AUDIT | - | - |
| OFFLINE-001 | Offline | Local DB | SQLite criptografado + catálogo/preços/caixa/vendas | SOANAS | ANALYZED | soanas_offline | NO | NO | NO | NO | NO | AUDIT | - | - |
| OFFLINE-002 | Offline | Outbox | OfflineOutboxEntry completo + estados | SOANAS | ANALYZED | soanas_offline | NO | NO | NO | NO | NO | AUDIT | - | - |
| OFFLINE-003 | Offline | Sync | Push/pull incremental / cursor / retry / backoff | SOANAS | ANALYZED | soanas_offline | NO | NO | NO | NO | NO | AUDIT | - | - |
| OFFLINE-004 | Offline | Conflitos | Políticas determinísticas (não LWW dinheiro/fiscal/estoque) | SOANAS | ANALYZED | soanas_offline | NO | NO | NO | NO | NO | AUDIT | - | - |
| OFFLINE-005 | Offline | Health UI | Online/offline/sync/pendências/erros | SOANAS | ANALYZED | soanas_offline | NO | NO | NO | NO | NO | AUDIT | - | - |
| OFFLINE-006 | Offline | Resiliência | Recuperação crash / journal / confirmação cloud | SOANAS | ANALYZED | soanas_offline | NO | NO | NO | NO | NO | AUDIT | - | - |
| REST-001 | Restaurant | Áreas | Salão/varanda/bar/… | SOANAS | ANALYZED | soanas_restaurant | NO | NO | NO | NO | NO | AUDIT | - | - |
| REST-002 | Restaurant | Mesas | Mapa visual / estados / unir / transferir | SOANAS | ANALYZED | soanas_restaurant | NO | NO | NO | NO | NO | AUDIT | - | - |
| REST-003 | Restaurant | Comanda | Abertura / consumo / transferências / divisão conta | SOANAS | ANALYZED | soanas_restaurant | NO | NO | NO | NO | NO | AUDIT | - | - |
| REST-004 | Restaurant | Cardápio | Categorias / disponibilidade / 86 / limite diário | SOANAS | ANALYZED | soanas_restaurant | NO | NO | NO | NO | NO | AUDIT | - | - |
| REST-005 | Restaurant | Modificadores | Grupos obrigatórios/opcionais / preço / estoque | SOANAS | ANALYZED | soanas_restaurant | NO | NO | NO | NO | NO | AUDIT | - | - |
| REST-006 | Restaurant | Receita | Ficha técnica / rendimento / baixa estoque | SOANAS | ANALYZED | soanas_restaurant | NO | NO | NO | NO | NO | AUDIT | WMS | WMS |
| REST-007 | Restaurant | Garçom | PWA login PIN / mesas / pedidos / offline LAN | SOANAS | ANALYZED | soanas_restaurant | NO | NO | NO | NO | NO | AUDIT | - | - |
| REST-008 | Restaurant | Taxa/gorjeta | Percentual / remoção / rateio / fiscal | SOANAS | ANALYZED | soanas_restaurant | NO | NO | NO | NO | NO | AUDIT | - | - |
| REST-009 | Restaurant | Reservas | Reservas + waitlist + no-show | SOANAS | ANALYZED | soanas_restaurant | NO | NO | NO | NO | NO | AUDIT | - | - |
| REST-010 | Restaurant | Balcão/senha | Pedido rápido / painel chamadas | SOANAS | ANALYZED | soanas_restaurant | NO | NO | NO | NO | NO | AUDIT | - | - |
| KDS-001 | KDS | Estações | Cozinha/bar/chapa/… + roteamento | SOANAS | ANALYZED | soanas_kds | NO | NO | NO | NO | NO | AUDIT | - | - |
| KDS-002 | KDS | Tickets | Ticket/itens / status / recall / prioridade | SOANAS | ANALYZED | soanas_kds | NO | NO | NO | NO | NO | AUDIT | - | - |
| KDS-003 | KDS | Tempos | SLA amarelo/vermelho / médias / gargalo | SOANAS | ANALYZED | soanas_kds | NO | NO | NO | NO | NO | AUDIT | - | - |
| KDS-004 | KDS | Realtime | SSE/WebSocket preferido a polling agressivo | SOANAS | ANALYZED | soanas_kds | NO | NO | NO | NO | NO | AUDIT | events | events |
| DEL-001 | Delivery | Pedido | Entrega/retirada/agendado + taxa + zona | SOANAS | ANALYZED | soanas_delivery | NO | NO | NO | NO | NO | AUDIT | Sales + Soanas | Sales + Soanas |
| DEL-002 | Delivery | Fluxo | Recebido→entregue / cancelado | SOANAS | ANALYZED | soanas_delivery | NO | NO | NO | NO | NO | AUDIT | - | - |
| DEL-003 | Delivery | Entregador | Cadastro / atribuição / comissão | SOANAS | ANALYZED | soanas_delivery | NO | NO | NO | NO | NO | AUDIT | - | - |
| RETAIL-001 | Retail | Roupas | Grade cor/tamanho/coleção / etiqueta | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | catalog variants | catalog variants |
| RETAIL-002 | Retail | Mercado | Peso / balança / pesável / atacarejo | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | - | - |
| RETAIL-003 | Retail | Construção | m/m²/volume / encomenda / obra / NF-e | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | - | - |
| SALES-QUOTE-001 | SalesDocs | Orçamento | SalesQuote completo | MERCATO | ANALYZED | sales | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| SALES-ORDER-001 | SalesDocs | Pedido | SalesOrder lifecycle | MERCATO | ANALYZED | sales | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| SALES-QUOTE-002 | SalesDocs | Orçamento UX | PDF/WhatsApp/converter/reservar/expirar | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | extensão UX | extensão UX |
| SALES-PICK-001 | SalesDocs | Picking | Onda/tarefa/divergência/pack/despacho | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | WMS roadmap — verificar | WMS roadmap — verificar |
| SALES-XFER-001 | SalesDocs | Transferência lojas | Solicitação→trânsito→recebimento→fiscal | SOANAS | ANALYZED | soanas_pos | NO | NO | NO | NO | NO | AUDIT | - | - |
| FIN-AR-001 | Finance | Contas a receber | Origem venda / parcelas / baixa / inadimplência | SOANAS | ANALYZED | soanas_finance | NO | NO | NO | NO | NO | AUDIT | - | - |
| FIN-AP-001 | Finance | Contas a pagar | Fornecedor / compra / aprovação / pagamento | SOANAS | ANALYZED | soanas_finance | NO | NO | NO | NO | NO | AUDIT | - | - |
| FIN-CASH-001 | Finance | Caixa financeiro | Contas / banco / Pix / cartão a receber | SOANAS | ANALYZED | soanas_finance | NO | NO | NO | NO | NO | AUDIT | ≠ cash register | ≠ cash register |
| FIN-CARD-001 | Finance | Conciliação cartão | NSU/MDR/líquido/chargeback/antecipação | SOANAS | ANALYZED | soanas_finance | NO | NO | NO | NO | NO | AUDIT | - | - |
| FIN-PIX-001 | Finance | Conciliação Pix | txid/e2eId / duplicidade / manual | SOANAS | ANALYZED | soanas_finance | NO | NO | NO | NO | NO | AUDIT | - | - |
| FIN-COST-001 | Finance | Custo/margem | Médio/último/lote/ficha / margem | SOANAS | ANALYZED | soanas_finance | NO | NO | NO | NO | NO | AUDIT | - | - |
| FIN-COMM-001 | Finance | Comissões | Vendedor/garçom / regras / estorno | SOANAS | ANALYZED | soanas_finance | NO | NO | NO | NO | NO | AUDIT | - | - |
| REPORT-SALES-001 | Reporting | Vendas | Por dia/hora/loja/caixa/operador/produto/canal… | SOANAS | ANALYZED | soanas_reporting | NO | NO | NO | NO | NO | AUDIT | - | - |
| REPORT-CASH-001 | Reporting | Caixa | Abertura/sangrias/divergências/turnos… | SOANAS | ANALYZED | soanas_reporting | NO | NO | NO | NO | NO | AUDIT | - | - |
| REPORT-INV-001 | Reporting | Estoque | Saldo/giro/ABC/validade/perdas… | SOANAS | ANALYZED | soanas_reporting | NO | NO | NO | NO | NO | AUDIT | - | - |
| REPORT-REST-001 | Reporting | Restaurante | Ticket/giro mesa/KDS/gorjeta… | SOANAS | ANALYZED | soanas_reporting | NO | NO | NO | NO | NO | AUDIT | - | - |
| REPORT-FISCAL-001 | Reporting | Fiscal | NFC-e/NF-e/NFS-e status / XML faltante… | SOANAS | ANALYZED | soanas_reporting | NO | NO | NO | NO | NO | AUDIT | - | - |
| DASH-001 | Reporting | Dashboard proprietário | Faturamento/margem/críticos/pendências | SOANAS | ANALYZED | soanas_reporting | NO | NO | NO | NO | NO | AUDIT | dashboards framework | dashboards framework |
| DASH-002 | Reporting | Dashboard restaurante | Mesas/KDS/atrasos/faturamento | SOANAS | ANALYZED | soanas_reporting | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUD-001 | Audit | Audit base | audit_logs action/access | MERCATO | ANALYZED | audit_logs | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| AUD-002 | Audit | Eventos sensíveis | Caixa/desconto/fiscal/estoque/certificado… | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| AUD-003 | Audit | Campos | who/what/when/where/old/new/reason/approver/terminal | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| LGPD-001 | LGPD | Consentimento | Finalidade / consent record | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| LGPD-002 | LGPD | Direitos | Exportação / anonimização / exclusão c/ hold fiscal | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| LGPD-003 | LGPD | Controles | Minimização / retenção / criptografia / DPO canal | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| SEC-001 | Security | Auth hardening | MFA admin / sessões / rate limit | MERCATO+SOANAS | ANALYZED | auth/soanas_core | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | enterprise MFA optional — não copiar EE | enterprise MFA optional — não copiar EE |
| SEC-002 | Security | RBAC | Menor privilégio / tenant segregation | MERCATO+SOANAS | ANALYZED | auth/soanas_core | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| SEC-003 | Security | Crypto | TLS / secrets / A1 / backups | MERCATO+SOANAS | ANALYZED | auth/soanas_core | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| SEC-004 | Security | AppSec | CSP/CSRF/XSS/SQLi / SAST / dependency scan | MERCATO+SOANAS | ANALYZED | auth/soanas_core | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| SEC-005 | Security | Card data | Nunca armazenar PAN/CVV/PIN/trilha | MERCATO+SOANAS | ANALYZED | auth/soanas_core | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| AUTO-001 | Automation | Workflows/Rules | Motor genérico | MERCATO | ANALYZED | workflows/business_rules/notifications | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| NOTIF-001 | Automation | Notifications | In-app / push / channels | MERCATO | ANALYZED | workflows/business_rules/notifications | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| AUTO-002 | Automation | Regras Soanas | Estoque baixo / sangria sugerida / certificado… | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| NOTIF-002 | Automation | Canais Soanas | WhatsApp integração / som KDS / agrupamento | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| IO-IMP-001 | IO | Importação | Excel/CSV produtos/clientes/estoque/XML… | MERCATO+SOANAS | ANALYZED | data_sync/soanas_integrations | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | sync_excel + Soanas | sync_excel + Soanas |
| IO-EXP-001 | IO | Exportação | CSV/Excel/PDF/XML/JSON async + audit | MERCATO+SOANAS | ANALYZED | data_sync/soanas_integrations | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| API-001 | IO | API | REST OpenAPI / auth / scopes / idempotência / versionamento | MERCATO+SOANAS | ANALYZED | data_sync/soanas_integrations | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | core api_keys | core api_keys |
| WH-001 | IO | Webhooks | Eventos Soanas + assinatura Standard Webhooks | MERCATO+SOANAS | ANALYZED | data_sync/soanas_integrations | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | webhooks package | webhooks package |
| INT-PAY-001 | Integrations | Pagamento BR | Adapters Stone/Cielo/Rede/PagBank/MP/InfinitePay + Pix PSP | SOANAS | ANALYZED | soanas_integrations | NO | NO | NO | NO | NO | AUDIT | mock+adapter | mock+adapter |
| INT-TEF-001 | Integrations | TEF providers | Provider abstraction | SOANAS | ANALYZED | soanas_integrations | NO | NO | NO | NO | NO | AUDIT | - | - |
| INT-ECOM-001 | Integrations | Ecommerce | Shopify/Woo/ML/loja própria | SOANAS | ANALYZED | soanas_integrations | NO | NO | NO | NO | NO | AUDIT | - | - |
| INT-DEL-001 | Integrations | Delivery agg | iFood e agregadores quando parceria | SOANAS | ANALYZED | soanas_integrations | NO | NO | NO | NO | NO | AUDIT | BLOCKED_EXTERNAL potencial | BLOCKED_EXTERNAL potencial |
| INT-ACC-001 | Integrations | Contabilidade | Alterdata / XML / exportação fiscal | SOANAS | ANALYZED | soanas_integrations | NO | NO | NO | NO | NO | AUDIT | - | - |
| PRT-PROD-001 | Printing | Impressão produção | Roteamento produto→estação / fallback / anti-dup | SOANAS | ANALYZED | soanas_hardware | NO | NO | NO | NO | NO | AUDIT | - | - |
| PRT-RCPT-001 | Printing | Cupom não fiscal | Template 58/80mm customizável | SOANAS | ANALYZED | soanas_hardware | NO | NO | NO | NO | NO | AUDIT | - | - |
| PRT-REPRINT-001 | Printing | Reimpressão | 2ª via auditada com motivo | SOANAS | ANALYZED | soanas_hardware | NO | NO | NO | NO | NO | AUDIT | - | - |
| SAAS-001 | SaaS | Planos | Trial/mensal/anual / lojas/caixas/módulos / add-ons | SOANAS | ANALYZED | soanas_saas | NO | NO | NO | NO | NO | AUDIT | feature_toggles | feature_toggles |
| SAAS-002 | SaaS | Lifecycle | Suspensão / grace / reativação | SOANAS | ANALYZED | soanas_saas | NO | NO | NO | NO | NO | AUDIT | - | - |
| ONB-001 | SaaS | Onboarding | Wizard 11 etapas → produção | SOANAS | ANALYZED | soanas_saas | NO | NO | NO | NO | NO | AUDIT | onboarding package + Soanas | onboarding package + Soanas |
| HEALTH-001 | SaaS | Health PDV | Checklist pré-abertura + Diagnosticar | SOANAS | ANALYZED | soanas_saas | NO | NO | NO | NO | NO | AUDIT | - | - |
| UPD-001 | SaaS | Update client | Semver / rollout / rollback / migrate local DB | SOANAS | ANALYZED | soanas_saas | NO | NO | NO | NO | NO | AUDIT | - | - |
| DR-001 | SaaS | Backup Cloud | Automático / PITR / restore test | SOANAS | ANALYZED | soanas_saas | NO | NO | NO | NO | NO | AUDIT | ops | ops |
| DR-002 | SaaS | Backup Local | POS DB + outbox preserve | SOANAS | ANALYZED | soanas_saas | NO | NO | NO | NO | NO | AUDIT | - | - |
| OBS-001 | Observability | Logs/metrics/traces | Correlation ID ponta a ponta | MERCATO+SOANAS | ANALYZED | telemetry/soanas_core | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | telemetry package | telemetry package |
| OBS-002 | Observability | Alertas | API/fiscal/pagamento/hardware/sync/print | MERCATO+SOANAS | ANALYZED | telemetry/soanas_core | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| PERF-001 | Observability | Performance POS | Add item / search local / finish cash instantâneo | MERCATO+SOANAS | ANALYZED | telemetry/soanas_core | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | benchmarks | benchmarks |
| A11Y-001 | Observability | Acessibilidade POS | Touch/teclado/foco/contraste/F-keys | MERCATO+SOANAS | ANALYZED | telemetry/soanas_core | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| SHORT-001 | Observability | Atalhos | F1–F10 / Esc / Enter configuráveis | MERCATO+SOANAS | ANALYZED | telemetry/soanas_core | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | - | - |
| AI-001 | Observability | IA Soanas | Consultas gestor / Safe Actions — fora do caminho crítico | MERCATO+SOANAS | ANALYZED | telemetry/soanas_core | PARTIAL | NO | PARTIAL | PARTIAL | NO | AUDIT | ai-assistant | ai-assistant |
| TEST-CAT-001 | Testing | Testes catálogo | Simples/variante/preço/lote/serial/duplicados | SOANAS | ANALYZED | qa | NO | NO | NO | NO | NO | AUDIT | - | - |
| TEST-SALE-001 | Testing | Testes venda | 1–100 itens / peso / split / cancel / devolução | SOANAS | ANALYZED | qa | NO | NO | NO | NO | NO | AUDIT | - | - |
| TEST-CASH-001 | Testing | Testes caixa | Open/sangria/suprimento/close/cego/crash/offline | SOANAS | ANALYZED | qa | NO | NO | NO | NO | NO | AUDIT | - | - |
| TEST-PAY-001 | Testing | Testes pagamento | Dinheiro/Pix/cartão/timeout/unknown/dup | SOANAS | ANALYZED | qa | NO | NO | NO | NO | NO | AUDIT | - | - |
| TEST-FISCAL-001 | Testing | Testes fiscal | Homolog/produção/contingência/IBS-CBS/CNPJ alfa | SOANAS | ANALYZED | qa | NO | NO | NO | NO | NO | AUDIT | - | - |
| TEST-HW-001 | Testing | Testes hardware | Printer/gaveta/leitor/balança/TEF/restart | SOANAS | ANALYZED | qa | NO | NO | NO | NO | NO | AUDIT | - | - |
| TEST-REST-001 | Testing | Testes restaurante | Mesa/comanda/KDS/dividir/pago parcial | SOANAS | ANALYZED | qa | NO | NO | NO | NO | NO | AUDIT | - | - |
| TEST-E2E-001 | Testing | E2E varejo | Fluxo completo §108 | SOANAS | ANALYZED | qa | NO | NO | NO | NO | NO | AUDIT | - | - |
| TEST-E2E-002 | Testing | E2E restaurante | Fluxo completo §109 | SOANAS | ANALYZED | qa | NO | NO | NO | NO | NO | AUDIT | - | - |
| TEST-E2E-003 | Testing | E2E offline | Fluxo completo §110 | SOANAS | ANALYZED | qa | NO | NO | NO | NO | NO | AUDIT | - | - |
| TEST-E2E-004 | Testing | E2E falhas | Fluxo completo §111 | SOANAS | ANALYZED | qa | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-001 | Architecture | Packages | Pacotes soanas-* sem poluir packages/core | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-002 | Architecture | No duplication | Não duplicar Product/Customer/Order/Stock | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-003 | Architecture | Commands | Commands explícitos por mutação crítica | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-004 | Architecture | Events | Eventos versionados §107 | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-005 | Architecture | Idempotency | Ops críticas idempotentes | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-006 | Architecture | State machines | Venda/Caixa/Fiscal/KDS explícitas | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-007 | Architecture | Money | Decimal/numeric — sem float descontrolado | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-008 | Architecture | Concurrency | Locks/optimistic/idempotency em corridas | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-009 | Architecture | i18n | pt-BR via i18n — sem hardcode | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-010 | Architecture | Licensing | MIT deps; sem copiar enterprise; notices | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | docs/licenses | docs/licenses |
| ARCH-011 | Architecture | Mocks | MockPix/Tef/Fiscal/Printer/Scale oficiais | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-012 | Architecture | Contracts | Interfaces provider versionadas | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-013 | Architecture | Client versions | minimumSupportedVersion / BLOCKED | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-014 | Architecture | Human IDs | SALE-/CASH-/FISC- + UUID interno | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |
| ARCH-015 | Architecture | Error model | errorCode/correlationId/retryable/operatorAction | SOANAS | ANALYZED | soanas_core | NO | NO | NO | NO | NO | AUDIT | - | - |

## Legenda Backend/Frontend/Database/API/Tests

- `YES` — implementado no Soanas
- `PARTIAL` — existe no Open Mercato; extensão Soanas pendente ou mapeada
- `NO` — não implementado
- `MERCATO` — coberto pelo core (quando status VALIDATED de reuso)

## Próximos passos

1. Specs Fase 0 (`2026-09-15-soanas-*.md`)
2. Scaffold packages `soanas_*`
3. Atualizar status ID a ID com evidências (Implementation / API / Tests / UI / Migration)

## Changelog

| Data | Nota |
|------|------|
| 2026-09-15 | Matriz inicial pós-auditoria — todos IDs em ANALYZED |
| 2026-09-15 | Phase 0.1–0.2: soanas-core + soanas-establishments — ver `blueprint-coverage.json` |
