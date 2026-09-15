import { z } from 'zod'
import { posApplyDiscountSchema } from '../../../../data/validators'
import { buildPosCommandOpenApi } from '../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/discount',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
}

type DiscountResult = { transactionId: string; grandTotalCents: string }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posApplyDiscountSchema, DiscountResult>(req, {
    schema: posApplyDiscountSchema,
    commandId: 'soanas_pos.transactions.apply_discount',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({
      id: result?.transactionId ?? null,
      grandTotalCents: result?.grandTotalCents ?? '0',
    }),
    status: 200,
    failure: { key: 'soanas_pos.errors.discount_failed', fallback: 'Failed to apply the discount' },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Apply a POS discount',
  description: 'Line or cart discount; amounts above the operator limit require an approval feature.',
  requestSchema: z.object({
    scope: z.enum(['line', 'cart']),
    lineId: z.string().uuid().nullish(),
    amountCents: z.string(),
    reason: z.string().nullish(),
  }),
  responseSchema: z.object({ id: z.string().uuid().nullable(), grandTotalCents: z.string() }),
  status: 200,
})
