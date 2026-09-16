import { z } from 'zod'
import { pixRefundSchema } from '../../../../../data/validators'
import { buildPixCommandOpenApi } from '../../../../openapi'
import { handlePixCommandRoute, withServerScope } from '../../../../utils'

export const metadata = {
  path: '/soanas_payments_br/pix/charges/[txid]/refund',
  POST: { requireAuth: true, requireFeatures: ['soanas_payments_br.pix.refund'] },
}

type RefundResult = { chargeId: string; refundId: string; status: string }

export async function POST(req: Request, { params }: { params: Promise<{ txid: string }> | { txid: string } }) {
  const { txid } = await params
  return handlePixCommandRoute<typeof pixRefundSchema, RefundResult>(req, {
    schema: pixRefundSchema,
    commandId: 'soanas_payments_br.pix.refund',
    buildInput: (body, scope) => withServerScope(body, scope, { txid }),
    buildResponse: (result) => ({
      id: result?.chargeId ?? null,
      refundId: result?.refundId ?? null,
      status: result?.status ?? null,
    }),
    status: 200,
    failure: { key: 'soanas_payments_br.errors.refund_failed', fallback: 'Failed to refund the Pix charge' },
  })
}

export const openApi = buildPixCommandOpenApi({
  summary: 'Refund a Pix charge (full or partial)',
  description: 'Refunds a PAID/PARTIALLY_REFUNDED Pix charge. Omit amountCents to refund the remaining balance.',
  requestSchema: pixRefundSchema.omit({ tenantId: true, organizationId: true, txid: true }),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    refundId: z.string().nullable(),
    status: z.string().nullable(),
  }),
  status: 200,
})
