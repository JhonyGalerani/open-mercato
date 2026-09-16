import { z } from 'zod'
import { posTenderRemoveSchema } from '../../../../../data/validators'
import { buildPosCommandOpenApi } from '../../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/tenders/[tenderId]',
  DELETE: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
}

type RemoveResult = { tenderId: string; status: string }

export async function DELETE(
  req: Request,
  {
    params,
  }: { params: Promise<{ id: string; tenderId: string }> | { id: string; tenderId: string } },
) {
  const resolved = await params
  return handlePosCommandRoute<typeof posTenderRemoveSchema, RemoveResult>(req, {
    schema: posTenderRemoveSchema,
    commandId: 'soanas_pos.transactions.remove_tender',
    buildInput: (body, scope) =>
      withServerScope(body, scope, {
        transactionId: resolved.id,
        tenderId: resolved.tenderId,
      }),
    buildResponse: (result) => ({
      id: result?.tenderId ?? null,
      status: result?.status ?? null,
    }),
    failure: {
      key: 'soanas_pos.errors.tender_remove_failed',
      fallback: 'Failed to remove the payment tender',
    },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Remove a payment tender before completion',
  description:
    'Removes a tender and reopens PAYMENT_PENDING when the sale was already marked PAID. Never undoes a COMPLETED sale.',
  requestSchema: z.object({}),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    status: z.string().nullable(),
  }),
})
