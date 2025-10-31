# Task List: Refactor AcFun Live Toolbox

## Phase 1: Foundation & Core Structure
- [x] 1.1. Create the new directory structure in `packages/main/src` as per DDD (`adapter`, `rooms`, `persistence`, `server`, `plugins`, `ipc`, `logging`, `types`).
- [x] 1.2. Move existing relevant files from `modules`, `apis`, `utils` into the new structure.
- [x] 1.3. Delete obsolete directories (`modules`, `apis`).
- [x] 1.4. Implement the standardized `NormalizedEvent` and `RoomStatus` types in `packages/main/src/types`.
- [x] 1.5. Add `ACFUN-FOSS/acfundanmu.js` as a dependency（currently in packages\acfundanmu).
- [x] 1.6. Implement the initial `AcfunAdapter` class in `packages/main/src/adapter/` with connection/disconnection logic and event normalization mapping.
- [x] 1.7. Implement the license check for `acfundanmu.js` on startup.

## Phase 2: Persistence & State Management
- [x] 2.1. Add a SQLite library (e.g., `sqlite3`) as a dependency.
- [x] 2.2. Implement the `persistence` layer in `packages/main/src/persistence/`.
- [x] 2.3. Create the `events.db` and `events` table schema on startup.
- [x] 2.4. Implement the `EventWriter` with an asynchronous queue for batch writing events to SQLite.
- [x] 2.5. Implement the `RoomManager` in `packages/main/src/rooms/` to manage multiple `AcfunAdapter` instances (up to 3).
- [x] 2.6. Connect `RoomManager` to `EventWriter` to persist all normalized events.
- [x] 2.7. Implement the exponential backoff reconnection strategy in `RoomManager`/`AcfunAdapter`.

## Phase 3: APIs & External Communication
- [x] 3.1. Refactor the Express server in `packages/main/src/server/`.
- [x] 3.2. Implement the HTTP API endpoints as defined in `srs.md` (`/api/events`, `/api/export`, etc.).
- [x] 3.3. Implement the WebSocket Hub (`WsHub`) to broadcast events and status updates.
- [x] 3.4. Update the renderer (`packages/renderer`) to connect to the WebSocket Hub for real-time updates.
- [x] 3.5. Create basic UI components in the renderer to display room status and a simple event log from the WebSocket.

## Phase 4: Plugin Architecture & Finalization
- [x] 4.1. Implement the `PluginManager` in `packages/main/src/plugins/` for plugin lifecycle management.
- [x] 4.2. Implement the secure `ApiBridge` to expose the `PluginAPI` to plugins.
- [x] 4.3. Implement the `callAcfun` function in the bridge to make authenticated requests on behalf of plugins.
- [x] 4.4. Implement the `subscribeEvents` function for plugins.
- [x] 4.5. Implement `pluginStorage` for secure, isolated plugin data persistence.
- [x] 4.6. Implement `registerHttpRoute` to allow plugins to expose their own HTTP endpoints via the main server.
  - [x] 4.7. Implement the diagnostics and logging features (`一键诊断包`).
  - [x] 4.8. Conduct end-to-end tests for the new architecture.
  - [x] 4.9. Update all checklists in `tasks.md` to be checked (`- [x]`).
