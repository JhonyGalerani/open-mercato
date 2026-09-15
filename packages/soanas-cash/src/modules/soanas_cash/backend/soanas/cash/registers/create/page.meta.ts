export const metadata = {
  requireAuth: true,
  requireFeatures: ['soanas_cash.registers.manage'],
  pageTitle: 'Create cash register',
  pageTitleKey: 'soanas_cash.registers.create.title',
  pageGroup: 'Cash',
  pageGroupKey: 'soanas_cash.nav.group',
  pageContext: 'settings' as const,
  breadcrumb: [
    {
      label: 'Cash registers',
      labelKey: 'soanas_cash.registers.page.title',
      href: '/backend/soanas/cash/registers',
    },
    { label: 'Create', labelKey: 'soanas_cash.registers.create.title' },
  ],
}
