import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['soanas_establishments.*'],
    admin: ['soanas_establishments.*'],
  },
}

export default setup
