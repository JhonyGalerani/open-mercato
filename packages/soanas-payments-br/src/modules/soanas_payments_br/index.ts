import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'soanas_payments_br',
  title: 'Soanas Payments (BR)',
  version: '0.1.0',
  description: 'Brazilian Pix payments: provider port, mock adapter, charge lifecycle and webhooks.',
  author: 'Soanas',
  license: 'UNLICENSED',
}

export { features } from './acl'
export default metadata
