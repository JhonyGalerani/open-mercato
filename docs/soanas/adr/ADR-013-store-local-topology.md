# ADR-013 — Store-local topology for offline-capable POS

**Status:** Accepted (working decision for E1+)  
**Date:** 2026-09-18  
**Supersedes:** n/a (extends ADR-005)

## Context

ADR-005 requires local-first POS with durable outbox and domain conflict policies.  
The Cloud agent and current codebase run Open Mercato on **PostgreSQL** with MikroORM migrations.  
There is **no** Electron/Tauri/desktop package yet. Multi-master financial writes are unsafe without a strong authority.

Operator contract (master prompt): Windows installable visual PDV; offline supported sales must not depend on remote APIs to complete.

Four failure modes must stay distinct:

1. Internet (WAN) down  
2. Cloud service down  
3. Store LAN down  
4. Local PC / local service down  

## Decision

### Topology (default)

**Store-local application server + PostgreSQL on the store host (or dedicated store server), terminals on the LAN.**

| Concern | Authority |
|---------|-----------|
| Stock mutations for the store | Store-local Postgres (single writer authority per store DB) |
| Cash / POS / ledger | Store-local DB |
| Auth offline | Local session cache + signed offline grants (E1/E3); no plaintext passwords; no universal credentials |
| Cloud | Async sync via outbox when WAN/cloud available |
| Hardware | Device Agent on local host (E4); browser/UI does not own raw device I/O |

### Rejected for launch path

| Option | Why not now |
|--------|-------------|
| Independent SQLite DB per terminal (multi-master) | Divergent money/stock; LWW forbidden for balances; migration/tooling mismatch with existing Postgres contracts |
| Cloud-only UI (URL) as “desktop” | Fails offline and Windows installable contract |
| Replace Postgres with SQLite wholesale | Breaks existing migrations, concurrency tests, and Gate evidence |

### Desktop technology

| Choice | Rationale |
|--------|-----------|
| **Electron shell** wrapping the local Mercato/Soanas UI (`soanas-desktop`) | Mature Windows packaging (.exe), existing web UI reuse, local URL `http://127.0.0.1:<port>` |
| Alternatives (Tauri, native WebView2-only) | Smaller binary possible; higher integration cost with current Next toolchain — revisit if Electron size blocks E8 |

Costs accepted: larger installer; must ship Node/runtime or sidecar services with the app in E8.

### CDN / assets

Essential POS assets must be bundled or served from the local app. No involuntary dependency on remote CDNs for operator-critical UI.

## Consequences

- E1 delivers: documented topology, local boot smoke (Postgres + durable sale survival across process restart), desktop package skeleton pointing at **local** origin.  
- E3 implements outbox/sync against this topology.  
- Isolated terminal with **no LAN to store server** cannot safely complete stock-authoritative sales unless a future quota/reservation design is approved — **do not silently reclassify** the requirement; block unsafe actions and surface the limitation.  
- Windows install validation remains `LOCAL_VALIDATION_PENDING` until E8 runs on Windows.

## References

- ADR-005, ADR-007, ADR-011  
- `docs/soanas/ROADMAP.md` E1/E3/E8  
- `docs/soanas/PACKAGE-INVENTORY.md`
