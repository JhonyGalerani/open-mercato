import { assertLocalOrigin } from './localOrigin'
import { createLocalRuntimeConfig, type LocalRuntimeConfig } from './localRuntime'

export type HealthProbeResult = {
  ok: boolean
  status: number | null
  path: string
  detail: string
}

export type LocalBootProbeResult = {
  origin: string
  health: HealthProbeResult
  loginPage: HealthProbeResult
  authLogin: HealthProbeResult
  posSellUi: HealthProbeResult
  ok: boolean
}

async function probe(
  origin: string,
  pathName: string,
  init?: RequestInit,
): Promise<HealthProbeResult> {
  const url = `${origin}${pathName}`
  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    })
    const status = response.status
    const ok = status >= 200 && status < 500
    return {
      ok,
      status,
      path: pathName,
      detail: ok ? `HTTP ${status}` : `unexpected HTTP ${status}`,
    }
  } catch (error) {
    return {
      ok: false,
      status: null,
      path: pathName,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Health + auth + POS UI reachability against the store-local origin.
 * Does not invent credentials: uses anonymous probes + optional login body from env.
 */
export async function probeLocalBoot(
  config?: LocalRuntimeConfig,
  options?: { loginEmail?: string; loginPassword?: string },
): Promise<LocalBootProbeResult> {
  const runtime = config ?? createLocalRuntimeConfig()
  assertLocalOrigin(runtime.uiOrigin)

  const health = await probe(runtime.uiOrigin, '/api/auth/session')
  const loginPage = await probe(runtime.uiOrigin, '/login')
  const posSellUi = await probe(runtime.uiOrigin, '/backend/soanas/pos/sell')

  const email = options?.loginEmail ?? process.env.SOANAS_E1_LOGIN_EMAIL ?? 'admin@acme.com'
  const password = options?.loginPassword ?? process.env.SOANAS_E1_LOGIN_PASSWORD ?? 'secret'
  const authLogin = await probe(runtime.uiOrigin, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const ok = health.ok && loginPage.ok && authLogin.ok && posSellUi.ok
  return {
    origin: runtime.uiOrigin,
    health,
    loginPage,
    authLogin,
    posSellUi,
    ok,
  }
}

/**
 * Simulate WAN loss for documentation/tests without touching host firewall:
 * attempt a documentation TEST-NET address that should not route, while caller
 * verifies loopback health separately.
 */
export async function probeWanDocumentationAddress(timeoutMs = 1500): Promise<{
  reachable: boolean
  detail: string
}> {
  try {
    await fetch('http://203.0.113.1/', { signal: AbortSignal.timeout(timeoutMs) })
    return { reachable: true, detail: 'unexpected success contacting TEST-NET-3' }
  } catch (error) {
    return {
      reachable: false,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
