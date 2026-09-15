'use client'

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Card } from '@open-mercato/ui/primitives/card'
import { Badge } from '@open-mercato/ui/primitives/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-mercato/ui/primitives/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import { LoadingMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { addCents, clampToZero, formatCentsAsBrl, subtractCents, toCents } from '../../../../lib/money'
import type { SaleReceiptDocument } from '../../../../lib/receipt'

type TerminalOption = {
  id: string
  code: string
  name: string
  cashRegisterId: string | null
  stockPolicy: string
}

type CatalogItem = {
  variantId: string
  productId: string | null
  sku: string | null
  barcode: string | null
  name: string
  unitPriceCents: string | null
}

type TransactionLine = {
  id: string
  catalogProductId: string | null
  catalogVariantId: string | null
  sku: string
  nameSnapshot: string
  quantity: string
  unitPriceCents: string
  discountAmountCents: string
  lineTotalCents: string
}

type TransactionDetail = {
  id: string
  status: string
  terminalId: string
  cashSessionId: string | null
  customerId: string | null
  salesOrderId: string | null
  subtotalCents: string
  discountTotalCents: string
  grandTotalCents: string
  amountPaidCents: string
  changeAmountCents: string
  lines: TransactionLine[]
  tenders: Array<{
    id: string
    type: string
    amountAppliedCents: string
    amountReceivedCents: string | null
    changeAmountCents: string | null
  }>
  recovery: {
    lastStep: string
    errorCode: string | null
    errorMessage: string | null
  } | null
}

type CompleteResult = {
  status: string | null
  receipt: SaleReceiptDocument | null
}

const MUTATION_CONTEXT_ID = 'soanas-pos-sell:mutation'
const RECOVERABLE_STATUSES = new Set(['COMPLETING', 'FAILED_RECOVERABLE', 'SYNC_PENDING'])

/** Operator input is in reais; everything leaving this page is integer centavos. */
function reaisToCents(value: string): string | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  return String(BigInt(`${whole}${fraction.padEnd(2, '0')}`))
}

function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export default function PosSellPage() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()

  const [terminals, setTerminals] = React.useState<TerminalOption[]>([])
  const [terminalId, setTerminalId] = React.useState('')
  const [cashSessionId, setCashSessionId] = React.useState('')
  const [transactionId, setTransactionId] = React.useState<string | null>(null)
  const [transaction, setTransaction] = React.useState<TransactionDetail | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const [searchTerm, setSearchTerm] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<CatalogItem[]>([])
  const [isSearching, setIsSearching] = React.useState(false)

  const [customerId, setCustomerId] = React.useState('')
  const [cartDiscount, setCartDiscount] = React.useState('')

  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [amountReceived, setAmountReceived] = React.useState('')
  const [receipt, setReceipt] = React.useState<SaleReceiptDocument | null>(null)

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
    async function loadTerminals() {
      const fallback = { items: [] as TerminalOption[] }
      const call = await apiCall<{ items: TerminalOption[] }>(
        '/api/soanas_pos/terminals?pageSize=100&status=active',
        undefined,
        { fallback },
      )
      if (cancelled) return
      if (!call.ok) {
        flash(t('soanas_pos.terminals.flash.loadError', 'Failed to load POS terminals'), 'error')
        return
      }
      const items = call.result?.items ?? []
      setTerminals(items)
      setTerminalId((previous) => previous || items[0]?.id || '')
    }
    loadTerminals()
    return () => {
      cancelled = true
    }
  }, [scopeVersion, t])

  const reloadTransaction = React.useCallback(
    async (id: string) => {
      setIsLoading(true)
      const call = await apiCall<TransactionDetail>(`/api/soanas_pos/transactions/${id}`, undefined, {
        fallback: null as unknown as TransactionDetail,
      })
      setIsLoading(false)
      if (!call.ok || !call.result) {
        flash(t('soanas_pos.errors.detail_failed', 'Failed to load the POS transaction'), 'error')
        return
      }
      setTransaction(call.result)
      setCustomerId(call.result.customerId ?? '')
    },
    [t],
  )

  const runPosMutation = React.useCallback(
    async <TPayload,>(args: {
      url: string
      method?: 'POST' | 'PUT' | 'DELETE'
      body: Record<string, unknown>
      resourceId: string
      successMessage?: string
    }): Promise<TPayload | null> => {
      try {
        const call = await runMutation({
          operation: async () => {
            const response = await apiCall<TPayload>(args.url, {
              method: args.method ?? 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(args.body),
            })
            if (!response.ok) {
              throw Object.assign(new Error('[internal] soanas_pos mutation failed'), {
                status: response.status,
                ...((response.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return response
          },
          context: {
            formId: MUTATION_CONTEXT_ID,
            resourceKind: 'soanas_pos.pos_transaction',
            resourceId: args.resourceId,
            retryLastMutation,
          },
          mutationPayload: args.body,
        })
        if (args.successMessage) flash(args.successMessage, 'success')
        return (call?.result ?? null) as TPayload | null
      } catch (error) {
        const message =
          (error as { error?: string } | null)?.error ??
          t('soanas_pos.sell.flash.error', 'The POS operation failed')
        flash(message, 'error')
        return null
      }
    },
    [retryLastMutation, runMutation, t],
  )

  const handleStartSale = React.useCallback(async () => {
    if (!terminalId) return
    const result = await runPosMutation<{ id: string }>({
      url: '/api/soanas_pos/transactions',
      body: {
        terminalId,
        ...(cashSessionId.trim() ? { cashSessionId: cashSessionId.trim() } : {}),
        idempotencyKey: newIdempotencyKey('pos-tx'),
      },
      resourceId: terminalId,
      successMessage: t('soanas_pos.sell.flash.started', 'Sale started'),
    })
    if (!result?.id) return
    setReceipt(null)
    setTransactionId(result.id)
    await reloadTransaction(result.id)
  }, [cashSessionId, reloadTransaction, runPosMutation, t, terminalId])

  const handleSearch = React.useCallback(async () => {
    setIsSearching(true)
    const params = new URLSearchParams()
    if (searchTerm.trim()) params.set('search', searchTerm.trim())
    params.set('pageSize', '20')
    const call = await apiCall<{ items: CatalogItem[] }>(
      `/api/soanas_pos/catalog/search?${params.toString()}`,
      undefined,
      { fallback: { items: [] } },
    )
    setIsSearching(false)
    if (!call.ok) {
      flash(t('soanas_pos.errors.catalog_search_failed', 'Failed to search the catalog'), 'error')
      return
    }
    setSearchResults(call.result?.items ?? [])
  }, [searchTerm, t])

  const handleAddLine = React.useCallback(
    async (item: CatalogItem) => {
      if (!transactionId) return
      if (!item.unitPriceCents) {
        flash(t('soanas_pos.sell.flash.error', 'The POS operation failed'), 'error')
        return
      }
      const done = await runPosMutation<{ id: string }>({
        url: `/api/soanas_pos/transactions/${transactionId}/lines`,
        body: {
          catalogVariantId: item.variantId,
          catalogProductId: item.productId,
          sku: item.sku ?? item.variantId,
          nameSnapshot: item.name,
          quantity: '1',
          unitPriceCents: item.unitPriceCents,
        },
        resourceId: transactionId,
        successMessage: t('soanas_pos.sell.flash.lineAdded', 'Item added'),
      })
      if (done) await reloadTransaction(transactionId)
    },
    [reloadTransaction, runPosMutation, t, transactionId],
  )

  const handleUpdateQuantity = React.useCallback(
    async (line: TransactionLine, quantity: string) => {
      if (!transactionId) return
      if (!/^\d+(\.\d{1,4})?$/.test(quantity) || Number(quantity) <= 0) return
      const done = await runPosMutation({
        url: `/api/soanas_pos/transactions/${transactionId}/lines`,
        method: 'PUT',
        body: { lineId: line.id, quantity },
        resourceId: transactionId,
      })
      if (done) await reloadTransaction(transactionId)
    },
    [reloadTransaction, runPosMutation, transactionId],
  )

  const handleRemoveLine = React.useCallback(
    async (line: TransactionLine) => {
      if (!transactionId) return
      const done = await runPosMutation({
        url: `/api/soanas_pos/transactions/${transactionId}/lines`,
        method: 'DELETE',
        body: { lineId: line.id },
        resourceId: transactionId,
        successMessage: t('soanas_pos.sell.flash.lineRemoved', 'Item removed'),
      })
      if (done) await reloadTransaction(transactionId)
    },
    [reloadTransaction, runPosMutation, t, transactionId],
  )

  const handleAttachCustomer = React.useCallback(async () => {
    if (!transactionId) return
    const done = await runPosMutation({
      url: `/api/soanas_pos/transactions/${transactionId}/customer`,
      body: { customerId: customerId.trim() || null },
      resourceId: transactionId,
    })
    if (done) await reloadTransaction(transactionId)
  }, [customerId, reloadTransaction, runPosMutation, transactionId])

  const handleApplyDiscount = React.useCallback(async () => {
    if (!transactionId) return
    const cents = reaisToCents(cartDiscount)
    if (cents === null) {
      flash(t('soanas_pos.errors.invalid_payload', 'Invalid payload'), 'error')
      return
    }
    const done = await runPosMutation({
      url: `/api/soanas_pos/transactions/${transactionId}/discount`,
      body: { scope: 'cart', amountCents: cents },
      resourceId: transactionId,
    })
    if (done) await reloadTransaction(transactionId)
  }, [cartDiscount, reloadTransaction, runPosMutation, t, transactionId])

  const handleCheckout = React.useCallback(async () => {
    if (!transactionId) return
    const done = await runPosMutation({
      url: `/api/soanas_pos/transactions/${transactionId}/checkout`,
      body: {},
      resourceId: transactionId,
      successMessage: t('soanas_pos.sell.flash.checkedOut', 'Ready for payment'),
    })
    if (!done) return
    await reloadTransaction(transactionId)
    setPaymentOpen(true)
  }, [reloadTransaction, runPosMutation, t, transactionId])

  const handleRegisterCash = React.useCallback(async () => {
    if (!transactionId) return
    const cents = reaisToCents(amountReceived)
    if (cents === null) {
      flash(t('soanas_pos.errors.invalid_payload', 'Invalid payload'), 'error')
      return
    }
    const done = await runPosMutation({
      url: `/api/soanas_pos/transactions/${transactionId}/tenders/cash`,
      body: { amountReceivedCents: cents, idempotencyKey: newIdempotencyKey('pos-cash') },
      resourceId: transactionId,
      successMessage: t('soanas_pos.sell.flash.paid', 'Payment registered'),
    })
    if (!done) return
    setAmountReceived('')
    setPaymentOpen(false)
    await reloadTransaction(transactionId)
  }, [amountReceived, reloadTransaction, runPosMutation, t, transactionId])

  const handleComplete = React.useCallback(
    async (mode: 'complete' | 'recover') => {
      if (!transactionId) return
      const result = await runPosMutation<CompleteResult>({
        url: `/api/soanas_pos/transactions/${transactionId}/${mode}`,
        body: {},
        resourceId: transactionId,
        successMessage: t('soanas_pos.sell.flash.completed', 'Sale completed'),
      })
      await reloadTransaction(transactionId)
      if (result?.receipt) setReceipt(result.receipt)
    },
    [reloadTransaction, runPosMutation, t, transactionId],
  )

  const handleCancel = React.useCallback(async () => {
    if (!transactionId) return
    const done = await runPosMutation({
      url: `/api/soanas_pos/transactions/${transactionId}/cancel`,
      body: {},
      resourceId: transactionId,
      successMessage: t('soanas_pos.sell.flash.cancelled', 'Sale cancelled'),
    })
    if (done) await reloadTransaction(transactionId)
  }, [reloadTransaction, runPosMutation, t, transactionId])

  const remainingDueCents = transaction
    ? clampToZero(subtractCents(transaction.grandTotalCents, transaction.amountPaidCents))
    : 0n
  const receivedCents = reaisToCents(amountReceived)
  const previewChangeCents = receivedCents
    ? clampToZero(subtractCents(receivedCents, remainingDueCents))
    : 0n
  const linesTotalCents = transaction
    ? addCents(...(transaction.lines.length ? transaction.lines.map((line) => line.lineTotalCents) : ['0']))
    : 0n
  const status = transaction?.status ?? null
  const canEditCart = status === 'DRAFT'
  const canPay = status === 'CHECKOUT' || status === 'PAYMENT_PENDING'
  const canComplete = status === 'PAID'
  const canRecover = !!status && RECOVERABLE_STATUSES.has(status)

  return (
    <Page>
      <PageBody>
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label htmlFor="soanas-pos-terminal">
                  {t('soanas_pos.sell.terminal.label', 'Terminal')}
                </Label>
                <Select value={terminalId} onValueChange={setTerminalId} disabled={!!transactionId}>
                  <SelectTrigger id="soanas-pos-terminal">
                    <SelectValue
                      placeholder={t('soanas_pos.sell.terminal.placeholder', 'Select a terminal')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {terminals.map((terminal) => (
                      <SelectItem key={terminal.id} value={terminal.id}>
                        {terminal.code} — {terminal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="soanas-pos-session">
                  {t('soanas_pos.sell.terminal.cashSession', 'Cash session id (optional)')}
                </Label>
                <Input
                  id="soanas-pos-session"
                  value={cashSessionId}
                  disabled={!!transactionId}
                  onChange={(event) => setCashSessionId(event.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleStartSale} disabled={!terminalId || !!transactionId}>
                  {t('soanas_pos.sell.actions.start', 'Start sale')}
                </Button>
                {status ? (
                  <Badge variant="secondary">
                    {t('soanas_pos.sell.status.label', 'Status')}: {status}
                  </Badge>
                ) : null}
              </div>
            </div>
          </Card>

          {isLoading ? (
            <LoadingMessage label={t('soanas_pos.sell.loading', 'Loading the POS transaction…')} />
          ) : null}

          {transaction?.recovery?.errorMessage ? (
            <Card className="border-status-error-border bg-status-error-bg p-4">
              <p className="text-sm text-status-error-text">
                {transaction.recovery.errorCode}: {transaction.recovery.errorMessage}
              </p>
            </Card>
          ) : null}

          {transaction ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <h2 className="text-lg font-medium">
                  {t('soanas_pos.sell.search.label', 'Product search')}
                </h2>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={searchTerm}
                    placeholder={t('soanas_pos.sell.search.placeholder', 'SKU, barcode or name')}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleSearch()
                      }
                    }}
                  />
                  <Button variant="secondary" onClick={handleSearch} disabled={isSearching}>
                    {t('soanas_pos.sell.search.action', 'Search')}
                  </Button>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {searchResults.length === 0 ? (
                    <li className="text-sm text-muted-foreground">
                      {t('soanas_pos.sell.search.empty', 'No products found')}
                    </li>
                  ) : null}
                  {searchResults.map((item) => (
                    <li
                      key={item.variantId}
                      className="flex items-center justify-between gap-2 rounded-md border border-border p-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {item.sku ?? item.variantId}
                          {item.unitPriceCents ? ` · ${formatCentsAsBrl(item.unitPriceCents)}` : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canEditCart || !item.unitPriceCents}
                        onClick={() => handleAddLine(item)}
                      >
                        {t('soanas_pos.sell.search.add', 'Add')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-4">
                <h2 className="text-lg font-medium">{t('soanas_pos.sell.cart.title', 'Cart')}</h2>
                {transaction.lines.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t('soanas_pos.sell.cart.empty', 'The cart is empty')}
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2">
                    {transaction.lines.map((line) => (
                      <li key={line.id} className="rounded-md border border-border p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{line.nameSnapshot}</p>
                            <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                          </div>
                          <span className="text-sm font-medium">
                            {formatCentsAsBrl(line.lineTotalCents)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Input
                            className="w-24"
                            inputMode="decimal"
                            defaultValue={line.quantity}
                            disabled={!canEditCart}
                            aria-label={t('soanas_pos.sell.cart.columns.quantity', 'Qty')}
                            onBlur={(event) => handleUpdateQuantity(line, event.target.value.trim())}
                          />
                          <span className="text-xs text-muted-foreground">
                            × {formatCentsAsBrl(line.unitPriceCents)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!canEditCart}
                            onClick={() => handleRemoveLine(line)}
                          >
                            {t('soanas_pos.sell.cart.remove', 'Remove')}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <dl className="mt-4 flex flex-col gap-1 text-sm">
                  <TotalRow
                    label={t('soanas_pos.sell.cart.subtotal', 'Subtotal')}
                    value={formatCentsAsBrl(linesTotalCents + toCents(transaction.discountTotalCents))}
                  />
                  <TotalRow
                    label={t('soanas_pos.sell.cart.discount', 'Discount')}
                    value={formatCentsAsBrl(transaction.discountTotalCents)}
                  />
                  <TotalRow
                    label={t('soanas_pos.sell.cart.grandTotal', 'Total')}
                    value={formatCentsAsBrl(transaction.grandTotalCents)}
                    emphasis
                  />
                  <TotalRow
                    label={t('soanas_pos.sell.payment.due', 'Amount due')}
                    value={formatCentsAsBrl(remainingDueCents)}
                  />
                  <TotalRow
                    label={t('soanas_pos.sell.payment.change', 'Change')}
                    value={formatCentsAsBrl(transaction.changeAmountCents)}
                  />
                </dl>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="soanas-pos-customer">
                      {t('soanas_pos.sell.customer.label', 'Customer id (optional)')}
                    </Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        id="soanas-pos-customer"
                        value={customerId}
                        disabled={!canEditCart}
                        onChange={(event) => setCustomerId(event.target.value)}
                      />
                      <Button variant="secondary" disabled={!canEditCart} onClick={handleAttachCustomer}>
                        {t('soanas_pos.sell.customer.apply', 'Attach customer')}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="soanas-pos-discount">
                      {t('soanas_pos.sell.discount.label', 'Cart discount (BRL)')}
                    </Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        id="soanas-pos-discount"
                        inputMode="decimal"
                        value={cartDiscount}
                        disabled={!canEditCart}
                        onChange={(event) => setCartDiscount(event.target.value)}
                      />
                      <Button variant="secondary" disabled={!canEditCart} onClick={handleApplyDiscount}>
                        {t('soanas_pos.sell.discount.apply', 'Apply discount')}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={handleCheckout} disabled={!canEditCart || transaction.lines.length === 0}>
                    {t('soanas_pos.sell.actions.checkout', 'Checkout')}
                  </Button>
                  <Button variant="secondary" onClick={() => setPaymentOpen(true)} disabled={!canPay}>
                    {t('soanas_pos.sell.payment.title', 'Cash payment')}
                  </Button>
                  <Button onClick={() => handleComplete('complete')} disabled={!canComplete}>
                    {t('soanas_pos.sell.actions.complete', 'Complete sale')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleComplete('recover')}
                    disabled={!canRecover}
                  >
                    {t('soanas_pos.sell.actions.recover', 'Retry completion')}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={status === 'COMPLETED' || status === 'CANCELLED'}
                  >
                    {t('soanas_pos.sell.actions.cancel', 'Cancel sale')}
                  </Button>
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      </PageBody>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setPaymentOpen(false)
              return
            }
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              void handleRegisterCash()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('soanas_pos.sell.payment.title', 'Cash payment')}</DialogTitle>
            <DialogDescription>
              {t('soanas_pos.sell.payment.due', 'Amount due')}: {formatCentsAsBrl(remainingDueCents)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="soanas-pos-received">
              {t('soanas_pos.sell.payment.received', 'Amount received (BRL)')}
            </Label>
            <Input
              id="soanas-pos-received"
              inputMode="decimal"
              value={amountReceived}
              onChange={(event) => setAmountReceived(event.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              {t('soanas_pos.sell.payment.change', 'Change')}: {formatCentsAsBrl(previewChangeCents)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleRegisterCash} disabled={receivedCents === null}>
              {t('soanas_pos.sell.payment.confirm', 'Register payment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(open) => (!open ? setReceipt(null) : undefined)}>
        <DialogContent
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setReceipt(null)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('soanas_pos.sell.receipt.title', 'Receipt')}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
            {receipt?.text ?? ''}
          </pre>
          <DialogFooter>
            <Button onClick={() => setReceipt(null)}>
              {t('soanas_pos.sell.receipt.close', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

function TotalRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={emphasis ? 'text-base font-semibold' : 'font-medium'}>{value}</dd>
    </div>
  )
}
