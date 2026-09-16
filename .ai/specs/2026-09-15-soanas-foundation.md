# Soanas Phase 0 — Foundation

**Date:** 2026-09-15  
**Status:** In progress (docs complete; implementation pending)  
**Coverage IDs:** TENANT-*, EST-*, AUTH-*, ARCH-*, CAT-FISCAL-* (fields), CRM-003/004, SAAS-001 (flags), ONB-001 (skeleton)

## TLDR

Scaffold Soanas product layer on Open Mercato 0.7.0 without modifying core domain modules: packages, FiscalEstablishment, ACL seeds, feature flags, BR catalog/CRM field extensions, demo seed hooks.

## Problem Statement

The Blueprint requires a Brazilian retail/restaurant product. The monorepo has strong ERP foundations but zero Soanas code. Jumping into POS UI without foundation causes tenant/fiscal/ACL inconsistency.

## Scope

- `soanas-core`, `soanas-establishments` packages
- Module registration in app
- FiscalEstablishment entity + CRUD API
- Soanas role/feature ACL seeds
- Feature toggles for soanas_* modules
- Custom fields / validators for BR customer/product fiscal basics
- Documentation + coverage updates

## Out of scope (later phases)

- POS UI, cash ledger runtime, NFC-e transmission, offline DB, restaurant, procurement

## Proposed Solution

Follow ADR-001…006. Establishments hold BR fiscal identity; Organization remains hierarchy node. Commands/events for establishment lifecycle. Idempotent setup seeds.

## Architecture

```
apps/mercato (modules.ts)
  → @open-mercato/soanas-core (soanas_core)
  → @open-mercato/soanas-establishments (soanas_establishments)
       → references organizationId, tenantId
       → no ORM relation to Organization entity class across modules
```

## Data Models (Phase 0)

### FiscalEstablishment

- id (uuid), tenant_id, organization_id
- legal_name, trade_name, cnpj (string), ie, im
- primary_cnae, secondary_cnaes (json)
- crt, special_regime
- ibge_city_code, uf, address fields, zip, phone, fiscal_email
- accountant_name, accountant_crc
- fiscal_environment (homologation|production)
- default_warehouse_id, default_price_kind, default_sales_channel_id
- nfce_series, nfe_series, nfce_number, nfe_number
- nfce_csc_id (secret ref), certificate_id (ref)
- timezone, currency_code (BRL)
- policies json (negative_stock, cash, discounts, cancellations)
- created_at, updated_at, deleted_at, is_active

## API Contracts (planned)

- `GET/POST /api/soanas_establishments/establishments`
- `GET/PUT/DELETE /api/soanas_establishments/establishments/:id`
- Features: `soanas_establishments.establishments.view|create|edit|delete`

## Events

- `soanas.establishment.created|updated|activated|deactivated` (v1)

## Permissions

Seed profiles mapping to AUTH-005 list; POS permissions stubbed as features even before POS UI.

## Risks

See RISK-001, RISK-009, RISK-010.

## Tests

- Unit: CNPJ alphanumeric validator
- Integration: create establishment scoped to tenant/org; cross-tenant denied
- Setup seed idempotency

## Changelog

| Date | Note |
|------|------|
| 2026-09-15 | Spec created post-audit |
