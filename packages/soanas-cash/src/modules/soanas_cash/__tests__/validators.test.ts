import {
  cashSessionOpenSchema,
  cashSupplyCreateSchema,
  cashWithdrawalCreateSchema,
} from '../data/validators'

const uuid = (suffix: string) => `0000000${suffix}-0000-4000-8000-000000000000`

const withdrawalBase = {
  tenantId: uuid('1'),
  organizationId: uuid('2'),
  sessionId: uuid('3'),
  operatorUserId: uuid('4'),
  amountCents: '10000',
  reasonCode: 'excess_cash' as const,
  destination: 'safe' as const,
  idempotencyKey: 'sangria-0001',
}

describe('withdrawal schema (REV-001)', () => {
  it('drops a client-supplied approval threshold instead of honouring it', () => {
    const parsed = cashWithdrawalCreateSchema.parse({
      ...withdrawalBase,
      maxWithoutApprovalCents: '999999999',
    })
    expect(parsed).not.toHaveProperty('maxWithoutApprovalCents')
  })

  it('rejects a zero amount', () => {
    expect(() => cashWithdrawalCreateSchema.parse({ ...withdrawalBase, amountCents: '0' })).toThrow()
  })

  it('requires a detail when the reason is other', () => {
    expect(() =>
      cashWithdrawalCreateSchema.parse({ ...withdrawalBase, reasonCode: 'other' }),
    ).toThrow()
    expect(
      cashWithdrawalCreateSchema.parse({
        ...withdrawalBase,
        reasonCode: 'other',
        reasonDetail: 'transfer to armored car',
      }).reasonDetail,
    ).toBe('transfer to armored car')
  })

  it('rejects denominations that do not sum to the amount', () => {
    expect(() =>
      cashWithdrawalCreateSchema.parse({ ...withdrawalBase, denominations: { '50': 1 } }),
    ).toThrow()
    expect(
      cashWithdrawalCreateSchema.parse({ ...withdrawalBase, denominations: { '50': 2 } }).denominations,
    ).toEqual({ '50': 2 })
  })
})

describe('supply schema', () => {
  it('requires an origin', () => {
    expect(() =>
      cashSupplyCreateSchema.parse({
        tenantId: uuid('1'),
        organizationId: uuid('2'),
        sessionId: uuid('3'),
        operatorUserId: uuid('4'),
        amountCents: '5000',
        reasonCode: 'change_fund',
        idempotencyKey: 'suprimento-1',
      }),
    ).toThrow()
  })
})

describe('session open schema (REV-011)', () => {
  const openBase = {
    tenantId: uuid('1'),
    organizationId: uuid('2'),
    registerId: uuid('3'),
    operatorUserId: uuid('4'),
    openingFloatCents: '20000',
    idempotencyKey: 'abertura-0001',
  }

  it('rejects opening denominations that disagree with the float', () => {
    expect(() =>
      cashSessionOpenSchema.parse({ ...openBase, openingDenominations: { '50': 1 } }),
    ).toThrow()
  })

  it('accepts opening denominations that match the float', () => {
    const parsed = cashSessionOpenSchema.parse({
      ...openBase,
      openingDenominations: { '50': 4 },
    })
    expect(parsed.openingFloatCents).toBe('20000')
  })
})
