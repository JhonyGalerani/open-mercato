import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest, type AuthContext } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CommandBus } from '@open-mercato/shared/lib/commands'

export type PosCommandScope = {
  auth: NonNullable<AuthContext>
  tenantId: string
  organizationId: string
}

type RequestContainer = Awaited<ReturnType<typeof createRequestContainer>>

type ResolvedOrganizationScope = Awaited<ReturnType<typeof resolveOrganizationScopeForRequest>>

export type PosRequestScope = PosCommandScope & {
  container: RequestContainer
  organizationIds: string[]
  organizationScope: ResolvedOrganizationScope | null
}

class PosScopeError extends Error {
  readonly response: Response

  constructor(response: Response) {
    super('[internal] soanas_pos request scope rejected')
    this.response = response
  }
}

/** Resolves the tenant/organization scope of a POS request; never trusts the body. */
export async function resolvePosRequestScope(req: Request): Promise<PosRequestScope> {
  const { translate } = await resolveTranslations()
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || !auth.sub) {
    throw new PosScopeError(
      NextResponse.json({ error: translate('soanas_pos.errors.unauthorized', 'Unauthorized') }, { status: 401 }),
    )
  }
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = scope?.selectedId ?? auth.orgId
  if (!organizationId) {
    throw new PosScopeError(
      NextResponse.json(
        { error: translate('soanas_pos.errors.org_required', 'Organization required') },
        { status: 400 },
      ),
    )
  }
  return {
    container,
    auth,
    tenantId: auth.tenantId,
    organizationId,
    organizationIds: scope?.filterIds ?? [organizationId],
    organizationScope: scope ?? null,
  }
}

export function posScopeErrorResponse(err: unknown): Response | null {
  return err instanceof PosScopeError ? err.response : null
}

export type PosCommandRouteOptions<TSchema extends z.ZodTypeAny, TResult> = {
  schema: TSchema
  commandId: string
  /** Scope and operator identity always come from the session, never from the body. */
  buildInput: (body: Record<string, unknown>, scope: PosCommandScope) => Record<string, unknown>
  buildResponse: (result: TResult | undefined) => unknown
  status?: number
  failure: { key: string; fallback: string }
}

export async function handlePosCommandRoute<TSchema extends z.ZodTypeAny, TResult>(
  req: Request,
  options: PosCommandRouteOptions<TSchema, TResult>,
): Promise<Response> {
  const { translate } = await resolveTranslations()
  try {
    const scope = await resolvePosRequestScope(req)
    const body = (await readJsonSafe(req, {})) as Record<string, unknown>
    const input = options.schema.parse(options.buildInput(body ?? {}, scope))

    const commandBus = scope.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute(options.commandId, {
      input,
      ctx: {
        container: scope.container,
        auth: scope.auth,
        selectedOrganizationId: scope.organizationId,
        organizationIds: scope.organizationIds,
        organizationScope: scope.organizationScope,
        request: req,
      },
    })
    return NextResponse.json(options.buildResponse(result as TResult | undefined), {
      status: options.status ?? 200,
    })
  } catch (err) {
    const scopeResponse = posScopeErrorResponse(err)
    if (scopeResponse) return scopeResponse
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: translate('soanas_pos.errors.invalid_payload', 'Invalid payload'), details: err.flatten() },
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
  scope: PosCommandScope,
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
