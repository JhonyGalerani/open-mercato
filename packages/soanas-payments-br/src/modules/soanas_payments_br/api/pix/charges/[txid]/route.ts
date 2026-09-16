import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import type { PixChargeSnapshot } from '../../../../commands/pix'
import { pixScopeErrorResponse, resolvePixRequestScope } from '../../../utils'

export const metadata = {
  path: '/soanas_payments_br/pix/charges/[txid]',
  GET: { requireAuth: true, requireFeatures: ['soanas_payments_br.pix.view'] },
}

export async function GET(req: Request, { params }: { params: Promise<{ txid: string }> | { txid: string } }) {
  const { translate } = await resolveTranslations()
  try {
    const scope = await resolvePixRequestScope(req)
    const { txid } = await params
    const commandBus = scope.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('soanas_payments_br.pix.get', {
      input: { tenantId: scope.tenantId, organizationId: scope.organizationId, txid },
      ctx: {
        container: scope.container,
        auth: scope.auth,
        selectedOrganizationId: scope.organizationId,
        organizationIds: scope.organizationIds,
        organizationScope: scope.organizationScope,
        request: req,
      },
    })
    const charge = result as PixChargeSnapshot | undefined
    return NextResponse.json(charge ?? null)
  } catch (err) {
    const scopeResponse = pixScopeErrorResponse(err)
    if (scopeResponse) return scopeResponse
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    return NextResponse.json(
      { error: translate('soanas_payments_br.errors.detail_failed', 'Failed to load the Pix charge') },
      { status: 500 },
    )
  }
}

export const openApi = {
  tag: 'Soanas Payments BR',
  summary: 'Pix charge detail',
  pathParams: z.object({ txid: z.string() }),
  methods: {
    GET: {
      summary: 'Get a Pix charge, refreshing its status from the provider',
      responses: [
        {
          status: 200,
          schema: z.object({ txid: z.string(), status: z.string(), amountCents: z.string() }),
        },
      ],
    },
  },
}
