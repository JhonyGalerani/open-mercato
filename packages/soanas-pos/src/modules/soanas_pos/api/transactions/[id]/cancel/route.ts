import { z } from 'zod'
import { posCancelSchema } from '../../../../data/validators'
import { buildPosCommandOpenApi } from '../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/cancel',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.cancel'] },
}

type CancelResult = { transactionId: string; status: string }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posCancelSchema, CancelResult>(req, {
    schema: posCancelSchema,
    commandId: 'soanas_pos.transactions.cancel',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({ id: result?.transactionId ?? null, status: result?.status ?? null }),
    status: 200,
    failure: { key: 'soanas_pos.errors.cancel_failed', fallback: 'Failed to cancel the POS transaction' },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Cancel a POS transaction',
  description:
    'DRAFT/CHECKOUT sales are cancelled outright; paid sales park in CANCEL_PENDING. A COMPLETED sale must be reversed with a sales return instead.',
  requestSchema: posCancelSchema.omit({
    tenantId: true,
    organizationId: true,
    operatorUserId: true,
    transactionId: true,
  }),
  responseSchema: z.object({ id: z.string().uuid().nullable(), status: z.string().nullable() }),
  status: 200,
})
