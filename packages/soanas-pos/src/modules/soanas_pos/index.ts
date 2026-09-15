import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'soanas_pos',
  title: 'Soanas POS',
  version: '0.1.0',
  description: 'Point of sale: terminals, POS transactions, tenders and the completion saga.',
  author: 'Soanas',
  license: 'UNLICENSED',
}

export { features } from './acl'
export default metadata
