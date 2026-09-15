import { z } from 'zod'

const centsSchema = z
  .union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
  .transform((value) => String(value))

const optionalCentsSchema = z
  .union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
  .transform((value) => String(value))
  .nullish()

/** Quantities are decimal strings, never cents and never floats in storage. */
export const quantitySchema = z
  .union([z.number().positive(), z.string().regex(/^\d+(\.\d{1,4})?$/)])
  .transform((value) => String(value))
  .refine((value) => Number(value) > 0, { message: 'quantity must be > 0' })

const idempotencyKeySchema = z.string().trim().min(8).max(128)

const scopeShape = {
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
}

export const stockPolicySchema = z.enum(['BLOCK', 'WARN', 'ALLOW'])
export const terminalStatusSchema = z.enum(['active', 'inactive'])
export const tenderTypeSchema = z.enum([
  'CASH',
  'PIX',
  'CARD_DEBIT',
  'CARD_CREDIT',
  'VOUCHER',
  'STORE_CREDIT',
  'OTHER',
])

// ---------------------------------------------------------------------------
// Terminals
// ---------------------------------------------------------------------------

export const posTerminalCreateSchema = z.object({
  ...scopeShape,
  establishmentId: z.string().uuid().nullish(),
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(255),
  warehouseId: z.string().uuid().nullish(),
  salesChannelId: z.string().uuid().nullish(),
  priceKindId: z.string().uuid().nullish(),
  cashRegisterId: z.string().uuid().nullish(),
  deviceId: z.string().uuid().nullish(),
  stockPolicy: stockPolicySchema.default('BLOCK'),
  status: terminalStatusSchema.default('active'),
  clientVersion: z.string().trim().max(64).nullish(),
})

export const posTerminalUpdateSchema = z.object({
  id: z.string().uuid(),
  ...scopeShape,
  establishmentId: z.string().uuid().nullish(),
  code: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  warehouseId: z.string().uuid().nullish(),
  salesChannelId: z.string().uuid().nullish(),
  priceKindId: z.string().uuid().nullish(),
  cashRegisterId: z.string().uuid().nullish(),
  deviceId: z.string().uuid().nullish(),
  stockPolicy: stockPolicySchema.optional(),
  status: terminalStatusSchema.optional(),
  clientVersion: z.string().trim().max(64).nullish(),
})

export const posTerminalDeleteSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
})

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const posTransactionCreateSchema = z.object({
  ...scopeShape,
  terminalId: z.string().uuid(),
  cashSessionId: z.string().uuid().nullish(),
  operatorUserId: z.string().uuid(),
  customerId: z.string().uuid().nullish(),
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/)
    .default('BRL'),
  idempotencyKey: idempotencyKeySchema.nullish(),
})

export const posLineAddSchema = z.object({
  ...scopeShape,
  transactionId: z.string().uuid(),
  operatorUserId: z.string().uuid(),
  catalogProductId: z.string().uuid().nullish(),
  catalogVariantId: z.string().uuid().nullish(),
  sku: z.string().trim().min(1).max(191),
  nameSnapshot: z.string().trim().min(1).max(255),
  quantity: quantitySchema,
  unitPriceCents: centsSchema,
  originalUnitPriceCents: optionalCentsSchema,
  unit: z.string().trim().max(25).nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
})

export const posLineUpdateSchema = z.object({
  ...scopeShape,
  transactionId: z.string().uuid(),
  lineId: z.string().uuid(),
  operatorUserId: z.string().uuid(),
  quantity: quantitySchema.optional(),
  unitPriceCents: centsSchema.optional(),
})

export const posLineRemoveSchema = z.object({
  ...scopeShape,
  transactionId: z.string().uuid(),
  lineId: z.string().uuid(),
  operatorUserId: z.string().uuid(),
})

export const posSetCustomerSchema = z.object({
  ...scopeShape,
  transactionId: z.string().uuid(),
  operatorUserId: z.string().uuid(),
  customerId: z.string().uuid().nullish(),
})

export const posApplyDiscountSchema = z
  .object({
    ...scopeShape,
    transactionId: z.string().uuid(),
    operatorUserId: z.string().uuid(),
    scope: z.enum(['line', 'cart']),
    lineId: z.string().uuid().nullish(),
    amountCents: centsSchema,
    reason: z.string().trim().max(255).nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'line' && !value.lineId) {
      ctx.addIssue({ code: 'custom', path: ['lineId'], message: 'lineId is required for a line discount' })
    }
  })

export const posCheckoutSchema = z.object({
  ...scopeShape,
  transactionId: z.string().uuid(),
  operatorUserId: z.string().uuid(),
})

export const posCashTenderSchema = z.object({
  ...scopeShape,
  transactionId: z.string().uuid(),
  operatorUserId: z.string().uuid(),
  amountReceivedCents: centsSchema,
  idempotencyKey: idempotencyKeySchema,
})

export const posCompleteSchema = z.object({
  ...scopeShape,
  transactionId: z.string().uuid(),
  operatorUserId: z.string().uuid(),
})

export const posRecoverSchema = posCompleteSchema

export const posCancelSchema = z.object({
  ...scopeShape,
  transactionId: z.string().uuid(),
  operatorUserId: z.string().uuid(),
  reason: z.string().trim().max(255).nullish(),
})

export const posCatalogSearchSchema = z.object({
  search: z.string().trim().max(191).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export const posTransactionListSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(25),
    status: z.string().trim().optional(),
    terminalId: z.string().uuid().optional(),
    search: z.string().trim().optional(),
  })
  .passthrough()

export type PosTerminalCreateInput = z.infer<typeof posTerminalCreateSchema>
export type PosTerminalUpdateInput = z.infer<typeof posTerminalUpdateSchema>
export type PosTerminalDeleteInput = z.infer<typeof posTerminalDeleteSchema>
export type PosTransactionCreateInput = z.infer<typeof posTransactionCreateSchema>
export type PosLineAddInput = z.infer<typeof posLineAddSchema>
export type PosLineUpdateInput = z.infer<typeof posLineUpdateSchema>
export type PosLineRemoveInput = z.infer<typeof posLineRemoveSchema>
export type PosSetCustomerInput = z.infer<typeof posSetCustomerSchema>
export type PosApplyDiscountInput = z.infer<typeof posApplyDiscountSchema>
export type PosCheckoutInput = z.infer<typeof posCheckoutSchema>
export type PosCashTenderInput = z.infer<typeof posCashTenderSchema>
export type PosCompleteInput = z.infer<typeof posCompleteSchema>
export type PosCancelInput = z.infer<typeof posCancelSchema>
