export {
  createLocalRuntimeConfig,
  type LocalRuntimeConfig,
  DEFAULT_LOCAL_UI_ORIGIN,
  assertLocalOrigin,
} from './localRuntime'
export { isLocalOrPrivateHost, expandIpv6 } from './localOrigin'
export {
  decideShellNavigation,
  shouldAllowShellNavigation,
  shouldAllowRemoteResource,
} from './navigationGuard'
export { probeLocalBoot, probeWanDocumentationAddress } from './localBoot'
export { restartStoreLocalAppProcess, findPidsListeningOnPort, killPids } from './appProcess'
export { resolveDesktopShellTarget, ELECTRON_MAIN_CONTRACT } from './shellTarget'

/**
 * Prototype-only JSONL helper — NOT transactional sale persistence.
 * @see ./prototype/localSaleJournalPrototype.ts
 */
export {
  LocalSaleJournalPrototype,
  LocalSaleJournal,
  type JournalSaleRecord,
  type JournalAppendInput,
} from './prototype/localSaleJournalPrototype'
