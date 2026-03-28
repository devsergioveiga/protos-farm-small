---
phase: 16-cadastro-de-ativos
plan: '06'
subsystem: assets-map-integration
tags: [assets, map, leaflet, postgis, gap-closure]
requirements: [ATIV-02, ATIV-06]

dependency_graph:
  requires:
    - apps/backend/src/modules/assets/assets.service.ts (geoPoint column via PostGIS)
    - apps/frontend/src/components/map/FarmMap.tsx (existing Leaflet setup)
    - apps/frontend/src/hooks/useFarmMap.ts (existing parallel fetch pattern)
  provides:
    - GET /org/:orgId/assets/map endpoint returning lat/lon for geolocated assets
    - FarmMapPage "Benfeitorias" layer toggle with brown CircleMarkers
    - AssetsPage map view toggle rendering Leaflet markers for all geolocated assets
  affects:
    - apps/frontend/src/pages/FarmMapPage.tsx (new layer in DEFAULT_LAYERS)
    - apps/frontend/src/pages/AssetsPage.tsx (new viewMode state + map rendering)

tech_stack:
  added: []
  patterns:
    - ST_Y/ST_X raw SQL extraction of PostGIS geometry coordinates
    - Leaflet CircleMarker with Popup for point markers (no custom icon needed)
    - viewMode state pattern for list/map toggle in page components

key_files:
  created: []
  modified:
    - apps/backend/src/modules/assets/assets.types.ts
    - apps/backend/src/modules/assets/assets.service.ts
    - apps/backend/src/modules/assets/assets.routes.ts
    - apps/frontend/src/types/asset.ts
    - apps/frontend/src/hooks/useFarmMap.ts
    - apps/frontend/src/hooks/useAssets.ts
    - apps/frontend/src/components/map/FarmMap.tsx
    - apps/frontend/src/pages/FarmMapPage.tsx
    - apps/frontend/src/pages/FarmMapPage.spec.tsx
    - apps/frontend/src/pages/AssetsPage.tsx
    - apps/frontend/src/pages/AssetsPage.css

decisions:
  - key: Brown color for asset markers (#6D4C41/#8D6E63)
    rationale: Visually distinguishes benfeitorias from farm locations (green/blue) and avoids reserved primary green and error red
  - key: Route position — /map before /:id in assets.routes.ts
    rationale: Express matches routes in registration order; /map registered before /:id prevents 'map' being treated as an asset ID
  - key: useFarmMap fetches /org/assets/map (no orgId in path)
    rationale: The useFarmMap hook uses api.get which adds the org prefix via the API client, consistent with other farm-scoped calls that pass through /org/farms/:farmId

metrics:
  duration: 470s
  completed: '2026-03-20'
  tasks: 2
  files: 10
---

# Phase 16 Plan 06: Asset Map Integration Summary

Backend map endpoint + FarmMapPage "Benfeitorias" layer + AssetsPage map view toggle using PostGIS ST_Y/ST_X coordinate extraction.

## What Was Built

### Task 1: Backend map endpoint + frontend types

- Added `AssetMapItem` interface to `assets.types.ts` (backend) with id, name, assetTag, assetType, status, farmId, lat, lon
- Added `getAssetsForMap()` to `assets.service.ts` using `$queryRawUnsafe` with ST_Y/ST_X to read lat/lon from PostGIS geoPoint column; filters by organizationId, deletedAt IS NULL, geoPoint IS NOT NULL, optional farmId
- Added `GET /org/:orgId/assets/map` route to `assets.routes.ts` positioned BEFORE `/:id` to prevent routing conflict; accepts optional `?farmId=` query param
- Added `AssetMapItem` interface to frontend `types/asset.ts` (typed with AssetType/AssetStatus enums)

### Task 2: FarmMapPage asset layer + AssetsPage map view toggle

**FarmMapPage (ATIV-02):**

- Extended `FarmMapData` interface in `useFarmMap.ts` with `assetMarkers: AssetMapItem[]`
- Added 4th parallel fetch in `fetchData`: `/org/assets/map?farmId=${farmId}` with `.catch(() => [])`
- Added `showAssets?: boolean` and `assetMarkers?: AssetMapItem[]` props to `FarmMap.tsx`
- Added CircleMarker rendering block after showFacilities block: brown (#6D4C41/#8D6E63) 7px radius markers with Popup showing name and assetTag
- Added `{ id: 'assets', label: 'Benfeitorias', enabled: false }` to `DEFAULT_LAYERS` in `FarmMapPage.tsx`
- Passes `showAssets={showAssets}` and `assetMarkers={data.assetMarkers}` to `<FarmMap>`

**AssetsPage (ATIV-06):**

- Added `fetchMapAssets()` to `useAssets.ts` calling `/org/${orgId}/assets/map`
- Added `viewMode: 'list' | 'map'` state and `mapAssets: AssetMapItem[]` state to `AssetsPage.tsx`
- Added view toggle button group (List + Map icons, 48x48px, aria-pressed) in header
- Map view renders `MapContainer` with OSM TileLayer + CircleMarkers (brown, 8px radius) with Popup showing name, assetTag, assetType
- Empty state shown when `mapAssets.length === 0`: MapPin icon + "Nenhum ativo com coordenadas cadastradas" message
- Added CSS classes: `.assets-page__view-toggle`, `.assets-page__view-toggle-btn`, `.assets-page__view-toggle-btn--active`, `.assets-page__map-container`, `.assets-page__map-empty`

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Fixed missing test fixture**

- **Found during:** Task 2 TypeScript compilation
- **Issue:** `FarmMapPage.spec.tsx` MOCK_DATA lacked `assetMarkers` field after FarmMapData interface was extended, causing TypeScript error TS2741
- **Fix:** Added `assetMarkers: []` to MOCK_DATA in the test file
- **Files modified:** `apps/frontend/src/pages/FarmMapPage.spec.tsx`
- **Commit:** 07608c41

All other tasks executed exactly as planned.

## Self-Check: PASSED

All key files exist. Key content verified:

- `assets.service.ts`: contains `getAssetsForMap`, `ST_Y`, `ST_X`, `geoPoint IS NOT NULL`
- `assets.routes.ts`: contains `/map` route and `getAssetsForMap` import
- `asset.ts` (frontend): contains `AssetMapItem` with `lat: number` and `lon: number`
- `useFarmMap.ts`: contains `assetMarkers` in FarmMapData and fetch call
- `FarmMapPage.tsx`: contains `assetMarkers` prop pass-through
- `FarmMap.tsx`: contains `showAssets` prop and `assetMarkers` rendering
- `AssetsPage.tsx`: contains `viewMode`, `MapContainer`, empty state message
- Both TypeScript projects compile without errors
