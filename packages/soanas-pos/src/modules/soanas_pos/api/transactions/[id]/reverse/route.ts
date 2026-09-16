import { z } from 'zod'
import { posReverseSchema } from '../../../../data/validators'
import { buildPosCommandOpenApi } from '../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/reverse',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.cancel'] },
}

type ReverseResult = {
  transactionId: string
  status: string
  wmsRestored: number
  cashReversalMovementId: string | null
  replayed: boolean
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posReverseSchema, ReverseResult>(req, {
    schema: posReverseSchema,
    commandId: 'soanas_pos.transactions.reverse',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({
      id: result?.transactionId ?? null,
      status: result?.status ?? null,
      wmsRestored: result?.wmsRestored ?? 0,
      cashReversalMovementId: result?.cashReversalMovementId ?? null,
      replayed: result?.replayed ?? false,
    }),
    status: 200,
    failure: { key: 'soanas_pos.errors.reverse_failed', fallback: 'Failed to reverse the POS sale' },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Reverse a completed POS sale',
  description:
    'Compensating saga: restores WMS stock, reverses cash sale movement, marks REVERSED. Never deletes history. Requires managerial approval unless a distinct manager executes the reverse.',
  requestSchema: posReverseSchema.omit({
    tenantId: true,
    organizationId: true,
    operatorUserId: true,
    transactionId: true,
  }),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    status: z.string().nullable(),
    wmsRestored: z.number(),
    cashReversalMovementId: z.string().uuid().nullable(),
    replayed: z.boolean(),
  }),
  status: 200,
})
