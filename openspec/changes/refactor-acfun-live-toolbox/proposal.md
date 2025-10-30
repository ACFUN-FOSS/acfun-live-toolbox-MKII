# OpenSpec Change Proposal: Refactor AcFun Live Toolbox based on SRS & DDD

## 1. Goal

This proposal outlines a comprehensive refactoring of the `acfun-live-toolbox-MKII` project to align its architecture, features, and implementation with the specifications detailed in `srs.md` (Software Requirements Specification) and `ddd.md` (Detailed Design Document).

The primary objective is to transform the existing boilerplate into a robust, domain-driven application specifically for ACFun live streaming, with a clear separation of concerns, standardized data contracts, and a well-defined plugin architecture.

## 2. Background & Rationale

The provided `srs.md` and `ddd.md` documents define a new target architecture for an "AcFun Live Manager". The current codebase, `ACLiveFrame`, is a generic Electron/Vue boilerplate. A significant refactoring is required to implement the specified domain logic, including:

-   **Core Dependency**: Strictly using `ACFUN-FOSS/acfundanmu.js` for all live stream interactions.
-   **Architecture**: A modular, domain-driven structure within the main process.
-   **Persistence**: Migrating from key-value stores (`electron-store`) to SQLite for high-volume event data.
-   **Standardization**: Enforcing unified event types (`NormalizedEvent`) and API contracts across the application.
-   **Features**: Implementing multi-room management, a local HTTP/WebSocket server, and a formal plugin system.

This refactoring will establish a solid foundation for the application's specific purpose, improving maintainability, scalability, and security.

## 3. Proposed Key Changes

The refactoring will be centered around the following key areas:

### 3.1. Main Process Restructuring (DDD Alignment)

The `packages/main/src` directory will be reorganized to follow the domain-driven structure proposed in `ddd.md`. This involves creating new modules and refactoring existing code into these new directories:

-   `/adapter`: To encapsulate and manage the `acfundanmu.js` library.
-   `/rooms`: For the `RoomManager` to handle concurrent live room connections.
-   `/persistence`: For the new SQLite-based persistence layer, including an event writer and query service.
-   `/server`: For the Express-based HTTP/WebSocket server.
-   `/plugins`: For the `PluginManager` and plugin API bridge.
-   `/ipc`: To define and handle all `ipcMain` contracts with the renderer.
-   `/logging`: For unified logging and diagnostics.
-   `/types`: For all shared, standardized TypeScript types (e.g., `NormalizedEvent`).

### 3.2. `acfundanmu.js` Adapter Implementation

A new `AcfunAdapter` module will be created as the sole interface to the `ACFUN-FOSS/acfundanmu.js` library.

-   **Responsibility**: It will handle connection, disconnection, automatic reconnection logic (with exponential backoff), and license validation.
-   **Event Normalization**: It will listen to raw events from the library and map them into the single, standardized `NormalizedEvent` format, as defined in the DDD. This decouples the application from the library's specific event shapes.

### 3.3. Room & Persistence Layer Overhaul

-   **RoomManager**: A new `RoomManager` will be implemented to manage the lifecycle of up to 3 concurrent room connections, using the `AcfunAdapter`. It will track the status of each connection and broadcast status changes.
-   **SQLite Integration**: The persistence mechanism will be migrated from `electron-data`/`electron-store` to SQLite.
    -   An `EventWriter` service will be created to handle writing `NormalizedEvent` objects to the `events` table.
    -   An **asynchronous write queue** will be implemented to batch writes and prevent blocking the main process, ensuring performance under high event loads.
    -   A `QueryService` will provide an interface for querying event data.
    -   A `CsvExporter` will be implemented for exporting data as specified.

### 3.4. API Server & Standardized Contracts

-   **HTTP Server**: The existing `HttpManager` will be refactored to align with the API routes defined in `srs.md` (`/api/events`, `/api/export`, `/console`, etc.).
-   **WebSocket Hub**: A WebSocket server will be added to broadcast normalized events and room status changes to all connected clients (e.g., LAN console, overlays).
-   **Unified Types**: The `NormalizedEvent` and `RoomStatus` types from `ddd.md` will be implemented in `packages/main/src/types` and used consistently across the main process, renderer, and plugin APIs.

### 3.5. Plugin System Formalization

-   **PluginManager**: A `PluginManager` will be created to handle the full lifecycle of plugins (installing from zip, loading, enabling/disabling).
-   **Controlled API Bridge**: A formal `PluginAPI` will be exposed to plugins, providing controlled access to core functionalities like event subscription (`subscribeEvents`), making authenticated AcFun API calls (`callAcfun`), and accessing plugin-specific storage, without exposing sensitive tokens.

## 4. Phased Implementation Plan

The refactoring will be executed in logical phases to manage complexity:

1.  **Phase 1: Foundation & Core Structure**
    -   Restructure the `packages/main/src` directory.
    -   Implement the `AcfunAdapter` and the `NormalizedEvent` type.
    -   Perform an initial integration of `acfundanmu.js`.

2.  **Phase 2: Persistence & State Management**
    -   Integrate SQLite and create the `persistence` layer with the async write queue.
    -   Implement the `RoomManager` to handle multiple connections.
    -   Connect the `RoomManager` to the `persistence` layer to store events.

3.  **Phase 3: APIs & External Communication**
    -   Refactor the Express server to expose the specified HTTP and WebSocket endpoints.
    -   Update the renderer UI to consume data from the new APIs instead of direct IPC calls where appropriate.

4.  **Phase 4: Plugin Architecture & Finalization**
    -   Implement the `PluginManager` and the secure `PluginAPI` bridge.
    -   Implement the diagnostics and logging features.
    -   Conduct end-to-end testing based on the new architecture.

## 5. Impact

-   **Codebase**: This is a major refactoring that will touch most of the files in `packages/main`. It will result in a more modular and maintainable codebase.
-   **Dependencies**: New dependencies like a SQLite library will be added. `electron-data` and `electron-store` may be deprecated or repurposed for simple configuration storage.
-   **Data Storage**: All existing data stored with `electron-store` will be incompatible with the new event store. A migration path is not required as this is a fundamental architectural shift.
-   **Functionality**: The application will transition from a generic template to a purpose-built tool for ACFun live streamers, enabling the specific features outlined in the SRS.
