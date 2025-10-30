# Project Context

## Purpose
ACFun Live Toolbox MKII is an Electron-based desktop application to assist ACFun live streamers. It provides modules for live room management, danmu (bullet chat) handling, streaming status monitoring, statistics/analytics, settings management, and integration with OBS via WebSocket. The app follows a secure Electron architecture and aims for a minimal, maintainable monorepo setup.

## Tech Stack
- Platform: Electron 36, electron-builder 26
- Language: TypeScript 5.8, ES Modules
- Bundler: Vite 7
- UI Framework: Vue 3 (script setup) for renderer
- UI Components: TDesign Vue Next
- Testing: Playwright for end-to-end tests
- Monorepo: npm workspaces (`@app/*` packages)
- Other: Wujie Vue3 (micro-frontend embedding), Express (internal HTTP API), obs-websocket-js (OBS integration), electron-updater (auto-update), electron-store/electron-data (config persistence)

## Project Conventions

### Code Style
- TypeScript across packages; strict typing encouraged via `vue-tsc` and package `typecheck` scripts.
- ES Modules everywhere; CommonJS interop handled where necessary (e.g., `electron-updater`).
- Vue SFCs use `<script setup lang="ts">` and composables; router with hash history.
- No mandatory linters/formatters in repo; keep code consistent and minimal per CONTRIBUTING.
- Environment variables exposed via `import.meta.env.*` with `VITE_` prefix only.

### Architecture Patterns
- Monorepo packages:
  - `@app/main`: Electron Main process with modules like `WindowManager`, `AppManager`, `AutoUpdater`, `SettingsModule`, `ChromeDevToolsExtension`, `HttpManager`, danmu connectors.
  - `@app/preload`: Preload layer exposing safe APIs to renderer through `contextBridge` (auto-exposed via ESM imports).
  - `@app/renderer`: Vue 3 app using TDesign components, router pages (`Dashboard`, `LiveManagement`, `LiveRoomManagement`, `Statistics`, `Settings`, `StreamMonitor`, `Login`), and Wujie embedding.
  - Utility package: `@app/electron-versions` (helper for Electron/Chromium/Node version targeting).
- IPC: Renderer calls Preload-exposed functions; Preload relays to Main via `ipcMain/ipcRenderer` handlers.
- Build & distribution: Vite builds each package; electron-builder compiles app artifacts; auto-update via channels.
- Files inclusion: electron-builder reads each workspace `files` field to include only runtime artifacts (e.g., `dist/**`).

### Testing Strategy
- End-to-end tests in `tests/e2e.spec.ts` using Playwright on compiled app.
- Tests check window lifecycle, console errors, context exposure, and basic UI presence.
- Unit tests optional per package; E2E is primary.

### Git Workflow
- Monorepo with workspaces; typical flow: feature branches -> PR.
- No enforced commit style/linters in repo; propose clear, concise commit messages.
- CI expectations: type checks and build per README; releases typically from `main`.

## Domain Context
- Target platform: ACFun live streaming.
- Features include: danmu collection and processing, live room assets and management, stream status monitoring, analytics/Statistics pages, OBS scene/control integration via `obs-websocket-js`.
- Renderer UI uses TDesign for consistent enterprise-style components; micro-frontend embedding via Wujie for app pages under `/application/*` during dev.

## Important Constraints
- Node.js engine: `>=23.0.0` (per root `package.json`).
- Renderer must not use native Node APIs; use Preload/Main via exposed functions.
- Context Isolation: Preload runs in BrowserWindow context; only limited Electron modules are available there.
- Environment variables: only `VITE_*` are exposed; key vars used include `VITE_APP_VERSION`, `VITE_DEV_SERVER_URL`, `VITE_DISTRIBUTION_CHANNEL`, `VITE_DEV_SERVER_PORT`.
- Window options include `sandbox: false` currently (due to demo Node APIs in preload); webview tag disabled.

## External Dependencies
- Electron ecosystem: `electron`, `electron-builder`, `electron-updater`, `electron-devtools-installer`.
- Persistence/config: `electron-store`, `electron-data`, `conf`.
- UI & frontend: `vue`, `vue-router`, `tdesign-vue-next`, `@vitejs/plugin-vue`, `vite-plugin-electron-renderer`.
- Micro-frontend: `wujie-vue3`.
- Streaming: `obs-websocket-js`.
- Server/utilities: `express`, `archiver`, `unzipper`, `glob`.
- Testing: `playwright`, `@playwright/test`.
