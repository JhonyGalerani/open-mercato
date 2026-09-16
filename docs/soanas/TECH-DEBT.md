# Soanas — Tech Debt

| ID | Debt | Why introduced | Consequence | Removal plan | Target phase |
|----|------|----------------|-------------|--------------|--------------|
| TD-001 | Coverage matrix is curated subset of every blueprint bullet (303 IDs) | Full literal expansion would be 1000+ rows; IDs group sub-bullets | Risco de sub-item sem ID próprio | Expand IDs when implementing domain (sub-IDs CASH-SANGRIA-*) | Continuous |
| TD-002 | Soanas lives inside open-mercato monorepo initially | Single agent workspace | Licensing/distribution clarity | Extract commercial app repo when packaging | Phase 7–8 |
| TD-003 | SPEC-022 Mercato POS still Proposed | Historical | Confusion for contributors | ADR-006 supersede note + link | Phase 0 |
| TD-004 | Baseline full `yarn test` may be truncated in agent env | Time/memory | Incomplete baseline signal | Re-run full suite in CI | Phase 0 |
| TD-005 | No real SEFAZ/Pix credentials | External | Production fiscal/pay blocked | Adapters+mocks; BLOCKED_EXTERNAL only for cert | Phase 2+ |
| TD-006 | POS reads WMS `InventoryBalance` ORM to plan multi-location adjust | WMS has no public consume-split command yet | Cross-module ORM coupling | Replace with WMS consume/pick API when available (ADR-008) | Phase 1→3 |
| TD-007 | Receipt print is in-process Mock via DI, not durable PrintJob | Hardware Agent not built | No paper-confirm / spooler | soanas-hardware PrintJob + ESC/POS (ADR-009) | Phase 3 |
| TD-008 | Legacy ACL ids `soanas.pos.*` filtered by module registry wildcards | Off-convention prefix vs module `soanas_pos` | Manager wildcards silently ineffective | Prefer `soanas_pos.*` features; keep legacy aliases concrete | Phase 1 |
| TD-009 | Approval PIN pad UI not built | Supervisor re-login sufficient for dual custody v1 | Weaker floor UX for managers | Soft PIN / badge on terminal | Phase 1→2 |
| TD-010 | COMPLETED reverse restores WMS+cash but does not yet call `sales.returns.create` | POS orders have no shipment; returns guard blocks | Sales commercial credit deferred | Ship-on-POS-complete or POS-aware return eligibility | Phase 1→2 |
| TD-011 | Pix charges not yet wired into POS complete saga | Payments package born as vertical slice first | Cash-only complete remains default | Wire Pix tender + wait-for-PAID before complete | Phase 2 |

Regra: toda solução temporária nova ganha linha aqui no mesmo PR.

