export const metadata = {
  requireAuth: true,
  requireFeatures: ['soanas_cash.registers.view'],
  pageTitle: 'Cash registers',
  pageTitleKey: 'soanas_cash.registers.page.title',
  pageGroup: 'Cash',
  pageGroupKey: 'soanas_cash.nav.group',
  pageOrder: 10,
  pageContext: 'settings' as const,
  icon: 'wallet',
  breadcrumb: [{ label: 'Cash registers', labelKey: 'soanas_cash.registers.page.title' }],
}
