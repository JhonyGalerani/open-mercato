import { enforceDualCustody } from '../commands/helpers'

function makeCtx(sub: string | null, canApprove = true) {
  return {
    auth: sub ? { sub, tenantId: 'tenant-1', orgId: 'org-1' } : null,
    selectedOrganizationId: 'org-1',
    systemActor: false,
    container: {
      resolve: (key: string) => {
        if (key === 'rbacService') {
          return {
            userHasAllFeatures: async () => canApprove,
            getGrantedFeatures: async () => (canApprove ? ['soanas_cash.approvals.manage'] : []),
          }
        }
        throw new Error(`unexpected di key ${key}`)
      },
    },
  } as never
}

describe('enforceDualCustody (ADR-012)', () => {
  const requirement = { requiresApproval: true, limitCents: null as bigint | null }

  it('allows manager B to approve a movement on operator A session', async () => {
    const approver = await enforceDualCustody({
      ctx: makeCtx('manager-b'),
      requirement,
      operatorUserId: 'operator-a',
      approverUserId: 'spoofed-uuid',
    })
    expect(approver).toBe('manager-b')
  })

  it('rejects self-approval when session operator equals authenticated caller', async () => {
    await expect(
      enforceDualCustody({
        ctx: makeCtx('operator-a'),
        requirement,
        operatorUserId: 'operator-a',
        approverUserId: 'different-spoof',
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('ignores client-supplied approverUserId for identity', async () => {
    const approver = await enforceDualCustody({
      ctx: makeCtx('manager-b'),
      requirement,
      operatorUserId: 'operator-a',
      approverUserId: '11111111-1111-4111-8111-111111111111',
    })
    expect(approver).toBe('manager-b')
    expect(approver).not.toBe('11111111-1111-4111-8111-111111111111')
  })

  it('returns null when approval is not required', async () => {
    const approver = await enforceDualCustody({
      ctx: makeCtx('operator-a'),
      requirement: { requiresApproval: false, limitCents: 1000n },
      operatorUserId: 'operator-a',
    })
    expect(approver).toBeNull()
  })
})
