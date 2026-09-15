import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'soanas_cash',
  title: 'Soanas Cash',
  version: '0.1.0',
  description: 'Cash register ledger: sessions, withdrawals, supplies, closing.',
  author: 'Soanas',
  license: 'UNLICENSED',
}

export { features } from './acl'
export default metadata
