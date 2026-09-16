import { z } from 'zod'
import { posRecoverSchema } from '../../../../data/validators'
import type { CompletePosSaleResult } from '../../../../commands/complete'
import { buildPosCommandOpenApi } from '../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/recover',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.complete'] },
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posRecoverSchema, CompletePosSaleResult>(req, {
    schema: posRecoverSchema,
    commandId: 'soanas_pos.transactions.recover',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({
      id: result?.transactionId ?? null,
      status: result?.status ?? null,
      salesOrderId: result?.salesOrderId ?? null,
      cashMovementId: result?.cashMovementId ?? null,
      wmsMovementIds: result?.wmsMovementIds ?? [],
      receipt: result?.receipt ?? null,
      replayed: result?.replayed ?? false,
    }),
    status: 200,
    failure: { key: 'soanas_pos.errors.recover_failed', fallback: 'Failed to recover the POS sale' },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Resume a POS sale stuck mid-completion',
  description: 'Replays only the saga steps the recovery checkpoint reports as pending.',
  requestSchema: z.object({}),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    status: z.string().nullable(),
    salesOrderId: z.string().uuid().nullable(),
    replayed: z.boolean(),
  }),
  status: 200,
})
