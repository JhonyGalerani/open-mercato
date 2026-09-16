import { z } from 'zod'
import { posResumeSchema } from '../../../../data/validators'
import { buildPosCommandOpenApi } from '../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/resume',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
}

type ResumeResult = { transactionId: string; status: string }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posResumeSchema, ResumeResult>(req, {
    schema: posResumeSchema,
    commandId: 'soanas_pos.transactions.resume',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({
      id: result?.transactionId ?? null,
      status: result?.status ?? null,
    }),
    status: 200,
    failure: { key: 'soanas_pos.errors.resume_failed', fallback: 'Failed to resume the POS transaction' },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Resume a suspended POS sale',
  description: 'Moves HELD -> DRAFT so the operator can continue editing the cart. Rejects expired holds.',
  requestSchema: z.object({}),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    status: z.string().nullable(),
  }),
  status: 200,
})
