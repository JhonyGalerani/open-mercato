export const features = [
  { id: 'soanas_cash.registers.view', title: 'View cash registers', module: 'soanas_cash' },
  { id: 'soanas_cash.registers.manage', title: 'Manage cash registers', module: 'soanas_cash', dependsOn: ['soanas_cash.registers.view'] },
  { id: 'soanas_cash.drawers.view', title: 'View cash drawers', module: 'soanas_cash' },
  { id: 'soanas_cash.drawers.manage', title: 'Manage cash drawers', module: 'soanas_cash', dependsOn: ['soanas_cash.drawers.view'] },
  { id: 'soanas_cash.sessions.view', title: 'View cash sessions', module: 'soanas_cash' },
  { id: 'soanas_cash.sessions.open', title: 'Open cash session', module: 'soanas_cash', dependsOn: ['soanas_cash.sessions.view'] },
  { id: 'soanas_cash.sessions.close', title: 'Close cash session', module: 'soanas_cash', dependsOn: ['soanas_cash.sessions.view'] },
  { id: 'soanas_cash.withdrawals.create', title: 'Create cash withdrawal (sangria)', module: 'soanas_cash' },
  { id: 'soanas_cash.supplies.create', title: 'Create cash supply', module: 'soanas_cash' },
  { id: 'soanas_cash.movements.reverse', title: 'Reverse cash movement', module: 'soanas_cash' },
  { id: 'soanas_cash.movements.record_sale', title: 'Record cash sale movement', module: 'soanas_cash' },
  { id: 'soanas_cash.counts.create', title: 'Record cash count', module: 'soanas_cash', dependsOn: ['soanas_cash.sessions.view'] },
  { id: 'soanas_cash.reconciliations.view', title: 'View cash reconciliations', module: 'soanas_cash', dependsOn: ['soanas_cash.sessions.view'] },
  { id: 'soanas_cash.approvals.manage', title: 'Approve cash movements and discrepancies', module: 'soanas_cash' },
]

export default features
