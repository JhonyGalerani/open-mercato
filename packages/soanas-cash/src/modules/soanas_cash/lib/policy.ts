export type ApprovalPolicyRegister = {
  withdrawalLimitWithoutApprovalCents?: string | null
  supplyLimitWithoutApprovalCents?: string | null
  discrepancyToleranceCents?: string | null
}

export type ApprovalRequirement = {
  requiresApproval: boolean
  limitCents: bigint | null
  amountCents: bigint
}

function resolveLimit(raw: string | null | undefined): bigint | null {
  if (raw === null || raw === undefined || raw === '') return null
  return BigInt(raw)
}

function resolveRequirement(limitRaw: string | null | undefined, amountCents: bigint): ApprovalRequirement {
  const limit = resolveLimit(limitRaw)
  // A null limit means "no self-service allowance" — every movement needs a second pair of eyes.
  return {
    requiresApproval: limit === null ? true : amountCents > limit,
    limitCents: limit,
    amountCents,
  }
}

/** Server-side sangria threshold. The client never supplies the limit (REV-001). */
export function resolveWithdrawalRequiresApproval(
  register: ApprovalPolicyRegister,
  amountCents: bigint,
): ApprovalRequirement {
  return resolveRequirement(register.withdrawalLimitWithoutApprovalCents, amountCents)
}

export function resolveSupplyRequiresApproval(
  register: ApprovalPolicyRegister,
  amountCents: bigint,
): ApprovalRequirement {
  return resolveRequirement(register.supplyLimitWithoutApprovalCents, amountCents)
}

export function resolveDiscrepancyToleranceCents(register: ApprovalPolicyRegister): bigint {
  const tolerance = resolveLimit(register.discrepancyToleranceCents)
  if (tolerance === null) return 0n
  return tolerance < 0n ? -tolerance : tolerance
}

/** Features that let a caller authorize a movement above the register limit. */
export const APPROVAL_FEATURES = [
  'soanas_cash.approvals.manage',
  'soanas_pos.approval.manager',
  'soanas.pos.approval.manager', // legacy alias
] as const
