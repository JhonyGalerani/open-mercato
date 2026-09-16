# ADR-010 — POS managerial approval (dual custody)

## Status

Accepted — 2026-09-16

## Context

Blueprint AUTH-APR / AUTH-POS-005/006 / DISC-002 require managerial approval for
over-limit discounts (and later cancellations, stock overrides, withdrawals).
Client-supplied approver UUIDs are unsafe. JWT sessions do not embed ACL
features, so command-level checks that read `auth.features` always deny.

## Decision

1. Persist `PosApprovalRequest` with requester (from `auth.sub`), reason,
   before/after snapshots, payload, terminal/transaction linkage, expiry.
2. Decide via authenticated session only; reject when `approverUserId === requesterUserId`.
3. Resolve feature grants through `rbacService.userHasAllFeatures` (live ACL),
   not JWT claims.
4. Feature IDs follow module convention (`soanas_pos.discount.*`,
   `soanas_pos.approval.manager`). Legacy `soanas.pos.*` ids remain as concrete
   aliases because multi-segment wildcards are dropped by the enabled-module
   filter.
5. Consume-once on the mutating command (discount today); reused approvals fail.

## Consequences

- PIN pad / remote approval remain future work (AUTH-APR-001 partial, AUTH-APR-002).
- Cash dual-custody helpers share the same RBAC resolution pattern.
