---
phase: 27-controle-de-ponto-e-jornada
plan: "05"
subsystem: mobile
tags: [expo, react-native, sqlite, offline-first, gps, geofence, haptics, time-tracking]

requires:
  - phase: 27-01
    provides: TimeEntry backend model with GPS fields and time-entries endpoints

provides:
  - SQLite V12 migration with time_punches table (GPS, out_of_range, synced columns)
  - TimePunchRepository class with create, getTodayPunches, markSynced, getPendingCount
  - time_punches added to OperationEntity union as CRITICAL priority
  - time-punch.tsx mobile screen: clock-in/out state machine, GPS capture, geofence check
  - Offline-queue integration for syncing punches to backend
  - Navigation entry in more.tsx

affects:
  - 27-06 (web attendance page consumes same time-entries backend endpoints)
  - future payroll plans that process time entries

tech-stack:
  added: []
  patterns:
    - "Ray-casting point-in-polygon (no external dependency) for offline geofence validation"
    - "PunchState machine (IDLE / CLOCKED_IN / ON_BREAK) derived from last punch type"
    - "TimePunchRepository follows same factory pattern as other mobile repositories"
    - "PRIORITY_CRITICAL for time_punches ensures attendance syncs before normal ops"

key-files:
  created:
    - apps/mobile/services/db/time-punch-repository.ts
    - apps/mobile/app/(app)/time-punch.tsx
  modified:
    - apps/mobile/services/database.ts
    - apps/mobile/services/db/pending-operations-repository.ts
    - apps/mobile/services/db/index.ts
    - apps/mobile/app/(app)/(tabs)/more.tsx

key-decisions:
  - "Used inline ray-casting algorithm instead of @turf/boolean-within to avoid adding a new dependency"
  - "organizationId stored in time_punches SQLite row so offline-queue can build correct endpoint URL without re-fetching auth context"
  - "Out-of-range warning shows modal but does NOT block registration — field workers can always punch"
  - "GPS timeout after 3s — if exceeded, punch is registered without coordinates (not blocked)"

patterns-established:
  - "Punch state derived from last punch type — no separate state column needed"
  - "Farm boundary fetched from SQLite cache (boundary_geojson column from V4 migration)"

requirements-completed: [PONTO-01]

duration: 5min
completed: 2026-03-24
---

# Phase 27 Plan 05: Mobile Time-Punch Screen Summary

**Offline-first clock-in/out mobile screen with GPS geofence validation (ray-casting), SQLite V12 storage, CRITICAL-priority offline-queue sync, haptic feedback, and elapsed time counter**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-24T14:52:56Z
- **Completed:** 2026-03-24T14:57:44Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify — awaiting user verification)
- **Files modified:** 6

## Accomplishments

- SQLite V12 migration creates `time_punches` table with GPS columns, CHECK constraint on punch_type, and indexes on employee_id + synced
- `TimePunchRepository` class exports `create`, `getTodayPunches`, `markSynced`, `getPendingCount` — follows existing repository pattern
- `time_punches` added to `OperationEntity` union as CRITICAL priority (processes before normal ops)
- `time-punch.tsx` screen: full state machine (IDLE/CLOCKED_IN/ON_BREAK), GPS capture with 3s timeout, ray-casting geofence, out-of-range warning modal, elapsed counter, break button, today's entries list, sync status dot, offline banner
- Navigation entry added to more.tsx menu with Clock icon

## Task Commits

1. **Task 1: SQLite V12 migration + TimePunchRepository + offline-queue integration** - `1d12f81c` (feat)
2. **Task 2: time-punch.tsx screen with GPS, geofence check, haptics, offline banner** - `b673c248` (feat)
3. **Task 3: Visual verification** — CHECKPOINT (awaiting human verification)

## Files Created/Modified

- `apps/mobile/services/database.ts` - Added migrationV12 + V12 branch in migrateDbIfNeeded, incremented DATABASE_VERSION to 12
- `apps/mobile/services/db/time-punch-repository.ts` - New: TimePunchRepository class + createTimePunchRepository factory
- `apps/mobile/services/db/pending-operations-repository.ts` - Added time_punches to OperationEntity and CRITICAL_ENTITIES set
- `apps/mobile/services/db/index.ts` - Exports TimePunchRepository, createTimePunchRepository, LocalTimePunch, PunchType
- `apps/mobile/app/(app)/time-punch.tsx` - New: full time-punch screen (307 lines of logic + 195 lines of styles)
- `apps/mobile/app/(app)/(tabs)/more.tsx` - Added "Registro de Ponto" menu item with Clock icon

## Decisions Made

- **Ray-casting over @turf/boolean-within**: No new npm dependency needed. The inline algorithm is sufficient for simple farm boundary polygons and has no bundle size impact.
- **organizationId in SQLite row**: The offline-queue endpoint URL is `/api/org/${organizationId}/employees/${userId}/time-entries`. Storing organizationId at punch time ensures the queue can build the correct URL even if auth context changes before sync.
- **Out-of-range = warning, not block**: Field workers in rural areas often have GPS drift or are at farm edges. A modal warning is shown but registration always proceeds.
- **GPS timeout 3s**: Mobile GPS can take 5-10s for cold starts. After 3s, we register without coordinates rather than blocking the worker. The punch still goes through.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used expo-crypto instead of react-native-uuid for UUID generation**
- **Found during:** Task 1 (TimePunchRepository.create)
- **Issue:** Plan referenced `react-native-uuid` but that package is not installed in the mobile app; `expo-crypto` is already installed and provides SHA256 hashing suitable for ID generation
- **Fix:** Used `Crypto.digestStringAsync` with a unique seed (employeeId + punchType + punchedAt + Math.random()) to generate a hex ID
- **Files modified:** apps/mobile/services/db/time-punch-repository.ts
- **Committed in:** 1d12f81c (Task 1 commit)

**2. [Rule 3 - Blocking] Used ray-casting instead of @turf/boolean-within**
- **Found during:** Task 2 (geofence validation)
- **Issue:** @turf/boolean-within is not installed; adding it would require pnpm install + native module considerations
- **Fix:** Implemented inline ray-casting algorithm (10 lines) — standard algorithm, no external dependency
- **Files modified:** apps/mobile/app/(app)/time-punch.tsx
- **Committed in:** b673c248 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking — missing dependencies replaced with available alternatives)
**Impact on plan:** Both fixes maintain plan intent. UUID uniqueness is preserved. Geofence algorithm is functionally equivalent for convex/concave polygons.

## Issues Encountered

- TypeScript strict cast required for GeoJSON Feature type — resolved with explicit `as unknown as` double-cast
- Pre-existing TypeScript errors in `app/team-operation.tsx` (missing hook imports) — out of scope, not fixed

## Known Stubs

None — all data paths are wired:
- GPS coordinates come from `expo-location`
- Farm boundary from SQLite `farms.boundary_geojson` column (populated by V4 migration sync)
- Punches stored via `TimePunchRepository.create`, enqueued via `offline-queue`
- Today's entries loaded from SQLite via `getTodayPunches`

## Next Phase Readiness

- Task 3 (checkpoint:human-verify) awaits user to run `npx expo start` and visually verify the screen
- After approval, no further tasks remain in this plan
- Plan 27-06 (web attendance page) is ready to begin — the backend time-entries endpoint is already built in 27-01

---
*Phase: 27-controle-de-ponto-e-jornada*
*Completed: 2026-03-24 (checkpoint — Tasks 1-2 complete, Task 3 awaiting human verify)*
