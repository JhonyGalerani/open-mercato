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
