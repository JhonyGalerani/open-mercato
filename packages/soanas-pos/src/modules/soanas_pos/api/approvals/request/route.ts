import { z } from 'zod'
import { posApprovalRequestSchema } from '../../../data/validators'
import { buildPosCommandOpenApi } from '../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../utils'

export const metadata = {
  path: '/soanas_pos/approvals/request',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
}

type RequestResult = { approvalRequestId: string; status: string; expiresAt: string | null }

export async function POST(req: Request) {
  return handlePosCommandRoute<typeof posApprovalRequestSchema, RequestResult>(req, {
    schema: posApprovalRequestSchema,
    commandId: 'soanas_pos.approvals.request',
    buildInput: (body, scope) => withServerScope(body, scope),
    buildResponse: (result) => ({
      id: result?.approvalRequestId ?? null,
      status: result?.status ?? null,
      expiresAt: result?.expiresAt ?? null,
    }),
    status: 201,
    failure: { key: 'soanas_pos.errors.approval_request_failed', fallback: 'Failed to request POS approval' },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Request a POS managerial approval',
  description:
    'Creates a pending approval. Requester is always the authenticated user. Approver UUID must never be supplied by the client.',
  requestSchema: z.object({
    kind: z.enum(['discount', 'cancel', 'stock_override', 'price_override', 'withdrawal']),
    transactionId: z.string().uuid().optional(),
    terminalId: z.string().uuid().optional(),
    lineId: z.string().uuid().optional(),
    reason: z.string(),
    payload: z.record(z.string(), z.unknown()).optional(),
    before: z.record(z.string(), z.unknown()).optional(),
    after: z.record(z.string(), z.unknown()).optional(),
    expiresAt: z.string().datetime().optional(),
    idempotencyKey: z.string().optional(),
  }),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    status: z.string().nullable(),
    expiresAt: z.string().nullable(),
  }),
  status: 201,
})
