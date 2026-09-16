import { z } from 'zod'
import { posApprovalDecideSchema } from '../../../data/validators'
import { buildPosCommandOpenApi } from '../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../utils'

export const metadata = {
  path: '/soanas_pos/approvals/decide',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.view'] },
}

type DecideResult = { approvalRequestId: string; status: string; approverUserId: string }

export async function POST(req: Request) {
  return handlePosCommandRoute<typeof posApprovalDecideSchema, DecideResult>(req, {
    schema: posApprovalDecideSchema,
    commandId: 'soanas_pos.approvals.decide',
    buildInput: (body, scope) => withServerScope(body, scope),
    buildResponse: (result) => ({
      id: result?.approvalRequestId ?? null,
      status: result?.status ?? null,
      approverUserId: result?.approverUserId ?? null,
    }),
    status: 200,
    failure: { key: 'soanas_pos.errors.approval_decide_failed', fallback: 'Failed to decide POS approval' },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Decide a POS managerial approval',
  description:
    'Approver identity is taken from the authenticated session. Self-approval is rejected (dual custody).',
  requestSchema: z.object({
    approvalRequestId: z.string().uuid(),
    decision: z.enum(['approved', 'rejected']),
    decisionReason: z.string().optional(),
  }),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    status: z.string().nullable(),
    approverUserId: z.string().uuid().nullable(),
  }),
  status: 200,
})
