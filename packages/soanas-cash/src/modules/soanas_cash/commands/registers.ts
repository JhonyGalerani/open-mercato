import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { badRequest, conflict, isUniqueViolation, notFound } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CashRegister, CashSession } from '../data/entities'
import {
  cashRegisterCreateSchema,
  cashRegisterUpdateSchema,
  cashRegisterDeleteSchema,
  type CashRegisterCreateInput,
  type CashRegisterUpdateInput,
  type CashRegisterDeleteInput,
} from '../data/validators'
import { forkEm } from './helpers'
import { centsToWire, nullableCentsToWire } from '../lib/cents'

type RegisterSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  code: string
  name: string
  establishmentId: string | null
  terminalId: string | null
  drawerId: string | null
  warehouseId: string | null
  blindClosing: boolean
  withdrawalLimitWithoutApprovalCents: string | null
  supplyLimitWithoutApprovalCents: string | null
  discrepancyToleranceCents: string
  expectedOpeningFloatCents: string | null
  isActive: boolean
  updatedAt: string
}

function toSnapshot(record: CashRegister): RegisterSnapshot {
  return {
    id: record.id,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    code: record.code,
    name: record.name,
    establishmentId: record.establishmentId ?? null,
    terminalId: record.terminalId ?? null,
    drawerId: record.drawerId ?? null,
    warehouseId: record.warehouseId ?? null,
    blindClosing: record.blindClosing,
    withdrawalLimitWithoutApprovalCents: nullableCentsToWire(record.withdrawalLimitWithoutApprovalCents),
    supplyLimitWithoutApprovalCents: nullableCentsToWire(record.supplyLimitWithoutApprovalCents),
    discrepancyToleranceCents: centsToWire(record.discrepancyToleranceCents),
    expectedOpeningFloatCents: nullableCentsToWire(record.expectedOpeningFloatCents),
    isActive: record.isActive,
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createRegisterCommand: CommandHandler<CashRegisterCreateInput, { registerId: string }> = {
  id: 'soanas_cash.registers.create',
  async execute(input, ctx) {
    const parsed = cashRegisterCreateSchema.parse(input)
    const em = forkEm(ctx)
    const now = new Date()
    const record = em.create(CashRegister, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      establishmentId: parsed.establishmentId ?? null,
      code: parsed.code,
      name: parsed.name,
      terminalId: parsed.terminalId ?? null,
      drawerId: parsed.drawerId ?? null,
      warehouseId: parsed.warehouseId ?? null,
      blindClosing: parsed.blindClosing === true,
      withdrawalLimitWithoutApprovalCents: parsed.withdrawalLimitWithoutApprovalCents ?? null,
      supplyLimitWithoutApprovalCents: parsed.supplyLimitWithoutApprovalCents ?? null,
      discrepancyToleranceCents: parsed.discrepancyToleranceCents ?? '0',
      expectedOpeningFloatCents: parsed.expectedOpeningFloatCents ?? null,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    try {
      await withAtomicFlush(em, [() => undefined], {
        transaction: true,
        label: 'soanas_cash.registers.create',
      })
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_cash_registers_code_scope_unique')) {
        const { translate } = await resolveTranslations()
        throw conflict(
          translate('soanas_cash.errors.register_code_taken', 'A cash register with this code already exists'),
        )
      }
      throw err
    }
    return { registerId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = forkEm(ctx)
    const record = await em.findOne(CashRegister, { id: result.registerId, deletedAt: null })
    return record ? toSnapshot(record) : null
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as RegisterSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.register_create', 'Create cash register'),
      resourceKind: 'soanas_cash.cash_register',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
    }
  },
}

const updateRegisterCommand: CommandHandler<CashRegisterUpdateInput, { registerId: string }> = {
  id: 'soanas_cash.registers.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Cash register id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const record = await em.findOne(CashRegister, { id: input.id, deletedAt: null })
    return { before: record ? toSnapshot(record) : null }
  },
  async execute(input, ctx) {
    const parsed = cashRegisterUpdateSchema.parse(input)
    const em = forkEm(ctx)
    const record = await em.findOne(CashRegister, {
      id: parsed.id,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      deletedAt: null,
    })
    if (!record) {
      const { translate } = await resolveTranslations()
      throw notFound(translate('soanas_cash.errors.register_not_found', 'Cash register not found'))
    }

    if (parsed.code !== undefined) record.code = parsed.code
    if (parsed.name !== undefined) record.name = parsed.name
    if (parsed.establishmentId !== undefined) record.establishmentId = parsed.establishmentId ?? null
    if (parsed.terminalId !== undefined) record.terminalId = parsed.terminalId ?? null
    if (parsed.drawerId !== undefined) record.drawerId = parsed.drawerId ?? null
    if (parsed.warehouseId !== undefined) record.warehouseId = parsed.warehouseId ?? null
    if (parsed.blindClosing !== undefined) record.blindClosing = parsed.blindClosing
    if (parsed.withdrawalLimitWithoutApprovalCents !== undefined) {
      record.withdrawalLimitWithoutApprovalCents = parsed.withdrawalLimitWithoutApprovalCents ?? null
    }
    if (parsed.supplyLimitWithoutApprovalCents !== undefined) {
      record.supplyLimitWithoutApprovalCents = parsed.supplyLimitWithoutApprovalCents ?? null
    }
    if (parsed.discrepancyToleranceCents !== undefined) {
      record.discrepancyToleranceCents = parsed.discrepancyToleranceCents
    }
    if (parsed.expectedOpeningFloatCents !== undefined) {
      record.expectedOpeningFloatCents = parsed.expectedOpeningFloatCents ?? null
    }
    if (parsed.isActive !== undefined) record.isActive = parsed.isActive
    record.updatedAt = new Date()

    try {
      await withAtomicFlush(em, [() => undefined], {
        transaction: true,
        label: 'soanas_cash.registers.update',
      })
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_cash_registers_code_scope_unique')) {
        const { translate } = await resolveTranslations()
        throw conflict(
          translate('soanas_cash.errors.register_code_taken', 'A cash register with this code already exists'),
        )
      }
      throw err
    }

    return { registerId: record.id }
  },
  captureAfter: async (input, _result, ctx) => {
    const em = forkEm(ctx)
    const record = await em.findOne(CashRegister, { id: input.id, deletedAt: null })
    return record ? toSnapshot(record) : null
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as RegisterSnapshot | undefined
    const after = snapshots.after as RegisterSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.register_update', 'Update cash register'),
      resourceKind: 'soanas_cash.cash_register',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
    }
  },
}

const deleteRegisterCommand: CommandHandler<CashRegisterDeleteInput, { registerId: string }> = {
  id: 'soanas_cash.registers.delete',
  async prepare(input, ctx) {
    const id = requireId(input, 'Cash register id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const record = await em.findOne(CashRegister, { id, deletedAt: null })
    return { before: record ? toSnapshot(record) : null }
  },
  async execute(input, ctx) {
    const parsed = cashRegisterDeleteSchema.parse(input)
    const em = forkEm(ctx)
    const record = await em.findOne(CashRegister, {
      id: parsed.id,
      tenantId: parsed.tenantId,
      deletedAt: null,
      ...(parsed.organizationId ? { organizationId: parsed.organizationId } : {}),
    })
    if (!record) {
      const { translate } = await resolveTranslations()
      throw notFound(translate('soanas_cash.errors.register_not_found', 'Cash register not found'))
    }

    const activeSession = await em.findOne(CashSession, {
      registerId: record.id,
      tenantId: record.tenantId,
      status: { $in: ['opening', 'open', 'closing'] },
      deletedAt: null,
    })
    if (activeSession) {
      const { translate } = await resolveTranslations()
      throw badRequest(
        translate(
          'soanas_cash.errors.register_has_open_session',
          'Close the open cash session before removing this register',
        ),
      )
    }

    record.deletedAt = new Date()
    record.isActive = false
    record.updatedAt = new Date()
    await withAtomicFlush(em, [() => undefined], {
      transaction: true,
      label: 'soanas_cash.registers.delete',
    })
    return { registerId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as RegisterSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.register_delete', 'Delete cash register'),
      resourceKind: 'soanas_cash.cash_register',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
    }
  },
}

registerCommand(createRegisterCommand)
registerCommand(updateRegisterCommand)
registerCommand(deleteRegisterCommand)
