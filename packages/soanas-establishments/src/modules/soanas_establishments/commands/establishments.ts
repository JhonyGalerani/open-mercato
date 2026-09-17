import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { makeCreateRedo } from '@open-mercato/shared/lib/commands/redo'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { conflict, isUniqueViolation, notFound } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { FiscalEstablishment } from '../data/entities'
import {
  fiscalEstablishmentCreateSchema,
  fiscalEstablishmentUpdateSchema,
  fiscalEstablishmentDeleteSchema,
  type FiscalEstablishmentCreateInput,
  type FiscalEstablishmentUpdateInput,
  type FiscalEstablishmentDeleteInput,
} from '../data/validators'

const ENTITY_TYPE = 'soanas_establishments:fiscal_establishment'

const crudEvents: CrudEventsConfig = {
  module: 'soanas_establishments',
  entity: 'fiscal_establishment',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

type Snapshot = {
  id: string
  tenantId: string
  organizationId: string
  legalName: string
  tradeName: string | null
  cnpj: string
  stateRegistration: string | null
  municipalRegistration: string | null
  primaryCnae: string | null
  secondaryCnaes: string[] | null
  crt: string | null
  specialRegime: string | null
  ibgeCityCode: string | null
  uf: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressNumber: string | null
  addressDistrict: string | null
  city: string | null
  zip: string | null
  phone: string | null
  fiscalEmail: string | null
  accountantName: string | null
  accountantCrc: string | null
  fiscalEnvironment: 'homologation' | 'production'
  defaultWarehouseId: string | null
  defaultPriceKind: string | null
  defaultSalesChannelId: string | null
  nfceSeries: string | null
  nfeSeries: string | null
  nfceNumber: number
  nfeNumber: number
  nfceCscId: string | null
  certificateId: string | null
  timezone: string
  currencyCode: string
  policies: Record<string, unknown> | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type Undo = UndoPayload<Snapshot>

function toSnapshot(record: FiscalEstablishment): Snapshot {
  return {
    id: record.id,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    legalName: record.legalName,
    tradeName: record.tradeName ?? null,
    cnpj: record.cnpj,
    stateRegistration: record.stateRegistration ?? null,
    municipalRegistration: record.municipalRegistration ?? null,
    primaryCnae: record.primaryCnae ?? null,
    secondaryCnaes: record.secondaryCnaes ?? null,
    crt: record.crt ?? null,
    specialRegime: record.specialRegime ?? null,
    ibgeCityCode: record.ibgeCityCode ?? null,
    uf: record.uf ?? null,
    addressLine1: record.addressLine1 ?? null,
    addressLine2: record.addressLine2 ?? null,
    addressNumber: record.addressNumber ?? null,
    addressDistrict: record.addressDistrict ?? null,
    city: record.city ?? null,
    zip: record.zip ?? null,
    phone: record.phone ?? null,
    fiscalEmail: record.fiscalEmail ?? null,
    accountantName: record.accountantName ?? null,
    accountantCrc: record.accountantCrc ?? null,
    fiscalEnvironment: record.fiscalEnvironment,
    defaultWarehouseId: record.defaultWarehouseId ?? null,
    defaultPriceKind: record.defaultPriceKind ?? null,
    defaultSalesChannelId: record.defaultSalesChannelId ?? null,
    nfceSeries: record.nfceSeries ?? null,
    nfeSeries: record.nfeSeries ?? null,
    nfceNumber: record.nfceNumber,
    nfeNumber: record.nfeNumber,
    nfceCscId: record.nfceCscId ?? null,
    certificateId: record.certificateId ?? null,
    timezone: record.timezone,
    currencyCode: record.currencyCode,
    policies: (record.policies as Record<string, unknown> | null) ?? null,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function applySnapshotFields(record: FiscalEstablishment, snapshot: Snapshot): void {
  record.legalName = snapshot.legalName
  record.tradeName = snapshot.tradeName
  record.cnpj = snapshot.cnpj
  record.stateRegistration = snapshot.stateRegistration
  record.municipalRegistration = snapshot.municipalRegistration
  record.primaryCnae = snapshot.primaryCnae
  record.secondaryCnaes = snapshot.secondaryCnaes
  record.crt = snapshot.crt
  record.specialRegime = snapshot.specialRegime
  record.ibgeCityCode = snapshot.ibgeCityCode
  record.uf = snapshot.uf
  record.addressLine1 = snapshot.addressLine1
  record.addressLine2 = snapshot.addressLine2
  record.addressNumber = snapshot.addressNumber
  record.addressDistrict = snapshot.addressDistrict
  record.city = snapshot.city
  record.zip = snapshot.zip
  record.phone = snapshot.phone
  record.fiscalEmail = snapshot.fiscalEmail
  record.accountantName = snapshot.accountantName
  record.accountantCrc = snapshot.accountantCrc
  record.fiscalEnvironment = snapshot.fiscalEnvironment
  record.defaultWarehouseId = snapshot.defaultWarehouseId
  record.defaultPriceKind = snapshot.defaultPriceKind
  record.defaultSalesChannelId = snapshot.defaultSalesChannelId
  record.nfceSeries = snapshot.nfceSeries
  record.nfeSeries = snapshot.nfeSeries
  record.nfceNumber = snapshot.nfceNumber
  record.nfeNumber = snapshot.nfeNumber
  record.nfceCscId = snapshot.nfceCscId
  record.certificateId = snapshot.certificateId
  record.timezone = snapshot.timezone
  record.currencyCode = snapshot.currencyCode
  record.policies = snapshot.policies
  record.isActive = snapshot.isActive
  record.deletedAt = null
  record.updatedAt = new Date()
}

const createCommand: CommandHandler<FiscalEstablishmentCreateInput, { establishmentId: string }> = {
  id: 'soanas_establishments.establishments.create',
  async execute(input, ctx) {
    const parsed = fiscalEstablishmentCreateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(FiscalEstablishment, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      legalName: parsed.legalName,
      tradeName: parsed.tradeName ?? null,
      cnpj: parsed.cnpj,
      stateRegistration: parsed.stateRegistration ?? null,
      municipalRegistration: parsed.municipalRegistration ?? null,
      primaryCnae: parsed.primaryCnae ?? null,
      secondaryCnaes: parsed.secondaryCnaes ?? null,
      crt: parsed.crt ?? null,
      specialRegime: parsed.specialRegime ?? null,
      ibgeCityCode: parsed.ibgeCityCode ?? null,
      uf: parsed.uf?.toUpperCase() ?? null,
      addressLine1: parsed.addressLine1 ?? null,
      addressLine2: parsed.addressLine2 ?? null,
      addressNumber: parsed.addressNumber ?? null,
      addressDistrict: parsed.addressDistrict ?? null,
      city: parsed.city ?? null,
      zip: parsed.zip ?? null,
      phone: parsed.phone ?? null,
      fiscalEmail: parsed.fiscalEmail ?? null,
      accountantName: parsed.accountantName ?? null,
      accountantCrc: parsed.accountantCrc ?? null,
      fiscalEnvironment: parsed.fiscalEnvironment ?? 'homologation',
      defaultWarehouseId: parsed.defaultWarehouseId ?? null,
      defaultPriceKind: parsed.defaultPriceKind ?? null,
      defaultSalesChannelId: parsed.defaultSalesChannelId ?? null,
      nfceSeries: parsed.nfceSeries ?? null,
      nfeSeries: parsed.nfeSeries ?? null,
      nfceNumber: parsed.nfceNumber ?? 0,
      nfeNumber: parsed.nfeNumber ?? 0,
      nfceCscId: parsed.nfceCscId ?? null,
      certificateId: parsed.certificateId ?? null,
      timezone: parsed.timezone ?? 'America/Sao_Paulo',
      currencyCode: parsed.currencyCode ?? 'BRL',
      policies: parsed.policies ?? null,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    try {
      await withAtomicFlush(em, [() => undefined], {
        transaction: true,
        label: 'soanas_establishments.create',
      })
    } catch (err) {
      if (
        isUniqueViolation(err, 'soanas_fiscal_establishments_org_tenant_unique') ||
        isUniqueViolation(err, 'soanas_fiscal_establishments_cnpj_tenant_unique')
      ) {
        throw conflict('Fiscal establishment already exists for this organization or CNPJ.')
      }
      throw err
    }

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'created',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
      },
      events: crudEvents,
      indexer: { entityType: ENTITY_TYPE },
    })

    return { establishmentId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(FiscalEstablishment, { id: result.establishmentId, deletedAt: null })
    return record ? toSnapshot(record) : null
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as Snapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_establishments.audit.create', 'Create fiscal establishment'),
      resourceKind: 'soanas_establishments.fiscal_establishment',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<Undo>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(FiscalEstablishment, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.isActive = false
    record.updatedAt = new Date()
    await em.flush()
  },
  redo: makeCreateRedo<FiscalEstablishment, Snapshot, FiscalEstablishmentCreateInput, { establishmentId: string }>({
    entityClass: FiscalEstablishment,
    buildResult: (entity) => ({ establishmentId: entity.id }),
    events: crudEvents,
    indexer: { entityType: ENTITY_TYPE },
  }),
}

const updateCommand: CommandHandler<FiscalEstablishmentUpdateInput, { establishmentId: string }> = {
  id: 'soanas_establishments.establishments.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Establishment id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const record = await em.findOne(FiscalEstablishment, { id: input.id, deletedAt: null })
    return { before: record ? toSnapshot(record) : null }
  },
  async execute(input, ctx) {
    const parsed = fiscalEstablishmentUpdateSchema.parse(input)
    requireId(parsed.id, 'Establishment id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(FiscalEstablishment, {
      id: parsed.id,
      ...(parsed.tenantId ? { tenantId: parsed.tenantId } : {}),
      deletedAt: null,
    })
    if (!record) {
      const { translate } = await resolveTranslations()
      throw notFound(translate('soanas_establishments.errors.not_found', 'Establishment not found'))
    }

    const { id: _id, tenantId: _t, organizationId: _o, ...rest } = parsed
    if (rest.legalName !== undefined) record.legalName = rest.legalName
    if (rest.tradeName !== undefined) record.tradeName = rest.tradeName ?? null
    if (rest.cnpj !== undefined) record.cnpj = rest.cnpj
    if (rest.stateRegistration !== undefined) record.stateRegistration = rest.stateRegistration ?? null
    if (rest.municipalRegistration !== undefined) record.municipalRegistration = rest.municipalRegistration ?? null
    if (rest.primaryCnae !== undefined) record.primaryCnae = rest.primaryCnae ?? null
    if (rest.secondaryCnaes !== undefined) record.secondaryCnaes = rest.secondaryCnaes ?? null
    if (rest.crt !== undefined) record.crt = rest.crt ?? null
    if (rest.specialRegime !== undefined) record.specialRegime = rest.specialRegime ?? null
    if (rest.ibgeCityCode !== undefined) record.ibgeCityCode = rest.ibgeCityCode ?? null
    if (rest.uf !== undefined) record.uf = rest.uf?.toUpperCase() ?? null
    if (rest.addressLine1 !== undefined) record.addressLine1 = rest.addressLine1 ?? null
    if (rest.addressLine2 !== undefined) record.addressLine2 = rest.addressLine2 ?? null
    if (rest.addressNumber !== undefined) record.addressNumber = rest.addressNumber ?? null
    if (rest.addressDistrict !== undefined) record.addressDistrict = rest.addressDistrict ?? null
    if (rest.city !== undefined) record.city = rest.city ?? null
    if (rest.zip !== undefined) record.zip = rest.zip ?? null
    if (rest.phone !== undefined) record.phone = rest.phone ?? null
    if (rest.fiscalEmail !== undefined) record.fiscalEmail = rest.fiscalEmail ?? null
    if (rest.accountantName !== undefined) record.accountantName = rest.accountantName ?? null
    if (rest.accountantCrc !== undefined) record.accountantCrc = rest.accountantCrc ?? null
    if (rest.fiscalEnvironment !== undefined) record.fiscalEnvironment = rest.fiscalEnvironment
    if (rest.defaultWarehouseId !== undefined) record.defaultWarehouseId = rest.defaultWarehouseId ?? null
    if (rest.defaultPriceKind !== undefined) record.defaultPriceKind = rest.defaultPriceKind ?? null
    if (rest.defaultSalesChannelId !== undefined) record.defaultSalesChannelId = rest.defaultSalesChannelId ?? null
    if (rest.nfceSeries !== undefined) record.nfceSeries = rest.nfceSeries ?? null
    if (rest.nfeSeries !== undefined) record.nfeSeries = rest.nfeSeries ?? null
    if (rest.nfceNumber !== undefined) record.nfceNumber = rest.nfceNumber
    if (rest.nfeNumber !== undefined) record.nfeNumber = rest.nfeNumber
    if (rest.nfceCscId !== undefined) record.nfceCscId = rest.nfceCscId ?? null
    if (rest.certificateId !== undefined) record.certificateId = rest.certificateId ?? null
    if (rest.timezone !== undefined) record.timezone = rest.timezone
    if (rest.currencyCode !== undefined) record.currencyCode = rest.currencyCode
    if (rest.policies !== undefined) record.policies = rest.policies ?? null
    if (rest.isActive !== undefined) record.isActive = rest.isActive
    record.updatedAt = new Date()

    try {
      await withAtomicFlush(em, [() => undefined], {
        transaction: true,
        label: 'soanas_establishments.update',
      })
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_fiscal_establishments_cnpj_tenant_unique')) {
        throw conflict('CNPJ already used by another establishment in this tenant.')
      }
      throw err
    }

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
      },
      events: crudEvents,
      indexer: { entityType: ENTITY_TYPE },
    })

    return { establishmentId: record.id }
  },
  captureAfter: async (input, _result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(FiscalEstablishment, { id: input.id, deletedAt: null })
    return record ? toSnapshot(record) : null
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as Snapshot | undefined
    const after = snapshots.after as Snapshot | undefined
    if (!before || !after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_establishments.audit.update', 'Update fiscal establishment'),
      resourceKind: 'soanas_establishments.fiscal_establishment',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: { undo: { before, after } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<Undo>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(FiscalEstablishment, { id: before.id })
    if (!record) return
    applySnapshotFields(record, before)
    await em.flush()
  },
}

const deleteCommand: CommandHandler<FiscalEstablishmentDeleteInput, { establishmentId: string }> = {
  id: 'soanas_establishments.establishments.delete',
  async prepare(input, ctx) {
    const id = requireId(input, 'Establishment id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const tenantId = typeof (input as { tenantId?: string }).tenantId === 'string'
      ? (input as { tenantId: string }).tenantId
      : undefined
    const record = await em.findOne(FiscalEstablishment, {
      id,
      deletedAt: null,
      ...(tenantId ? { tenantId } : {}),
    })
    return { before: record ? toSnapshot(record) : null }
  },
  async execute(input, ctx) {
    const parsed = fiscalEstablishmentDeleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(FiscalEstablishment, {
      id: parsed.id,
      tenantId: parsed.tenantId,
      deletedAt: null,
      ...(parsed.organizationId ? { organizationId: parsed.organizationId } : {}),
    })
    if (!record) {
      const { translate } = await resolveTranslations()
      throw notFound(translate('soanas_establishments.errors.not_found', 'Establishment not found'))
    }
    record.deletedAt = new Date()
    record.isActive = false
    record.updatedAt = new Date()
    await withAtomicFlush(em, [() => undefined], {
      transaction: true,
      label: 'soanas_establishments.delete',
    })

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'deleted',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
      },
      events: crudEvents,
      indexer: { entityType: ENTITY_TYPE },
    })

    return { establishmentId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as Snapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_establishments.audit.delete', 'Delete fiscal establishment'),
      resourceKind: 'soanas_establishments.fiscal_establishment',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<Undo>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let record = await em.findOne(FiscalEstablishment, { id: before.id })
    if (!record) {
      record = em.create(FiscalEstablishment, {
        id: before.id,
        tenantId: before.tenantId,
        organizationId: before.organizationId,
        legalName: before.legalName,
        tradeName: before.tradeName,
        cnpj: before.cnpj,
        stateRegistration: before.stateRegistration,
        municipalRegistration: before.municipalRegistration,
        primaryCnae: before.primaryCnae,
        secondaryCnaes: before.secondaryCnaes,
        crt: before.crt,
        specialRegime: before.specialRegime,
        ibgeCityCode: before.ibgeCityCode,
        uf: before.uf,
        addressLine1: before.addressLine1,
        addressLine2: before.addressLine2,
        addressNumber: before.addressNumber,
        addressDistrict: before.addressDistrict,
        city: before.city,
        zip: before.zip,
        phone: before.phone,
        fiscalEmail: before.fiscalEmail,
        accountantName: before.accountantName,
        accountantCrc: before.accountantCrc,
        fiscalEnvironment: before.fiscalEnvironment,
        defaultWarehouseId: before.defaultWarehouseId,
        defaultPriceKind: before.defaultPriceKind,
        defaultSalesChannelId: before.defaultSalesChannelId,
        nfceSeries: before.nfceSeries,
        nfeSeries: before.nfeSeries,
        nfceNumber: before.nfceNumber,
        nfeNumber: before.nfeNumber,
        nfceCscId: before.nfceCscId,
        certificateId: before.certificateId,
        timezone: before.timezone,
        currencyCode: before.currencyCode,
        policies: before.policies,
        isActive: before.isActive,
        createdAt: new Date(before.createdAt),
        updatedAt: new Date(before.updatedAt),
      })
      em.persist(record)
    }
    applySnapshotFields(record, before)
    await em.flush()
  },
}

registerCommand(createCommand)
registerCommand(updateCommand)
registerCommand(deleteCommand)
