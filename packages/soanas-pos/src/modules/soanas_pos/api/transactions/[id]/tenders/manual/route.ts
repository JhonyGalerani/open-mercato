import { z } from 'zod'
import { posManualTenderSchema } from '../../../../../data/validators'
import { buildPosCommandOpenApi } from '../../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/tenders/manual',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
}

type ManualTenderResult = {
  tenderId: string
  type: string
  amountAppliedCents: string
  changeAmountCents: string
  remainingDueCents: string
  status: string
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posManualTenderSchema, ManualTenderResult>(req, {
    schema: posManualTenderSchema,
    commandId: 'soanas_pos.transactions.add_tender_manual',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({
      id: result?.tenderId ?? null,
      type: result?.type ?? null,
      amountAppliedCents: result?.amountAppliedCents ?? '0',
      changeAmountCents: '0',
      remainingDueCents: result?.remainingDueCents ?? '0',
      status: result?.status ?? null,
    }),
    status: 201,
    failure: {
      key: 'soanas_pos.errors.manual_tender_failed',
      fallback: 'Failed to register the manual tender',
    },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Register a manual tender (Pix/card/voucher on external terminal)',
  description:
    'Operator confirms payment on a separate maquininha, then records the tender here. Non-cash methods never generate change.',
  requestSchema: posManualTenderSchema.omit({
    tenantId: true,
    organizationId: true,
    operatorUserId: true,
    transactionId: true,
  }),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    type: z.string().nullable(),
    amountAppliedCents: z.string(),
    changeAmountCents: z.string(),
    remainingDueCents: z.string(),
    status: z.string().nullable(),
  }),
})
