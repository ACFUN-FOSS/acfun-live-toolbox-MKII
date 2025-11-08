## 1. Implementation

- [x] 1.1 Extend manifest typings to include `ui.wujie.*` and `overlay.wujie.*`
- [ ] 1.2 Validate new manifest fields in `PluginManager.ts` and surface to renderer
- [ ] 1.3 Unify Wujie init config in `CentralPluginContainer.vue` (fetch/headers/events)
- [ ] 1.4 Add Wujie overlay container (e.g., `OverlayFramePage` or integrate into `Overlay.vue`)
- [x] 1.5 Make `OverlayManager.vue`/`OverlayRenderer.vue` compatible with Wujie overlay mode
- [ ] 1.6 Ensure router supports Wujie overlay route handling (`/overlay/:overlayId`)
- [ ] 1.7 Update `preload/src/index.ts` bridge for overlay and plugin UI Wujie access
- [x] 1.8 Update `docs/plugin-development.md` with manifest examples and SPA notes
- [x] 1.9 Update example manifests (`plugins/example-plugin/manifest.json`, `plugins/overlay-test-plugin/manifest.json`)
- [x] 1.10 Typecheck and static code review per project rules

## 2. Validation

- [ ] 2.1 Run `openspec validate update-overlay-and-plugin-wujie-loading --strict`
- [ ] 2.2 Confirm deltas align with impacted specs and proposal
