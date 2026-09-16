import { z } from 'zod'
import { cashSessionOpenSchema } from '../../../data/validators'
import { handleCashCommandRoute, withServerScope } from '../../utils'
import { buildCashCommandOpenApi } from '../../openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['soanas_cash.sessions.open'] },
}

export async function POST(req: Request) {
  return handleCashCommandRoute<typeof cashSessionOpenSchema, { sessionId: string; alreadyOpen: boolean }>(req, {
    schema: cashSessionOpenSchema,
    commandId: 'soanas_cash.sessions.open',
    buildInput: (body, scope) => withServerScope(body, scope),
    buildResponse: (result) => ({ id: result?.sessionId ?? null, alreadyOpen: result?.alreadyOpen ?? false }),
    status: 201,
    failure: { key: 'soanas_cash.errors.open_failed', fallback: 'Failed to open cash session' },
  })
}

export const openApi = buildCashCommandOpenApi({
  summary: 'Open cash session',
  description: 'Opens a session for a register. Tenant, organization and operator come from the session.',
  requestSchema: cashSessionOpenSchema,
  responseSchema: z.object({ id: z.string().uuid().nullable(), alreadyOpen: z.boolean() }),
})
