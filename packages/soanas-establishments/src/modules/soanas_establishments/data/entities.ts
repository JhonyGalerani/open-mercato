import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'

export type FiscalEnvironment = 'homologation' | 'production'

export type EstablishmentPolicies = {
  allowNegativeStock?: boolean
  cash?: Record<string, unknown>
  discounts?: Record<string, unknown>
  cancellations?: Record<string, unknown>
}

@Entity({ tableName: 'soanas_fiscal_establishments' })
@Index({ name: 'soanas_fiscal_establishments_scope_idx', properties: ['organizationId', 'tenantId'] })
@Unique({
  name: 'soanas_fiscal_establishments_org_tenant_unique',
  properties: ['organizationId', 'tenantId'],
})
@Unique({
  name: 'soanas_fiscal_establishments_cnpj_tenant_unique',
  properties: ['cnpj', 'tenantId'],
})
export class FiscalEstablishment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'legal_name', type: 'text' })
  legalName!: string

  @Property({ name: 'trade_name', type: 'text', nullable: true })
  tradeName?: string | null

  /** Alphanumeric CNPJ string — never numeric (EST-003 / NT 2026). */
  @Property({ type: 'text' })
  cnpj!: string

  @Property({ name: 'state_registration', type: 'text', nullable: true })
  stateRegistration?: string | null

  @Property({ name: 'municipal_registration', type: 'text', nullable: true })
  municipalRegistration?: string | null

  @Property({ name: 'primary_cnae', type: 'text', nullable: true })
  primaryCnae?: string | null

  @Property({ name: 'secondary_cnaes', type: 'json', nullable: true })
  secondaryCnaes?: string[] | null

  @Property({ type: 'text', nullable: true })
  crt?: string | null

  @Property({ name: 'special_regime', type: 'text', nullable: true })
  specialRegime?: string | null

  @Property({ name: 'ibge_city_code', type: 'text', nullable: true })
  ibgeCityCode?: string | null

  @Property({ type: 'text', nullable: true })
  uf?: string | null

  @Property({ name: 'address_line1', type: 'text', nullable: true })
  addressLine1?: string | null

  @Property({ name: 'address_line2', type: 'text', nullable: true })
  addressLine2?: string | null

  @Property({ name: 'address_number', type: 'text', nullable: true })
  addressNumber?: string | null

  @Property({ name: 'address_district', type: 'text', nullable: true })
  addressDistrict?: string | null

  @Property({ type: 'text', nullable: true })
  city?: string | null

  @Property({ type: 'text', nullable: true })
  zip?: string | null

  @Property({ type: 'text', nullable: true })
  phone?: string | null

  @Property({ name: 'fiscal_email', type: 'text', nullable: true })
  fiscalEmail?: string | null

  @Property({ name: 'accountant_name', type: 'text', nullable: true })
  accountantName?: string | null

  @Property({ name: 'accountant_crc', type: 'text', nullable: true })
  accountantCrc?: string | null

  @Property({ name: 'fiscal_environment', type: 'text', default: 'homologation' })
  fiscalEnvironment: FiscalEnvironment = 'homologation'

  @Property({ name: 'default_warehouse_id', type: 'uuid', nullable: true })
  defaultWarehouseId?: string | null

  @Property({ name: 'default_price_kind', type: 'text', nullable: true })
  defaultPriceKind?: string | null

  @Property({ name: 'default_sales_channel_id', type: 'uuid', nullable: true })
  defaultSalesChannelId?: string | null

  @Property({ name: 'nfce_series', type: 'text', nullable: true })
  nfceSeries?: string | null

  @Property({ name: 'nfe_series', type: 'text', nullable: true })
  nfeSeries?: string | null

  @Property({ name: 'nfce_number', type: 'integer', default: 0 })
  nfceNumber: number = 0

  @Property({ name: 'nfe_number', type: 'integer', default: 0 })
  nfeNumber: number = 0

  @Property({ name: 'nfce_csc_id', type: 'text', nullable: true })
  nfceCscId?: string | null

  @Property({ name: 'certificate_id', type: 'uuid', nullable: true })
  certificateId?: string | null

  @Property({ type: 'text', default: 'America/Sao_Paulo' })
  timezone: string = 'America/Sao_Paulo'

  @Property({ name: 'currency_code', type: 'text', default: 'BRL' })
  currencyCode: string = 'BRL'

  @Property({ type: 'json', nullable: true })
  policies?: EstablishmentPolicies | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
