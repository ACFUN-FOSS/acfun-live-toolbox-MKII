# Integrate AcFunDanmu.js Backend

## Why

The current AcfunAdapter implementation uses simulated connections and mock event generation instead of the actual acfundanmu.js library. This prevents real-time danmu collection from AcFun live streams and limits the application's core functionality. The acfunlive-http-api package is already installed but not properly integrated into the backend architecture.

## What Changes

- Replace simulated connection logic in AcfunAdapter with actual acfundanmu.js integration
- Implement proper WebSocket connection management using acfunlive-http-api
- Add real-time danmu event processing and context enrichment (roomId, source, timestamp)
- Integrate authentication flow using acfunlive-http-api's AuthService
- Add proper error handling and reconnection logic for live stream connections
- Update danmu event pipeline to handle real AcFun danmu data structures

## Impact

- Affected specs: danmu-display (core danmu collection and processing requirements)
- Affected code: 
  - `packages/main/src/core/adapters/AcfunAdapter.ts` (complete rewrite of connection logic)
  - `packages/main/src/core/danmu/AcfunDanmuModule.ts` (integration with real API)
  - `packages/main/src/core/auth/AuthManager.ts` (authentication integration)
  - `packages/main/src/core/api/ApiBridge.ts` (API call integration)
- Dependencies: Proper utilization of existing acfunlive-http-api package
- **BREAKING**: Changes danmu event data structure to include real AcFun event types and metadata