import { z } from 'zod'
import { cashWithdrawalCreateSchema } from '../../data/validators'
import { handleCashCommandRoute, withServerScope } from '../utils'
import { buildCashCommandOpenApi } from '../openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['soanas_cash.withdrawals.create'] },
}

export async function POST(req: Request) {
  return handleCashCommandRoute<
    typeof cashWithdrawalCreateSchema,
    { movementId: string; approvalId: string | null }
  >(req, {
    schema: cashWithdrawalCreateSchema,
    commandId: 'soanas_cash.withdrawals.create',
    // The approval threshold lives on the register; anything the client sends about
    // limits is dropped by the schema (REV-001).
    buildInput: (body, scope) => withServerScope(body, scope),
    buildResponse: (result) => ({
      id: result?.movementId ?? null,
      approvalId: result?.approvalId ?? null,
    }),
    status: 201,
    failure: { key: 'soanas_cash.errors.withdrawal_failed', fallback: 'Failed to create withdrawal' },
  })
}

export const openApi = buildCashCommandOpenApi({
  summary: 'Create cash withdrawal (sangria)',
  description:
    'Registers a withdrawal. The approval threshold is read from the register, never from the request body.',
  requestSchema: cashWithdrawalCreateSchema,
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    approvalId: z.string().uuid().nullable(),
  }),
})
