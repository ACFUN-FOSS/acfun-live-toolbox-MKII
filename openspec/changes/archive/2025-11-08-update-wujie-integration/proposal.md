## Why
Wujie acts as the micro-frontend framework across plugin UI, overlay, and window contexts. We need a unified, developer-friendly integration that:
- Bridges readonly store updates and main-process lifecycle hooks via SSE/event bus into all plugin contexts.
- Enforces one-way UI/Window → Overlay messaging via HTTP, with Overlay receiving through Wujie; forbid reverse HTTP.
- Guarantees a single Overlay instance per browser source to avoid stacking/visibility/ordering complexity.

## What Changes
- Plugin System:
  - ADDED: Wujie Event Bus Integration — Wujie SHALL consume SSE store-change updates and main lifecycle hooks, and re-emit unified envelopes to UI/Overlay/Window.
  - ADDED: One-way UI/Window → Overlay communication — UI/Window MUST send HTTP requests; Overlay SHALL accept them through Wujie; reverse HTTP MUST NOT exist.
  - ADDED: Single Overlay per browser source — Overlay instance management SHALL be idempotent, disallow creation/hide/remove/layer operations.
- Desktop UI:
  - ADDED: Overlay presence per browser source — UI SHALL mount exactly one overlay per source, without stacking or layer management.
  - ADDED: Wujie acceptance in overlay — Overlay MUST accept UI/Window requests through Wujie.

## Impact
- Affected specs: `specs/plugin-system`, `specs/desktop-ui`.
- Affected code (post-approval): `packages/renderer` (Wujie containers, Overlay page), `packages/main` (ApiServer SSE/POST endpoints, OverlayManager instance policy), `packages/preload` (bridges), `types/global.d.ts` (event envelope types).
- Developer experience: Plugins consume unified Wujie events/props and do not handle raw SSE/POST; UI/Window only call HTTP for overlay interactions.

## Risks / Trade-offs
- BREAKING (if reverse HTTP existed): Overlay MUST NOT initiate direct HTTP to UI/Window; use Wujie events instead.
- SSE load: require throttling/aggregation for high-frequency updates.

## Migration
- Plugins update messaging to use Wujie envelopes and props.shared readonly store; UI/Window routes overlay calls via HTTP endpoints; overlay side listens via Wujie.

