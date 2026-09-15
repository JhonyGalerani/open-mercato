import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['soanas_pos.*', 'soanas.pos.*'],
    admin: ['soanas_pos.*', 'soanas.pos.*'],
    manager: [
      'soanas_pos.terminals.view',
      'soanas_pos.terminals.manage',
      'soanas_pos.transactions.view',
      'soanas_pos.transactions.sell',
      'soanas_pos.transactions.complete',
      'soanas_pos.transactions.cancel',
      'soanas_pos.catalog.search',
      'soanas.pos.discount.grant',
      'soanas.pos.discount.approve',
      'soanas.pos.approval.manager',
    ],
    employee: [
      'soanas_pos.terminals.view',
      'soanas_pos.transactions.view',
      'soanas_pos.transactions.sell',
      'soanas_pos.transactions.complete',
      'soanas_pos.catalog.search',
      'soanas.pos.discount.grant',
    ],
  },
}

export default setup
