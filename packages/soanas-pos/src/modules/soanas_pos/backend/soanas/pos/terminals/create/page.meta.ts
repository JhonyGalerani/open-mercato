export const metadata = {
  requireAuth: true,
  requireFeatures: ['soanas_pos.terminals.manage'],
  pageTitle: 'Create POS terminal',
  pageTitleKey: 'soanas_pos.terminals.create.title',
  pageGroup: 'POS',
  pageGroupKey: 'soanas_pos.nav.group',
  pageContext: 'settings' as const,
  breadcrumb: [
    {
      label: 'POS terminals',
      labelKey: 'soanas_pos.terminals.page.title',
      href: '/backend/soanas/pos/terminals',
    },
    { label: 'Create', labelKey: 'soanas_pos.terminals.create.title' },
  ],
}
