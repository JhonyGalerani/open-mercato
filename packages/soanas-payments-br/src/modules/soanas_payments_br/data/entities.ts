import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import type { PixChargeStatus } from '../lib/pixProvider'

/** Money lives in bigint centavos strings; never floats. */
@Entity({ tableName: 'soanas_payments_br_pix_charges' })
@Index({ name: 'soanas_payments_br_pix_charges_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'soanas_payments_br_pix_charges_status_idx', properties: ['tenantId', 'status'] })
@Index({ name: 'soanas_payments_br_pix_charges_pos_tx_idx', properties: ['posTransactionId'] })
@Unique({ name: 'soanas_payments_br_pix_charges_txid_unique', properties: ['tenantId', 'txid'] })
export class PixCharge {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'terminal_id', type: 'uuid', nullable: true })
  terminalId?: string | null

  @Property({ name: 'pos_transaction_id', type: 'uuid', nullable: true })
  posTransactionId?: string | null

  @Property({ name: 'sales_order_id', type: 'uuid', nullable: true })
  salesOrderId?: string | null

  @Property({ type: 'text' })
  txid!: string

  @Property({ type: 'text', default: 'CREATED' })
  status: PixChargeStatus = 'CREATED'

  @Property({ name: 'amount_cents', type: 'bigint' })
  amountCents!: string

  @Property({ name: 'qr_code', type: 'text' })
  qrCode!: string

  @Property({ name: 'copia_e_cola', type: 'text' })
  copiaECola!: string

  @Property({ name: 'expires_at', type: Date })
  expiresAt!: Date

  @Property({ name: 'e2e_id', type: 'text', nullable: true })
  e2eId?: string | null

  @Property({ name: 'paid_at', type: Date, nullable: true })
  paidAt?: Date | null

  @Property({ type: 'text', default: 'mock' })
  provider: string = 'mock'

  @Property({ name: 'idempotency_key', type: 'text', nullable: true })
  idempotencyKey?: string | null

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
