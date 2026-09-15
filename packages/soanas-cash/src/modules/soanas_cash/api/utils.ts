import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest, type AuthContext } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CommandBus } from '@open-mercato/shared/lib/commands'

export type CashCommandScope = {
  auth: NonNullable<AuthContext>
  tenantId: string
  organizationId: string
}

export type CashCommandRouteOptions<TSchema extends z.ZodTypeAny, TResult> = {
  schema: TSchema
  commandId: string
  /**
   * Builds the command input from the request body. Scope and actor identity are always
   * taken from the session, never from the body (REV-003).
   */
  buildInput: (body: Record<string, unknown>, scope: CashCommandScope) => Record<string, unknown>
  buildResponse: (result: TResult | undefined) => unknown
  status?: number
  failure: { key: string; fallback: string }
}

export async function handleCashCommandRoute<TSchema extends z.ZodTypeAny, TResult>(
  req: Request,
  options: CashCommandRouteOptions<TSchema, TResult>,
): Promise<Response> {
  const { translate } = await resolveTranslations()
  try {
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

    const body = (await readJsonSafe(req, {})) as Record<string, unknown>
    const input = options.schema.parse(
      options.buildInput(body ?? {}, { auth, tenantId: auth.tenantId, organizationId }),
    )

    const commandBus = container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute(options.commandId, {
      input,
      ctx: {
        container,
        auth,
        organizationScope: scope ?? null,
        selectedOrganizationId: organizationId,
        organizationIds: scope?.filterIds ?? [organizationId],
        request: req,
      },
    })
    return NextResponse.json(options.buildResponse(result as TResult | undefined), {
      status: options.status ?? 201,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: translate('soanas_cash.errors.invalid_payload', 'Invalid payload'), details: err.flatten() },
        { status: 400 },
      )
    }
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    return NextResponse.json({ error: translate(options.failure.key, options.failure.fallback) }, { status: 500 })
  }
}

/** Strips client-supplied scope/actor keys so only server-derived values survive. */
export function withServerScope(
  body: Record<string, unknown>,
  scope: CashCommandScope,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const {
    tenantId: _tenantId,
    organizationId: _organizationId,
    operatorUserId: _operatorUserId,
    ...rest
  } = body
  return {
    ...rest,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    operatorUserId: scope.auth.sub,
    ...extra,
  }
}
