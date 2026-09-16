#!/usr/bin/env node
/**
 * Generates docs/soanas/BLUEPRINT-COVERAGE.md from the Soanas functional blueprint SSOT.
 * Run: node scripts/soanas-generate-blueprint-coverage.mjs
 *
 * WARNING: this regenerates the matrix structure and RESETS every row status to ANALYZED.
 * Do NOT run it to "refresh progress". After a structural change, re-apply evidence statuses
 * from git history / IMPLEMENTATION-STATUS.md before committing.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT = path.join(ROOT, 'docs/soanas/BLUEPRINT-COVERAGE.md')

/** @typedef {{ id: string, domain: string, feature: string, sub: string, origin: string, status: string, module: string, notes?: string }} Row */

/** @type {Row[]} */
const rows = []

/**
 * @param {Omit<Row, 'status'> & { status?: string }} r
 */
function add(r) {
  rows.push({
    status: 'ANALYZED',
    notes: '',
    ...r,
  })
}

function batch(domain, origin, module, items, status = 'ANALYZED') {
  for (const [id, feature, sub, notes, itemOrigin, itemModule] of items) {
    add({
      id,
      domain,
      feature,
      sub,
      origin: itemOrigin ?? origin,
      status,
      module: itemModule ?? module,
      notes: notes ?? '',
    })
  }
}

// ---------------------------------------------------------------------------
// §1 Tenant / Org
// ---------------------------------------------------------------------------
batch('Tenant/Org', 'MERCATO', 'directory', [
  ['TENANT-001', 'Tenant', 'Criar tenant', 'directory.Tenant'],
  ['TENANT-002', 'Tenant', 'Ativar/desativar tenant', 'isActive / soft patterns'],
  ['TENANT-007', 'Organization', 'Criar organização matriz', 'Organization hierarchy'],
  ['TENANT-008', 'Organization', 'Criar filiais', 'parent/ancestors'],
  ['TENANT-009', 'Organization', 'Criar unidades operacionais', 'org tree'],
  ['TENANT-010', 'Organization', 'Organizar hierarquia', 'raiz/ancestrais/descendentes'],
  ['TENANT-011', 'Visibility', 'Usuário ver uma ou várias orgs', 'auth ACL org scope'],
  ['TENANT-012', 'Visibility', 'Visão consolidada de grupo', 'org descendants'],
  ['TENANT-013', 'UX', 'Troca rápida de organização', 'org switcher UI'],
  ['TENANT-014', 'Security', 'Bloquear dados entre tenants', 'tenant_id scoping'],
])
batch('Tenant/Org', 'SOANAS', 'soanas_saas', [
  ['TENANT-003', 'Billing', 'Suspender tenant por billing', 'soanas_saas'],
  ['TENANT-004', 'Billing', 'Definir plano contratado', 'soanas_saas'],
  ['TENANT-005', 'Billing', 'Definir limites do plano', 'feature toggles + quotas'],
  ['TENANT-006', 'Billing', 'Definir organizações permitidas', 'plan limits'],
])
batch('Tenant/Org', 'SOANAS', 'soanas_establishments', [
  ['TENANT-015', 'Isolation', 'Isolar dados fiscais por estabelecimento', 'FiscalEstablishment'],
  ['TENANT-016', 'Isolation', 'Isolar caixa por estabelecimento', 'CashRegister scope'],
  ['TENANT-017', 'Isolation', 'Isolar estoque por estabelecimento/depósito', 'WMS warehouse + establishment'],
  ['TENANT-018', 'Config', 'Estoque compartilhado entre unidades', 'config flag'],
  ['TENANT-019', 'Config', 'Preços diferentes por unidade', 'catalog price + org'],
  ['TENANT-020', 'Config', 'Cardápios diferentes por unidade', 'soanas_restaurant'],
  ['TENANT-021', 'Config', 'Meios de pagamento por unidade', 'soanas_payments_br'],
  ['TENANT-022', 'Config', 'Tributação diferente por CNPJ', 'FiscalEstablishment'],
])

// ---------------------------------------------------------------------------
// §2 Establishments BR
// ---------------------------------------------------------------------------
batch('Establishments', 'SOANAS', 'soanas_establishments', [
  ['EST-001', 'FiscalEstablishment', 'Entidade FiscalEstablishment', 'não poluir Organization'],
  ['EST-002', 'Identificação', 'Razão social / nome fantasia', ''],
  ['EST-003', 'Identificação', 'CNPJ como string alfanumérico', 'NT 2026'],
  ['EST-004', 'Identificação', 'IE / IM / CNAE principal e secundários', ''],
  ['EST-005', 'Identificação', 'CRT / regime tributário / regime especial', ''],
  ['EST-006', 'Endereço', 'IBGE / UF / endereço / CEP / telefone / e-mail fiscal', ''],
  ['EST-007', 'Contador', 'Contador responsável + CRC', ''],
  ['EST-008', 'Ambiente', 'Homologação / produção', ''],
  ['EST-009', 'Config', 'Depósito principal / tabela preço / canal padrão', 'FK IDs'],
  ['EST-010', 'Config fiscal', 'Séries e numeração NFC-e / NF-e', ''],
  ['EST-011', 'Config fiscal', 'CSC NFC-e + ID CSC', 'secret'],
  ['EST-012', 'Config', 'Certificado digital referência', 'soanas_fiscal_br'],
  ['EST-013', 'Config', 'PSP Pix / adquirentes', 'soanas_payments_br'],
  ['EST-014', 'Config', 'Impressora padrão / timezone / moeda BRL', ''],
  ['EST-015', 'Políticas', 'Estoque negativo / caixa / descontos / cancelamentos', ''],
])

// ---------------------------------------------------------------------------
// §3 Auth / Staff / RBAC
// ---------------------------------------------------------------------------
batch('Auth/RBAC', 'MERCATO', 'auth/staff', [
  ['AUTH-001', 'Auth', 'Autenticação usuários', 'auth module'],
  ['AUTH-002', 'Staff', 'Funcionários / times', 'staff module'],
  ['AUTH-003', 'RBAC', 'ACL feature-based', 'acl.ts pattern'],
  ['AUTH-004', 'Audit', 'Audit logs base', 'audit_logs'],
])
batch('Auth/RBAC', 'SOANAS', 'soanas_core', [
  ['AUTH-005', 'Perfis', 'Perfis padrão Soanas (proprietário…suporte)', 'role seed'],
  ['AUTH-POS-001', 'Permissão POS', 'abrir/fechar caixa', ''],
  ['AUTH-POS-002', 'Permissão POS', 'sangria / suprimento', ''],
  ['AUTH-POS-003', 'Permissão POS', 'abrir gaveta sem venda', ''],
  ['AUTH-POS-004', 'Permissão POS', 'cancelar item / venda', ''],
  ['AUTH-POS-005', 'Permissão POS', 'desconto + limite percentual', ''],
  ['AUTH-POS-006', 'Permissão POS', 'desconto acima limite com aprovação', ''],
  ['AUTH-POS-007', 'Permissão POS', 'alterar preço / vender abaixo custo', ''],
  ['AUTH-POS-008', 'Permissão POS', 'vender sem estoque', ''],
  ['AUTH-POS-009', 'Permissão POS', 'editar/reabrir venda', ''],
  ['AUTH-POS-010', 'Permissão POS', 'estornar pagamento / devolver / crédito', ''],
  ['AUTH-POS-011', 'Permissão POS', 'cancelar documento fiscal / inutilizar', ''],
  ['AUTH-POS-012', 'Permissão POS', 'ajustar/inventariar estoque', ''],
  ['AUTH-POS-013', 'Permissão POS', 'visualizar custo/margem/faturamento/lucro', ''],
  ['AUTH-POS-014', 'Permissão POS', 'visualizar fechamento outros caixas', ''],
  ['AUTH-POS-015', 'Permissão POS', 'cadastrar clientes / limite crédito / fiado', ''],
  ['AUTH-POS-016', 'Permissão POS', 'editar config fiscal / hardware', ''],
  ['AUTH-APR-001', 'Aprovação', 'PIN gerente / senha / supervisor', ''],
  ['AUTH-APR-002', 'Aprovação', 'Aprovação remota', ''],
  ['AUTH-APR-003', 'Aprovação', 'Motivo + quem solicitou/aprovou + terminal + hora', ''],
  ['AUTH-APR-004', 'Aprovação', 'Valor antes/depois', ''],
  ['AUTH-APR-005', 'Aprovação', 'Dupla custódia (impedir self-approve)', ''],
])

// ---------------------------------------------------------------------------
// §4 Catalog
// ---------------------------------------------------------------------------
batch('Catalog', 'MERCATO', 'catalog', [
  ['CAT-001', 'Produto', 'Cadastro básico (nome, SKU, GTIN, categoria…)', 'catalog products'],
  ['CAT-002', 'Produto', 'Imagens / status / disponibilidade canais', ''],
  ['CAT-003', 'Variantes', 'Variantes/SKU/preço/estoque próprio', 'CatalogProductVariant'],
  ['CAT-004', 'Preços', 'Price kinds / faixas / validade / moeda', ''],
])
batch('Catalog', 'SOANAS', 'soanas_core/catalog-extension', [
  ['CAT-005', 'Tipos', 'Tipos produto (kit, combo, peso, serial, lote…)', 'extension + CF'],
  ['CAT-FISCAL-001', 'Fiscal produto', 'NCM/CEST/origem/CFOP/CST/CSOSN', ''],
  ['CAT-FISCAL-002', 'Fiscal produto', 'ICMS/ST/FCP/PIS/COFINS/IPI', ''],
  ['CAT-FISCAL-003', 'Fiscal produto', 'IBS/CBS/IS / classificação RTC', 'Reforma 2026'],
  ['CAT-FISCAL-004', 'Fiscal produto', 'Benefícios / códigos estaduais / GTIN tributável', ''],
  ['CAT-FISCAL-005', 'Fiscal produto', 'Tributação por UF/regime + versionamento', 'FiscalRule'],
  ['CAT-006', 'Códigos', 'PLU / código barras secundário / código interno', ''],
  ['CAT-007', 'Canais', 'Disponível PDV / ecommerce / delivery', 'flags'],
])

// ---------------------------------------------------------------------------
// §5 Prices
// ---------------------------------------------------------------------------
batch('Prices', 'MERCATO', 'catalog', [
  ['PRICE-001', 'Tabelas', 'Preço padrão / kinds / faixas', ''],
  ['PRICE-002', 'Regras', 'Validade temporal de preços', ''],
])
batch('Prices', 'SOANAS', 'soanas_pos/soanas_core', [
  ['PRICE-003', 'Tabelas', 'Atacado/varejo/ecommerce/delivery/filial/canal/grupo', ''],
  ['PRICE-004', 'Tabelas', 'Especial/temporário/promocional/quantidade', ''],
  ['PRICE-005', 'Regras', 'Dia semana / horário / min-max qty / prioridade', ''],
  ['PRICE-006', 'Regras', 'Fallback / impedir negativo / alerta abaixo custo', ''],
  ['PRICE-007', 'Regras', 'Margem mínima / aprovação preço manual', ''],
])

// ---------------------------------------------------------------------------
// §6 Inventory / WMS
// ---------------------------------------------------------------------------
batch('Inventory', 'MERCATO', 'wms', [
  ['INV-001', 'Depósitos', 'Warehouse / zones / locations', 'WMS phase 1'],
  ['INV-002', 'Saldo', 'Físico/reservado/alocado/disponível', 'InventoryBalance'],
  ['INV-003', 'Movimentos', 'Ledger append-only', 'InventoryMovement'],
  ['INV-004', 'Lotes', 'Lot / validade / status', 'InventoryLot'],
  ['INV-005', 'Seriais', 'Serial tracking base', 'profile flags'],
  ['INV-006', 'Reorder', 'Reorder point / safety stock', 'ProductInventoryProfile'],
])
batch('Inventory', 'SOANAS', 'soanas_core/wms-ux', [
  ['INV-007', 'Depósitos tipados', 'Vendas/cozinha/bar/recebimento/avarias/quarentena/central/trânsito', 'config overlay'],
  ['INV-008', 'Saldo estendido', 'Em trânsito/avariado/bloqueado/vencido/futuro', ''],
  ['INV-009', 'Movimentos UX', 'Venda/devolução/perda/quebra/produção/desmontagem', 'orchestration'],
  ['INV-010', 'Lotes avançados', 'FEFO / bloquear vencido / rastrear venda', ''],
  ['INV-011', 'Seriais avançados', 'Garantia / histórico / cliente comprador', ''],
  ['INV-012', 'Alertas', 'Mín/máx/segurança/reposição/lead time/sugestão compra', ''],
])

// ---------------------------------------------------------------------------
// §7 Inventory count
// ---------------------------------------------------------------------------
batch('InventoryCount', 'SOANAS', 'soanas_core/wms-ux', [
  ['INVCOUNT-001', 'Inventário', 'Abrir inventário / escopo loja-depósito-categoria', 'WMS cycle-count base + UX'],
  ['INVCOUNT-002', 'Contagem', 'Total/parcial/cega/visível', ''],
  ['INVCOUNT-003', 'Fluxo', '1ª contagem / recontagem / divergência / aprovação', ''],
  ['INVCOUNT-004', 'Ops', 'Bloqueio movimentação / contínuo / rotativo', ''],
  ['INVCOUNT-005', 'Captura', 'Barcode / mobile / import-export planilha', ''],
  ['INVCOUNT-006', 'Audit', 'Auditor / motivo / perdas / trilha', ''],
], 'ANALYZED')

// Mark INVCOUNT as extension of WMS
rows.find((r) => r.id === 'INVCOUNT-001').origin = 'MERCATO+SOANAS'
rows.find((r) => r.id === 'INVCOUNT-001').notes = 'cycle-count API existe; UX inventário Soanas não'

// ---------------------------------------------------------------------------
// §8-9 Procurement
// ---------------------------------------------------------------------------
batch('Procurement', 'SOANAS', 'soanas_procurement', [
  ['PROC-SUP-001', 'Fornecedor', 'Cadastro completo (CNPJ, IE, contatos, prazos…)', 'CRM company + SupplierProfile'],
  ['PROC-SUP-002', 'Fornecedor', 'Produtos fornecidos / código fornecedor / preços', ''],
  ['PROC-SUP-003', 'Fornecedor', 'Avaliação / status / histórico preços', ''],
  ['PROC-REQ-001', 'Solicitação', 'Manual / auto mínimo / previsão / ruptura / produção', ''],
  ['PROC-REQ-002', 'Solicitação', 'Prioridade / solicitante / justificativa / aprovação', ''],
  ['PROC-RFQ-001', 'Cotação', 'Múltiplos fornecedores / comparação / seleção', ''],
  ['PROC-PO-001', 'Pedido compra', 'PO completo + aprovação + PDF + e-mail/WhatsApp', ''],
  ['PROC-RCV-001', 'Recebimento', 'Parcial/integral/divergência/cego/lotes/seriais', ''],
  ['PROC-RCV-002', 'Recebimento', 'Entrada estoque + custo atualizado', 'WMS receive'],
  ['PROC-NFE-001', 'NF-e entrada', 'Importar XML / chave / mapear SKU / AP', ''],
  ['PROC-NFE-002', 'NF-e entrada', 'Validar qty / gerar entrada / AP / arquivar / duplicidade', ''],
])

// ---------------------------------------------------------------------------
// §10-12 POS
// ---------------------------------------------------------------------------
batch('POS', 'SOANAS', 'soanas_pos', [
  ['POS-001', 'Terminal', 'Entidade PosTerminal', ''],
  ['POS-002', 'Terminal', 'Cadastro (código, estabelecimento, hardware, versão…)', ''],
  ['POS-003', 'Terminal', 'Online/offline / ativo/bloqueado / versão mínima', ''],
  ['POS-UI-001', 'Venda', 'Busca barcode/SKU/PLU/nome/fuzzy/favoritos/teclas', ''],
  ['POS-UI-002', 'Venda', 'Adicionar item (qty, peso, variante, lote, serial…)', ''],
  ['POS-UI-003', 'Venda', 'Alterar/remover/cancelar item com motivo', ''],
  ['POS-UI-004', 'Venda', 'Totais (subtotal, descontos, impostos, troco…)', 'Sales totals + POS'],
  ['POS-TXN-001', 'PosTransaction', 'Orquestrador (não duplicar SalesOrder)', 'ADR'],
  ['POS-TXN-002', 'State machine', 'DRAFT→…→COMPLETED + failure states', ''],
  ['POS-HOLD-001', 'Pré-venda', 'Suspender/nomear/retomar/transferir/expirar', ''],
  ['POS-HOLD-002', 'Pré-venda', 'Reservar estoque opcional / auditar', ''],
])

// ---------------------------------------------------------------------------
// §13-19 Cash
// ---------------------------------------------------------------------------
batch('Cash', 'SOANAS', 'soanas_cash', [
  ['CASH-001', 'Estrutura', 'CashRegister / Drawer / Session / Movement / Count / Reconciliation / Approval', ''],
  ['CASH-002', 'Caixa lógico', 'Código / estabelecimento / terminal / gaveta / depósito', ''],
  ['CASH-OPEN-001', 'Abertura', 'Selecionar caixa / operador / fundo inicial', ''],
  ['CASH-OPEN-002', 'Abertura', 'Contagem por denominações BRL', ''],
  ['CASH-OPEN-003', 'Abertura', 'Comparar fundo esperado / justificar / gerente', ''],
  ['CASH-OPEN-004', 'Abertura', 'Sessão única / timestamps server+local / offline', ''],
  ['CASH-SANGRIA-001', 'Sangria', 'Criar sangria (valor, motivo, destino, responsável)', ''],
  ['CASH-SANGRIA-002', 'Sangria', 'Validar saldo físico / limites / aprovação / PIN', ''],
  ['CASH-SANGRIA-003', 'Sangria', 'Dupla custódia / sessão aberta / sem edição pós-confirmação', ''],
  ['CASH-SANGRIA-004', 'Sangria', 'Denominações / ledger / não alterar faturamento', ''],
  ['CASH-SANGRIA-005', 'Sangria', 'Reversão (não exclusão) + vínculo', ''],
  ['CASH-SANGRIA-006', 'Sangria', 'Comprovante térmico / auditoria / sync / alertas / relatórios', ''],
  ['CASH-SUPPLY-001', 'Suprimento', 'Criar suprimento (origem, motivo, denominações, aprovação)', ''],
  ['CASH-SUPPLY-002', 'Suprimento', 'Comprovante / saldo esperado / reversão / auditoria', ''],
  ['CASH-DRAWER-001', 'Gaveta', 'Abertura sem venda (permissão, motivo, evento, alertas)', ''],
  ['CASH-CLOSE-001', 'Fechamento', 'Bloquear vendas / pendências Pix/cartão/fiscal/offline', ''],
  ['CASH-CLOSE-002', 'Fechamento', 'Contagem meios + fechamento cego', ''],
  ['CASH-CLOSE-003', 'Fechamento', 'Conciliação matemática expected vs counted', ''],
  ['CASH-CLOSE-004', 'Fechamento', 'Resultado por pagamento / PDF / e-mail / financeiro', ''],
  ['CASH-SHIFT-001', 'Turno', 'Troca operador mantendo caixa / exigindo fechamento', ''],
  ['CASH-SHIFT-002', 'Turno', 'Pausa / bloqueio / login rápido PIN / comissão', ''],
])

// ---------------------------------------------------------------------------
// §20-23 Payments
// ---------------------------------------------------------------------------
batch('Payments', 'MERCATO', 'payment_gateways', [
  ['PAY-GW-001', 'Gateway Hub', 'Sessão / auth-capture / cancel / refund / webhooks / idempotência', ''],
  ['PAY-SALES-001', 'SalesPayment', 'Pagamentos comerciais + allocations', 'sales'],
])
batch('Payments', 'SOANAS', 'soanas_payments_br', [
  ['PAY-001', 'PaymentTender', 'Tender operacional POS separado de SalesPayment', ''],
  ['PAY-CASH-001', 'Dinheiro', 'Recebido / troco / limite / arredondamento / cédulas', ''],
  ['PAY-CARD-001', 'Débito/Crédito', 'TEF/SmartPOS/POS externo / NSU / bandeira / parcelas', ''],
  ['PAY-PIX-001', 'Pix', 'QR dinâmico / copia-cola / txid / expiração / webhook / polling', ''],
  ['PAY-PIX-002', 'Pix', 'Conciliação / duplicidade / devolução parcial / recibo', ''],
  ['PAY-SPLIT-001', 'Split', 'N formas / restante tempo real / cancelar parcela', ''],
  ['PAY-VOUCHER-001', 'Voucher', 'VR/VA/interno/convênio/gift', ''],
  ['PAY-ERR-001', 'Erros', 'Estados iniciado…requer conciliação', ''],
  ['PAY-ERR-002', 'Erros', 'PAYMENT_UNKNOWN — não re-cobrar / idempotency / conciliação', ''],
  ['PAY-CANCEL-001', 'Cancelamento venda', 'Antes/depois pagamento e fiscal / estorno / estoque', 'orchestration'],
  ['PAY-RETURN-001', 'Devolução', 'Localizar venda / parcial / restituição / auditoria', 'Sales credit memo + UX'],
])
rows.find((r) => r.id === 'PAY-RETURN-001').origin = 'MERCATO+SOANAS'

// ---------------------------------------------------------------------------
// §24 Discounts
// ---------------------------------------------------------------------------
batch('Discounts', 'MERCATO', 'sales', [
  ['DISC-001', 'Adjustments', 'Desconto/acréscimo sales adjustments', ''],
])
batch('Discounts', 'SOANAS', 'soanas_pos/business_rules', [
  ['DISC-002', 'Manual', 'Percentual/valor/item/venda + limites/aprovação', ''],
  ['DISC-003', 'Promoções', 'X por Y / leve-pague / combo / happy hour / cupom…', 'business_rules'],
  ['DISC-004', 'Promoções', 'Prioridade / empilhamento / limites uso', ''],
])

// ---------------------------------------------------------------------------
// §25 Customers
// ---------------------------------------------------------------------------
batch('Customers', 'MERCATO', 'customers', [
  ['CRM-001', 'CRM', 'Pessoas / empresas / endereços / tags / atividades', ''],
  ['CRM-002', 'CRM', 'Custom fields', 'entities'],
])
batch('Customers', 'SOANAS', 'soanas_core/customers-extension', [
  ['CRM-003', 'Brasil PF', 'CPF / nascimento / WhatsApp / LGPD consent', 'CF + validators'],
  ['CRM-004', 'Brasil PJ', 'CNPJ / IE / indicador IE', ''],
  ['CRM-005', 'Histórico', 'Compras / ticket / favoritos / pontos / crédito', 'reporting + loyalty'],
])

// ---------------------------------------------------------------------------
// §26-27 Loyalty / Store credit
// ---------------------------------------------------------------------------
batch('Loyalty', 'SOANAS', 'soanas_loyalty', [
  ['LOY-001', 'Pontos', 'Acúmulo / resgate / validade / níveis', ''],
  ['LOY-002', 'Cashback', 'Saldo / extrato / estorno devolução', ''],
  ['LOY-003', 'Campanhas', 'Aniversário / indicação / antifraude', ''],
])
batch('Finance', 'SOANAS', 'soanas_finance', [
  ['FIN-CREDIT-001', 'Fiado', 'Limite / saldo / vencimento / parcelas / aprovação', ''],
  ['FIN-CREDIT-002', 'Fiado', 'Juros/multa/renegociação/parcial/inadimplência', ''],
])

// ---------------------------------------------------------------------------
// §28-32 Fiscal BR
// ---------------------------------------------------------------------------
batch('FiscalBR', 'SOANAS', 'soanas_fiscal_br', [
  ['FISCAL-001', 'Arquitetura', 'FiscalCore / TaxEngine / adapters / Certificate / Sefaz / Queue / Storage', ''],
  ['FISCAL-RULE-001', 'FiscalRule', 'Regra versionada (estabelecimento, UF, NCM, vigência…)', ''],
  ['FISCAL-ENG-001', 'Engine', 'Calcular / simular / explicar / TaxSnapshot', 'nunca recalcular histórico'],
  ['FISCAL-CERT-001', 'Certificado', 'A1 PFX upload / senha criptografada / validar CNPJ', ''],
  ['FISCAL-CERT-002', 'Certificado', 'Alertas 60/30/15/7/vencido / rotação / trilha', ''],
  ['FISCAL-NFCE-001', 'NFC-e', 'Emissão modelo 65 completa', 'SP 2026'],
  ['FISCAL-NFCE-002', 'NFC-e', 'Status / rejeições amigáveis / correção', ''],
  ['FISCAL-NFCE-003', 'NFC-e', 'Contingência + fila retransmissão + idempotência', ''],
  ['FISCAL-NFCE-004', 'NFC-e', 'Cancelamento / inutilização / XML storage', ''],
  ['FISCAL-NFE-001', 'NF-e', 'Modelo 55 B2B/transferência/devolução/remessa…', ''],
  ['FISCAL-NFE-002', 'NF-e', 'CC-e / contingência / IBS-CBS / schemas versionados', ''],
  ['FISCAL-NFSE-001', 'NFS-e', 'Padrão nacional + adaptadores municipais', ''],
  ['FISCAL-NFSE-002', 'NFS-e', 'ISS / retenções / IBS-CBS / cancelamento', ''],
])

// ---------------------------------------------------------------------------
// §33-38 Hardware
// ---------------------------------------------------------------------------
batch('Hardware', 'SOANAS', 'soanas_hardware', [
  ['HW-001', 'Agent', 'Soanas Device Agent local', 'não usar devices Mercato'],
  ['HW-PRT-001', 'Impressora', 'ESC/POS multi-transport / fabricantes', ''],
  ['HW-PRT-002', 'Impressão', 'Cupom/DANFE/cozinha/sangria/fechamento…', ''],
  ['HW-PRT-003', 'Spool', 'PrintJob queue estados + retry + reimpressão', ''],
  ['HW-DRW-001', 'Gaveta', 'Pulso / abrir em dinheiro/sangria/suprimento/manual', ''],
  ['HW-SCN-001', 'Leitor', 'HID/serial / pesável / debounce', ''],
  ['HW-SCL-001', 'Balança', 'Protocolos / estabilidade / tara / kg-g', ''],
  ['HW-TEF-001', 'Pinpad/TEF', 'PaymentTerminalProvider abstraction', ''],
  ['HW-DSP-001', 'Display cliente', 'Produto/totais/QR Pix/agradecimento', ''],
])

// ---------------------------------------------------------------------------
// §39-40 Offline
// ---------------------------------------------------------------------------
batch('Offline', 'SOANAS', 'soanas_offline', [
  ['OFFLINE-001', 'Local DB', 'SQLite criptografado + catálogo/preços/caixa/vendas', ''],
  ['OFFLINE-002', 'Outbox', 'OfflineOutboxEntry completo + estados', ''],
  ['OFFLINE-003', 'Sync', 'Push/pull incremental / cursor / retry / backoff', ''],
  ['OFFLINE-004', 'Conflitos', 'Políticas determinísticas (não LWW dinheiro/fiscal/estoque)', ''],
  ['OFFLINE-005', 'Health UI', 'Online/offline/sync/pendências/erros', ''],
  ['OFFLINE-006', 'Resiliência', 'Recuperação crash / journal / confirmação cloud', ''],
])

// ---------------------------------------------------------------------------
// §41-52 Restaurant / KDS / Delivery
// ---------------------------------------------------------------------------
batch('Restaurant', 'SOANAS', 'soanas_restaurant', [
  ['REST-001', 'Áreas', 'Salão/varanda/bar/…', ''],
  ['REST-002', 'Mesas', 'Mapa visual / estados / unir / transferir', ''],
  ['REST-003', 'Comanda', 'Abertura / consumo / transferências / divisão conta', ''],
  ['REST-004', 'Cardápio', 'Categorias / disponibilidade / 86 / limite diário', ''],
  ['REST-005', 'Modificadores', 'Grupos obrigatórios/opcionais / preço / estoque', ''],
  ['REST-006', 'Receita', 'Ficha técnica / rendimento / baixa estoque', 'WMS'],
  ['REST-007', 'Garçom', 'PWA login PIN / mesas / pedidos / offline LAN', ''],
  ['REST-008', 'Taxa/gorjeta', 'Percentual / remoção / rateio / fiscal', ''],
  ['REST-009', 'Reservas', 'Reservas + waitlist + no-show', ''],
  ['REST-010', 'Balcão/senha', 'Pedido rápido / painel chamadas', ''],
])
batch('KDS', 'SOANAS', 'soanas_kds', [
  ['KDS-001', 'Estações', 'Cozinha/bar/chapa/… + roteamento', ''],
  ['KDS-002', 'Tickets', 'Ticket/itens / status / recall / prioridade', ''],
  ['KDS-003', 'Tempos', 'SLA amarelo/vermelho / médias / gargalo', ''],
  ['KDS-004', 'Realtime', 'SSE/WebSocket preferido a polling agressivo', 'events'],
])
batch('Delivery', 'SOANAS', 'soanas_delivery', [
  ['DEL-001', 'Pedido', 'Entrega/retirada/agendado + taxa + zona', 'Sales + Soanas'],
  ['DEL-002', 'Fluxo', 'Recebido→entregue / cancelado', ''],
  ['DEL-003', 'Entregador', 'Cadastro / atribuição / comissão', ''],
])

// ---------------------------------------------------------------------------
// §53-59 Retail / Quote / Order / Transfer
// ---------------------------------------------------------------------------
batch('Retail', 'SOANAS', 'soanas_pos', [
  ['RETAIL-001', 'Roupas', 'Grade cor/tamanho/coleção / etiqueta', 'catalog variants'],
  ['RETAIL-002', 'Mercado', 'Peso / balança / pesável / atacarejo', ''],
  ['RETAIL-003', 'Construção', 'm/m²/volume / encomenda / obra / NF-e', ''],
])
batch('SalesDocs', 'MERCATO', 'sales', [
  ['SALES-QUOTE-001', 'Orçamento', 'SalesQuote completo', ''],
  ['SALES-ORDER-001', 'Pedido', 'SalesOrder lifecycle', ''],
])
batch('SalesDocs', 'SOANAS', 'soanas_pos', [
  ['SALES-QUOTE-002', 'Orçamento UX', 'PDF/WhatsApp/converter/reservar/expirar', 'extensão UX'],
  ['SALES-PICK-001', 'Picking', 'Onda/tarefa/divergência/pack/despacho', 'WMS roadmap — verificar'],
  ['SALES-XFER-001', 'Transferência lojas', 'Solicitação→trânsito→recebimento→fiscal', ''],
])

// ---------------------------------------------------------------------------
// §60-64 Finance / Cost / Commission
// ---------------------------------------------------------------------------
batch('Finance', 'SOANAS', 'soanas_finance', [
  ['FIN-AR-001', 'Contas a receber', 'Origem venda / parcelas / baixa / inadimplência', ''],
  ['FIN-AP-001', 'Contas a pagar', 'Fornecedor / compra / aprovação / pagamento', ''],
  ['FIN-CASH-001', 'Caixa financeiro', 'Contas / banco / Pix / cartão a receber', '≠ cash register'],
  ['FIN-CARD-001', 'Conciliação cartão', 'NSU/MDR/líquido/chargeback/antecipação', ''],
  ['FIN-PIX-001', 'Conciliação Pix', 'txid/e2eId / duplicidade / manual', ''],
  ['FIN-COST-001', 'Custo/margem', 'Médio/último/lote/ficha / margem', ''],
  ['FIN-COMM-001', 'Comissões', 'Vendedor/garçom / regras / estorno', ''],
])

// ---------------------------------------------------------------------------
// §65-70 Reporting / Dashboard
// ---------------------------------------------------------------------------
batch('Reporting', 'SOANAS', 'soanas_reporting', [
  ['REPORT-SALES-001', 'Vendas', 'Por dia/hora/loja/caixa/operador/produto/canal…', ''],
  ['REPORT-CASH-001', 'Caixa', 'Abertura/sangrias/divergências/turnos…', ''],
  ['REPORT-INV-001', 'Estoque', 'Saldo/giro/ABC/validade/perdas…', ''],
  ['REPORT-REST-001', 'Restaurante', 'Ticket/giro mesa/KDS/gorjeta…', ''],
  ['REPORT-FISCAL-001', 'Fiscal', 'NFC-e/NF-e/NFS-e status / XML faltante…', ''],
  ['DASH-001', 'Dashboard proprietário', 'Faturamento/margem/críticos/pendências', 'dashboards framework'],
  ['DASH-002', 'Dashboard restaurante', 'Mesas/KDS/atrasos/faturamento', ''],
])

// ---------------------------------------------------------------------------
// §71-73 Audit / LGPD / Security
// ---------------------------------------------------------------------------
batch('Audit', 'MERCATO', 'audit_logs', [
  ['AUD-001', 'Audit base', 'audit_logs action/access', ''],
])
batch('Audit', 'SOANAS', 'soanas_core', [
  ['AUD-002', 'Eventos sensíveis', 'Caixa/desconto/fiscal/estoque/certificado…', ''],
  ['AUD-003', 'Campos', 'who/what/when/where/old/new/reason/approver/terminal', ''],
])
batch('LGPD', 'SOANAS', 'soanas_core', [
  ['LGPD-001', 'Consentimento', 'Finalidade / consent record', ''],
  ['LGPD-002', 'Direitos', 'Exportação / anonimização / exclusão c/ hold fiscal', ''],
  ['LGPD-003', 'Controles', 'Minimização / retenção / criptografia / DPO canal', ''],
])
batch('Security', 'MERCATO+SOANAS', 'auth/soanas_core', [
  ['SEC-001', 'Auth hardening', 'MFA admin / sessões / rate limit', 'enterprise MFA optional — não copiar EE'],
  ['SEC-002', 'RBAC', 'Menor privilégio / tenant segregation', ''],
  ['SEC-003', 'Crypto', 'TLS / secrets / A1 / backups', ''],
  ['SEC-004', 'AppSec', 'CSP/CSRF/XSS/SQLi / SAST / dependency scan', ''],
  ['SEC-005', 'Card data', 'Nunca armazenar PAN/CVV/PIN/trilha', ''],
])

// ---------------------------------------------------------------------------
// §74-79 Automations / API / Webhooks / IO
// ---------------------------------------------------------------------------
batch('Automation', 'MERCATO', 'workflows/business_rules/notifications', [
  ['AUTO-001', 'Workflows/Rules', 'Motor genérico', ''],
  ['NOTIF-001', 'Notifications', 'In-app / push / channels', ''],
])
batch('Automation', 'SOANAS', 'soanas_core', [
  ['AUTO-002', 'Regras Soanas', 'Estoque baixo / sangria sugerida / certificado…', ''],
  ['NOTIF-002', 'Canais Soanas', 'WhatsApp integração / som KDS / agrupamento', ''],
])
batch('IO', 'MERCATO+SOANAS', 'data_sync/soanas_integrations', [
  ['IO-IMP-001', 'Importação', 'Excel/CSV produtos/clientes/estoque/XML…', 'sync_excel + Soanas'],
  ['IO-EXP-001', 'Exportação', 'CSV/Excel/PDF/XML/JSON async + audit', ''],
  ['API-001', 'API', 'REST OpenAPI / auth / scopes / idempotência / versionamento', 'core api_keys'],
  ['WH-001', 'Webhooks', 'Eventos Soanas + assinatura Standard Webhooks', 'webhooks package'],
])

// ---------------------------------------------------------------------------
// §80 Integrations BR
// ---------------------------------------------------------------------------
batch('Integrations', 'SOANAS', 'soanas_integrations', [
  ['INT-PAY-001', 'Pagamento BR', 'Adapters Stone/Cielo/Rede/PagBank/MP/InfinitePay + Pix PSP', 'mock+adapter'],
  ['INT-TEF-001', 'TEF providers', 'Provider abstraction', ''],
  ['INT-ECOM-001', 'Ecommerce', 'Shopify/Woo/ML/loja própria', ''],
  ['INT-DEL-001', 'Delivery agg', 'iFood e agregadores quando parceria', 'BLOCKED_EXTERNAL potencial'],
  ['INT-ACC-001', 'Contabilidade', 'Alterdata / XML / exportação fiscal', ''],
])

// ---------------------------------------------------------------------------
// §81-83 Print / Receipt
// ---------------------------------------------------------------------------
batch('Printing', 'SOANAS', 'soanas_hardware', [
  ['PRT-PROD-001', 'Impressão produção', 'Roteamento produto→estação / fallback / anti-dup', ''],
  ['PRT-RCPT-001', 'Cupom não fiscal', 'Template 58/80mm customizável', ''],
  ['PRT-REPRINT-001', 'Reimpressão', '2ª via auditada com motivo', ''],
])

// ---------------------------------------------------------------------------
// §84-88 SaaS / Onboarding / Health / Update / Backup
// ---------------------------------------------------------------------------
batch('SaaS', 'SOANAS', 'soanas_saas', [
  ['SAAS-001', 'Planos', 'Trial/mensal/anual / lojas/caixas/módulos / add-ons', 'feature_toggles'],
  ['SAAS-002', 'Lifecycle', 'Suspensão / grace / reativação', ''],
  ['ONB-001', 'Onboarding', 'Wizard 11 etapas → produção', 'onboarding package + Soanas'],
  ['HEALTH-001', 'Health PDV', 'Checklist pré-abertura + Diagnosticar', ''],
  ['UPD-001', 'Update client', 'Semver / rollout / rollback / migrate local DB', ''],
  ['DR-001', 'Backup Cloud', 'Automático / PITR / restore test', 'ops'],
  ['DR-002', 'Backup Local', 'POS DB + outbox preserve', ''],
])

// ---------------------------------------------------------------------------
// §89-93 Observability / Perf / A11y / Shortcuts / AI
// ---------------------------------------------------------------------------
batch('Observability', 'MERCATO+SOANAS', 'telemetry/soanas_core', [
  ['OBS-001', 'Logs/metrics/traces', 'Correlation ID ponta a ponta', 'telemetry package'],
  ['OBS-002', 'Alertas', 'API/fiscal/pagamento/hardware/sync/print', ''],
  ['PERF-001', 'Performance POS', 'Add item / search local / finish cash instantâneo', 'benchmarks'],
  ['A11Y-001', 'Acessibilidade POS', 'Touch/teclado/foco/contraste/F-keys', ''],
  ['SHORT-001', 'Atalhos', 'F1–F10 / Esc / Enter configuráveis', ''],
  ['AI-001', 'IA Soanas', 'Consultas gestor / Safe Actions — fora do caminho crítico', 'ai-assistant'],
])

// ---------------------------------------------------------------------------
// §94-100 Tests domains
// ---------------------------------------------------------------------------
batch('Testing', 'SOANAS', 'qa', [
  ['TEST-CAT-001', 'Testes catálogo', 'Simples/variante/preço/lote/serial/duplicados', ''],
  ['TEST-SALE-001', 'Testes venda', '1–100 itens / peso / split / cancel / devolução', ''],
  ['TEST-CASH-001', 'Testes caixa', 'Open/sangria/suprimento/close/cego/crash/offline', ''],
  ['TEST-PAY-001', 'Testes pagamento', 'Dinheiro/Pix/cartão/timeout/unknown/dup', ''],
  ['TEST-FISCAL-001', 'Testes fiscal', 'Homolog/produção/contingência/IBS-CBS/CNPJ alfa', ''],
  ['TEST-HW-001', 'Testes hardware', 'Printer/gaveta/leitor/balança/TEF/restart', ''],
  ['TEST-REST-001', 'Testes restaurante', 'Mesa/comanda/KDS/dividir/pago parcial', ''],
  ['TEST-E2E-001', 'E2E varejo', 'Fluxo completo §108', ''],
  ['TEST-E2E-002', 'E2E restaurante', 'Fluxo completo §109', ''],
  ['TEST-E2E-003', 'E2E offline', 'Fluxo completo §110', ''],
  ['TEST-E2E-004', 'E2E falhas', 'Fluxo completo §111', ''],
])

// ---------------------------------------------------------------------------
// Architecture / Platform requirements from master prompt
// ---------------------------------------------------------------------------
batch('Architecture', 'SOANAS', 'soanas_core', [
  ['ARCH-001', 'Packages', 'Pacotes soanas-* sem poluir packages/core', ''],
  ['ARCH-002', 'No duplication', 'Não duplicar Product/Customer/Order/Stock', ''],
  ['ARCH-003', 'Commands', 'Commands explícitos por mutação crítica', ''],
  ['ARCH-004', 'Events', 'Eventos versionados §107', ''],
  ['ARCH-005', 'Idempotency', 'Ops críticas idempotentes', ''],
  ['ARCH-006', 'State machines', 'Venda/Caixa/Fiscal/KDS explícitas', ''],
  ['ARCH-007', 'Money', 'Decimal/numeric — sem float descontrolado', ''],
  ['ARCH-008', 'Concurrency', 'Locks/optimistic/idempotency em corridas', ''],
  ['ARCH-009', 'i18n', 'pt-BR via i18n — sem hardcode', ''],
  ['ARCH-010', 'Licensing', 'MIT deps; sem copiar enterprise; notices', 'docs/licenses'],
  ['ARCH-011', 'Mocks', 'MockPix/Tef/Fiscal/Printer/Scale oficiais', ''],
  ['ARCH-012', 'Contracts', 'Interfaces provider versionadas', ''],
  ['ARCH-013', 'Client versions', 'minimumSupportedVersion / BLOCKED', ''],
  ['ARCH-014', 'Human IDs', 'SALE-/CASH-/FISC- + UUID interno', ''],
  ['ARCH-015', 'Error model', 'errorCode/correlationId/retryable/operatorAction', ''],
])

// ---------------------------------------------------------------------------
// Emit markdown
// ---------------------------------------------------------------------------
const byStatus = {}
const byDomain = {}
for (const r of rows) {
  byStatus[r.status] = (byStatus[r.status] || 0) + 1
  byDomain[r.domain] = (byDomain[r.domain] || 0) + 1
}

const reuse = rows.filter((r) => r.origin === 'MERCATO' || r.origin === 'MERCATO+SOANAS').length
const soanasOnly = rows.filter((r) => r.origin === 'SOANAS').length

let md = `# Soanas — Blueprint Coverage Matrix

> **SSOT funcional:** Blueprint Funcional Completo (prompt mestre).  
> **Gerado em:** 2026-09-15  
> **Open Mercato base:** v0.7.0 @ \`30d509eeb481ae4778be771d6c3992042add2d1a\` (\`main\`)  
> **Regenerar:** \`node scripts/soanas-generate-blueprint-coverage.mjs\`

## Summary

| Métrica | Valor |
|--------|------:|
| Total de IDs | ${rows.length} |
| ANALYZED | ${byStatus.ANALYZED || 0} |
| NOT_STARTED | ${byStatus.NOT_STARTED || 0} |
| IN_PROGRESS | ${byStatus.IN_PROGRESS || 0} |
| IMPLEMENTED | ${byStatus.IMPLEMENTED || 0} |
| TESTED | ${byStatus.TESTED || 0} |
| VALIDATED | ${byStatus.VALIDATED || 0} |
| BLOCKED_EXTERNAL | ${byStatus.BLOCKED_EXTERNAL || 0} |
| Origem MERCATO / MERCATO+SOANAS | ${reuse} |
| Origem SOANAS only | ${soanasOnly} |

### Progresso overall

\`\`\`
Overall progress: 0.0%  (VALIDATED / total)
Foundation readiness: audit+coverage complete; implementation not started
\`\`\`

Percentuais de domínio em \`IMPLEMENTATION-STATUS.md\` são derivados desta matriz.

### Status válidos

\`NOT_STARTED\` · \`ANALYZED\` · \`IN_PROGRESS\` · \`IMPLEMENTED\` · \`TESTED\` · \`VALIDATED\` · \`BLOCKED_EXTERNAL\`

\`BLOCKED_EXTERNAL\` só para dependência externa real (credencial SEFAZ, adquirente, parceria iFood, etc.), com adapter+mock+testes prontos.

## Domínios

| Domínio | IDs |
|---------|----:|
${Object.entries(byDomain)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([d, n]) => `| ${d} | ${n} |`)
  .join('\n')}

## Matrix

| ID | Domínio | Funcionalidade | Subfunção | Origem | Status | Módulo | Backend | Frontend | Database | API | Tests | Documentação | Dependências | Observações |
|----|---------|----------------|-----------|--------|--------|--------|---------|----------|----------|-----|-------|--------------|--------------|-------------|
`

for (const r of rows) {
  const backend = r.origin.includes('MERCATO') ? 'PARTIAL' : 'NO'
  const database = r.origin.includes('MERCATO') ? 'PARTIAL' : 'NO'
  const api = r.origin.includes('MERCATO') ? 'PARTIAL' : 'NO'
  md += `| ${r.id} | ${r.domain} | ${r.feature} | ${r.sub} | ${r.origin} | ${r.status} | ${r.module} | ${backend} | NO | ${database} | ${api} | NO | AUDIT | ${r.notes || '-'} | ${r.notes || '-'} |\n`
}

md += `
## Legenda Backend/Frontend/Database/API/Tests

- \`YES\` — implementado no Soanas
- \`PARTIAL\` — existe no Open Mercato; extensão Soanas pendente ou mapeada
- \`NO\` — não implementado
- \`MERCATO\` — coberto pelo core (quando status VALIDATED de reuso)

## Próximos passos

1. Specs Fase 0 (\`2026-09-15-soanas-*.md\`)
2. Scaffold packages \`soanas_*\`
3. Atualizar status ID a ID com evidências (Implementation / API / Tests / UI / Migration)

## Changelog

| Data | Nota |
|------|------|
| 2026-09-15 | Matriz inicial pós-auditoria — todos IDs em ANALYZED |
`

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, md)
console.log(`Wrote ${rows.length} rows to ${OUT}`)

// Also write machine-readable JSON for status calculator
const jsonOut = path.join(ROOT, 'docs/soanas/blueprint-coverage.json')
fs.writeFileSync(jsonOut, JSON.stringify({ generatedAt: '2026-09-15', commit: '30d509eeb', version: '0.7.0', rows }, null, 2))
console.log(`Wrote JSON ${jsonOut}`)
