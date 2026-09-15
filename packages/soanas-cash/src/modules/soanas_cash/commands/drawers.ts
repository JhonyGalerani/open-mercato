import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { conflict, isUniqueViolation, notFound } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CashDrawer } from '../data/entities'
import {
  cashDrawerCreateSchema,
  cashDrawerUpdateSchema,
  cashDrawerDeleteSchema,
  type CashDrawerCreateInput,
  type CashDrawerUpdateInput,
  type CashDrawerDeleteInput,
} from '../data/validators'
import { forkEm, loadRegisterOrThrow } from './helpers'

type DrawerSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  registerId: string
  code: string
  name: string | null
  isActive: boolean
  updatedAt: string
}

function toSnapshot(record: CashDrawer): DrawerSnapshot {
  return {
    id: record.id,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    registerId: record.registerId,
    code: record.code,
    name: record.name ?? null,
    isActive: record.isActive,
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function throwDrawerCodeConflict(): Promise<never> {
  const { translate } = await resolveTranslations()
  throw conflict(
    translate('soanas_cash.errors.drawer_code_taken', 'A drawer with this code already exists on the register'),
  )
}

const createDrawerCommand: CommandHandler<CashDrawerCreateInput, { drawerId: string }> = {
  id: 'soanas_cash.drawers.create',
  async execute(input, ctx) {
    const parsed = cashDrawerCreateSchema.parse(input)
    const em = forkEm(ctx)
    await loadRegisterOrThrow(
      em,
      { id: parsed.registerId, tenantId: parsed.tenantId, organizationId: parsed.organizationId },
      { requireActive: false },
    )

    const now = new Date()
    const record = em.create(CashDrawer, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      registerId: parsed.registerId,
      code: parsed.code,
      name: parsed.name ?? null,
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    try {
      await withAtomicFlush(em, [() => undefined], {
        transaction: true,
        label: 'soanas_cash.drawers.create',
      })
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_cash_drawers_register_code_unique')) await throwDrawerCodeConflict()
      throw err
    }
    return { drawerId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = forkEm(ctx)
    const record = await em.findOne(CashDrawer, { id: result.drawerId, deletedAt: null })
    return record ? toSnapshot(record) : null
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as DrawerSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.drawer_create', 'Create cash drawer'),
      resourceKind: 'soanas_cash.cash_drawer',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
    }
  },
}

const updateDrawerCommand: CommandHandler<CashDrawerUpdateInput, { drawerId: string }> = {
  id: 'soanas_cash.drawers.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Cash drawer id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const record = await em.findOne(CashDrawer, { id: input.id, deletedAt: null })
    return { before: record ? toSnapshot(record) : null }
  },
  async execute(input, ctx) {
    const parsed = cashDrawerUpdateSchema.parse(input)
    const em = forkEm(ctx)
    const record = await em.findOne(CashDrawer, {
      id: parsed.id,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      deletedAt: null,
    })
    if (!record) {
      const { translate } = await resolveTranslations()
      throw notFound(translate('soanas_cash.errors.drawer_not_found', 'Cash drawer not found'))
    }

    if (parsed.registerId !== undefined) {
      await loadRegisterOrThrow(
        em,
        { id: parsed.registerId, tenantId: parsed.tenantId, organizationId: parsed.organizationId },
        { requireActive: false },
      )
      record.registerId = parsed.registerId
    }
    if (parsed.code !== undefined) record.code = parsed.code
    if (parsed.name !== undefined) record.name = parsed.name ?? null
    if (parsed.isActive !== undefined) record.isActive = parsed.isActive
    record.updatedAt = new Date()

    try {
      await withAtomicFlush(em, [() => undefined], {
        transaction: true,
        label: 'soanas_cash.drawers.update',
      })
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_cash_drawers_register_code_unique')) await throwDrawerCodeConflict()
      throw err
    }
    return { drawerId: record.id }
  },
  captureAfter: async (input, _result, ctx) => {
    const em = forkEm(ctx)
    const record = await em.findOne(CashDrawer, { id: input.id, deletedAt: null })
    return record ? toSnapshot(record) : null
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as DrawerSnapshot | undefined
    const after = snapshots.after as DrawerSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.drawer_update', 'Update cash drawer'),
      resourceKind: 'soanas_cash.cash_drawer',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
    }
  },
}

const deleteDrawerCommand: CommandHandler<CashDrawerDeleteInput, { drawerId: string }> = {
  id: 'soanas_cash.drawers.delete',
  async prepare(input, ctx) {
    const id = requireId(input, 'Cash drawer id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const record = await em.findOne(CashDrawer, { id, deletedAt: null })
    return { before: record ? toSnapshot(record) : null }
  },
  async execute(input, ctx) {
    const parsed = cashDrawerDeleteSchema.parse(input)
    const em = forkEm(ctx)
    const record = await em.findOne(CashDrawer, {
      id: parsed.id,
      tenantId: parsed.tenantId,
      deletedAt: null,
      ...(parsed.organizationId ? { organizationId: parsed.organizationId } : {}),
    })
    if (!record) {
      const { translate } = await resolveTranslations()
      throw notFound(translate('soanas_cash.errors.drawer_not_found', 'Cash drawer not found'))
    }
    record.deletedAt = new Date()
    record.isActive = false
    record.updatedAt = new Date()
    await withAtomicFlush(em, [() => undefined], {
      transaction: true,
      label: 'soanas_cash.drawers.delete',
    })
    return { drawerId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as DrawerSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.drawer_delete', 'Delete cash drawer'),
      resourceKind: 'soanas_cash.cash_drawer',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
    }
  },
}

registerCommand(createDrawerCommand)
registerCommand(updateDrawerCommand)
registerCommand(deleteDrawerCommand)
