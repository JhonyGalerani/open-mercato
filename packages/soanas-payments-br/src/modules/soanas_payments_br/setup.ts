import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['soanas_payments_br.*'],
    admin: ['soanas_payments_br.*'],
    manager: [
      'soanas_payments_br.pix.view',
      'soanas_payments_br.pix.create',
      'soanas_payments_br.pix.cancel',
      'soanas_payments_br.pix.refund',
    ],
    employee: [
      'soanas_payments_br.pix.view',
      'soanas_payments_br.pix.create',
      'soanas_payments_br.pix.cancel',
    ],
  },
}

export default setup
