import { z } from 'zod'
import { posCompleteSchema } from '../../../../data/validators'
import type { CompletePosSaleResult } from '../../../../commands/complete'
import { buildPosCommandOpenApi } from '../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/complete',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.complete'] },
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posCompleteSchema, CompletePosSaleResult>(req, {
    schema: posCompleteSchema,
    commandId: 'soanas_pos.transactions.complete',
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
    failure: { key: 'soanas_pos.errors.complete_failed', fallback: 'Failed to complete the POS sale' },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Complete a POS sale',
  description:
    'Runs the idempotent completion saga: SalesOrder + payment, WMS deduction, cash movement, receipt (ADR-007).',
  requestSchema: z.object({}),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    status: z.string().nullable(),
    salesOrderId: z.string().uuid().nullable(),
    cashMovementId: z.string().uuid().nullable(),
    wmsMovementIds: z.array(z.string().uuid()),
    replayed: z.boolean(),
  }),
  status: 200,
})
