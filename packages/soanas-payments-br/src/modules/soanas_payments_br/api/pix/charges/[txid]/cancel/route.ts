import { z } from 'zod'
import { pixCancelSchema } from '../../../../../data/validators'
import { buildPixCommandOpenApi } from '../../../../openapi'
import { handlePixCommandRoute, withServerScope } from '../../../../utils'

export const metadata = {
  path: '/soanas_payments_br/pix/charges/[txid]/cancel',
  POST: { requireAuth: true, requireFeatures: ['soanas_payments_br.pix.cancel'] },
}

type CancelResult = { chargeId: string; status: string }

export async function POST(req: Request, { params }: { params: Promise<{ txid: string }> | { txid: string } }) {
  const { txid } = await params
  return handlePixCommandRoute<typeof pixCancelSchema, CancelResult>(req, {
    schema: pixCancelSchema,
    commandId: 'soanas_payments_br.pix.cancel',
    buildInput: (body, scope) => withServerScope(body, scope, { txid }),
    buildResponse: (result) => ({ id: result?.chargeId ?? null, status: result?.status ?? null }),
    status: 200,
    failure: { key: 'soanas_payments_br.errors.cancel_failed', fallback: 'Failed to cancel the Pix charge' },
  })
}

export const openApi = buildPixCommandOpenApi({
  summary: 'Cancel a Pix charge',
  description: 'Cancels a Pix charge that is still CREATED/WAITING for payment.',
  requestSchema: pixCancelSchema.omit({ tenantId: true, organizationId: true, txid: true }),
  responseSchema: z.object({ id: z.string().uuid().nullable(), status: z.string().nullable() }),
  status: 200,
})
