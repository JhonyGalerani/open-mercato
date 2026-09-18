# Soanas — Tech Debt

| ID | Debt | Why introduced | Consequence | Removal plan | Target phase |
|----|------|----------------|-------------|--------------|--------------|
| TD-001 | Coverage matrix is curated subset of every blueprint bullet (303 IDs) | Full literal expansion would be 1000+ rows; IDs group sub-bullets | Risco de sub-item sem ID próprio | Expand IDs when implementing domain (sub-IDs CASH-SANGRIA-*) | Continuous |
| TD-002 | Soanas lives inside open-mercato monorepo initially | Single agent workspace | Licensing/distribution clarity | Extract commercial app repo when packaging | Phase 7–8 |
| TD-003 | SPEC-022 Mercato POS still Proposed | Historical | Confusion for contributors | ADR-006 supersede note + link | Phase 0 |
| TD-004 | Baseline full `yarn test` may be truncated in agent env | Time/memory | Incomplete baseline signal | Re-run full suite in CI | Phase 0 |
| TD-005 | No real SEFAZ/Pix credentials | External | Production fiscal/pay blocked | Adapters+mocks; BLOCKED_EXTERNAL only for cert | Phase 2+ |
| TD-006 | POS reads WMS `InventoryBalance` ORM to plan multi-location adjust | WMS has no public consume-split command yet | Cross-module ORM coupling | Replace with WMS consume/pick API when available (ADR-008) | Phase 1→3 |
| TD-007 | Receipt print is in-process Mock via DI, not durable PrintJob | Hardware Agent not built | No paper-confirm / spooler | **Mitigated Gate 0:** `PosPrintJob` entity + enqueue-before-print (ADR-011); ESC/POS still pending | Phase 3 |
| TD-008 | Legacy ACL ids `soanas.pos.*` filtered by module registry wildcards | Off-convention prefix vs module `soanas_pos` | Manager wildcards silently ineffective | Prefer `soanas_pos.*` features; keep legacy aliases concrete | Phase 1 |
| TD-009 | Approval PIN pad UI not built | Supervisor re-login sufficient for dual custody v1 | Weaker floor UX for managers | Soft PIN / badge on terminal | Phase 1→2 |
| TD-010 | COMPLETED reverse restores WMS+cash but does not yet call `sales.returns.create` | POS orders have no shipment; returns guard blocks | Sales commercial credit deferred | Ship-on-POS-complete or POS-aware return eligibility | Phase 1→2 |
| TD-011 | Pix charges not yet wired into POS complete saga; first launch uses manual card/Pix tenders | Payments package born as vertical slice first | Integrated Pix not on critical path for retail v1 | Manual tenders (Gate 1) first; wire PSP later as optional | Phase 2 |
| TD-012 | Terminal `stockPolicy=ALLOW` promised negative stock but WMS adjust hard-rejects shortage | WMS has no allow-negative contract | UI/docs oversold ALLOW | Gate 0: UI removes ALLOW; coerce ALLOW→BLOCK; restore when WMS supports | Phase 1→3 |
| TD-013 | Coverage over-validated 20 IDs with shared retail-gate evidence | Agent rubber-stamp after Retail Sale v1 | False readiness signal | Gate 0 rebaseline → 7 VALIDATED; CI coverage honesty check | Continuous |
| TD-014 | Direct ORM reads of SalesOrder/SalesPayment/InventoryBalance/WarehouseLocation in POS complete/helpers/reverse | No public multi-location consume / orphan lookup API | Cross-module coupling (ADR-008) | Keep limited to helpers; replace with ports when WMS/Sales expose them | Phase 1→3 / E2→E3 |
| TD-015 | `STORE_CREDIT` existe no contrato/UI legado sem saldo+ledger reais | Prompt exige ledger real ou desabilitar | Crédito fictício / fraude | **Mitigado E0:** removido da UI operacional; API rejeita com erro explícito; reabilitar só com ledger | E2/E7 |
| TD-016 | Desktop = foundations (`soanas-desktop` journal + shell contract); sem Electron empacotado nem .exe | E1 prova localidade antes de E8 | Instalador ausente | Empacotar Electron + serviços locais em E8; validar em Windows | E1→E8 |

Regra: toda solução temporária nova ganha linha aqui no mesmo PR.

**Nota de fases:** coluna “Target phase” legado Phase N mapeia via `ROADMAP.md` (Gates/Phases → E0–E9).

