import { z } from 'zod'
import { sumDenominationCents } from '../lib/ledger'

const moneyCentsSchema = z
  .union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
  .transform((value) => String(value))

const optionalMoneyCentsSchema = z
  .union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
  .transform((value) => String(value))
  .nullish()

export const denominationMapSchema = z
  .record(z.string(), z.number().int().nonnegative())
  .optional()
  .nullable()

const idempotencyKeySchema = z.string().trim().min(8).max(128)

const scopeShape = {
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
}

function refinePositiveAmount(amountCents: string, ctx: z.RefinementCtx, path = 'amountCents'): bigint {
  const amount = BigInt(amountCents)
  if (amount <= 0n) {
    ctx.addIssue({ code: 'custom', path: [path], message: 'amount must be > 0' })
  }
  return amount
}

function refineDenominations(
  denominations: Record<string, number> | null | undefined,
  amountCents: bigint,
  ctx: z.RefinementCtx,
  path = 'denominations',
): void {
  if (!denominations || Object.keys(denominations).length === 0) return
  const sum = sumDenominationCents(denominations)
  if (sum !== amountCents) {
    ctx.addIssue({
      code: 'custom',
      path: [path],
      message: 'denomination sum must equal the declared amount',
    })
  }
}

// ---------------------------------------------------------------------------
// Registers
// ---------------------------------------------------------------------------

export const cashRegisterCreateSchema = z
  .object({
    ...scopeShape,
    establishmentId: z.string().uuid().nullish(),
    code: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(255),
    terminalId: z.string().uuid().nullish(),
    drawerId: z.string().uuid().nullish(),
    warehouseId: z.string().uuid().nullish(),
    blindClosing: z.boolean().optional(),
    withdrawalLimitWithoutApprovalCents: optionalMoneyCentsSchema,
    supplyLimitWithoutApprovalCents: optionalMoneyCentsSchema,
    discrepancyToleranceCents: moneyCentsSchema.optional(),
    expectedOpeningFloatCents: optionalMoneyCentsSchema,
    isActive: z.boolean().optional(),
  })
  .strict()

export const cashRegisterUpdateSchema = z
  .object({
    id: z.string().uuid(),
    ...scopeShape,
    establishmentId: z.string().uuid().nullish(),
    code: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(255).optional(),
    terminalId: z.string().uuid().nullish(),
    drawerId: z.string().uuid().nullish(),
    warehouseId: z.string().uuid().nullish(),
    blindClosing: z.boolean().optional(),
    withdrawalLimitWithoutApprovalCents: optionalMoneyCentsSchema,
    supplyLimitWithoutApprovalCents: optionalMoneyCentsSchema,
    discrepancyToleranceCents: moneyCentsSchema.optional(),
    expectedOpeningFloatCents: optionalMoneyCentsSchema,
    isActive: z.boolean().optional(),
  })
  .strict()

export const cashRegisterDeleteSchema = z
  .object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid().optional(),
  })
  .strict()

// ---------------------------------------------------------------------------
// Drawers
// ---------------------------------------------------------------------------

export const cashDrawerCreateSchema = z
  .object({
    ...scopeShape,
    registerId: z.string().uuid(),
    code: z.string().trim().min(1).max(64),
    name: z.string().trim().max(255).nullish(),
    isActive: z.boolean().optional(),
  })
  .strict()

export const cashDrawerUpdateSchema = z
  .object({
    id: z.string().uuid(),
    ...scopeShape,
    registerId: z.string().uuid().optional(),
    code: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().max(255).nullish(),
    isActive: z.boolean().optional(),
  })
  .strict()

export const cashDrawerDeleteSchema = z
  .object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid().optional(),
  })
  .strict()

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const cashSessionOpenSchema = z
  .object({
    ...scopeShape,
    establishmentId: z.string().uuid().nullish(),
    registerId: z.string().uuid(),
    terminalId: z.string().uuid().nullish(),
    operatorUserId: z.string().uuid(),
    openingFloatCents: moneyCentsSchema,
    openingDenominations: denominationMapSchema,
    notes: z.string().trim().max(500).nullish(),
    openedAtLocal: z.coerce.date().optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    refineDenominations(value.openingDenominations, BigInt(value.openingFloatCents), ctx, 'openingDenominations')
  })

export const cashSessionCloseSchema = z
  .object({
    ...scopeShape,
    sessionId: z.string().uuid(),
    operatorUserId: z.string().uuid(),
    countedCashCents: moneyCentsSchema,
    denominations: denominationMapSchema,
    notes: z.string().trim().max(500).nullish(),
    reason: z.string().trim().max(500).nullish(),
    approverUserId: z.string().uuid().nullish(),
    closedAtLocal: z.coerce.date().optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    refineDenominations(value.denominations, BigInt(value.countedCashCents), ctx)
  })

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

export const cashCountCreateSchema = z
  .object({
    ...scopeShape,
    sessionId: z.string().uuid(),
    kind: z.enum(['opening', 'closing', 'spot']),
    operatorUserId: z.string().uuid(),
    totalCountedCents: moneyCentsSchema,
    denominations: denominationMapSchema,
    notes: z.string().trim().max(500).nullish(),
  })
  .strict()
  .superRefine((value, ctx) => {
    refineDenominations(value.denominations, BigInt(value.totalCountedCents), ctx)
  })

// ---------------------------------------------------------------------------
// Withdrawals (sangria) and supplies (suprimento)
// ---------------------------------------------------------------------------

/**
 * `maxWithoutApprovalCents` is intentionally absent: the approval threshold is server-side
 * policy on the register (REV-001). Unknown keys are stripped so a stale client sending it
 * gets a plain 201 instead of a validation failure.
 */
export const cashWithdrawalCreateSchema = z
  .object({
    ...scopeShape,
    sessionId: z.string().uuid(),
    amountCents: moneyCentsSchema,
    reasonCode: z.enum(['excess_cash', 'safe_deposit', 'authorized_payment', 'transfer', 'other']),
    reasonDetail: z.string().trim().max(500).nullish(),
    destination: z.enum(['safe', 'treasury', 'bank', 'other_register', 'other']),
    receiverName: z.string().trim().max(255).nullish(),
    operatorUserId: z.string().uuid(),
    approverUserId: z.string().uuid().nullish(),
    terminalId: z.string().uuid().nullish(),
    denominations: denominationMapSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strip()
  .superRefine((value, ctx) => {
    if (value.reasonCode === 'other' && !value.reasonDetail?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['reasonDetail'],
        message: 'reasonDetail is required when reasonCode is other',
      })
    }
    const amount = refinePositiveAmount(value.amountCents, ctx)
    refineDenominations(value.denominations, amount, ctx)
  })

export const cashSupplyCreateSchema = z
  .object({
    ...scopeShape,
    sessionId: z.string().uuid(),
    amountCents: moneyCentsSchema,
    origin: z.enum(['treasury', 'safe', 'bank', 'other_register', 'other']),
    reasonCode: z.enum(['opening_float', 'change_fund', 'transfer', 'other']),
    reasonDetail: z.string().trim().max(500).nullish(),
    operatorUserId: z.string().uuid(),
    approverUserId: z.string().uuid().nullish(),
    terminalId: z.string().uuid().nullish(),
    denominations: denominationMapSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strip()
  .superRefine((value, ctx) => {
    if ((value.reasonCode === 'other' || value.origin === 'other') && !value.reasonDetail?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['reasonDetail'],
        message: 'reasonDetail is required when reasonCode or origin is other',
      })
    }
    const amount = refinePositiveAmount(value.amountCents, ctx)
    refineDenominations(value.denominations, amount, ctx)
  })

// ---------------------------------------------------------------------------
// Reversal and POS sale recording
// ---------------------------------------------------------------------------

export const cashMovementReverseSchema = z
  .object({
    ...scopeShape,
    movementId: z.string().uuid(),
    operatorUserId: z.string().uuid(),
    approverUserId: z.string().uuid().nullish(),
    reason: z.string().trim().min(3).max(500),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict()

export const cashSaleRecordSchema = z
  .object({
    ...scopeShape,
    sessionId: z.string().uuid(),
    amountCents: moneyCentsSchema,
    operatorUserId: z.string().uuid(),
    terminalId: z.string().uuid().nullish(),
    posTransactionId: z.string().uuid().nullish(),
    salesOrderId: z.string().uuid().nullish(),
    paymentTenderId: z.string().uuid().nullish(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    refinePositiveAmount(value.amountCents, ctx)
  })

export type CashRegisterCreateInput = z.infer<typeof cashRegisterCreateSchema>
export type CashRegisterUpdateInput = z.infer<typeof cashRegisterUpdateSchema>
export type CashRegisterDeleteInput = z.infer<typeof cashRegisterDeleteSchema>
export type CashDrawerCreateInput = z.infer<typeof cashDrawerCreateSchema>
export type CashDrawerUpdateInput = z.infer<typeof cashDrawerUpdateSchema>
export type CashDrawerDeleteInput = z.infer<typeof cashDrawerDeleteSchema>
export type CashSessionOpenInput = z.infer<typeof cashSessionOpenSchema>
export type CashSessionCloseInput = z.infer<typeof cashSessionCloseSchema>
export type CashCountCreateInput = z.infer<typeof cashCountCreateSchema>
export type CashWithdrawalCreateInput = z.infer<typeof cashWithdrawalCreateSchema>
export type CashSupplyCreateInput = z.infer<typeof cashSupplyCreateSchema>
export type CashMovementReverseInput = z.infer<typeof cashMovementReverseSchema>
export type CashSaleRecordInput = z.infer<typeof cashSaleRecordSchema>
