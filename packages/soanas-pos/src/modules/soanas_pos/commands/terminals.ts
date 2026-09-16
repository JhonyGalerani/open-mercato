import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { badRequest, conflict, isUniqueViolation, notFound } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { PosTerminal, PosTransaction } from '../data/entities'
import {
  posTerminalCreateSchema,
  posTerminalDeleteSchema,
  posTerminalUpdateSchema,
  type PosTerminalCreateInput,
  type PosTerminalDeleteInput,
  type PosTerminalUpdateInput,
} from '../data/validators'
import { forkEm } from './helpers'

type TerminalSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  code: string
  name: string
  establishmentId: string | null
  warehouseId: string | null
  salesChannelId: string | null
  priceKindId: string | null
  cashRegisterId: string | null
  deviceId: string | null
  stockPolicy: string
  status: string
  updatedAt: string
}

function toSnapshot(record: PosTerminal): TerminalSnapshot {
  return {
    id: record.id,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    code: record.code,
    name: record.name,
    establishmentId: record.establishmentId ?? null,
    warehouseId: record.warehouseId ?? null,
    salesChannelId: record.salesChannelId ?? null,
    priceKindId: record.priceKindId ?? null,
    cashRegisterId: record.cashRegisterId ?? null,
    deviceId: record.deviceId ?? null,
    stockPolicy: record.stockPolicy,
    status: record.status,
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createTerminalCommand: CommandHandler<PosTerminalCreateInput, { terminalId: string }> = {
  id: 'soanas_pos.terminals.create',
  async execute(input, ctx) {
    const parsed = posTerminalCreateSchema.parse(input)
    const em = forkEm(ctx)
    const now = new Date()
    const record = em.create(PosTerminal, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      establishmentId: parsed.establishmentId ?? null,
      code: parsed.code,
      name: parsed.name,
      warehouseId: parsed.warehouseId ?? null,
      salesChannelId: parsed.salesChannelId ?? null,
      priceKindId: parsed.priceKindId ?? null,
      cashRegisterId: parsed.cashRegisterId ?? null,
      deviceId: parsed.deviceId ?? null,
      stockPolicy: parsed.stockPolicy,
      status: parsed.status,
      clientVersion: parsed.clientVersion ?? null,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    try {
      await withAtomicFlush(em, [() => undefined], {
        transaction: true,
        label: 'soanas_pos.terminals.create',
      })
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_pos_terminals_code_scope_unique')) {
        const { translate } = await resolveTranslations()
        throw conflict(
          translate('soanas_pos.errors.terminal_code_taken', 'A POS terminal with this code already exists'),
        )
      }
      throw err
    }
    return { terminalId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = forkEm(ctx)
    const record = await em.findOne(PosTerminal, { id: result.terminalId, deletedAt: null })
    return record ? toSnapshot(record) : null
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as TerminalSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_pos.audit.terminal_create', 'Create POS terminal'),
      resourceKind: 'soanas_pos.pos_terminal',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
    }
  },
}

const updateTerminalCommand: CommandHandler<PosTerminalUpdateInput, { terminalId: string }> = {
  id: 'soanas_pos.terminals.update',
  async prepare(input, ctx) {
    requireId(input.id, 'POS terminal id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const record = await em.findOne(PosTerminal, { id: input.id, deletedAt: null })
    return { before: record ? toSnapshot(record) : null }
  },
  async execute(input, ctx) {
    const parsed = posTerminalUpdateSchema.parse(input)
    const em = forkEm(ctx)
    const record = await em.findOne(PosTerminal, {
      id: parsed.id,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      deletedAt: null,
    })
    if (!record) {
      const { translate } = await resolveTranslations()
      throw notFound(translate('soanas_pos.errors.terminal_not_found', 'POS terminal not found'))
    }
    if (parsed.code !== undefined) record.code = parsed.code
    if (parsed.name !== undefined) record.name = parsed.name
    if (parsed.establishmentId !== undefined) record.establishmentId = parsed.establishmentId ?? null
    if (parsed.warehouseId !== undefined) record.warehouseId = parsed.warehouseId ?? null
    if (parsed.salesChannelId !== undefined) record.salesChannelId = parsed.salesChannelId ?? null
    if (parsed.priceKindId !== undefined) record.priceKindId = parsed.priceKindId ?? null
    if (parsed.cashRegisterId !== undefined) record.cashRegisterId = parsed.cashRegisterId ?? null
    if (parsed.deviceId !== undefined) record.deviceId = parsed.deviceId ?? null
    if (parsed.stockPolicy !== undefined) record.stockPolicy = parsed.stockPolicy
    if (parsed.status !== undefined) record.status = parsed.status
    if (parsed.clientVersion !== undefined) record.clientVersion = parsed.clientVersion ?? null
    record.updatedAt = new Date()

    try {
      await withAtomicFlush(em, [() => undefined], {
        transaction: true,
        label: 'soanas_pos.terminals.update',
      })
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_pos_terminals_code_scope_unique')) {
        const { translate } = await resolveTranslations()
        throw conflict(
          translate('soanas_pos.errors.terminal_code_taken', 'A POS terminal with this code already exists'),
        )
      }
      throw err
    }
    return { terminalId: record.id }
  },
  captureAfter: async (input, _result, ctx) => {
    const em = forkEm(ctx)
    const record = await em.findOne(PosTerminal, { id: input.id, deletedAt: null })
    return record ? toSnapshot(record) : null
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as TerminalSnapshot | undefined
    const after = snapshots.after as TerminalSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_pos.audit.terminal_update', 'Update POS terminal'),
      resourceKind: 'soanas_pos.pos_terminal',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
    }
  },
}

const deleteTerminalCommand: CommandHandler<PosTerminalDeleteInput, { terminalId: string }> = {
  id: 'soanas_pos.terminals.delete',
  async prepare(input, ctx) {
    const id = requireId(input, 'POS terminal id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const record = await em.findOne(PosTerminal, { id, deletedAt: null })
    return { before: record ? toSnapshot(record) : null }
  },
  async execute(input, ctx) {
    const parsed = posTerminalDeleteSchema.parse(input)
    const em = forkEm(ctx)
    const record = await em.findOne(PosTerminal, {
      id: parsed.id,
      tenantId: parsed.tenantId,
      deletedAt: null,
      ...(parsed.organizationId ? { organizationId: parsed.organizationId } : {}),
    })
    if (!record) {
      const { translate } = await resolveTranslations()
      throw notFound(translate('soanas_pos.errors.terminal_not_found', 'POS terminal not found'))
    }
    const openTransaction = await em.findOne(PosTransaction, {
      terminalId: record.id,
      tenantId: record.tenantId,
      status: { $in: ['DRAFT', 'HELD', 'CHECKOUT', 'PAYMENT_PENDING', 'PAID', 'COMPLETING', 'FAILED_RECOVERABLE'] },
      deletedAt: null,
    })
    if (openTransaction) {
      const { translate } = await resolveTranslations()
      throw badRequest(
        translate(
          'soanas_pos.errors.terminal_has_open_transaction',
          'Finish or cancel the open POS transactions before removing this terminal',
        ),
      )
    }
    record.deletedAt = new Date()
    record.status = 'inactive'
    record.updatedAt = new Date()
    await withAtomicFlush(em, [() => undefined], {
      transaction: true,
      label: 'soanas_pos.terminals.delete',
    })
    return { terminalId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as TerminalSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_pos.audit.terminal_delete', 'Delete POS terminal'),
      resourceKind: 'soanas_pos.pos_terminal',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
    }
  },
}

registerCommand(createTerminalCommand)
registerCommand(updateTerminalCommand)
registerCommand(deleteTerminalCommand)
