# ADR-012 — Cash approver identity from session (Gate 0)

**Date:** 2026-09-16  
**Status:** Accepted  

## Decision

Cash dual-custody approvals (`sangria`, `suprimento`, close discrepancy) derive
`approverUserId` exclusively from `ctx.auth.sub` of the authenticated caller who
holds an approval feature. Client-supplied `approverUserId` is ignored for authorization.

Self-approval (`approver === operator`) remains forbidden.

PIN/badge soft-auth remains deferred (TD-009); supervisor re-login is the v1 mechanism.

## Consequences

- UI no longer collects an approver UUID text field
- Matches POS approval decide path (ADR-010)
