export const features = [
  { id: 'soanas_payments_br.pix.view', title: 'View Pix charges', module: 'soanas_payments_br' },
  {
    id: 'soanas_payments_br.pix.create',
    title: 'Create Pix charges',
    module: 'soanas_payments_br',
    dependsOn: ['soanas_payments_br.pix.view'],
  },
  {
    id: 'soanas_payments_br.pix.cancel',
    title: 'Cancel Pix charges',
    module: 'soanas_payments_br',
    dependsOn: ['soanas_payments_br.pix.view'],
  },
  {
    id: 'soanas_payments_br.pix.refund',
    title: 'Refund Pix charges',
    module: 'soanas_payments_br',
    dependsOn: ['soanas_payments_br.pix.view'],
  },
  {
    id: 'soanas_payments_br.pix.webhook',
    title: 'Receive Pix webhooks',
    module: 'soanas_payments_br',
  },
]

export default features
