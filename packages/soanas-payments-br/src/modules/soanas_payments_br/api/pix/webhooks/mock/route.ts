import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { pixApplyWebhookSchema } from '../../../../data/validators'
import { buildPixCommandOpenApi } from '../../../openapi'

/**
 * Dev/test-only endpoint that simulates the mock PSP calling back into the
 * platform. Real Bacen/PSP webhooks arrive unauthenticated too (they carry their
 * own signature scheme instead of a session), so this route mirrors that shape:
 * no `requireAuth`, tenant/txid identify the charge, and applying the same
 * payload twice is a no-op (see `pixStateMachine`/`MockPixProvider`).
 */
export const metadata = {
  path: '/soanas_payments_br/pix/webhooks/mock',
  POST: { requireAuth: false },
}

type ApplyWebhookResult = { chargeId: string; status: string; applied: boolean }

export async function POST(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    const body = (await readJsonSafe(req, {})) as Record<string, unknown>
    const input = pixApplyWebhookSchema.parse({
      tenantId: body.tenantId,
      payload: { txid: body.txid, status: body.status, e2eId: body.e2eId ?? null },
    })

    const container = await createRequestContainer()
    const commandBus = container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('soanas_payments_br.pix.apply_webhook', {
      input,
      ctx: {
        container,
        auth: null,
        organizationScope: null,
        selectedOrganizationId: null,
        organizationIds: null,
        systemActor: true,
      },
    })
    const applied = result as ApplyWebhookResult | undefined
    return NextResponse.json({
      id: applied?.chargeId ?? null,
      status: applied?.status ?? null,
      applied: applied?.applied ?? false,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: translate('soanas_payments_br.errors.invalid_payload', 'Invalid payload'), details: err.flatten() },
        { status: 400 },
      )
    }
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const debugMessage = err instanceof Error ? err.message : String(err)
    console.error('[soanas_payments_br] webhook failure', debugMessage)
    return NextResponse.json(
      { error: translate('soanas_payments_br.errors.webhook_failed', 'Failed to apply the Pix webhook') },
      { status: 500 },
    )
  }
}

export const openApi = buildPixCommandOpenApi({
  summary: 'Apply a mock Pix webhook',
  description: 'Simulates the mock PSP notifying a charge status change. Idempotent for repeated deliveries.',
  requestSchema: z.object({
    tenantId: z.string().uuid(),
    txid: z.string(),
    status: z.string(),
    e2eId: z.string().nullish(),
  }),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    status: z.string().nullable(),
    applied: z.boolean(),
  }),
  status: 200,
})
