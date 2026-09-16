import { z } from 'zod'
import { posHoldSchema } from '../../../../data/validators'
import { buildPosCommandOpenApi } from '../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/hold',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
}

type HoldResult = {
  transactionId: string
  status: string
  holdName: string | null
  heldAt: string | null
  expiresAt: string | null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posHoldSchema, HoldResult>(req, {
    schema: posHoldSchema,
    commandId: 'soanas_pos.transactions.hold',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({
      id: result?.transactionId ?? null,
      status: result?.status ?? null,
      holdName: result?.holdName ?? null,
      heldAt: result?.heldAt ?? null,
      expiresAt: result?.expiresAt ?? null,
    }),
    status: 200,
    failure: { key: 'soanas_pos.errors.hold_failed', fallback: 'Failed to suspend the POS transaction' },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Suspend a POS draft sale',
  description: 'Moves DRAFT -> HELD with optional name and expiry. Lines and price snapshots are preserved.',
  requestSchema: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    expiresAt: z.string().datetime().optional(),
  }),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    status: z.string().nullable(),
    holdName: z.string().nullable(),
    heldAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
  }),
  status: 200,
})
