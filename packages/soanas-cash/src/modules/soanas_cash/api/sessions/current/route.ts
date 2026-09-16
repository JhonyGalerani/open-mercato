import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { hasFeature } from '@open-mercato/shared/security/features'
import { CashMovement, CashRegister, CashSession } from '../../../data/entities'
import { buildReconciliationTotals } from '../../../lib/ledger'
import { APPROVAL_FEATURES } from '../../../lib/policy'
import { centsToWire, nullableCentsToWire } from '../../../lib/cents'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['soanas_cash.sessions.view'] },
}

const querySchema = z.object({ registerId: z.string().uuid() })

export async function GET(req: Request) {
  const { translate } = await resolveTranslations()
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || !auth.sub) {
    return NextResponse.json(
      { error: translate('soanas_cash.errors.unauthorized', 'Unauthorized') },
      { status: 401 },
    )
  }
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = scope?.selectedId ?? auth.orgId
  if (!organizationId) {
    return NextResponse.json(
      { error: translate('soanas_cash.errors.org_required', 'Organization required') },
      { status: 400 },
    )
  }

  const url = new URL(req.url)
  const parsedQuery = querySchema.safeParse({ registerId: url.searchParams.get('registerId') ?? undefined })
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: translate('soanas_cash.errors.register_required', 'registerId is required') },
      { status: 400 },
    )
  }

  const em = (container.resolve('em') as EntityManager).fork()
  const register = await em.findOne(CashRegister, {
    id: parsedQuery.data.registerId,
    tenantId: auth.tenantId,
    organizationId,
    deletedAt: null,
  })
  if (!register) {
    return NextResponse.json(
      { error: translate('soanas_cash.errors.register_not_found', 'Cash register not found') },
      { status: 404 },
    )
  }

  const session = await em.findOne(
    CashSession,
    {
      registerId: register.id,
      tenantId: auth.tenantId,
      organizationId,
      status: { $in: ['opening', 'open', 'closing'] },
      deletedAt: null,
    },
    { orderBy: { openedAtServer: 'desc' } },
  )
  if (!session) {
    return NextResponse.json({ session: null, register: serializeRegister(register) })
  }

  const movements = await em.find(
    CashMovement,
    { sessionId: session.id, tenantId: auth.tenantId },
    { orderBy: { createdAt: 'asc' } },
  )
  const totals = buildReconciliationTotals(
    movements.map((movement) => ({
      type: movement.type,
      amountCents: BigInt(movement.amountCents),
      status: movement.status,
    })),
  )

  const grantedFeatures = Array.isArray(auth.features)
    ? auth.features.filter((value): value is string => typeof value === 'string')
    : []
  const blind = session.closingBlind || register.blindClosing
  const revealExpected =
    !blind || APPROVAL_FEATURES.some((feature) => hasFeature(grantedFeatures, feature))

  return NextResponse.json({
    register: serializeRegister(register),
    session: {
      id: session.id,
      status: session.status,
      registerId: session.registerId,
      operatorUserId: session.operatorUserId,
      openingFloatCents: centsToWire(session.openingFloatCents),
      openedAtServer: session.openedAtServer.toISOString(),
      notes: session.notes ?? null,
      blind,
      updatedAt: session.updatedAt.toISOString(),
    },
    totals: {
      salesCents: totals.salesCents.toString(),
      suppliesCents: totals.suppliesCents.toString(),
      withdrawalsCents: totals.withdrawalsCents.toString(),
      refundsCents: totals.refundsCents.toString(),
      ...(revealExpected ? { expectedCashCents: totals.expectedCashCents.toString() } : {}),
    },
    movements: movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      status: movement.status,
      amountCents: centsToWire(movement.amountCents),
      reasonCode: movement.reasonCode ?? null,
      createdAt: movement.createdAt.toISOString(),
    })),
  })
}

function serializeRegister(register: CashRegister) {
  return {
    id: register.id,
    code: register.code,
    name: register.name,
    blindClosing: register.blindClosing,
    discrepancyToleranceCents: centsToWire(register.discrepancyToleranceCents),
    expectedOpeningFloatCents: nullableCentsToWire(register.expectedOpeningFloatCents),
    updatedAt: register.updatedAt.toISOString(),
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Soanas Cash',
  summary: 'Current open cash session for a register',
  methods: {
    GET: {
      summary: 'Current open cash session for a register',
      query: querySchema,
    },
  },
}
