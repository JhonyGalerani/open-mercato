import { createCrudOpenApiFactory } from '@open-mercato/shared/lib/openapi/crud'
import { z } from 'zod'

export const buildEstablishmentsCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'Soanas Establishments',
})

export const defaultOkResponseSchema = z.object({ ok: z.literal(true) })

export function createPagedListResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  })
}
