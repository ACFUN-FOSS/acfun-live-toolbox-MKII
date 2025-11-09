# Project Context

## Purpose
ACFun Live Toolbox MKII is an Electron-based desktop application to assist ACFun live streamers. It provides modules for live room management, danmu (bullet chat) handling, streaming status monitoring, statistics/analytics, settings management, and integration with OBS via WebSocket. The app follows a secure Electron architecture and aims for a minimal, maintainable monorepo setup.

## Tech Stack
- Platform: Electron 39, electron-builder 26
- Language: TypeScript 5.9, ES Modules
- Bundler: Vite 7
- UI Framework: Vue 3 (script setup) for renderer
- UI Components: TDesign Vue Next
- Testing: Playwright for end-to-end tests
- Monorepo: pnpm workspaces (`packages/*`, `@app/*` packages)
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

### Security Model & Windowing
- BrowserWindow defaults: fixed `1024x768`, `frame: false`, `resizable: false`.
- `webPreferences`: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: false`, `preload` set to `packages/preload/dist/index.js`.
- Removes Content-Security-Policy headers in development to ease local tooling; DevTools open in development only.
- Loads from Vite dev server URL in dev, falls back to packaged `index.html` in production.

### Preload API Surface
- Exposes `window.electronApi` with modules: `dialog`, `fs`, `login`, `window` (minimize/maximize/close), `system`, `overlay`, `plugin` (install/uninstall/enable/disable/devtools), `room`, `account`, `http` (local API via `ACFRAME_API_PORT`), `console`, and generic `on`/`off` for events.
- Plugin popup capability is not implemented; use `overlay` or in-app routing instead.
- Renderer must call Preload APIs; direct Node/Electron access in renderer is disallowed.

### Local HTTP API Server
- `ApiServer` (Express) starts a local HTTP/WebSocket server; default port `1299`.
- Middleware: `helmet`, `cors`, `compression`, `morgan` with concise logs.
- Routes: root info, `/health`, `/api/events`, `/api/stats/events`, and a comprehensive proxy for AcFun Live APIs (auth, user, danmu, live, gifts, manager, permissions).
- WebSocket endpoint mirrors the configured `port` for real-time events.

### Routing (Renderer)
- `vue-router` with `createWebHashHistory`.
- Shell: `LayoutShell`; pages: `Home`, `Live` (nested: `Room`, `Danmu`), `Plugins` (nested: `Management`, `Frame`), `System` (nested: `Settings`, `Console`, `Develop`), plus `Error` and `NotFound`.
- Supports dynamic plugin route registration/unregistration; global `beforeEach` sets titles.

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
- Environment variables: `VITE_*` are exposed to renderer; key vars include `VITE_APP_VERSION`, `VITE_DEV_SERVER_URL`, `VITE_DISTRIBUTION_CHANNEL`, `VITE_DEV_SERVER_PORT`. Preload uses `ACFRAME_API_PORT` for local API calls.
- Window options include `sandbox: false` (due to preload needs); `webview` tag disabled. Follow secure defaults: no Node integration, strict context isolation.

## External Dependencies
- Electron ecosystem: `electron`, `electron-builder`, `electron-updater`, `electron-devtools-installer`.
- Persistence/config: `electron-store`, `electron-data`, `conf`.
- UI & frontend: `vue`, `vue-router`, `tdesign-vue-next`, `@vitejs/plugin-vue`, `vite-plugin-electron-renderer`.
- Micro-frontend: `wujie-vue3`.
- Streaming: `obs-websocket-js`.
- Server/utilities: `express`, `archiver`, `unzipper`, `glob`.
- Testing: `playwright`, `@playwright/test`.
- AcFun API: `acfunlive-http-api` (installed in `packages/main/node_modules/acfunlive-http-api`; must not be mocked in tests).

## Testing Conventions
- Place all test files under the root `test` directory.
- Do not mock `acfunlive-http-api`; tests must use real requests and functions.
- Unless explicitly requested, do not run tests or create new test cases/tasks.

## OpenSpec Workflow
- OpenSpec CLI is integrated into development: list active changes/specs, implement proposals, and archive changes under `openspec/changes`.
- Use OpenSpec to align UI specs (`desktop-ui`), plugin system, auth flows, and danmu display with documented requirements.
