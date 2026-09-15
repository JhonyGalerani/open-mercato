import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { parseBooleanToken } from '@open-mercato/shared/lib/boolean'
import { FiscalEstablishment } from '../../data/entities'
import { fiscalEstablishmentCreateSchema, fiscalEstablishmentUpdateSchema } from '../../data/validators'
import {
  buildEstablishmentsCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'

const ENTITY_TYPE = 'soanas_establishments:fiscal_establishment'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['soanas_establishments.establishments.view'] },
  POST: { requireAuth: true, requireFeatures: ['soanas_establishments.establishments.create'] },
  PUT: { requireAuth: true, requireFeatures: ['soanas_establishments.establishments.edit'] },
  DELETE: { requireAuth: true, requireFeatures: ['soanas_establishments.establishments.delete'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(25),
    search: z.string().optional(),
    ids: z.string().optional(),
    isActive: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: FiscalEstablishment,
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
      'legal_name',
      'trade_name',
      'cnpj',
      'state_registration',
      'municipal_registration',
      'primary_cnae',
      'crt',
      'uf',
      'ibge_city_code',
      'fiscal_environment',
      'timezone',
      'currency_code',
      'is_active',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      legalName: 'legal_name',
      cnpj: 'cnpj',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    transformItem: (item: Record<string, unknown>) => {
      if (!item) return item
      return {
        id: item.id,
        organizationId: item.organization_id,
        tenantId: item.tenant_id,
        legalName: item.legal_name,
        tradeName: item.trade_name,
        cnpj: item.cnpj,
        stateRegistration: item.state_registration,
        municipalRegistration: item.municipal_registration,
        primaryCnae: item.primary_cnae,
        crt: item.crt,
        uf: item.uf,
        ibgeCityCode: item.ibge_city_code,
        fiscalEnvironment: item.fiscal_environment,
        timezone: item.timezone,
        currencyCode: item.currency_code,
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
      const isActive = parseBooleanToken(query.isActive)
      if (isActive !== null) filters.is_active = { $eq: isActive }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [
          { legal_name: { $ilike: like } },
          { trade_name: { $ilike: like } },
          { cnpj: { $ilike: like } },
        ]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'soanas_establishments.establishments.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(fiscalEstablishmentCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.establishmentId ?? null }),
      status: 201,
    },
    update: {
      commandId: 'soanas_establishments.establishments.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(fiscalEstablishmentUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'soanas_establishments.establishments.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        return { id: resolveCrudRecordId(parsed, ctx, translate) }
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
  legalName: z.string().nullable().optional(),
  tradeName: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
})

export const openApi = buildEstablishmentsCrudOpenApi({
  resourceName: 'FiscalEstablishment',
  pluralName: 'Fiscal establishments',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(listItemSchema),
  create: {
    schema: fiscalEstablishmentCreateSchema,
    description: 'Creates a Brazilian fiscal establishment for an organization.',
  },
  update: {
    schema: fiscalEstablishmentUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a fiscal establishment by id.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a fiscal establishment by id.',
  },
})
