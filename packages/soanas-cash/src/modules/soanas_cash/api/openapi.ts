import { createCrudOpenApiFactory } from '@open-mercato/shared/lib/openapi/crud'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { z } from 'zod'

export const buildCashCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'Soanas Cash',
})

export const defaultOkResponseSchema = z.object({ ok: z.literal(true) })

export function buildCashCommandOpenApi(args: {
  summary: string
  description?: string
  requestSchema: z.ZodTypeAny
  responseSchema: z.ZodTypeAny
  status?: number
}): OpenApiRouteDoc {
  return {
    tag: 'Soanas Cash',
    summary: args.summary,
    description: args.description,
    methods: {
      POST: {
        summary: args.summary,
        description: args.description,
        requestBody: { schema: args.requestSchema },
        responses: [{ status: args.status ?? 201, schema: args.responseSchema }],
      },
    },
  }
}

export function createPagedListResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  })
}
