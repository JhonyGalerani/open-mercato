# 05 — Dependency Map

## Open Mercato packages (reuse)

| Package | Soanas usage |
|---------|--------------|
| `@open-mercato/core` | directory, auth, catalog, customers, sales, wms, payment_gateways, … |
| `@open-mercato/shared` | i18n, CRUD, boolean, optimistic lock helpers |
| `@open-mercato/ui` | Admin + shared primitives (POS may use subset) |
| `@open-mercato/events` | Domain events + bridges |
| `@open-mercato/queue` | Fiscal retransmit, sync, imports |
| `@open-mercato/cache` | Read caches (not POS truth) |
| `@open-mercato/webhooks` | Outbound Soanas events |
| `@open-mercato/checkout` | Payment orchestration patterns only |
| `@open-mercato/gateway-stripe` | Pattern reference for gateway packages |
| `@open-mercato/onboarding` | Wizard shell |
| `@open-mercato/ai-assistant` | Non-critical AI |
| `@open-mercato/telemetry` | Observability |
| `@open-mercato/create-app` | Standalone Soanas app scaffold |
| `@open-mercato/cli` | generate / migrate |
| `@open-mercato/search` | Admin search; POS prefers local index |

## Planned Soanas packages

| Package | Depends on (conceptual) |
|---------|-------------------------|
| `soanas-core` | shared, core (auth/directory events) |
| `soanas-establishments` | soanas-core, directory |
| `soanas-pos` | soanas-core, cash, sales, catalog, wms |
| `soanas-cash` | soanas-core, establishments |
| `soanas-offline` | soanas-core, pos, cash |
| `soanas-hardware` | soanas-core |
| `soanas-fiscal-br` | soanas-core, establishments |
| `soanas-payments-br` | soanas-core, payment_gateways |
| `soanas-restaurant` | soanas-core, pos, sales, catalog |
| `soanas-kds` | soanas-restaurant, events |
| `soanas-procurement` | soanas-core, customers, wms, fiscal-br |
| `soanas-finance` | soanas-core, sales, payments-br |
| `soanas-loyalty` | soanas-core, customers, sales |
| `soanas-delivery` | soanas-core, sales, restaurant |
| `soanas-reporting` | soanas-core + read models |
| `soanas-integrations` | soanas-core + provider adapters |
| `soanas-saas` | soanas-core, feature_toggles |

## External runtime dependencies (future)

| Concern | Candidate approach | License gate |
|---------|-------------------|--------------|
| Local DB POS | SQLite (system) / better-sqlite3 or sql.js | Prefer MIT/Apache |
| ESC/POS | Minimal MIT library or own encoder | Audit before add |
| XML fiscal | Fast XML parser MIT | Audit |
| Crypto PFX | Node crypto + forge if needed | Audit |
| Pix providers | Official APIs via adapters | N/A (integration) |

## Forbidden

| Dependency | Reason |
|------------|--------|
| `@open-mercato/enterprise` source copy | Commercial EE license contamination |
| GPL/AGPL strong copyleft in proprietary Soanas surface | Contamina estratégia proprietária |
| Card PAN storage libraries that encourage storing PAN | PCI / blueprint SEC-005 |

## Current third-party notices

See `docs/licenses/DEPENDENCY_LICENSES.md` and `THIRD_PARTY_NOTICES.md`.
