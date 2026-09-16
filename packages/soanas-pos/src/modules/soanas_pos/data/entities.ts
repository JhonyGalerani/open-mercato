import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'

/**
 * Stock enforcement when the requested quantity exceeds the WMS availability.
 * BLOCK refuses the line, WARN needs an approver feature, ALLOW sells anyway
 * (negative stock is reconciled later by inventory).
 */
export type PosStockPolicy = 'BLOCK' | 'WARN' | 'ALLOW'

export type PosTerminalStatus = 'active' | 'inactive'

/**
 * Lifecycle of a POS sale. FISCAL_PENDING is intentionally absent: fiscal
 * emission (NFC-e) is a later slice and plugs into the same saga (ADR-004/007).
 */
export type PosTransactionStatus =
  | 'DRAFT'
  | 'HELD'
  | 'CHECKOUT'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'REVERSED'
  | 'PAYMENT_UNKNOWN'
  | 'SYNC_PENDING'
  | 'CANCEL_PENDING'
  | 'FAILED_RECOVERABLE'
  | 'CANCELLED'

export type PaymentTenderType =
  | 'CASH'
  | 'PIX'
  | 'CARD_DEBIT'
  | 'CARD_CREDIT'
  | 'VOUCHER'
  | 'STORE_CREDIT'
  | 'OTHER'

export type PaymentTenderStatus = 'pending' | 'captured' | 'failed' | 'unknown'

/** Saga checkpoint (ADR-007): the last step that finished successfully. */
export type PosRecoveryStep = 'validate' | 'sales' | 'wms' | 'cash' | 'complete'

@Entity({ tableName: 'soanas_pos_terminals' })
@Index({ name: 'soanas_pos_terminals_scope_idx', properties: ['organizationId', 'tenantId'] })
@Unique({ name: 'soanas_pos_terminals_code_scope_unique', properties: ['tenantId', 'organizationId', 'code'] })
export class PosTerminal {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'establishment_id', type: 'uuid', nullable: true })
  establishmentId?: string | null

  @Property({ type: 'text' })
  code!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ name: 'warehouse_id', type: 'uuid', nullable: true })
  warehouseId?: string | null

  @Property({ name: 'sales_channel_id', type: 'uuid', nullable: true })
  salesChannelId?: string | null

  @Property({ name: 'price_kind_id', type: 'uuid', nullable: true })
  priceKindId?: string | null

  @Property({ name: 'cash_register_id', type: 'uuid', nullable: true })
  cashRegisterId?: string | null

  @Property({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId?: string | null

  @Property({ name: 'stock_policy', type: 'text', default: 'BLOCK' })
  stockPolicy: PosStockPolicy = 'BLOCK'

  @Property({ type: 'text', default: 'active' })
  status: PosTerminalStatus = 'active'

  @Property({ name: 'client_version', type: 'text', nullable: true })
  clientVersion?: string | null

  @Property({ name: 'last_seen_at', type: Date, nullable: true })
  lastSeenAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

/** Money lives in bigint centavos strings; never floats (ADR-002). */
@Entity({ tableName: 'soanas_pos_transactions' })
@Index({ name: 'soanas_pos_transactions_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'soanas_pos_transactions_terminal_status_idx', properties: ['terminalId', 'status'] })
@Index({ name: 'soanas_pos_transactions_session_idx', properties: ['cashSessionId', 'createdAt'] })
@Unique({ name: 'soanas_pos_transactions_idempotency_unique', properties: ['tenantId', 'idempotencyKey'] })
export class PosTransaction {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'establishment_id', type: 'uuid', nullable: true })
  establishmentId?: string | null

  @Property({ name: 'terminal_id', type: 'uuid' })
  terminalId!: string

  @Property({ name: 'cash_session_id', type: 'uuid', nullable: true })
  cashSessionId?: string | null

  @Property({ name: 'operator_user_id', type: 'uuid' })
  operatorUserId!: string

  @Property({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId?: string | null

  @Property({ name: 'sales_order_id', type: 'uuid', nullable: true })
  salesOrderId?: string | null

  @Property({ type: 'text', default: 'DRAFT' })
  status: PosTransactionStatus = 'DRAFT'

  @Property({ name: 'currency_code', type: 'text', default: 'BRL' })
  currencyCode: string = 'BRL'

  @Property({ name: 'subtotal_cents', type: 'bigint', default: '0' })
  subtotalCents: string = '0'

  @Property({ name: 'discount_total_cents', type: 'bigint', default: '0' })
  discountTotalCents: string = '0'

  @Property({ name: 'surcharge_total_cents', type: 'bigint', default: '0' })
  surchargeTotalCents: string = '0'

  @Property({ name: 'tax_total_cents', type: 'bigint', default: '0' })
  taxTotalCents: string = '0'

  @Property({ name: 'grand_total_cents', type: 'bigint', default: '0' })
  grandTotalCents: string = '0'

  @Property({ name: 'amount_paid_cents', type: 'bigint', default: '0' })
  amountPaidCents: string = '0'

  @Property({ name: 'change_amount_cents', type: 'bigint', default: '0' })
  changeAmountCents: string = '0'

  /** Shared across every saga step and every audit row of this sale. */
  @Property({ name: 'correlation_id', type: 'text' })
  correlationId!: string

  @Property({ name: 'idempotency_key', type: 'text', nullable: true })
  idempotencyKey?: string | null

  /** Operator-facing label when the cart is suspended (POS-HOLD-001). */
  @Property({ name: 'hold_name', type: 'text', nullable: true })
  holdName?: string | null

  @Property({ name: 'held_at', type: Date, nullable: true })
  heldAt?: Date | null

  @Property({ name: 'held_by_user_id', type: 'uuid', nullable: true })
  heldByUserId?: string | null

  @Property({ name: 'expires_at', type: Date, nullable: true })
  expiresAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'completed_at', type: Date, nullable: true })
  completedAt?: Date | null

  @Property({ name: 'cancelled_at', type: Date, nullable: true })
  cancelledAt?: Date | null

  /** When a COMPLETED sale was reversed (never deletes history). */
  @Property({ name: 'reversed_at', type: Date, nullable: true })
  reversedAt?: Date | null

  @Property({ name: 'reversal_reason', type: 'text', nullable: true })
  reversalReason?: string | null

  @Property({ name: 'reversal_cash_movement_id', type: 'uuid', nullable: true })
  reversalCashMovementId?: string | null

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'soanas_pos_transaction_lines' })
@Index({ name: 'soanas_pos_transaction_lines_tx_idx', properties: ['transactionId', 'sortOrder'] })
@Index({ name: 'soanas_pos_transaction_lines_scope_idx', properties: ['organizationId', 'tenantId'] })
export class PosTransactionLine {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'catalog_product_id', type: 'uuid', nullable: true })
  catalogProductId?: string | null

  @Property({ name: 'catalog_variant_id', type: 'uuid', nullable: true })
  catalogVariantId?: string | null

  @Property({ type: 'text' })
  sku!: string

  @Property({ name: 'name_snapshot', type: 'text' })
  nameSnapshot!: string

  /** Decimal string (not cents): 1, 0.500, 2.75 kg. */
  @Property({ type: 'text' })
  quantity!: string

  @Property({ name: 'unit_price_cents', type: 'bigint' })
  unitPriceCents!: string

  @Property({ name: 'original_unit_price_cents', type: 'bigint' })
  originalUnitPriceCents!: string

  @Property({ name: 'discount_amount_cents', type: 'bigint', default: '0' })
  discountAmountCents: string = '0'

  @Property({ name: 'surcharge_amount_cents', type: 'bigint', default: '0' })
  surchargeAmountCents: string = '0'

  @Property({ name: 'tax_amount_cents', type: 'bigint', default: '0' })
  taxAmountCents: string = '0'

  @Property({ name: 'line_total_cents', type: 'bigint', default: '0' })
  lineTotalCents: string = '0'

  @Property({ type: 'text', nullable: true })
  unit?: string | null

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null

  @Property({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number = 0

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'soanas_pos_payment_tenders' })
@Index({ name: 'soanas_pos_payment_tenders_tx_idx', properties: ['posTransactionId', 'createdAt'] })
@Index({ name: 'soanas_pos_payment_tenders_scope_idx', properties: ['organizationId', 'tenantId'] })
@Unique({ name: 'soanas_pos_payment_tenders_idempotency_unique', properties: ['tenantId', 'idempotencyKey'] })
export class PaymentTender {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'pos_transaction_id', type: 'uuid' })
  posTransactionId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'text' })
  type!: PaymentTenderType

  @Property({ name: 'amount_applied_cents', type: 'bigint' })
  amountAppliedCents!: string

  @Property({ name: 'amount_received_cents', type: 'bigint', nullable: true })
  amountReceivedCents?: string | null

  @Property({ name: 'change_amount_cents', type: 'bigint', nullable: true })
  changeAmountCents?: string | null

  @Property({ type: 'text', default: 'captured' })
  status: PaymentTenderStatus = 'captured'

  @Property({ type: 'text', nullable: true })
  provider?: string | null

  @Property({ name: 'external_transaction_id', type: 'text', nullable: true })
  externalTransactionId?: string | null

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null

  @Property({ name: 'idempotency_key', type: 'text' })
  idempotencyKey!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

/** Append-only audit of every POS status change. */
@Entity({ tableName: 'soanas_pos_state_transitions' })
@Index({ name: 'soanas_pos_state_transitions_tx_idx', properties: ['transactionId', 'createdAt'] })
export class PosStateTransition {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'from_state', type: 'text' })
  fromState!: string

  @Property({ name: 'to_state', type: 'text' })
  toState!: string

  @Property({ type: 'text' })
  trigger!: string

  @Property({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null

  @Property({ name: 'correlation_id', type: 'text', nullable: true })
  correlationId?: string | null

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}

@Entity({ tableName: 'soanas_pos_recovery_states' })
@Index({ name: 'soanas_pos_recovery_states_scope_idx', properties: ['organizationId', 'tenantId'] })
@Unique({ name: 'soanas_pos_recovery_states_tx_unique', properties: ['transactionId'] })
export class PosRecoveryState {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'last_step', type: 'text', default: 'validate' })
  lastStep: PosRecoveryStep = 'validate'

  @Property({ name: 'sales_order_id', type: 'uuid', nullable: true })
  salesOrderId?: string | null

  @Property({ name: 'wms_movement_id', type: 'uuid', nullable: true })
  wmsMovementId?: string | null

  @Property({ name: 'cash_movement_id', type: 'uuid', nullable: true })
  cashMovementId?: string | null

  @Property({ name: 'error_code', type: 'text', nullable: true })
  errorCode?: string | null

  @Property({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

export type PosApprovalKind = 'discount' | 'cancel' | 'stock_override' | 'price_override' | 'withdrawal'

export type PosApprovalStatus = 'pending' | 'approved' | 'rejected' | 'consumed' | 'expired'

/**
 * Explicit approval request/decision record (AUTH-APR-*). Approver identity is always
 * taken from the authenticated decide caller — never from a client-supplied UUID.
 */
@Entity({ tableName: 'soanas_pos_approval_requests' })
@Index({ name: 'soanas_pos_approvals_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'soanas_pos_approvals_tx_status_idx', properties: ['transactionId', 'status'] })
export class PosApprovalRequest {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'terminal_id', type: 'uuid', nullable: true })
  terminalId?: string | null

  @Property({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId?: string | null

  @Property({ name: 'line_id', type: 'uuid', nullable: true })
  lineId?: string | null

  @Property({ type: 'text' })
  kind!: PosApprovalKind

  @Property({ type: 'text', default: 'pending' })
  status: PosApprovalStatus = 'pending'

  @Property({ name: 'requester_user_id', type: 'uuid' })
  requesterUserId!: string

  @Property({ name: 'approver_user_id', type: 'uuid', nullable: true })
  approverUserId?: string | null

  @Property({ type: 'text', nullable: true })
  reason?: string | null

  @Property({ name: 'decision_reason', type: 'text', nullable: true })
  decisionReason?: string | null

  @Property({ name: 'payload_json', type: 'json', nullable: true })
  payloadJson?: Record<string, unknown> | null

  @Property({ name: 'before_json', type: 'json', nullable: true })
  beforeJson?: Record<string, unknown> | null

  @Property({ name: 'after_json', type: 'json', nullable: true })
  afterJson?: Record<string, unknown> | null

  @Property({ name: 'idempotency_key', type: 'text', nullable: true })
  idempotencyKey?: string | null

  @Property({ name: 'decided_at', type: Date, nullable: true })
  decidedAt?: Date | null

  @Property({ name: 'consumed_at', type: Date, nullable: true })
  consumedAt?: Date | null

  @Property({ name: 'expires_at', type: Date, nullable: true })
  expiresAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
