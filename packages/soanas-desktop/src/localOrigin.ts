import { isIP } from 'node:net'

/**
 * Strict store-local UI origin checks (ADR-013).
 * Accepts only http/https origins bound to loopback or RFC1918 / ULA / IPv6 loopback.
 * Rejects credentialed URLs, path/query/hash (not part of an origin), and hostname spoofs
 * like `10.0.0.1.evil.example` (those are DNS names, not IP literals).
 */
export function assertLocalOrigin(origin: string): void {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    throw new Error('[internal] soanas-desktop invalid uiOrigin')
  }

  const protocol = url.protocol.toLowerCase()
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('[internal] soanas-desktop uiOrigin must use http or https')
  }

  if (url.username !== '' || url.password !== '') {
    throw new Error('[internal] soanas-desktop uiOrigin must not include credentials')
  }

  // An origin is scheme + host + port only.
  if ((url.pathname && url.pathname !== '/') || url.search !== '' || url.hash !== '') {
    throw new Error('[internal] soanas-desktop uiOrigin must not include path, query, or hash')
  }

  const host = normalizeHost(url.hostname)
  if (!isLocalOrPrivateHost(host)) {
    throw new Error('[internal] soanas-desktop uiOrigin must be loopback or private LAN (ADR-013)')
  }
}

function normalizeHost(hostname: string): string {
  // Some Node versions keep brackets on IPv6 URL.hostname (e.g. "[::1]").
  let host = hostname.trim().toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1)
  }
  return host
}

export function isLocalOrPrivateHost(host: string): boolean {
  if (host === 'localhost') return true

  const version = isIP(host)
  if (version === 4) return isPrivateOrLoopbackIpv4(host)
  if (version === 6) return isPrivateOrLoopbackIpv6(host)

  // Non-IP hostnames (including names that *look* like IPs with extra labels) are rejected.
  return false
}

function isPrivateOrLoopbackIpv4(host: string): boolean {
  const octets = host.split('.').map((part) => Number(part))
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }
  const [a, b] = octets
  // 127.0.0.0/8 loopback
  if (a === 127) return true
  // 10.0.0.0/8
  if (a === 10) return true
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

function isPrivateOrLoopbackIpv6(host: string): boolean {
  const expanded = expandIpv6(host)
  if (!expanded) return false

  // ::1 loopback
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') return true

  const first = Number.parseInt(expanded.slice(0, 4), 16)
  // fc00::/7 unique local
  if ((first & 0xfe00) === 0xfc00) return true
  // fe80::/10 link-local (store LAN peers)
  if ((first & 0xffc0) === 0xfe80) return true

  // IPv4-mapped IPv6 ::ffff:x.x.x.x — evaluate embedded IPv4
  if (expanded.startsWith('0000:0000:0000:0000:0000:ffff:')) {
    const hi = Number.parseInt(expanded.split(':')[6] ?? '', 16)
    const lo = Number.parseInt(expanded.split(':')[7] ?? '', 16)
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) return false
    const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
    return isPrivateOrLoopbackIpv4(ipv4)
  }

  return false
}

/** Expand IPv6 to eight lowercase 4-hex hextets, or null if invalid. */
export function expandIpv6(host: string): string | null {
  if (isIP(host) !== 6) return null
  let input = host.toLowerCase()
  if (input.startsWith('::ffff:')) {
    const dotted = input.slice('::ffff:'.length)
    if (isIP(dotted) === 4) {
      const [a, b, c, d] = dotted.split('.').map(Number)
      const hi = ((a << 8) | b).toString(16).padStart(4, '0')
      const lo = ((c << 8) | d).toString(16).padStart(4, '0')
      return `0000:0000:0000:0000:0000:ffff:${hi}:${lo}`
    }
  }

  const sides = input.split('::')
  if (sides.length > 2) return null
  const head = sides[0] ? sides[0].split(':').filter(Boolean) : []
  const tail = sides.length === 2 && sides[1] ? sides[1].split(':').filter(Boolean) : []
  if (sides.length === 1) {
    if (head.length !== 8) return null
    return head.map((h) => h.padStart(4, '0')).join(':')
  }
  const missing = 8 - head.length - tail.length
  if (missing < 0) return null
  const full = [...head, ...Array.from({ length: missing }, () => '0'), ...tail]
  if (full.length !== 8) return null
  return full.map((h) => h.padStart(4, '0')).join(':')
}
