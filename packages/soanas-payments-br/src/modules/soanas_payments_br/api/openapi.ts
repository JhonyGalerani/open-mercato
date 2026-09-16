import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { z } from 'zod'

export const defaultOkResponseSchema = z.object({ ok: z.literal(true) })

export function buildPixCommandOpenApi(args: {
  summary: string
  description?: string
  requestSchema: z.ZodTypeAny
  responseSchema: z.ZodTypeAny
  status?: number
  method?: 'GET' | 'POST'
}): OpenApiRouteDoc {
  const method = args.method ?? 'POST'
  return {
    tag: 'Soanas Payments BR',
    summary: args.summary,
    description: args.description,
    methods: {
      [method]: {
        summary: args.summary,
        description: args.description,
        ...(method === 'POST' ? { requestBody: { schema: args.requestSchema } } : {}),
        responses: [{ status: args.status ?? 200, schema: args.responseSchema }],
      },
    },
  }
}
