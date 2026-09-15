'use client'

import * as React from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { BooleanIcon } from '@open-mercato/ui/backend/ValueIcons'
import { Button } from '@open-mercato/ui/primitives/button'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { formatCentsAsBrl } from '../../../../lib/receipt'

type RegisterRow = {
  id: string
  code: string
  name: string
  blindClosing: boolean
  withdrawalLimitWithoutApprovalCents: string | null
  discrepancyToleranceCents: string | null
  isActive: boolean
  organizationId: string
  tenantId: string
  updatedAt: string
}

type ResponsePayload = {
  items: RegisterRow[]
  total: number
  page: number
  totalPages?: number
}

const MUTATION_CONTEXT_ID = 'soanas-cash-registers:mutation'

export default function CashRegistersPage() {
  const t = useT()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<RegisterRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)

  const { runMutation, retryLastMutation } = useGuardedMutation<{
    formId: string
    resourceKind: string
    resourceId: string
    retryLastMutation: () => Promise<boolean>
  }>({
    contextId: MUTATION_CONTEXT_ID,
    blockedMessage: t('ui.forms.flash.saveBlocked', 'Save blocked by validation'),
  })

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', '50')
      if (search) params.set('search', search)
      const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
      const call = await apiCall<ResponsePayload>(
        `/api/soanas_cash/registers?${params.toString()}`,
        undefined,
        { fallback },
      )
      if (cancelled) return
      if (!call.ok) {
        flash(t('soanas_cash.registers.flash.loadError', 'Failed to load cash registers'), 'error')
        setIsLoading(false)
        return
      }
      const payload = call.result ?? fallback
      setRows(Array.isArray(payload.items) ? payload.items : [])
      setTotal(payload.total || 0)
      setTotalPages(payload.totalPages || 1)
      setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, search, reloadToken, scopeVersion, t])

  const handleDelete = React.useCallback(
    async (row: RegisterRow) => {
      const confirmed = await confirmDialog({
        title: t('soanas_cash.registers.list.confirmDelete', 'Remove this cash register?'),
        variant: 'destructive',
      })
      if (!confirmed) return
      try {
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(buildOptimisticLockHeader(row.updatedAt), () =>
              apiCall('/api/soanas_cash/registers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: row.id }),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] soanas_cash.registers.delete failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: MUTATION_CONTEXT_ID,
            resourceKind: 'soanas_cash.cash_register',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: { id: row.id },
        })
        flash(t('soanas_cash.registers.flash.deleted', 'Cash register removed'), 'success')
        setReloadToken((token) => token + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((token) => token + 1) })) return
        flash(t('soanas_cash.registers.flash.deleteError', 'Failed to remove cash register'), 'error')
      }
    },
    [confirmDialog, retryLastMutation, runMutation, t],
  )

  const columns = React.useMemo<ColumnDef<RegisterRow>[]>(
    () => [
      {
        accessorKey: 'code',
        header: t('soanas_cash.registers.list.columns.code', 'Code'),
        cell: ({ row }) => <span className="font-mono font-medium">{row.original.code}</span>,
      },
      { accessorKey: 'name', header: t('soanas_cash.registers.list.columns.name', 'Name') },
      {
        accessorKey: 'withdrawalLimitWithoutApprovalCents',
        header: t('soanas_cash.registers.list.columns.withdrawalLimit', 'Sangria limit'),
        enableSorting: false,
        cell: ({ row }) => {
          const value = row.original.withdrawalLimitWithoutApprovalCents
          return value ? formatCentsAsBrl(value) : t('soanas_cash.registers.list.alwaysApproval', 'Always approval')
        },
      },
      {
        accessorKey: 'discrepancyToleranceCents',
        header: t('soanas_cash.registers.list.columns.tolerance', 'Tolerance'),
        enableSorting: false,
        cell: ({ row }) => formatCentsAsBrl(row.original.discrepancyToleranceCents ?? '0'),
      },
      {
        accessorKey: 'blindClosing',
        header: t('soanas_cash.registers.list.columns.blindClosing', 'Blind closing'),
        enableSorting: false,
        cell: ({ getValue }) => <BooleanIcon value={Boolean(getValue())} />,
      },
      {
        accessorKey: 'isActive',
        header: t('soanas_cash.registers.list.columns.active', 'Active'),
        enableSorting: false,
        cell: ({ getValue }) => <BooleanIcon value={Boolean(getValue())} />,
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('soanas_cash.registers.list.title', 'Cash registers')}
          columns={columns}
          data={rows}
          isLoading={isLoading}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('soanas_cash.registers.list.searchPlaceholder', 'Search by code or name')}
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          actions={
            <Button asChild>
              <Link href="/backend/soanas/cash/registers/create">
                <Plus className="mr-2 h-4 w-4" />
                {t('soanas_cash.registers.list.actions.create', 'New register')}
              </Link>
            </Button>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'session',
                  label: t('soanas_cash.registers.list.actions.session', 'Open session view'),
                  href: `/backend/soanas/cash/session?registerId=${row.id}`,
                },
                {
                  id: 'delete',
                  label: t('common.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => handleDelete(row),
                },
              ]}
            />
          )}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
