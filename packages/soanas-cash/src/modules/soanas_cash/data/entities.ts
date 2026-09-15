import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'

export type CashSessionStatus =
  | 'closed'
  | 'opening'
  | 'open'
  | 'closing'
  | 'reconciliation_required'

export type CashMovementType =
  | 'opening'
  | 'cash_sale'
  | 'supply'
  | 'withdrawal'
  | 'cash_refund'
  | 'other_out'
  | 'other_in'
  | 'reversal'

export type CashMovementStatus = 'confirmed' | 'reversed'

export type CashCountKind = 'opening' | 'closing' | 'spot'

export type CashReconciliationStatus =
  | 'matched'
  | 'within_tolerance'
  | 'discrepancy'
  | 'approved'
  | 'rejected'

export type CashApprovalKind = 'withdrawal' | 'supply' | 'discrepancy' | 'exceptional_close'

export type CashApprovalStatus = 'pending' | 'approved' | 'rejected'

@Entity({ tableName: 'soanas_cash_registers' })
@Index({ name: 'soanas_cash_registers_scope_idx', properties: ['organizationId', 'tenantId'] })
@Unique({ name: 'soanas_cash_registers_code_scope_unique', properties: ['tenantId', 'organizationId', 'code'] })
export class CashRegister {
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

  @Property({ name: 'terminal_id', type: 'uuid', nullable: true })
  terminalId?: string | null

  @Property({ name: 'drawer_id', type: 'uuid', nullable: true })
  drawerId?: string | null

  @Property({ name: 'warehouse_id', type: 'uuid', nullable: true })
  warehouseId?: string | null

  /** When true the operator counts without seeing the expected amount (cega). */
  @Property({ name: 'blind_closing', type: 'boolean', default: false })
  blindClosing: boolean = false

  /** Server-side sangria threshold in centavos; null means every withdrawal needs approval. */
  @Property({ name: 'withdrawal_limit_without_approval_cents', type: 'bigint', nullable: true })
  withdrawalLimitWithoutApprovalCents?: string | null

  @Property({ name: 'supply_limit_without_approval_cents', type: 'bigint', nullable: true })
  supplyLimitWithoutApprovalCents?: string | null

  @Property({ name: 'discrepancy_tolerance_cents', type: 'bigint', default: '0' })
  discrepancyToleranceCents: string = '0'

  @Property({ name: 'expected_opening_float_cents', type: 'bigint', nullable: true })
  expectedOpeningFloatCents?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'soanas_cash_drawers' })
@Index({ name: 'soanas_cash_drawers_scope_idx', properties: ['organizationId', 'tenantId'] })
@Unique({ name: 'soanas_cash_drawers_register_code_unique', properties: ['registerId', 'code'] })
export class CashDrawer {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'register_id', type: 'uuid' })
  registerId!: string

  @Property({ type: 'text' })
  code!: string

  @Property({ type: 'text', nullable: true })
  name?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'soanas_cash_sessions' })
@Index({ name: 'soanas_cash_sessions_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'soanas_cash_sessions_register_status_idx', properties: ['registerId', 'status'] })
export class CashSession {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'establishment_id', type: 'uuid', nullable: true })
  establishmentId?: string | null

  @Property({ name: 'register_id', type: 'uuid' })
  registerId!: string

  @Property({ name: 'terminal_id', type: 'uuid', nullable: true })
  terminalId?: string | null

  @Property({ name: 'operator_user_id', type: 'uuid' })
  operatorUserId!: string

  @Property({ type: 'text', default: 'open' })
  status: CashSessionStatus = 'open'

  /** Opening float in minor units (centavos). */
  @Property({ name: 'opening_float_cents', type: 'bigint' })
  openingFloatCents!: string

  @Property({ name: 'opening_denominations', type: 'json', nullable: true })
  openingDenominations?: Record<string, number> | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  /** Snapshot of the register blind-closing policy taken when the session opened. */
  @Property({ name: 'closing_blind', type: 'boolean', default: false })
  closingBlind: boolean = false

  @Property({ name: 'opened_at_server', type: Date, onCreate: () => new Date() })
  openedAtServer: Date = new Date()

  @Property({ name: 'opened_at_local', type: Date, nullable: true })
  openedAtLocal?: Date | null

  @Property({ name: 'closed_at_server', type: Date, nullable: true })
  closedAtServer?: Date | null

  @Property({ name: 'closed_at_local', type: Date, nullable: true })
  closedAtLocal?: Date | null

  @Property({ name: 'idempotency_key', type: 'text', nullable: true })
  idempotencyKey?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

/**
 * Append-only ledger row (ADR-003). `deletedAt` exists for schema symmetry only:
 * confirmed movements are NEVER soft-deleted — they are compensated by a `reversal`
 * movement and flipped to `status = 'reversed'`. Ledger math keys off `status`.
 */
@Entity({ tableName: 'soanas_cash_movements' })
@Index({ name: 'soanas_cash_movements_session_idx', properties: ['sessionId', 'createdAt'] })
@Index({ name: 'soanas_cash_movements_scope_idx', properties: ['organizationId', 'tenantId'] })
@Unique({ name: 'soanas_cash_movements_idempotency_unique', properties: ['tenantId', 'idempotencyKey'] })
export class CashMovement {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'session_id', type: 'uuid' })
  sessionId!: string

  @Property({ name: 'register_id', type: 'uuid' })
  registerId!: string

  @Property({ type: 'text' })
  type!: CashMovementType

  /** Signed amount in centavos: +in / -out for ledger convenience on supplies/withdrawals. */
  @Property({ name: 'amount_cents', type: 'bigint' })
  amountCents!: string

  @Property({ type: 'text', default: 'confirmed' })
  status: CashMovementStatus = 'confirmed'

  @Property({ name: 'reason_code', type: 'text', nullable: true })
  reasonCode?: string | null

  @Property({ name: 'reason_detail', type: 'text', nullable: true })
  reasonDetail?: string | null

  @Property({ name: 'destination', type: 'text', nullable: true })
  destination?: string | null

  /** Provenance of a supply (suprimento): treasury, safe, bank, other register. */
  @Property({ name: 'origin', type: 'text', nullable: true })
  origin?: string | null

  @Property({ name: 'receiver_name', type: 'text', nullable: true })
  receiverName?: string | null

  @Property({ name: 'operator_user_id', type: 'uuid' })
  operatorUserId!: string

  @Property({ name: 'approver_user_id', type: 'uuid', nullable: true })
  approverUserId?: string | null

  @Property({ name: 'terminal_id', type: 'uuid', nullable: true })
  terminalId?: string | null

  @Property({ type: 'json', nullable: true })
  denominations?: Record<string, number> | null

  @Property({ name: 'reverses_movement_id', type: 'uuid', nullable: true })
  reversesMovementId?: string | null

  @Property({ name: 'pos_transaction_id', type: 'uuid', nullable: true })
  posTransactionId?: string | null

  @Property({ name: 'sales_order_id', type: 'uuid', nullable: true })
  salesOrderId?: string | null

  @Property({ name: 'payment_tender_id', type: 'uuid', nullable: true })
  paymentTenderId?: string | null

  @Property({ name: 'receipt_payload', type: 'json', nullable: true })
  receiptPayload?: Record<string, unknown> | null

  @Property({ name: 'idempotency_key', type: 'text' })
  idempotencyKey!: string

  @Property({ name: 'sync_status', type: 'text', default: 'pending' })
  syncStatus: string = 'pending'

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'soanas_cash_counts' })
@Index({ name: 'soanas_cash_counts_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'soanas_cash_counts_session_idx', properties: ['sessionId', 'createdAt'] })
export class CashCount {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'session_id', type: 'uuid' })
  sessionId!: string

  @Property({ name: 'register_id', type: 'uuid' })
  registerId!: string

  @Property({ type: 'text' })
  kind!: CashCountKind

  @Property({ type: 'json', nullable: true })
  denominations?: Record<string, number> | null

  @Property({ name: 'total_counted_cents', type: 'bigint' })
  totalCountedCents!: string

  @Property({ name: 'operator_user_id', type: 'uuid' })
  operatorUserId!: string

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'blind_mode', type: 'boolean', default: false })
  blindMode: boolean = false

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'soanas_cash_reconciliations' })
@Index({ name: 'soanas_cash_reconciliations_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'soanas_cash_reconciliations_session_idx', properties: ['sessionId', 'createdAt'] })
export class CashReconciliation {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'session_id', type: 'uuid' })
  sessionId!: string

  @Property({ name: 'count_id', type: 'uuid', nullable: true })
  countId?: string | null

  @Property({ name: 'expected_cash_cents', type: 'bigint' })
  expectedCashCents!: string

  @Property({ name: 'counted_cash_cents', type: 'bigint' })
  countedCashCents!: string

  /** counted - expected; negative means missing cash (quebra), positive means surplus (sobra). */
  @Property({ name: 'discrepancy_cents', type: 'bigint' })
  discrepancyCents!: string

  @Property({ name: 'tolerance_cents', type: 'bigint', default: '0' })
  toleranceCents: string = '0'

  @Property({ type: 'text' })
  status!: CashReconciliationStatus

  @Property({ type: 'text', nullable: true })
  reason?: string | null

  @Property({ name: 'approval_id', type: 'uuid', nullable: true })
  approvalId?: string | null

  @Property({ name: 'operator_user_id', type: 'uuid' })
  operatorUserId!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'soanas_cash_approvals' })
@Index({ name: 'soanas_cash_approvals_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'soanas_cash_approvals_session_idx', properties: ['sessionId', 'createdAt'] })
export class CashApproval {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId?: string | null

  @Property({ name: 'movement_id', type: 'uuid', nullable: true })
  movementId?: string | null

  @Property({ name: 'reconciliation_id', type: 'uuid', nullable: true })
  reconciliationId?: string | null

  @Property({ type: 'text' })
  kind!: CashApprovalKind

  @Property({ name: 'requester_user_id', type: 'uuid' })
  requesterUserId!: string

  @Property({ name: 'approver_user_id', type: 'uuid', nullable: true })
  approverUserId?: string | null

  @Property({ type: 'text', default: 'pending' })
  status: CashApprovalStatus = 'pending'

  @Property({ type: 'text', nullable: true })
  reason?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
