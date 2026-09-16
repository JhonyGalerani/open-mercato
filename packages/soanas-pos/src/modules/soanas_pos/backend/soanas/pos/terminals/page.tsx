'use client'

import * as React from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'

type TerminalRow = {
  id: string
  code: string
  name: string
  warehouseId: string | null
  cashRegisterId: string | null
  stockPolicy: string
  status: string
  updatedAt: string
}

type ResponsePayload = {
  items: TerminalRow[]
  total: number
  page: number
  totalPages?: number
}

const MUTATION_CONTEXT_ID = 'soanas-pos-terminals:mutation'

export default function PosTerminalsPage() {
  const t = useT()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<TerminalRow[]>([])
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
        `/api/soanas_pos/terminals?${params.toString()}`,
        undefined,
        { fallback },
      )
      if (cancelled) return
      if (!call.ok) {
        flash(t('soanas_pos.terminals.flash.loadError', 'Failed to load POS terminals'), 'error')
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
    async (row: TerminalRow) => {
      const confirmed = await confirmDialog({
        title: t('soanas_pos.terminals.list.confirmDelete', 'Remove this POS terminal?'),
        variant: 'destructive',
      })
      if (!confirmed) return
      try {
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(buildOptimisticLockHeader(row.updatedAt), () =>
              apiCall('/api/soanas_pos/terminals', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: row.id }),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] soanas_pos.terminals.delete failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: MUTATION_CONTEXT_ID,
            resourceKind: 'soanas_pos.pos_terminal',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: { id: row.id },
        })
        flash(t('soanas_pos.terminals.flash.deleted', 'POS terminal removed'), 'success')
        setReloadToken((token) => token + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((token) => token + 1) })) return
        flash(t('soanas_pos.terminals.flash.deleteError', 'Failed to remove the POS terminal'), 'error')
      }
    },
    [confirmDialog, retryLastMutation, runMutation, t],
  )

  const columns = React.useMemo<ColumnDef<TerminalRow>[]>(
    () => [
      {
        accessorKey: 'code',
        header: t('soanas_pos.terminals.list.columns.code', 'Code'),
        cell: ({ row }) => <span className="font-mono font-medium">{row.original.code}</span>,
      },
      { accessorKey: 'name', header: t('soanas_pos.terminals.list.columns.name', 'Name') },
      {
        accessorKey: 'warehouseId',
        header: t('soanas_pos.terminals.list.columns.warehouse', 'Warehouse'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.warehouseId ?? t('soanas_pos.terminals.list.none', '—')}
          </span>
        ),
      },
      {
        accessorKey: 'cashRegisterId',
        header: t('soanas_pos.terminals.list.columns.cashRegister', 'Cash register'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.cashRegisterId ?? t('soanas_pos.terminals.list.none', '—')}
          </span>
        ),
      },
      {
        accessorKey: 'stockPolicy',
        header: t('soanas_pos.terminals.list.columns.stockPolicy', 'Stock policy'),
        enableSorting: false,
      },
      {
        accessorKey: 'status',
        header: t('soanas_pos.terminals.list.columns.status', 'Status'),
        enableSorting: false,
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('soanas_pos.terminals.list.title', 'POS terminals')}
          columns={columns}
          data={rows}
          isLoading={isLoading}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('soanas_pos.terminals.list.searchPlaceholder', 'Search by code or name')}
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          actions={
            <Button asChild>
              <Link href="/backend/soanas/pos/terminals/create">
                <Plus className="mr-2 h-4 w-4" />
                {t('soanas_pos.terminals.list.actions.create', 'New terminal')}
              </Link>
            </Button>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'sell',
                  label: t('soanas_pos.terminals.list.actions.sell', 'Open POS'),
                  href: `/backend/soanas/pos/sell?terminalId=${row.id}`,
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
