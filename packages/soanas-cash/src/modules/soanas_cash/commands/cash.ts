import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/core'
import { conflict, forbidden, notFound, badRequest, isUniqueViolation } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CashMovement, CashRegister, CashSession } from '../data/entities'
import { cashSessionOpenSchema, type CashSessionOpenInput } from '../data/validators'
import { computeExpectedCashCents } from '../lib/ledger'
import { cashWithdrawalCreateSchema, type CashWithdrawalCreateInput } from '../data/validators'

const openSessionCommand: CommandHandler<CashSessionOpenInput, { sessionId: string }> = {
  id: 'soanas_cash.sessions.open',
  async execute(input, ctx) {
    const parsed = cashSessionOpenSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const register = await em.findOne(CashRegister, {
      id: parsed.registerId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      deletedAt: null,
      isActive: true,
    })
    if (!register) {
      const { translate } = await resolveTranslations()
      throw notFound(translate('soanas_cash.errors.register_not_found', 'Cash register not found'))
    }

    const existingOpen = await em.findOne(CashSession, {
      registerId: parsed.registerId,
      tenantId: parsed.tenantId,
      status: { $in: ['open', 'opening', 'closing'] },
      deletedAt: null,
    })
    if (existingOpen) {
      throw conflict('Register already has an incompatible open session')
    }

    if (parsed.idempotencyKey) {
      const prior = await em.findOne(CashSession, {
        tenantId: parsed.tenantId,
        idempotencyKey: parsed.idempotencyKey,
        deletedAt: null,
      })
      if (prior) return { sessionId: prior.id }
    }

    const now = new Date()
    const sessionId = crypto.randomUUID()
    const session = em.create(CashSession, {
      id: sessionId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      establishmentId: parsed.establishmentId ?? null,
      registerId: parsed.registerId,
      terminalId: parsed.terminalId ?? null,
      operatorUserId: parsed.operatorUserId,
      status: 'open',
      openingFloatCents: parsed.openingFloatCents,
      openingDenominations: parsed.openingDenominations ?? null,
      openedAtServer: now,
      openedAtLocal: parsed.openedAtLocal ?? null,
      idempotencyKey: parsed.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(session)

    const openingMovement = em.create(CashMovement, {
      id: crypto.randomUUID(),
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      sessionId,
      registerId: parsed.registerId,
      type: 'opening',
      amountCents: parsed.openingFloatCents,
      status: 'confirmed',
      operatorUserId: parsed.operatorUserId,
      terminalId: parsed.terminalId ?? null,
      denominations: parsed.openingDenominations ?? null,
      idempotencyKey: `${parsed.idempotencyKey}:opening`,
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    em.persist(openingMovement)

    try {
      await withAtomicFlush(em, [() => undefined], { transaction: true, label: 'soanas_cash.sessions.open' })
    } catch (err) {
      if (isUniqueViolation(err)) {
        const prior = await em.findOne(CashSession, {
          tenantId: parsed.tenantId,
          idempotencyKey: parsed.idempotencyKey,
          deletedAt: null,
        })
        if (prior) return { sessionId: prior.id }
        throw conflict('Duplicate cash session open')
      }
      throw err
    }

    return { sessionId }
  },
}

const createWithdrawalCommand: CommandHandler<CashWithdrawalCreateInput, { movementId: string }> = {
  id: 'soanas_cash.withdrawals.create',
  async execute(input, ctx) {
    const parsed = cashWithdrawalCreateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const prior = await em.findOne(CashMovement, {
      tenantId: parsed.tenantId,
      idempotencyKey: parsed.idempotencyKey,
      deletedAt: null,
    })
    if (prior) return { movementId: prior.id }

    const session = await em.findOne(CashSession, {
      id: parsed.sessionId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      deletedAt: null,
    })
    if (!session) {
      const { translate } = await resolveTranslations()
      throw notFound(translate('soanas_cash.errors.session_not_found', 'Cash session not found'))
    }
    if (session.status !== 'open') {
      throw badRequest('Cash session is not open')
    }

    const amount = BigInt(parsed.amountCents)
    const maxWithoutApproval = parsed.maxWithoutApprovalCents
      ? BigInt(parsed.maxWithoutApprovalCents)
      : null
    if (maxWithoutApproval !== null && amount > maxWithoutApproval && !parsed.approverUserId) {
      throw forbidden('Managerial approval required for this withdrawal amount')
    }
    if (parsed.approverUserId && parsed.approverUserId === parsed.operatorUserId) {
      throw forbidden('Operator cannot approve their own withdrawal (dual custody)')
    }

    const movements = await em.find(CashMovement, {
      sessionId: session.id,
      deletedAt: null,
    })
    const expected = computeExpectedCashCents(
      movements.map((m) => ({
        type: m.type,
        amountCents: BigInt(m.amountCents),
        status: m.status,
      })),
    )
    if (amount > expected) {
      throw badRequest('Insufficient physical cash for withdrawal')
    }

    const now = new Date()
    const movement = em.create(CashMovement, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      sessionId: session.id,
      registerId: session.registerId,
      type: 'withdrawal',
      amountCents: parsed.amountCents,
      status: 'confirmed',
      reasonCode: parsed.reasonCode,
      reasonDetail: parsed.reasonDetail ?? null,
      destination: parsed.destination,
      receiverName: parsed.receiverName ?? null,
      operatorUserId: parsed.operatorUserId,
      approverUserId: parsed.approverUserId ?? null,
      terminalId: parsed.terminalId ?? null,
      denominations: parsed.denominations ?? null,
      idempotencyKey: parsed.idempotencyKey,
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    em.persist(movement)
    session.updatedAt = now

    try {
      await withAtomicFlush(em, [() => undefined], {
        transaction: true,
        label: 'soanas_cash.withdrawals.create',
      })
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_cash_movements_idempotency_unique')) {
        const again = await em.findOne(CashMovement, {
          tenantId: parsed.tenantId,
          idempotencyKey: parsed.idempotencyKey,
          deletedAt: null,
        })
        if (again) return { movementId: again.id }
        throw conflict('Duplicate withdrawal')
      }
      throw err
    }

    return { movementId: movement.id }
  },
}

registerCommand(openSessionCommand)
registerCommand(createWithdrawalCommand)
