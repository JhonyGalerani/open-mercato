'use client'

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Card } from '@open-mercato/ui/primitives/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-mercato/ui/primitives/select'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { formatCentsAsBrl } from '../../../../lib/receipt'

type RegisterOption = {
  id: string
  code: string
  name: string
}

type CurrentSessionPayload = {
  register: {
    id: string
    code: string
    name: string
    blindClosing: boolean
    discrepancyToleranceCents: string
    expectedOpeningFloatCents: string | null
  } | null
  session: {
    id: string
    status: string
    openingFloatCents: string
    openedAtServer: string
    operatorUserId: string
    blind: boolean
  } | null
  totals?: {
    salesCents: string
    suppliesCents: string
    withdrawalsCents: string
    refundsCents: string
    expectedCashCents?: string
  }
  movements?: Array<{
    id: string
    type: string
    status: string
    amountCents: string
    createdAt: string
  }>
}

const MUTATION_CONTEXT_ID = 'soanas-cash-session:mutation'

function toCents(value: string): string | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount < 0) return null
  return String(Math.round(amount * 100))
}

function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export default function CashSessionPage() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [registers, setRegisters] = React.useState<RegisterOption[]>([])
  const [registerId, setRegisterId] = React.useState('')
  const [current, setCurrent] = React.useState<CurrentSessionPayload | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)

  const [openingFloat, setOpeningFloat] = React.useState('')
  const [withdrawalAmount, setWithdrawalAmount] = React.useState('')
  const [withdrawalApprover, setWithdrawalApprover] = React.useState('')
  const [supplyAmount, setSupplyAmount] = React.useState('')
  const [countedAmount, setCountedAmount] = React.useState('')

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
    async function loadRegisters() {
      const fallback = { items: [] as RegisterOption[] }
      const call = await apiCall<{ items: RegisterOption[] }>(
        '/api/soanas_cash/registers?pageSize=100&isActive=true',
        undefined,
        { fallback },
      )
      if (cancelled) return
      if (!call.ok) {
        setLoadError(t('soanas_cash.registers.flash.loadError', 'Failed to load cash registers'))
        setIsLoading(false)
        return
      }
      const items = call.result?.items ?? []
      setRegisters(items)
      setRegisterId((previous) => previous || items[0]?.id || '')
      if (items.length === 0) setIsLoading(false)
    }
    loadRegisters()
    return () => {
      cancelled = true
    }
  }, [scopeVersion, t])

  React.useEffect(() => {
    if (!registerId) return
    let cancelled = false
    async function loadSession() {
      setIsLoading(true)
      setLoadError(null)
      const call = await apiCall<CurrentSessionPayload>(
        `/api/soanas_cash/sessions/current?registerId=${registerId}`,
        undefined,
        { fallback: { register: null, session: null } },
      )
      if (cancelled) return
      if (!call.ok) {
        setLoadError(t('soanas_cash.session.flash.loadError', 'Failed to load the cash session'))
      } else {
        setCurrent(call.result ?? null)
      }
      setIsLoading(false)
    }
    loadSession()
    return () => {
      cancelled = true
    }
  }, [registerId, reloadToken, scopeVersion, t])

  const runCashMutation = React.useCallback(
    async (args: {
      url: string
      body: Record<string, unknown>
      resourceId: string
      successMessage: string
      errorMessage: string
    }) => {
      try {
        await runMutation({
          operation: async () => {
            const call = await apiCall(args.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(args.body),
            })
            if (!call.ok) {
              throw Object.assign(new Error('[internal] soanas_cash mutation failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: MUTATION_CONTEXT_ID,
            resourceKind: 'soanas_cash.cash_session',
            resourceId: args.resourceId,
            retryLastMutation,
          },
          mutationPayload: args.body,
        })
        flash(args.successMessage, 'success')
        setReloadToken((token) => token + 1)
        return true
      } catch {
        flash(args.errorMessage, 'error')
        return false
      }
    },
    [retryLastMutation, runMutation],
  )

  const handleOpen = React.useCallback(async () => {
    const cents = toCents(openingFloat)
    if (cents === null) {
      flash(t('soanas_cash.session.errors.invalidAmount', 'Enter a valid amount'), 'error')
      return
    }
    const done = await runCashMutation({
      url: '/api/soanas_cash/sessions/open',
      body: {
        registerId,
        openingFloatCents: cents,
        idempotencyKey: newIdempotencyKey('open'),
      },
      resourceId: registerId,
      successMessage: t('soanas_cash.session.flash.opened', 'Cash session opened'),
      errorMessage: t('soanas_cash.session.flash.openError', 'Failed to open the cash session'),
    })
    if (done) setOpeningFloat('')
  }, [openingFloat, registerId, runCashMutation, t])

  const handleWithdrawal = React.useCallback(async () => {
    const sessionId = current?.session?.id
    const cents = toCents(withdrawalAmount)
    if (!sessionId || cents === null) {
      flash(t('soanas_cash.session.errors.invalidAmount', 'Enter a valid amount'), 'error')
      return
    }
    const done = await runCashMutation({
      url: '/api/soanas_cash/withdrawals',
      body: {
        sessionId,
        amountCents: cents,
        reasonCode: 'excess_cash',
        destination: 'safe',
        ...(withdrawalApprover.trim() ? { approverUserId: withdrawalApprover.trim() } : {}),
        idempotencyKey: newIdempotencyKey('sangria'),
      },
      resourceId: sessionId,
      successMessage: t('soanas_cash.session.flash.withdrawalCreated', 'Withdrawal registered'),
      errorMessage: t('soanas_cash.session.flash.withdrawalError', 'Failed to register the withdrawal'),
    })
    if (done) {
      setWithdrawalAmount('')
      setWithdrawalApprover('')
    }
  }, [current?.session?.id, runCashMutation, t, withdrawalAmount, withdrawalApprover])

  const handleSupply = React.useCallback(async () => {
    const sessionId = current?.session?.id
    const cents = toCents(supplyAmount)
    if (!sessionId || cents === null) {
      flash(t('soanas_cash.session.errors.invalidAmount', 'Enter a valid amount'), 'error')
      return
    }
    const done = await runCashMutation({
      url: '/api/soanas_cash/supplies',
      body: {
        sessionId,
        amountCents: cents,
        origin: 'treasury',
        reasonCode: 'change_fund',
        idempotencyKey: newIdempotencyKey('suprimento'),
      },
      resourceId: sessionId,
      successMessage: t('soanas_cash.session.flash.supplyCreated', 'Supply registered'),
      errorMessage: t('soanas_cash.session.flash.supplyError', 'Failed to register the supply'),
    })
    if (done) setSupplyAmount('')
  }, [current?.session?.id, runCashMutation, supplyAmount, t])

  const handleSpotCount = React.useCallback(async () => {
    const sessionId = current?.session?.id
    const cents = toCents(countedAmount)
    if (!sessionId || cents === null) {
      flash(t('soanas_cash.session.errors.invalidAmount', 'Enter a valid amount'), 'error')
      return
    }
    await runCashMutation({
      url: '/api/soanas_cash/counts',
      body: { sessionId, kind: 'spot', totalCountedCents: cents },
      resourceId: sessionId,
      successMessage: t('soanas_cash.session.flash.countRecorded', 'Count recorded'),
      errorMessage: t('soanas_cash.session.flash.countError', 'Failed to record the count'),
    })
  }, [countedAmount, current?.session?.id, runCashMutation, t])

  const handleClose = React.useCallback(async () => {
    const sessionId = current?.session?.id
    const cents = toCents(countedAmount)
    if (!sessionId || cents === null) {
      flash(t('soanas_cash.session.errors.invalidAmount', 'Enter a valid amount'), 'error')
      return
    }
    const done = await runCashMutation({
      url: '/api/soanas_cash/sessions/close',
      body: {
        sessionId,
        countedCashCents: cents,
        idempotencyKey: newIdempotencyKey('close'),
      },
      resourceId: sessionId,
      successMessage: t('soanas_cash.session.flash.closed', 'Cash session closed'),
      errorMessage: t('soanas_cash.session.flash.closeError', 'Failed to close the cash session'),
    })
    if (done) setCountedAmount('')
  }, [countedAmount, current?.session?.id, runCashMutation, t])

  const session = current?.session ?? null
  const totals = current?.totals
  const blind = session?.blind ?? current?.register?.blindClosing ?? false

  return (
    <Page>
      <PageBody>
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <Label htmlFor="soanas-cash-register">
              {t('soanas_cash.session.field.register', 'Register')}
            </Label>
            <Select value={registerId} onValueChange={setRegisterId}>
              <SelectTrigger id="soanas-cash-register">
                <SelectValue placeholder={t('soanas_cash.session.field.register', 'Register')} />
              </SelectTrigger>
              <SelectContent>
                {registers.map((register) => (
                  <SelectItem key={register.id} value={register.id}>
                    {register.code} — {register.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {isLoading ? <LoadingMessage label={t('soanas_cash.session.loading', 'Loading cash session…')} /> : null}
          {loadError ? <ErrorMessage label={loadError} /> : null}

          {!isLoading && !loadError && !session ? (
            <Card className="p-4">
              <h2 className="text-lg font-medium">
                {t('soanas_cash.session.open.title', 'Open cash session')}
              </h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label htmlFor="soanas-cash-opening-float">
                    {t('soanas_cash.session.field.openingFloat', 'Opening float (BRL)')}
                  </Label>
                  <Input
                    id="soanas-cash-opening-float"
                    inputMode="decimal"
                    value={openingFloat}
                    onChange={(event) => setOpeningFloat(event.target.value)}
                  />
                </div>
                <Button onClick={handleOpen} disabled={!registerId}>
                  {t('soanas_cash.session.action.open', 'Open session')}
                </Button>
              </div>
            </Card>
          ) : null}

          {!isLoading && !loadError && session ? (
            <>
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-medium">
                    {t('soanas_cash.session.summary.title', 'Open session')}
                  </h2>
                  <Badge variant="secondary">{session.status}</Badge>
                  {blind ? (
                    <Badge variant="outline">
                      {t('soanas_cash.session.summary.blind', 'Blind closing')}
                    </Badge>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryItem
                    label={t('soanas_cash.session.summary.openingFloat', 'Opening float')}
                    value={formatCentsAsBrl(session.openingFloatCents)}
                  />
                  <SummaryItem
                    label={t('soanas_cash.session.summary.sales', 'Cash sales')}
                    value={formatCentsAsBrl(totals?.salesCents ?? '0')}
                  />
                  <SummaryItem
                    label={t('soanas_cash.session.summary.withdrawals', 'Withdrawals')}
                    value={formatCentsAsBrl(totals?.withdrawalsCents ?? '0')}
                  />
                  <SummaryItem
                    label={t('soanas_cash.session.summary.expected', 'Expected in drawer')}
                    value={
                      totals?.expectedCashCents
                        ? formatCentsAsBrl(totals.expectedCashCents)
                        : t('soanas_cash.session.summary.hidden', 'Hidden (blind closing)')
                    }
                  />
                </dl>
              </Card>

              <Card className="p-4">
                <h2 className="text-lg font-medium">
                  {t('soanas_cash.session.movements.title', 'Movements')}
                </h2>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="soanas-cash-withdrawal">
                      {t('soanas_cash.session.field.withdrawal', 'Withdrawal — sangria (BRL)')}
                    </Label>
                    <Input
                      id="soanas-cash-withdrawal"
                      inputMode="decimal"
                      value={withdrawalAmount}
                      onChange={(event) => setWithdrawalAmount(event.target.value)}
                    />
                    <Label htmlFor="soanas-cash-approver">
                      {t('soanas_cash.session.field.approver', 'Approver user id (when required)')}
                    </Label>
                    <Input
                      id="soanas-cash-approver"
                      value={withdrawalApprover}
                      onChange={(event) => setWithdrawalApprover(event.target.value)}
                    />
                    <Button variant="secondary" onClick={handleWithdrawal}>
                      {t('soanas_cash.session.action.withdrawal', 'Register withdrawal')}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="soanas-cash-supply">
                      {t('soanas_cash.session.field.supply', 'Supply — suprimento (BRL)')}
                    </Label>
                    <Input
                      id="soanas-cash-supply"
                      inputMode="decimal"
                      value={supplyAmount}
                      onChange={(event) => setSupplyAmount(event.target.value)}
                    />
                    <Button variant="secondary" onClick={handleSupply}>
                      {t('soanas_cash.session.action.supply', 'Register supply')}
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h2 className="text-lg font-medium">
                  {t('soanas_cash.session.close.title', 'Count and close')}
                </h2>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor="soanas-cash-counted">
                      {t('soanas_cash.session.field.counted', 'Counted cash (BRL)')}
                    </Label>
                    <Input
                      id="soanas-cash-counted"
                      inputMode="decimal"
                      value={countedAmount}
                      onChange={(event) => setCountedAmount(event.target.value)}
                    />
                  </div>
                  <Button variant="secondary" onClick={handleSpotCount}>
                    {t('soanas_cash.session.action.spotCount', 'Record spot count')}
                  </Button>
                  <Button onClick={handleClose}>
                    {t('soanas_cash.session.action.close', 'Close session')}
                  </Button>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      </PageBody>
    </Page>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium">{value}</dd>
    </div>
  )
}
