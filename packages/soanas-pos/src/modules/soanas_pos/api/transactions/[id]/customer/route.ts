import { z } from 'zod'
import { posSetCustomerSchema } from '../../../../data/validators'
import { buildPosCommandOpenApi } from '../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/customer',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posSetCustomerSchema, { transactionId: string }>(req, {
    schema: posSetCustomerSchema,
    commandId: 'soanas_pos.transactions.set_customer',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({ id: result?.transactionId ?? null }),
    status: 200,
    failure: { key: 'soanas_pos.errors.set_customer_failed', fallback: 'Failed to set the POS customer' },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Attach a customer to a POS transaction',
  requestSchema: z.object({ customerId: z.string().uuid().nullish() }),
  responseSchema: z.object({ id: z.string().uuid().nullable() }),
  status: 200,
})
