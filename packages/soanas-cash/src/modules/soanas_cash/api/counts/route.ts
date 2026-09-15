import { z } from 'zod'
import { cashCountCreateSchema } from '../../data/validators'
import { handleCashCommandRoute, withServerScope } from '../utils'
import { buildCashCommandOpenApi } from '../openapi'
import type { CashCountCreateResult } from '../../commands/counts'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['soanas_cash.counts.create'] },
}

export async function POST(req: Request) {
  return handleCashCommandRoute<typeof cashCountCreateSchema, CashCountCreateResult>(req, {
    schema: cashCountCreateSchema,
    commandId: 'soanas_cash.counts.create',
    buildInput: (body, scope) => withServerScope(body, scope),
    buildResponse: (result) => result ?? null,
    status: 201,
    failure: { key: 'soanas_cash.errors.count_failed', fallback: 'Failed to record cash count' },
  })
}

export const openApi = buildCashCommandOpenApi({
  summary: 'Record an opening, spot or closing cash count',
  requestSchema: cashCountCreateSchema,
  responseSchema: z.object({
    countId: z.string().uuid(),
    sessionId: z.string().uuid(),
    totalCountedCents: z.string(),
    blind: z.boolean(),
    expectedCashCents: z.string().optional(),
    discrepancyCents: z.string().optional(),
  }),
})
