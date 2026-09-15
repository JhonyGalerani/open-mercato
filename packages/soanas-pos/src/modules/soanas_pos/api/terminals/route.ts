import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { PosTerminal } from '../../data/entities'
import { posTerminalCreateSchema, posTerminalUpdateSchema } from '../../data/validators'
import { buildPosCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const ENTITY_TYPE = 'soanas_pos:pos_terminal'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['soanas_pos.terminals.view'] },
  POST: { requireAuth: true, requireFeatures: ['soanas_pos.terminals.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['soanas_pos.terminals.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['soanas_pos.terminals.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(25),
    search: z.string().optional(),
    ids: z.string().optional(),
    status: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: PosTerminal,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: ENTITY_TYPE },
  list: {
    schema: listSchema,
    entityId: ENTITY_TYPE,
    fields: [
      'id',
      'organization_id',
      'tenant_id',
      'establishment_id',
      'code',
      'name',
      'warehouse_id',
      'sales_channel_id',
      'price_kind_id',
      'cash_register_id',
      'device_id',
      'stock_policy',
      'status',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      code: 'code',
      name: 'name',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    transformItem: (item: Record<string, unknown>) => {
      if (!item) return item
      return {
        id: item.id,
        organizationId: item.organization_id,
        tenantId: item.tenant_id,
        establishmentId: item.establishment_id,
        code: item.code,
        name: item.name,
        warehouseId: item.warehouse_id,
        salesChannelId: item.sales_channel_id,
        priceKindId: item.price_kind_id,
        cashRegisterId: item.cash_register_id,
        deviceId: item.device_id,
        stockPolicy: item.stock_policy,
        status: item.status,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        filters.id = {
          $in: query.ids
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
        }
      }
      if (typeof query.status === 'string' && query.status.trim().length > 0) {
        filters.status = { $eq: query.status.trim() }
      }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [{ code: { $ilike: like } }, { name: { $ilike: like } }]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'soanas_pos.terminals.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(posTerminalCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.terminalId ?? null }),
      status: 201,
    },
    update: {
      commandId: 'soanas_pos.terminals.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(posTerminalUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'soanas_pos.terminals.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        return {
          id: resolveCrudRecordId(parsed, ctx, translate),
          tenantId: ctx.auth?.tenantId,
          organizationId: ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? undefined,
        }
      },
      response: () => ({ ok: true }),
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const listItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  organizationId: z.string().uuid().nullable().optional(),
  tenantId: z.string().uuid().nullable().optional(),
  code: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  salesChannelId: z.string().uuid().nullable().optional(),
  cashRegisterId: z.string().uuid().nullable().optional(),
  stockPolicy: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
})

export const openApi = buildPosCrudOpenApi({
  resourceName: 'PosTerminal',
  pluralName: 'POS terminals',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(listItemSchema),
  create: {
    schema: posTerminalCreateSchema,
    description: 'Creates a POS terminal bound to a warehouse, sales channel and cash register.',
  },
  update: {
    schema: posTerminalUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a POS terminal by id.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a POS terminal by id.',
  },
})
