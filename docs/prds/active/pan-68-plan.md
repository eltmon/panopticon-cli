# PAN-68: Dashboard production build crashes - __filename is not defined

## Status: PLANNING COMPLETE

## Problem Statement

Running `pan up` (production build) crashes immediately with:
```
ReferenceError: __filename is not defined
    at dist/dashboard/server.js:28928
```

Development mode (`npm run dev`) works fine.

## Root Cause Analysis

**Import chain:**
1. Dashboard server (`src/dashboard/server/index.ts`) imports Cloister service
2. Cloister service imports `database.ts`
3. `database.ts` imports `better-sqlite3` (a native addon)
4. `better-sqlite3` uses the `bindings` package to locate `.node` binary files
5. `bindings` relies on `__filename` - a CommonJS-only global
6. esbuild bundles into ESM format (`format: 'esm'`)
7. `__filename` doesn't exist in ESM → crash

**Current esbuild config:**
```javascript
// src/dashboard/server/esbuild.config.mjs
external: ['@homebridge/node-pty-prebuilt-multiarch'],  // node-pty is external
// but better-sqlite3 is NOT listed → gets bundled → crash
```

## Decision: Scope

**User preference:** Externalize ALL native addons (comprehensive approach)

**Native addon audit:**
- `@homebridge/node-pty-prebuilt-multiarch` - ✅ Already externalized
- `better-sqlite3` - ❌ Needs to be externalized

Only two native addons exist in the project. Adding `better-sqlite3` satisfies the "externalize all" requirement.

## Decision: Testing

**User preference:** Add automated test to CI

**Approach:**
1. Create integration test that builds the dashboard server
2. Verify the bundled file can be loaded without ESM/`__filename` errors
3. Test runs as part of the standard test suite

## Solution

### Task 1: Add better-sqlite3 to esbuild externals

Modify `src/dashboard/server/esbuild.config.mjs`:
```javascript
external: [
  '@homebridge/node-pty-prebuilt-multiarch',
  'better-sqlite3'
],
```

### Task 2: Add build verification test

Create `tests/integration/dashboard/build.test.ts`:
- Build the dashboard server
- Attempt to import/load the bundled file
- Verify no `__filename` or native addon errors occur
- This prevents future regressions when new native dependencies are added

### Task 3: Manual verification

After fix:
1. Run `npm run build` in dashboard
2. Run `pan up` - should start without crashing
3. Verify Cloister health database still works (dashboard health checks)

## Files to Modify

| File | Change |
|------|--------|
| `src/dashboard/server/esbuild.config.mjs` | Add `better-sqlite3` to external array |
| `tests/integration/dashboard/build.test.ts` | New file - build verification test |

## Out of Scope

- Changes to the CLI build process (tsup, not esbuild)
- Changes to frontend build (Vite)
- Refactoring the Cloister database to remove better-sqlite3 dependency
- Dynamic import workarounds (externalization is cleaner)

## Success Criteria

1. ✅ `npm run build:dashboard:server` succeeds
2. ✅ `pan up` starts without crashing
3. ✅ Automated test catches future native addon bundling issues
4. ✅ Dashboard health checks work (Cloister database functional)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `better-sqlite3` not installed in production | Already a production dependency in root package.json |
| Other native addons added later cause same issue | Automated test will catch this |
| Test is flaky due to build time | Use reasonable timeout, skip in CI if needed |
