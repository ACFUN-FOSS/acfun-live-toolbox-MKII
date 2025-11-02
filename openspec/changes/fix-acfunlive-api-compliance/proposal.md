# Fix AcFunLive HTTP API Integration Compliance

## Summary

Fix multiple compliance issues in the current integration with `acfunlive-http-api` to ensure proper usage patterns, authentication flows, and API initialization according to the library's documentation and test examples.

## Problem Statement

After analyzing the `acfunlive-http-api` documentation, test cases, and current integration code, several non-compliant usage patterns were identified:

1. **Incorrect API Instance Creation**: Using `createApi()` without configuration instead of `new AcFunLiveApi(config)`
2. **Incomplete Authentication Flow**: Missing proper QR code login implementation and token management
3. **Wrong Danmu Service Parameters**: Incorrect parameter passing to `startDanmu` method
4. **Redundant Retry Logic**: Implementing external retry mechanisms when API has built-in retry configuration

## Proposed Solution

### 1. Fix API Instance Creation
- Replace `createApi()` calls with `new AcFunLiveApi(config)` 
- Add proper configuration with timeout, retryCount, and baseUrl
- Update ConnectionPoolManager and ApiBridge implementations

### 2. Implement Proper Authentication Flow
- Add complete QR code login flow: `qrLogin()` → poll `checkQrLoginStatus()`
- Fix token management and refresh logic in AuthManager
- Ensure proper token setting with `setAuthToken()`

### 3. Correct Danmu Service Usage
- Fix `startDanmu` parameter passing (liverUID as string, proper callback)
- Align event handling with API's expected event types
- Update AcfunAdapter to match API specifications

### 4. Remove Redundant Retry Logic
- Configure retry behavior in API initialization instead of external wrappers
- Simplify ApiRetryManager to work with API's built-in retry mechanism
- Remove duplicate error handling layers

## Impact Assessment

### Benefits
- **Reliability**: Proper API usage reduces connection failures and authentication issues
- **Performance**: Eliminates redundant retry layers and improves response times
- **Maintainability**: Code aligns with library documentation, easier to debug and update
- **Compatibility**: Ensures compatibility with future API updates

### Risks
- **Breaking Changes**: Some method signatures may change
- **Testing Required**: All integration points need verification
- **Migration**: Existing connections may need to be reset

## Implementation Plan

1. **Update API Initialization** - Fix createApi usage across all modules
2. **Refactor Authentication** - Implement proper QR login flow
3. **Fix Danmu Integration** - Correct parameter passing and event handling
4. **Simplify Retry Logic** - Remove external retry wrappers
5. **Update Tests** - Ensure all integration tests pass with real API calls
6. **Documentation** - Update internal docs to reflect proper usage patterns

## Acceptance Criteria

- [ ] All API instances created with proper configuration
- [ ] QR code authentication flow works end-to-end
- [ ] Danmu service connects and receives events correctly
- [ ] No redundant retry logic in external wrappers
- [ ] All integration tests pass with real API calls
- [ ] Performance metrics show improved connection reliability

## Dependencies

- Requires `acfunlive-http-api` package (already installed)
- May need to update TypeScript types for proper API usage
- Integration tests must use real API calls (no mocking allowed per user rules)

## Timeline

- **Phase 1**: API initialization fixes (1-2 hours)
- **Phase 2**: Authentication flow implementation (2-3 hours) 
- **Phase 3**: Danmu service corrections (1-2 hours)
- **Phase 4**: Retry logic simplification (1 hour)
- **Phase 5**: Testing and validation (2-3 hours)

**Total Estimated Time**: 7-11 hours