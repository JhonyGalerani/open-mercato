export const features = [
  {
    id: 'soanas_establishments.establishments.view',
    title: 'View fiscal establishments',
    module: 'soanas_establishments',
  },
  {
    id: 'soanas_establishments.establishments.create',
    title: 'Create fiscal establishments',
    module: 'soanas_establishments',
    dependsOn: ['soanas_establishments.establishments.view'],
  },
  {
    id: 'soanas_establishments.establishments.edit',
    title: 'Edit fiscal establishments',
    module: 'soanas_establishments',
    dependsOn: ['soanas_establishments.establishments.view'],
  },
  {
    id: 'soanas_establishments.establishments.delete',
    title: 'Delete fiscal establishments',
    module: 'soanas_establishments',
    dependsOn: ['soanas_establishments.establishments.view'],
  },
]

export default features
