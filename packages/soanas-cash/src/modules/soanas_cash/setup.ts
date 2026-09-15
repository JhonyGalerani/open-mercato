import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['soanas_cash.*'],
    admin: ['soanas_cash.*'],
    manager: [
      'soanas_cash.registers.view',
      'soanas_cash.registers.manage',
      'soanas_cash.drawers.view',
      'soanas_cash.drawers.manage',
      'soanas_cash.sessions.view',
      'soanas_cash.sessions.open',
      'soanas_cash.sessions.close',
      'soanas_cash.withdrawals.create',
      'soanas_cash.supplies.create',
      'soanas_cash.movements.reverse',
      'soanas_cash.counts.create',
      'soanas_cash.reconciliations.view',
      'soanas_cash.approvals.manage',
    ],
    employee: [
      'soanas_cash.registers.view',
      'soanas_cash.drawers.view',
      'soanas_cash.sessions.view',
      'soanas_cash.sessions.open',
      'soanas_cash.sessions.close',
      'soanas_cash.withdrawals.create',
      'soanas_cash.supplies.create',
      'soanas_cash.counts.create',
      'soanas_cash.movements.record_sale',
    ],
  },
}

export default setup
