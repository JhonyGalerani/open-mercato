export const metadata = {
  requireAuth: true,
  requireFeatures: ['soanas_pos.terminals.view'],
  pageTitle: 'POS terminals',
  pageTitleKey: 'soanas_pos.terminals.page.title',
  pageGroup: 'POS',
  pageGroupKey: 'soanas_pos.nav.group',
  pageOrder: 10,
  pageContext: 'settings' as const,
  icon: 'monitor',
  breadcrumb: [{ label: 'POS terminals', labelKey: 'soanas_pos.terminals.page.title' }],
}
