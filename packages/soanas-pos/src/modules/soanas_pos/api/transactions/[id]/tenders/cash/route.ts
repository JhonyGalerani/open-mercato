import { z } from 'zod'
import { posCashTenderSchema } from '../../../../../data/validators'
import { buildPosCommandOpenApi } from '../../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/tenders/cash',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
}

type CashTenderResult = {
  tenderId: string
  amountAppliedCents: string
  changeAmountCents: string
  remainingDueCents: string
  status: string
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posCashTenderSchema, CashTenderResult>(req, {
    schema: posCashTenderSchema,
    commandId: 'soanas_pos.transactions.add_tender_cash',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({
      id: result?.tenderId ?? null,
      amountAppliedCents: result?.amountAppliedCents ?? '0',
      changeAmountCents: result?.changeAmountCents ?? '0',
      remainingDueCents: result?.remainingDueCents ?? '0',
      status: result?.status ?? null,
    }),
    status: 201,
    failure: { key: 'soanas_pos.errors.tender_failed', fallback: 'Failed to register the cash tender' },
  })
}

export const openApi = buildPosCommandOpenApi({
  summary: 'Register a cash tender',
  description: 'Applies min(remaining due, received) and returns the change to hand back.',
  requestSchema: posCashTenderSchema.omit({
    tenantId: true,
    organizationId: true,
    operatorUserId: true,
    transactionId: true,
  }),
  responseSchema: z.object({
    id: z.string().uuid().nullable(),
    amountAppliedCents: z.string(),
    changeAmountCents: z.string(),
    remainingDueCents: z.string(),
    status: z.string().nullable(),
  }),
})
