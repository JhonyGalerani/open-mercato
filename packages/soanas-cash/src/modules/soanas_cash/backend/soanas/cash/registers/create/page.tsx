'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'

const LIST_HREF = '/backend/soanas/cash/registers'

/** Reais typed by the user become bigint centavos before they reach the API. */
function toCentsOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(',', '.')
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount < 0) return null
  return String(Math.round(amount * 100))
}

export default function CreateCashRegisterPage() {
  const t = useT()
  const router = useRouter()

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'identity',
        column: 1,
        title: t('soanas_cash.registers.form.group.identity', 'Identification'),
        fields: [
          {
            id: 'code',
            type: 'text',
            label: t('soanas_cash.registers.form.field.code', 'Code'),
            required: true,
            maxLength: 64,
          },
          {
            id: 'name',
            type: 'text',
            label: t('soanas_cash.registers.form.field.name', 'Name'),
            required: true,
            maxLength: 255,
          },
          {
            id: 'isActive',
            type: 'checkbox',
            label: t('soanas_cash.registers.form.field.isActive', 'Active'),
            defaultValue: true,
          },
        ],
      },
      {
        id: 'policy',
        column: 2,
        title: t('soanas_cash.registers.form.group.policy', 'Cash policy'),
        fields: [
          {
            id: 'blindClosing',
            type: 'checkbox',
            label: t('soanas_cash.registers.form.field.blindClosing', 'Blind closing'),
            helpText: t(
              'soanas_cash.registers.form.field.blindClosingHelp',
              'The operator counts without seeing the expected amount.',
            ),
          },
          {
            id: 'withdrawalLimit',
            type: 'text',
            label: t('soanas_cash.registers.form.field.withdrawalLimit', 'Sangria limit without approval (BRL)'),
            helpText: t(
              'soanas_cash.registers.form.field.withdrawalLimitHelp',
              'Leave empty to require approval for every withdrawal.',
            ),
          },
          {
            id: 'supplyLimit',
            type: 'text',
            label: t('soanas_cash.registers.form.field.supplyLimit', 'Supply limit without approval (BRL)'),
          },
          {
            id: 'tolerance',
            type: 'text',
            label: t('soanas_cash.registers.form.field.tolerance', 'Discrepancy tolerance (BRL)'),
            defaultValue: '0',
          },
          {
            id: 'expectedOpeningFloat',
            type: 'text',
            label: t('soanas_cash.registers.form.field.expectedOpeningFloat', 'Expected opening float (BRL)'),
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
          title={t('soanas_cash.registers.create.title', 'Create cash register')}
          backHref={LIST_HREF}
          fields={[]}
          groups={groups}
          submitLabel={t('soanas_cash.registers.form.action.create', 'Create register')}
          cancelHref={LIST_HREF}
          onSubmit={async (values) => {
            const code = String(values.code || '').trim()
            const name = String(values.name || '').trim()
            if (!code || !name) {
              throw createCrudFormError(
                t('soanas_cash.registers.form.errors.required', 'Code and name are required'),
              )
            }
            const tolerance = toCentsOrNull(values.tolerance) ?? '0'
            await createCrud('soanas_cash/registers', {
              code,
              name,
              isActive: values.isActive !== false,
              blindClosing: !!values.blindClosing,
              withdrawalLimitWithoutApprovalCents: toCentsOrNull(values.withdrawalLimit),
              supplyLimitWithoutApprovalCents: toCentsOrNull(values.supplyLimit),
              discrepancyToleranceCents: tolerance,
              expectedOpeningFloatCents: toCentsOrNull(values.expectedOpeningFloat),
            })
            flash(t('soanas_cash.registers.flash.created', 'Cash register created'), 'success')
            router.push(LIST_HREF)
          }}
        />
      </PageBody>
    </Page>
  )
}
