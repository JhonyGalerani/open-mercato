# ADR-004 — Fiscal BR isolated and versioned

**Status:** Accepted  
**Date:** 2026-09-15

## Context

Brazilian e-invoicing (NFC-e/NF-e/NFS-e), certificates, and 2026 IBS/CBS rules must not leak into Mercato generic tax tables or POS UI.

## Decision

- Package `soanas-fiscal-br` owns TaxEngine, FiscalRule (effective dating), FiscalDocument, CertificateService, SEFAZ transport adapters, contingency queue, XML storage.
- Every sale stores `TaxSnapshot`; historical documents never recalculate with new rules.
- Providers behind interfaces; mocks for CI; real SEFAZ activation may be `CERTIFICATION_PENDING`.

## Consequences

- Schema/version upgrades localized.
- POS depends on fiscal API, not SEFAZ SDK.
