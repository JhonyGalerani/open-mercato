import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'soanas_establishments',
  title: 'Soanas Establishments',
  version: '0.1.0',
  description: 'Brazilian fiscal establishments linked to Mercato organizations.',
  author: 'Soanas',
  license: 'UNLICENSED',
}

export { features } from './acl'
export default metadata
