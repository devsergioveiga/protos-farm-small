---
phase: 27-controle-de-ponto-e-jornada
plan: 05
status: complete
started: 2026-03-24
completed: 2026-03-24
---

## Summary

Mobile time-punch screen with offline-first architecture: clock-in/out with GPS geofencing, SQLite storage, offline-queue sync, haptic feedback, and today's entries list.

## Key Files

### Created
- `apps/mobile/app/(app)/time-punch.tsx` — Clock-in/out screen with GPS, geofence, haptics, offline banner, elapsed timer
- `apps/mobile/services/db/time-punch-repository.ts` — SQLite CRUD for offline punches

### Modified
- `apps/mobile/services/db/migrations.ts` — V12 migration for time_punches table
- `apps/mobile/services/offline-queue.ts` — Added time_punches to OperationEntity
- `apps/mobile/app/(app)/(tabs)/more.tsx` — Navigation entry with Clock icon

## What Was Built

- State machine: IDLE, CLOCKED_IN, ON_BREAK
- GPS capture via expo-location with geofence check
- Out-of-range modal (warns but does not block)
- Offline banner with pending count
- Elapsed timer in JetBrains Mono
- Haptic feedback plus pulse animation (respects reduceMotion)

## Verification

- Task 3 (visual verification): Approved by user

## Deviations

None.
