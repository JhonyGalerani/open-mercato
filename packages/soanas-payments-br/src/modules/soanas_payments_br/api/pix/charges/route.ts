import { z } from 'zod'
import { pixCreateSchema } from '../../../data/validators'
import { buildPixCommandOpenApi } from '../../openapi'
import { handlePixCommandRoute, withServerScope } from '../../utils'

export const metadata = {
  path: '/soanas_payments_br/pix/charges',
  POST: { requireAuth: true, requireFeatures: ['soanas_payments_br.pix.create'] },
}

type CreateResult = { chargeId: string; txid: string }

export async function POST(req: Request) {
  return handlePixCommandRoute<typeof pixCreateSchema, CreateResult>(req, {
    schema: pixCreateSchema,
    commandId: 'soanas_payments_br.pix.create',
    buildInput: (body, scope) => withServerScope(body, scope),
    buildResponse: (result) => ({ id: result?.chargeId ?? null, txid: result?.txid ?? null }),
    status: 201,
    failure: { key: 'soanas_payments_br.errors.create_failed', fallback: 'Failed to create the Pix charge' },
  })
}

export const openApi = buildPixCommandOpenApi({
  summary: 'Create a Pix charge',
  description: 'Opens a Pix charge through the configured PixProvider (mock by default) and persists it.',
  requestSchema: pixCreateSchema.omit({ tenantId: true, organizationId: true }),
  responseSchema: z.object({ id: z.string().uuid().nullable(), txid: z.string().nullable() }),
  status: 201,
})
