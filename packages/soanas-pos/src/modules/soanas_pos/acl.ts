export const features = [
  { id: 'soanas_pos.terminals.view', title: 'View POS terminals', module: 'soanas_pos' },
  {
    id: 'soanas_pos.terminals.manage',
    title: 'Manage POS terminals',
    module: 'soanas_pos',
    dependsOn: ['soanas_pos.terminals.view'],
  },
  { id: 'soanas_pos.transactions.view', title: 'View POS transactions', module: 'soanas_pos' },
  {
    id: 'soanas_pos.transactions.sell',
    title: 'Operate a POS sale',
    module: 'soanas_pos',
    dependsOn: ['soanas_pos.transactions.view'],
  },
  {
    id: 'soanas_pos.transactions.complete',
    title: 'Complete a POS sale',
    module: 'soanas_pos',
    dependsOn: ['soanas_pos.transactions.sell'],
  },
  {
    id: 'soanas_pos.transactions.cancel',
    title: 'Cancel a POS transaction',
    module: 'soanas_pos',
    dependsOn: ['soanas_pos.transactions.view'],
  },
  { id: 'soanas_pos.catalog.search', title: 'Search catalog from POS', module: 'soanas_pos' },
  { id: 'soanas_pos.discount.grant', title: 'Grant POS discounts', module: 'soanas_pos' },
  {
    id: 'soanas_pos.discount.approve',
    title: 'Approve POS discounts above the terminal limit',
    module: 'soanas_pos',
  },
  {
    id: 'soanas_pos.approval.manager',
    title: 'Authorize exceptional POS operations',
    module: 'soanas_pos',
  },
  // Legacy aliases (pre-convention `soanas.pos.*`) — kept so seeded ACLs still resolve.
  { id: 'soanas.pos.discount.grant', title: 'Grant POS discounts (legacy)', module: 'soanas_pos' },
  {
    id: 'soanas.pos.discount.approve',
    title: 'Approve POS discounts (legacy)',
    module: 'soanas_pos',
  },
  {
    id: 'soanas.pos.approval.manager',
    title: 'Authorize exceptional POS operations (legacy)',
    module: 'soanas_pos',
  },
]

export default features
