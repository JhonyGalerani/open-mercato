# Soanas — Technical Roadmap

Derived from Blueprint §108 and master prompt §66–67.  
Coverage tracked in `BLUEPRINT-COVERAGE.md` (303 IDs @ 2026-09-15).

## Phase 0 — Foundation (current)

| Subphase | Deliverable | Coverage IDs (sample) |
|----------|-------------|------------------------|
| 0.0 | Audit + coverage + ADRs + licenses | ARCH-010 |
| 0.1 | `soanas-core` package scaffold + events helpers + error model | ARCH-001…015 |
| 0.2 | `soanas-establishments` + FiscalEstablishment | EST-001…015, TENANT-015…022 |
| 0.3 | ACL/profile seeds Soanas | AUTH-005, AUTH-POS-*, AUTH-APR-* |
| 0.4 | App wiring (`modules.ts`) + feature flags | SAAS-001 partial |
| 0.5 | Catalog/CRM BR extension fields (CF) | CAT-FISCAL-*, CRM-003…004 |
| 0.6 | Demo tenant seed skeleton | ONB-001 partial |
| 0.7 | Baseline docs/runbooks stubs | — |

**Exit:** packages build, modules discoverable, coverage IDs for foundation → IMPLEMENTED/TESTED where applicable.

## Phase 1 — Retail POS + Cash

1.1 PosTerminal → 1.2 CashRegister → 1.3 CashSession → 1.4 POS cart → 1.5 PaymentTender cash/manual card → 1.6 Sangria → 1.7 Suprimento → 1.8 Closing → 1.9 Basic reports → 1.10 Hardening

## Phase 2 — Fiscal SP + Pix

Establishment fiscal → Certificate → TaxEngine → NFC-e → Contingency → Pix charge → Reconciliation → Homologation harness

## Phase 3 — Offline + Hardware

Local DB → Outbox → Sync → Device Agent → Printer/Drawer/Scanner/Scale → TEF abstraction → Failure recovery

## Phase 4 — Restaurant + KDS

Areas/Tables/Tabs → Modifiers/Recipes → Waiter PWA → KDS realtime → Service charge → Split check

## Phase 5 — Procurement + Finance

Suppliers → RFQ → PO → Goods receipt → XML in → AP/AR → Card/Pix settlement → Cost/margin

## Phase 6 — National scale

Multi-UF rules → Multi-SEFAZ → NFS-e → Accounting exports → Marketplaces

## Phase 7 — Reporting / Loyalty / SaaS scale

Read models → Loyalty → Advanced plans/quotas → Dashboards

## Phase 8 — Hardening

Perf benchmarks → Security/LGPD audit → DR drills → Final E2E §108–111 → Coverage VALIDATED gate

## Priority invariant

```
data integrity > money integrity > fiscal integrity > inventory integrity
> security > reliability > UX > visual polish > AI
```
