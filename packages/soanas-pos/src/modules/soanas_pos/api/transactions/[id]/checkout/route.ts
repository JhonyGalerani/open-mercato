import { z } from 'zod'
import { posCheckoutSchema } from '../../../../data/validators'
import { buildPosCommandOpenApi } from '../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/checkout',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
}

type CheckoutResult = { transactionId: string; status: string; grandTotalCents: string }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posCheckoutSchema, CheckoutResult>(req, {
    schema: posCheckoutSchema,
    commandId: 'soanas_pos.transactions.checkout',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({
      id: result?.transactionId ?? null,
      status: result?.status ?? null,
      grandTotalCents: result?.grandTotalCents ?? '0',
    }),
    status: 200,
    failure: { key: 'soanas_pos.errors.checkout_failed', fallback: 'Failed to check out the POS transaction' },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Check out a POS transaction',
  description: 'Recalculates the cart and moves DRAFT -> CHECKOUT -> PAYMENT_PENDING.',
  requestSchema: z.object({}),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    status: z.string().nullable(),
    grandTotalCents: z.string(),
  }),
  status: 200,
})
