# Soanas — Technical Roadmap

Derived from Blueprint §108 and master prompt §66–67.  
Coverage tracked in `BLUEPRINT-COVERAGE.md` (303 IDs). Contadores derivados: `node scripts/soanas-sync-status-docs.mjs`.

## Phase 0 — Foundation (done)

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

## Phase 1 — Retail POS + Cash (**current**)

1.1–1.9 Cash + POS + completeSale saga — **código pronto**  
1.10 Hardening gate (in progress on `cursor/soanas-retail-gate-validation-4347`):

- [x] Docs coverage sync (no manual counter drift)
- [x] WMS `referenceType=so` → `salesOrderId` (ADR-008)
- [x] Multi-location stock split (ADR-008)
- [x] ReceiptPrinter DI port (ADR-009)
- [ ] Migrations on ephemeral PostgreSQL
- [ ] `TC-SOANAS-RETAIL-001` green (API + stock/cash/sales asserts)
- [ ] Real DB concurrency (stock=1, two terminals)
- [ ] Crash/recovery failure injection
- [ ] Browser E2E operator path
- [ ] Retail Sale v1 → VALIDATED

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
