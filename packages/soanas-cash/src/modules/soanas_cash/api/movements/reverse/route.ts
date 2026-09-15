import { z } from 'zod'
import { cashMovementReverseSchema } from '../../../data/validators'
import { handleCashCommandRoute, withServerScope } from '../../utils'
import { buildCashCommandOpenApi } from '../../openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['soanas_cash.movements.reverse'] },
}

export async function POST(req: Request) {
  return handleCashCommandRoute<
    typeof cashMovementReverseSchema,
    { movementId: string; reversalMovementId: string }
  >(req, {
    schema: cashMovementReverseSchema,
    commandId: 'soanas_cash.movements.reverse',
    buildInput: (body, scope) => withServerScope(body, scope),
    buildResponse: (result) => ({
      id: result?.reversalMovementId ?? null,
      reversedMovementId: result?.movementId ?? null,
    }),
    status: 201,
    failure: { key: 'soanas_cash.errors.reverse_failed', fallback: 'Failed to reverse cash movement' },
  })
}

export const openApi = buildCashCommandOpenApi({
  summary: 'Reverse a cash movement with a compensating entry',
  description: 'Appends a reversal movement and flags the original as reversed. Nothing is deleted.',
  requestSchema: cashMovementReverseSchema,
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    reversedMovementId: z.string().uuid().nullable(),
  }),
})
