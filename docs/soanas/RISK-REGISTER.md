# Soanas — Risk Register

| ID | Description | Probability | Impact | Mitigation | Domain | Status |
|----|-------------|-------------|--------|------------|--------|--------|
| RISK-001 | Upstream merge hell via core edits | M | Extreme | soanas packages only | Architecture | Open |
| RISK-002 | Money float / rounding bugs | M | Extreme | Decimal + tests | Cash/Payments | Open |
| RISK-003 | Duplicate charges (Pix/TEF) | M | Extreme | Idempotency + PAYMENT_UNKNOWN | Payments | Open |
| RISK-004 | Duplicate NFC-e | M | Extreme | Fiscal queue + idempotency keys | Fiscal | Open |
| RISK-005 | Offline LWW corruption | M | Extreme | Domain conflict policies | Offline | Open |
| RISK-006 | Cross-tenant data leak | M | Extreme | Scoped queries + tests | Security | Open |
| RISK-007 | A1 certificate exposure | M | Extreme | Encrypted secrets + ACL | Fiscal | Open |
| RISK-008 | WMS roadmap assumed complete | H | High | Verify before depend | Inventory | Open |
| RISK-009 | License contamination (EE/GPL) | M | Extreme | License docs + review | Legal | Open |
| RISK-010 | Scope collapse to “MVP done” | H | Extreme | Coverage VALIDATED gate | Process | Open |
| RISK-011 | SEFAZ/schema churn 2026 RTC | H | High | Versioned TaxEngine | Fiscal | Open |
| RISK-012 | Hardware flaky in field | H | High | Agent + spooler + health | Hardware | Open |
| RISK-013 | Report queries starve POS | M | High | Read models / separate pool | Reporting | Open |
| RISK-014 | Self-approval of sensitive ops | M | High | Dual custody rules | Auth | Open |
| RISK-015 | Lost sale on crash | M | Extreme | Local journal + state machine | POS/Offline | Open |
| RISK-016 | Client-controlled cash approval threshold | H | Extreme | Server-side register policy (REV-001) | Cash | Mitigating |
| RISK-017 | Concurrent cash session / withdrawal races | H | Extreme | Partial unique + row lock (REV-004/005) | Cash | Mitigating |
| RISK-018 | Coverage inflation without executable slice | H | Extreme | Vertical slice metrics in IMPLEMENTATION-STATUS | Process | Open |
