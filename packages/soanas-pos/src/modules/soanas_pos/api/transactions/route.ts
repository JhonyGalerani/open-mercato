import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { PosTransaction } from '../../data/entities'
import { posTransactionCreateSchema, posTransactionListSchema } from '../../data/validators'
import { buildPosCommandOpenApi, createPagedListResponseSchema } from '../openapi'
import { handlePosCommandRoute, posScopeErrorResponse, resolvePosRequestScope, withServerScope } from '../utils'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.view'] },
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.sell'] },
}

const listItemSchema = z.object({
  id: z.string().uuid(),
  terminalId: z.string().uuid(),
  cashSessionId: z.string().uuid().nullable(),
  status: z.string(),
  currencyCode: z.string(),
  grandTotalCents: z.string(),
  amountPaidCents: z.string(),
  changeAmountCents: z.string(),
  salesOrderId: z.string().uuid().nullable(),
  customerId: z.string().uuid().nullable(),
  operatorUserId: z.string().uuid(),
  correlationId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
})

export async function GET(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    const scope = await resolvePosRequestScope(req)
    const url = new URL(req.url)
    const query = posTransactionListSchema.parse(Object.fromEntries(url.searchParams.entries()))
    const em = (scope.container.resolve('em') as EntityManager).fork()

    const where: Record<string, unknown> = {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    }
    if (query.terminalId) where.terminalId = query.terminalId
    if (query.status) {
      const statuses = query.status
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
      if (statuses.length) where.status = { $in: statuses }
    }
    if (query.search) {
      const like = `%${escapeLikePattern(query.search)}%`
      where.correlationId = { $ilike: like }
    }

    const [items, total] = await em.findAndCount(PosTransaction, where, {
      orderBy: { createdAt: 'desc' },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })

    return NextResponse.json({
      items: items.map((transaction) => ({
        id: transaction.id,
        terminalId: transaction.terminalId,
        cashSessionId: transaction.cashSessionId ?? null,
        status: transaction.status,
        currencyCode: transaction.currencyCode,
        grandTotalCents: transaction.grandTotalCents,
        amountPaidCents: transaction.amountPaidCents,
        changeAmountCents: transaction.changeAmountCents,
        salesOrderId: transaction.salesOrderId ?? null,
        customerId: transaction.customerId ?? null,
        operatorUserId: transaction.operatorUserId,
        correlationId: transaction.correlationId,
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString(),
        completedAt: transaction.completedAt ? transaction.completedAt.toISOString() : null,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    })
  } catch (err) {
    const scopeResponse = posScopeErrorResponse(err)
    if (scopeResponse) return scopeResponse
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: translate('soanas_pos.errors.invalid_payload', 'Invalid payload'), details: err.flatten() },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: translate('soanas_pos.errors.list_failed', 'Failed to load POS transactions') },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  return handlePosCommandRoute<typeof posTransactionCreateSchema, { transactionId: string }>(req, {
    schema: posTransactionCreateSchema,
    commandId: 'soanas_pos.transactions.create',
    buildInput: (body, scope) => withServerScope(body, scope),
    buildResponse: (result) => ({ id: result?.transactionId ?? null }),
    status: 201,
    failure: { key: 'soanas_pos.errors.create_failed', fallback: 'Failed to open POS transaction' },
  })
}

export const openApi = {
  tag: 'Soanas POS',
  summary: 'POS transactions',
  methods: {
    GET: {
      summary: 'List POS transactions',
      description: 'Sales history for the selected organization.',
      query: posTransactionListSchema,
      responses: [{ status: 200, schema: createPagedListResponseSchema(listItemSchema) }],
    },
    POST: buildPosCommandOpenApi({
      summary: 'Open a POS transaction',
      requestSchema: posTransactionCreateSchema,
      responseSchema: z.object({ id: z.string().uuid().nullable() }),
    }).methods.POST,
  },
}
