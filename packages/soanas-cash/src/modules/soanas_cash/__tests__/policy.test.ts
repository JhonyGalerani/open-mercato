import {
  resolveDiscrepancyToleranceCents,
  resolveSupplyRequiresApproval,
  resolveWithdrawalRequiresApproval,
} from '../lib/policy'

describe('withdrawal approval policy (REV-001)', () => {
  it('allows an amount at or below the register limit without approval', () => {
    const register = { withdrawalLimitWithoutApprovalCents: '20000' }
    expect(resolveWithdrawalRequiresApproval(register, 19999n).requiresApproval).toBe(false)
    expect(resolveWithdrawalRequiresApproval(register, 20000n).requiresApproval).toBe(false)
  })

  it('requires approval above the register limit', () => {
    const register = { withdrawalLimitWithoutApprovalCents: '20000' }
    const requirement = resolveWithdrawalRequiresApproval(register, 20001n)
    expect(requirement.requiresApproval).toBe(true)
    expect(requirement.limitCents).toBe(20000n)
  })

  it('requires approval for every amount when no limit is configured', () => {
    expect(resolveWithdrawalRequiresApproval({}, 1n).requiresApproval).toBe(true)
    expect(
      resolveWithdrawalRequiresApproval({ withdrawalLimitWithoutApprovalCents: null }, 1n).requiresApproval,
    ).toBe(true)
  })

  it('allows nothing without approval when the limit is zero', () => {
    const register = { withdrawalLimitWithoutApprovalCents: '0' }
    expect(resolveWithdrawalRequiresApproval(register, 1n).requiresApproval).toBe(true)
    expect(resolveWithdrawalRequiresApproval(register, 0n).requiresApproval).toBe(false)
  })
})

describe('supply approval policy', () => {
  it('uses the supply limit, not the withdrawal limit', () => {
    const register = {
      withdrawalLimitWithoutApprovalCents: '100',
      supplyLimitWithoutApprovalCents: '50000',
    }
    expect(resolveSupplyRequiresApproval(register, 40000n).requiresApproval).toBe(false)
    expect(resolveSupplyRequiresApproval(register, 50001n).requiresApproval).toBe(true)
  })
})

describe('discrepancy tolerance', () => {
  it('defaults to zero', () => {
    expect(resolveDiscrepancyToleranceCents({})).toBe(0n)
    expect(resolveDiscrepancyToleranceCents({ discrepancyToleranceCents: null })).toBe(0n)
  })

  it('reads the configured tolerance as an absolute value', () => {
    expect(resolveDiscrepancyToleranceCents({ discrepancyToleranceCents: '500' })).toBe(500n)
    expect(resolveDiscrepancyToleranceCents({ discrepancyToleranceCents: '-500' })).toBe(500n)
  })
})
