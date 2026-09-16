# ADR-006 — Relationship to Open Mercato SPEC-022 POS

**Status:** Accepted  
**Date:** 2026-09-15

## Context

Open Mercato has Proposed `SPEC-022` POS module (issue #391) with no implementation. Soanas Blueprint defines a full Brazilian POS product.

## Decision

- Soanas POS (`soanas_pos` + `soanas_cash` + …) is the implementation vehicle for POS capabilities in this product line.
- We do **not** implement SPEC-022 inside `packages/core`.
- Useful UX ideas from SPEC-022/022a may be adopted; divergence is expected and documented here.
- If upstream later ships a generic POS, Soanas will integrate via events/IDs rather than merge codebases.

## Consequences

- Avoids duplicate effort in core.
- Contributors must not “finish SPEC-022 in core” for Soanas needs.
