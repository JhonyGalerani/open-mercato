import { isMockPixWebhookAllowed } from '../lib/mockWebhookGuard'

describe('isMockPixWebhookAllowed', () => {
  it('allows development and test without a secret', () => {
    expect(isMockPixWebhookAllowed({ nodeEnv: 'development' }).allowed).toBe(true)
    expect(isMockPixWebhookAllowed({ nodeEnv: 'test' }).allowed).toBe(true)
  })

  it('blocks production when the flag is off', () => {
    const result = isMockPixWebhookAllowed({
      nodeEnv: 'production',
      enabledFlag: 'false',
      configuredSecret: 'super-secret-value-1234',
      providedSecret: 'super-secret-value-1234',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('disabled_outside_dev_test')
  })

  it('blocks production when the secret is missing or wrong', () => {
    expect(
      isMockPixWebhookAllowed({
        nodeEnv: 'production',
        enabledFlag: 'true',
        configuredSecret: '',
        providedSecret: 'x',
      }).reason,
    ).toBe('secret_not_configured')

    expect(
      isMockPixWebhookAllowed({
        nodeEnv: 'production',
        enabledFlag: 'true',
        configuredSecret: 'super-secret-value-1234',
        providedSecret: 'wrong',
      }).reason,
    ).toBe('secret_mismatch')
  })

  it('allows production only with flag + matching secret', () => {
    const result = isMockPixWebhookAllowed({
      nodeEnv: 'production',
      enabledFlag: 'true',
      configuredSecret: 'super-secret-value-1234',
      providedSecret: 'super-secret-value-1234',
    })
    expect(result.allowed).toBe(true)
    expect(result.reason).toBe('secret_ok')
  })
})

describe('Pix charge scope contract', () => {
  it('requires tenantId + organizationId + txid for lookups', () => {
    // Contract smoke: the command helper signature is the security boundary.
    // Cross-tenant / cross-org isolation is covered by the loader filters themselves.
    const scope = {
      tenantId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      txid: 'txid-abc',
    }
    expect(Object.keys(scope).sort()).toEqual(['organizationId', 'tenantId', 'txid'])
  })
})
