import { z } from 'zod'
import { posCompleteSchema } from '../../../../../data/validators'
import { handlePosCommandRoute, withServerScope } from '../../../../utils'
import { buildPosCommandOpenApi } from '../../../../openapi'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/print/retry',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.complete'] },
}

type RetryPrintResult = { jobId: string; status: string }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posCompleteSchema, RetryPrintResult>(req, {
    schema: posCompleteSchema,
    commandId: 'soanas_pos.transactions.retry_print',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({
      jobId: result?.jobId ?? null,
      status: result?.status ?? null,
    }),
    failure: {
      key: 'soanas_pos.errors.print_retry_failed',
      fallback: 'Failed to retry the receipt print job',
    },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Retry a failed sale receipt print job',
  description:
    'Re-attempts printing for a COMPLETED sale without reopening the commercial transaction (ADR-011).',
  requestSchema: posCompleteSchema,
  responseSchema: z.object({
    jobId: z.string().uuid().nullable(),
    status: z.string().nullable(),
  }),
})
