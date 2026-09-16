import { z } from 'zod'

const centsSchema = z
  .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
  .transform((value) => String(value))

const optionalCentsSchema = z
  .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
  .transform((value) => String(value))
  .optional()

const idempotencyKeySchema = z.string().trim().min(8).max(128).nullish()

const scopeShape = {
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
}

export const pixChargeStatusSchema = z.enum([
  'CREATED',
  'WAITING',
  'PAID',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'UNKNOWN',
])

export const pixCreateSchema = z.object({
  ...scopeShape,
  terminalId: z.string().uuid().nullish(),
  posTransactionId: z.string().uuid().nullish(),
  salesOrderId: z.string().uuid().nullish(),
  amountCents: centsSchema,
  description: z.string().trim().max(255).nullish(),
  payerDocument: z.string().trim().max(32).nullish(),
  payerName: z.string().trim().max(255).nullish(),
  expiresInSeconds: z.number().int().positive().max(86400).optional(),
  idempotencyKey: idempotencyKeySchema,
})
export type PixCreateInput = z.infer<typeof pixCreateSchema>

export const pixGetSchema = z.object({
  ...scopeShape,
  txid: z.string().trim().min(1),
})
export type PixGetInput = z.infer<typeof pixGetSchema>

export const pixCancelSchema = z.object({
  ...scopeShape,
  txid: z.string().trim().min(1),
  reason: z.string().trim().max(255).nullish(),
})
export type PixCancelInput = z.infer<typeof pixCancelSchema>

export const pixRefundSchema = z.object({
  ...scopeShape,
  txid: z.string().trim().min(1),
  amountCents: optionalCentsSchema,
  reason: z.string().trim().max(255).nullish(),
})
export type PixRefundInput = z.infer<typeof pixRefundSchema>

export const pixWebhookPayloadSchema = z.object({
  txid: z.string().trim().min(1),
  status: pixChargeStatusSchema,
  e2eId: z.string().trim().nullish(),
})

export const pixApplyWebhookSchema = z.object({
  tenantId: z.string().uuid(),
  payload: pixWebhookPayloadSchema,
})
export type PixApplyWebhookInput = z.infer<typeof pixApplyWebhookSchema>
