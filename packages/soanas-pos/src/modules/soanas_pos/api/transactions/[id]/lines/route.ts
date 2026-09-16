import { z } from 'zod'
import { posLineAddSchema, posLineRemoveSchema, posLineUpdateSchema } from '../../../../data/validators'
import { buildPosCommandOpenApi } from '../../../openapi'
import { handlePosCommandRoute, withServerScope } from '../../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]/lines',
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
  PUT: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
  DELETE: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posLineAddSchema, { lineId: string; grandTotalCents: string }>(req, {
    schema: posLineAddSchema,
    commandId: 'soanas_pos.transactions.add_line',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({
      id: result?.lineId ?? null,
      grandTotalCents: result?.grandTotalCents ?? '0',
    }),
    status: 201,
    failure: { key: 'soanas_pos.errors.add_line_failed', fallback: 'Failed to add the POS line' },
  })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posLineUpdateSchema, { lineId: string; grandTotalCents: string }>(req, {
    schema: posLineUpdateSchema,
    commandId: 'soanas_pos.transactions.update_line',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({
      id: result?.lineId ?? null,
      grandTotalCents: result?.grandTotalCents ?? '0',
    }),
    status: 200,
    failure: { key: 'soanas_pos.errors.update_line_failed', fallback: 'Failed to update the POS line' },
  })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params
  return handlePosCommandRoute<typeof posLineRemoveSchema, { lineId: string; grandTotalCents: string }>(req, {
    schema: posLineRemoveSchema,
    commandId: 'soanas_pos.transactions.remove_line',
    buildInput: (body, scope) => withServerScope(body, scope, { transactionId: id }),
    buildResponse: (result) => ({
      id: result?.lineId ?? null,
      grandTotalCents: result?.grandTotalCents ?? '0',
    }),
    status: 200,
    failure: { key: 'soanas_pos.errors.remove_line_failed', fallback: 'Failed to remove the POS line' },
  })
}

const lineResponseSchema = z.object({ id: z.string().uuid().nullable(), grandTotalCents: z.string() })

export const openApi = {
  tag: 'Soanas POS',
  summary: 'POS transaction lines',
  pathParams: z.object({ id: z.string().uuid() }),
  methods: {
    POST: buildPosCommandOpenApi({
      summary: 'Add a line to a POS transaction',
      description: 'Totals are recalculated server-side and the terminal stock policy is enforced.',
      requestSchema: posLineAddSchema.omit({
        tenantId: true,
        organizationId: true,
        operatorUserId: true,
        transactionId: true,
      }),
      responseSchema: lineResponseSchema,
    }).methods.POST,
    PUT: {
      summary: 'Update the quantity or unit price of a POS line',
      requestBody: {
        schema: posLineUpdateSchema.omit({
          tenantId: true,
          organizationId: true,
          operatorUserId: true,
          transactionId: true,
        }),
      },
      responses: [{ status: 200, schema: lineResponseSchema }],
    },
    DELETE: {
      summary: 'Remove a POS line',
      requestBody: {
        schema: posLineRemoveSchema.omit({
          tenantId: true,
          organizationId: true,
          operatorUserId: true,
          transactionId: true,
        }),
      },
      responses: [{ status: 200, schema: lineResponseSchema }],
    },
  },
}
