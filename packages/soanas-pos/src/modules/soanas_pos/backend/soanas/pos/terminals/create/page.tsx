'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'

const LIST_HREF = '/backend/soanas/pos/terminals'

function optionalId(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
}

export default function CreatePosTerminalPage() {
  const t = useT()
  const router = useRouter()

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'identity',
        column: 1,
        title: t('soanas_pos.terminals.form.group.identity', 'Identification'),
        fields: [
          {
            id: 'code',
            type: 'text',
            label: t('soanas_pos.terminals.form.field.code', 'Code'),
            required: true,
            maxLength: 64,
          },
          {
            id: 'name',
            type: 'text',
            label: t('soanas_pos.terminals.form.field.name', 'Name'),
            required: true,
            maxLength: 255,
          },
          {
            id: 'status',
            type: 'select',
            label: t('soanas_pos.terminals.form.field.status', 'Status'),
            defaultValue: 'active',
            options: [
              { value: 'active', label: t('soanas_pos.terminals.status.active', 'Active') },
              { value: 'inactive', label: t('soanas_pos.terminals.status.inactive', 'Inactive') },
            ],
          },
        ],
      },
      {
        id: 'operations',
        column: 2,
        title: t('soanas_pos.terminals.form.group.operations', 'Operations'),
        fields: [
          {
            id: 'warehouseId',
            type: 'text',
            label: t('soanas_pos.terminals.form.field.warehouseId', 'Warehouse id'),
          },
          {
            id: 'salesChannelId',
            type: 'text',
            label: t('soanas_pos.terminals.form.field.salesChannelId', 'Sales channel id'),
          },
          {
            id: 'priceKindId',
            type: 'text',
            label: t('soanas_pos.terminals.form.field.priceKindId', 'Price kind id'),
          },
          {
            id: 'cashRegisterId',
            type: 'text',
            label: t('soanas_pos.terminals.form.field.cashRegisterId', 'Cash register id'),
          },
          {
            id: 'stockPolicy',
            type: 'select',
            label: t('soanas_pos.terminals.form.field.stockPolicy', 'Stock policy'),
            helpText: t(
              'soanas_pos.terminals.form.field.stockPolicyHelp',
              'BLOCK refuses a sale without stock. WARN needs an approval. ALLOW is disabled until WMS supports negative stock.',
            ),
            defaultValue: 'BLOCK',
            options: [
              { value: 'BLOCK', label: 'BLOCK' },
              { value: 'WARN', label: 'WARN' },
            ],
          },
        ],
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('soanas_pos.terminals.create.title', 'Create POS terminal')}
          backHref={LIST_HREF}
          fields={[]}
          groups={groups}
          submitLabel={t('soanas_pos.terminals.form.action.create', 'Create terminal')}
          cancelHref={LIST_HREF}
          onSubmit={async (values) => {
            const code = String(values.code || '').trim()
            const name = String(values.name || '').trim()
            if (!code || !name) {
              throw createCrudFormError(
                t('soanas_pos.terminals.form.errors.required', 'Code and name are required'),
              )
            }
            const requestedPolicy = String(values.stockPolicy || 'BLOCK')
            await createCrud('soanas_pos/terminals', {
              code,
              name,
              status: values.status === 'inactive' ? 'inactive' : 'active',
              stockPolicy: requestedPolicy === 'ALLOW' ? 'BLOCK' : requestedPolicy,
              warehouseId: optionalId(values.warehouseId),
              salesChannelId: optionalId(values.salesChannelId),
              priceKindId: optionalId(values.priceKindId),
              cashRegisterId: optionalId(values.cashRegisterId),
            })
            flash(t('soanas_pos.terminals.flash.created', 'POS terminal created'), 'success')
            router.push(LIST_HREF)
          }}
        />
      </PageBody>
    </Page>
  )
}
