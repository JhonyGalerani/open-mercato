import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['soanas_cash.*'],
    admin: ['soanas_cash.*'],
    employee: [
      'soanas_cash.sessions.view',
      'soanas_cash.sessions.open',
      'soanas_cash.sessions.close',
      'soanas_cash.withdrawals.create',
      'soanas_cash.supplies.create',
    ],
  },
}

export default setup
