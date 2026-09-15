# Soanas — Tech Debt

| ID | Debt | Why introduced | Consequence | Removal plan | Target phase |
|----|------|----------------|-------------|--------------|--------------|
| TD-001 | Coverage matrix is curated subset of every blueprint bullet (303 IDs) | Full literal expansion would be 1000+ rows; IDs group sub-bullets | Risco de sub-item sem ID próprio | Expand IDs when implementing domain (sub-IDs CASH-SANGRIA-*) | Continuous |
| TD-002 | Soanas lives inside open-mercato monorepo initially | Single agent workspace | Licensing/distribution clarity | Extract commercial app repo when packaging | Phase 7–8 |
| TD-003 | SPEC-022 Mercato POS still Proposed | Historical | Confusion for contributors | ADR-006 supersede note + link | Phase 0 |
| TD-004 | Baseline full `yarn test` may be truncated in agent env | Time/memory | Incomplete baseline signal | Re-run full suite in CI | Phase 0 |
| TD-005 | No real SEFAZ/Pix credentials | External | Production fiscal/pay blocked | Adapters+mocks; BLOCKED_EXTERNAL only for cert | Phase 2+ |

Regra: toda solução temporária nova ganha linha aqui no mesmo PR.
