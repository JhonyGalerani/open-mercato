import { z } from 'zod'
import { cashSupplyCreateSchema } from '../../data/validators'
import { handleCashCommandRoute, withServerScope } from '../utils'
import { buildCashCommandOpenApi } from '../openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['soanas_cash.supplies.create'] },
}

export async function POST(req: Request) {
  return handleCashCommandRoute<
    typeof cashSupplyCreateSchema,
    { movementId: string; approvalId: string | null }
  >(req, {
    schema: cashSupplyCreateSchema,
    commandId: 'soanas_cash.supplies.create',
    buildInput: (body, scope) => withServerScope(body, scope),
    buildResponse: (result) => ({
      id: result?.movementId ?? null,
      approvalId: result?.approvalId ?? null,
    }),
    status: 201,
    failure: { key: 'soanas_cash.errors.supply_failed', fallback: 'Failed to create cash supply' },
  })
}

export const openApi = buildCashCommandOpenApi({
  summary: 'Create cash supply (suprimento)',
  requestSchema: cashSupplyCreateSchema,
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    approvalId: z.string().uuid().nullable(),
  }),
})
