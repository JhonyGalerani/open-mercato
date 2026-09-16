/**
 * Mock Pix webhook is never public in production.
 * Allowed only when:
 * - NODE_ENV is development or test, OR
 * - SOANAS_PIX_MOCK_WEBHOOK_ENABLED=true AND a matching SOANAS_PIX_MOCK_WEBHOOK_SECRET is sent.
 */
export function isMockPixWebhookAllowed(args: {
  nodeEnv?: string | null
  enabledFlag?: string | null
  configuredSecret?: string | null
  providedSecret?: string | null
}): { allowed: boolean; reason: string } {
  const nodeEnv = (args.nodeEnv ?? process.env.NODE_ENV ?? '').toLowerCase()
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return { allowed: true, reason: 'dev_or_test' }
  }

  const enabled =
    (args.enabledFlag ?? process.env.SOANAS_PIX_MOCK_WEBHOOK_ENABLED ?? '').toLowerCase() === 'true'
  if (!enabled) {
    return { allowed: false, reason: 'disabled_outside_dev_test' }
  }

  const configured = args.configuredSecret ?? process.env.SOANAS_PIX_MOCK_WEBHOOK_SECRET ?? ''
  const provided = args.providedSecret ?? ''
  if (!configured || configured.length < 16) {
    return { allowed: false, reason: 'secret_not_configured' }
  }
  if (provided !== configured) {
    return { allowed: false, reason: 'secret_mismatch' }
  }
  return { allowed: true, reason: 'secret_ok' }
}
