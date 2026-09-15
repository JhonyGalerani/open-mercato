import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { cashWithdrawalCreateSchema } from '../../data/validators'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['soanas_cash.withdrawals.create'] },
}

export async function POST(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId || !auth.sub) {
      return NextResponse.json({ error: translate('soanas_cash.errors.unauthorized', 'Unauthorized') }, { status: 401 })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId
    if (!organizationId) {
      return NextResponse.json({ error: translate('soanas_cash.errors.org_required', 'Organization required') }, { status: 400 })
    }

    const body = await readJsonSafe(req, {})
    const parsed = cashWithdrawalCreateSchema.parse({
      ...body,
      tenantId: auth.tenantId,
      organizationId,
      operatorUserId: body.operatorUserId ?? auth.sub,
    })

    const commandBus = container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('soanas_cash.withdrawals.create', {
      input: parsed,
      ctx: {
        container,
        auth,
        organizationScope: scope ?? null,
        selectedOrganizationId: organizationId,
        organizationIds: scope?.filterIds ?? [organizationId],
        request: req,
      },
    })
    return NextResponse.json({ id: result?.movementId ?? null }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: err.flatten() }, { status: 400 })
    }
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    return NextResponse.json({ error: translate('soanas_cash.errors.withdrawal_failed', 'Failed to create withdrawal') }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Soanas Cash',
  summary: 'Create cash withdrawal (sangria)',
}
