import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { parseBooleanToken } from '@open-mercato/shared/lib/boolean'
import { CashDrawer } from '../../data/entities'
import { cashDrawerCreateSchema, cashDrawerUpdateSchema } from '../../data/validators'
import { buildCashCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const ENTITY_TYPE = 'soanas_cash:cash_drawer'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['soanas_cash.drawers.view'] },
  POST: { requireAuth: true, requireFeatures: ['soanas_cash.drawers.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['soanas_cash.drawers.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['soanas_cash.drawers.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(25),
    search: z.string().optional(),
    ids: z.string().optional(),
    registerId: z.string().uuid().optional(),
    isActive: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: CashDrawer,
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
      'register_id',
      'code',
      'name',
      'is_active',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      code: 'code',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    transformItem: (item: Record<string, unknown>) => {
      if (!item) return item
      return {
        id: item.id,
        organizationId: item.organization_id,
        tenantId: item.tenant_id,
        registerId: item.register_id,
        code: item.code,
        name: item.name,
        isActive: item.is_active,
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
      if (typeof query.registerId === 'string' && query.registerId.length > 0) {
        filters.register_id = { $eq: query.registerId }
      }
      const isActive = parseBooleanToken(query.isActive)
      if (isActive !== null) filters.is_active = { $eq: isActive }
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
      commandId: 'soanas_cash.drawers.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(cashDrawerCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.drawerId ?? null }),
      status: 201,
    },
    update: {
      commandId: 'soanas_cash.drawers.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(cashDrawerUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'soanas_cash.drawers.delete',
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
  registerId: z.string().uuid().nullable().optional(),
  code: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  isActive: z.boolean().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
})

export const openApi = buildCashCrudOpenApi({
  resourceName: 'CashDrawer',
  pluralName: 'Cash drawers',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(listItemSchema),
  create: {
    schema: cashDrawerCreateSchema,
    description: 'Creates a physical drawer attached to a cash register.',
  },
  update: {
    schema: cashDrawerUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a cash drawer by id.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a cash drawer by id.',
  },
})
