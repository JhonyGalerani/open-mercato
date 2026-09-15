import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'soanas_core',
  title: 'Soanas Core',
  version: '0.1.0',
  description: 'Shared Soanas foundation: ACL catalog, validators, and cross-domain helpers.',
  author: 'Soanas',
  license: 'UNLICENSED',
}

export { features } from './acl'
export default metadata
