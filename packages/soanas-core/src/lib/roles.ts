/** Default Soanas staff profiles (AUTH-005). Role names are seeds — ACL uses feature IDs. */
export const SOANAS_DEFAULT_PROFILES = [
  'owner',
  'admin',
  'general_manager',
  'store_manager',
  'supervisor',
  'fiscal',
  'accountant',
  'stockist',
  'buyer',
  'cashier',
  'seller',
  'waiter',
  'attendant',
  'cook',
  'bartender',
  'dispatcher',
  'delivery',
  'auditor',
  'tech_support',
] as const

export type SoanasDefaultProfile = (typeof SOANAS_DEFAULT_PROFILES)[number]
