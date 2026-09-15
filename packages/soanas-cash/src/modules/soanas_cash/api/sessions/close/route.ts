import { z } from 'zod'
import { cashSessionCloseSchema } from '../../../data/validators'
import { handleCashCommandRoute, withServerScope } from '../../utils'
import { buildCashCommandOpenApi } from '../../openapi'
import type { CashSessionCloseResult } from '../../../commands/sessions'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['soanas_cash.sessions.close'] },
}

export async function POST(req: Request) {
  return handleCashCommandRoute<typeof cashSessionCloseSchema, CashSessionCloseResult>(req, {
    schema: cashSessionCloseSchema,
    commandId: 'soanas_cash.sessions.close',
    buildInput: (body, scope) => withServerScope(body, scope),
    // `expectedCashCents` / `discrepancyCents` are omitted by the command while the
    // register runs blind closing and the caller is not an approval manager.
    buildResponse: (result) => result ?? null,
    status: 201,
    failure: { key: 'soanas_cash.errors.close_failed', fallback: 'Failed to close cash session' },
  })
}

export const openApi = buildCashCommandOpenApi({
  summary: 'Close cash session with count and reconciliation',
  description:
    'Persists a closing count, reconciles it against the ledger and raises an approval when the discrepancy exceeds the register tolerance.',
  requestSchema: cashSessionCloseSchema,
  responseSchema: z.object({
    sessionId: z.string().uuid(),
    countId: z.string().uuid(),
    reconciliationId: z.string().uuid(),
    reconciliationStatus: z.string(),
    countedCashCents: z.string(),
    toleranceCents: z.string(),
    blind: z.boolean(),
    approvalId: z.string().uuid().nullable(),
    expectedCashCents: z.string().optional(),
    discrepancyCents: z.string().optional(),
  }),
})
