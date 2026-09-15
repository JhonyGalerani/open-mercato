import { isAcceptableCnpj, normalizeCnpj } from '@open-mercato/soanas-core/lib/cnpj'
import { fiscalEstablishmentCreateSchema } from '../data/validators'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const TENANT_ID = '22222222-2222-4222-8222-222222222222'

describe('fiscalEstablishmentCreateSchema', () => {
  it('normalizes CNPJ and accepts alphanumeric values', () => {
    const parsed = fiscalEstablishmentCreateSchema.parse({
      organizationId: ORG_ID,
      tenantId: TENANT_ID,
      legalName: 'Empresa Demo LTDA',
      cnpj: '12.ABC.345/01DE-35',
    })
    expect(parsed.cnpj).toBe(normalizeCnpj('12ABC34501DE35'))
    expect(isAcceptableCnpj(parsed.cnpj)).toBe(true)
  })

  it('rejects invalid CNPJ', () => {
    expect(() =>
      fiscalEstablishmentCreateSchema.parse({
        organizationId: ORG_ID,
        tenantId: TENANT_ID,
        legalName: 'Empresa Demo LTDA',
        cnpj: '123',
      }),
    ).toThrow()
  })
})
