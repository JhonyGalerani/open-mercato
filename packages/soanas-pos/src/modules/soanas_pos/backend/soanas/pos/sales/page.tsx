'use client'

import * as React from 'react'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { formatCentsAsBrl } from '../../../../lib/money'

type SaleRow = {
  id: string
  terminalId: string
  status: string
  grandTotalCents: string
  amountPaidCents: string
  changeAmountCents: string
  salesOrderId: string | null
  correlationId: string
  createdAt: string
}

type ResponsePayload = {
  items: SaleRow[]
  total: number
  page: number
  totalPages?: number
}

const PAGE_SIZE = 25

export default function PosSalesPage() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<SaleRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      if (search) params.set('search', search)
      const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
      const call = await apiCall<ResponsePayload>(
        `/api/soanas_pos/transactions?${params.toString()}`,
        undefined,
        { fallback },
      )
      if (cancelled) return
      if (!call.ok) {
        flash(t('soanas_pos.sales.flash.loadError', 'Failed to load POS sales'), 'error')
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
  }, [page, search, scopeVersion, t])

  const columns = React.useMemo<ColumnDef<SaleRow>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: t('soanas_pos.sales.list.columns.createdAt', 'Date'),
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
      {
        accessorKey: 'status',
        header: t('soanas_pos.sales.list.columns.status', 'Status'),
        enableSorting: false,
        cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
      },
      {
        accessorKey: 'terminalId',
        header: t('soanas_pos.sales.list.columns.terminal', 'Terminal'),
        enableSorting: false,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.terminalId}</span>,
      },
      {
        accessorKey: 'grandTotalCents',
        header: t('soanas_pos.sales.list.columns.total', 'Total'),
        enableSorting: false,
        cell: ({ row }) => formatCentsAsBrl(row.original.grandTotalCents),
      },
      {
        accessorKey: 'amountPaidCents',
        header: t('soanas_pos.sales.list.columns.paid', 'Paid'),
        enableSorting: false,
        cell: ({ row }) => formatCentsAsBrl(row.original.amountPaidCents),
      },
      {
        accessorKey: 'salesOrderId',
        header: t('soanas_pos.sales.list.columns.salesOrder', 'Sales order'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.salesOrderId ?? t('soanas_pos.terminals.list.none', '—')}
          </span>
        ),
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('soanas_pos.sales.list.title', 'POS sales history')}
          columns={columns}
          data={rows}
          isLoading={isLoading}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('soanas_pos.sales.list.searchPlaceholder', 'Search by correlation id')}
          pagination={{ page, pageSize: PAGE_SIZE, total, totalPages, onPageChange: setPage }}
        />
      </PageBody>
    </Page>
  )
}
