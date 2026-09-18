import { assertLocalOrigin } from './localOrigin'

export type NavigationDecision = {
  allow: boolean
  reason: string
}

/**
 * Electron / WebView navigation policy for the store-local shell.
 * Controls top-level navigations, redirects, and new-window targets:
 * only same-origin as the approved local UI origin (plus about:blank).
 */
export function decideShellNavigation(requestUrl: string, allowedOrigin: string): NavigationDecision {
  assertLocalOrigin(allowedOrigin)
  if (requestUrl === 'about:blank') {
    return { allow: true, reason: 'about:blank' }
  }

  let target: URL
  try {
    target = new URL(requestUrl)
  } catch {
    return { allow: false, reason: 'invalid-url' }
  }

  const protocol = target.protocol.toLowerCase()
  if (protocol !== 'http:' && protocol !== 'https:') {
    return { allow: false, reason: `protocol:${protocol}` }
  }

  if (target.username || target.password) {
    return { allow: false, reason: 'credentials' }
  }

  const allowed = new URL(allowedOrigin)
  if (target.origin !== allowed.origin) {
    return { allow: false, reason: 'cross-origin' }
  }

  return { allow: true, reason: 'same-origin' }
}

export function shouldAllowShellNavigation(requestUrl: string, allowedOrigin: string): boolean {
  return decideShellNavigation(requestUrl, allowedOrigin).allow
}

/** Deny list probe for remote assets that must not load in packaged POS. */
export function shouldAllowRemoteResource(resourceUrl: string, allowedOrigin: string): boolean {
  return shouldAllowShellNavigation(resourceUrl, allowedOrigin)
}
