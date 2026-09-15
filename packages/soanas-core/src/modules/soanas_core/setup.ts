import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['soanas_core.*', 'soanas.pos.*'],
    admin: ['soanas_core.*', 'soanas.pos.*'],
  },
}

export default setup
