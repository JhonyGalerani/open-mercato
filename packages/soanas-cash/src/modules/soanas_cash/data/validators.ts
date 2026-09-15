import { z } from 'zod'

const moneyCentsSchema = z.union([
  z.number().int().nonnegative(),
  z.string().regex(/^\d+$/),
]).transform((value) => String(value))

export const denominationMapSchema = z.record(z.string(), z.number().int().nonnegative()).optional().nullable()

export const cashSessionOpenSchema = z
  .object({
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid(),
    establishmentId: z.string().uuid().nullish(),
    registerId: z.string().uuid(),
    terminalId: z.string().uuid().nullish(),
    operatorUserId: z.string().uuid(),
    openingFloatCents: moneyCentsSchema,
    openingDenominations: denominationMapSchema,
    openedAtLocal: z.coerce.date().optional(),
    idempotencyKey: z.string().trim().min(8).max(128),
  })
  .strict()

export const cashWithdrawalCreateSchema = z
  .object({
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid(),
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
    idempotencyKey: z.string().trim().min(8).max(128),
    maxWithoutApprovalCents: moneyCentsSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.reasonCode === 'other' && !value.reasonDetail?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['reasonDetail'],
        message: 'reasonDetail is required when reasonCode is other',
      })
    }
    const amount = BigInt(value.amountCents)
    if (amount <= 0n) {
      ctx.addIssue({ code: 'custom', path: ['amountCents'], message: 'amount must be > 0' })
    }
    if (value.denominations) {
      // denomination face values are reais (e.g. "100" = R$100)
      let sum = 0n
      for (const [face, count] of Object.entries(value.denominations)) {
        sum += BigInt(Math.round(Number(face) * 100)) * BigInt(count)
      }
      if (sum > 0n && sum !== amount) {
        ctx.addIssue({
          code: 'custom',
          path: ['denominations'],
          message: 'denomination sum must equal amountCents',
        })
      }
    }
  })

export type CashSessionOpenInput = z.infer<typeof cashSessionOpenSchema>
export type CashWithdrawalCreateInput = z.infer<typeof cashWithdrawalCreateSchema>
