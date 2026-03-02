# US-015 Etapa 2 — Upload e Importação de Perímetro

## O que foi feito

### Dependências novas

- `multer` — upload com memory storage (Express 5)
- `@turf/area` + `@turf/kinks` + `@turf/helpers` — validação/cálculo de geometria
- `shapefile` — parse Shapefile (.zip) → GeoJSON
- `@tmcw/togeojson` — parse KML → GeoJSON
- `jszip` — extração de .kmz (KML compactado)
- `@xmldom/xmldom` — DOMParser para Node (KML)

### Módulo `geo-parser.ts` (novo)

Funções exportadas:

- `detectFormat(filename, mimetype)` → `'geojson' | 'kml' | 'kmz' | 'shapefile' | null`
- `parseGeoFile(buffer, filename, mimetype)` → `{ boundaries: Polygon[], warnings[] }`
- `validateGeometry(polygon)` → `{ valid, errors[] }`
- `calculateAreaHa(polygon)` → número em hectares

Formatos suportados: `.geojson`, `.json`, `.kml`, `.kmz`, `.zip` (Shapefile)

### Tipos novos em `farms.types.ts`

- `ALLOWED_GEO_EXTENSIONS` — extensões aceitas
- `MAX_GEO_FILE_SIZE` — 10 MB
- `BoundaryUploadResult` — resultado do upload com área, divergência e warnings
- `BoundaryInfo` — informação do perímetro (GET)

### Service — 6 funções novas

| Função                       | Descrição                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `uploadFarmBoundary`         | Parse → valida → ST_GeomFromGeoJSON → ST_Area → compara totalAreaHa (>10% warning) |
| `uploadRegistrationBoundary` | Idem para matrículas, compara com areaHa                                           |
| `getFarmBoundary`            | ST_AsGeoJSON(boundary) + boundaryAreaHa                                            |
| `getRegistrationBoundary`    | Idem para matrícula                                                                |
| `deleteFarmBoundary`         | SET boundary=NULL, boundaryAreaHa=NULL                                             |
| `deleteRegistrationBoundary` | Idem                                                                               |

### Routes — 6 endpoints novos

| Método | Rota                                               | Permissão      |
| ------ | -------------------------------------------------- | -------------- |
| POST   | `/org/farms/:farmId/boundary`                      | `farms:update` |
| GET    | `/org/farms/:farmId/boundary`                      | `farms:read`   |
| DELETE | `/org/farms/:farmId/boundary`                      | `farms:update` |
| POST   | `/org/farms/:farmId/registrations/:regId/boundary` | `farms:update` |
| GET    | `/org/farms/:farmId/registrations/:regId/boundary` | `farms:read`   |
| DELETE | `/org/farms/:farmId/registrations/:regId/boundary` | `farms:update` |

Multer: memory storage, limite 10 MB, filtro por extensão.

Audit actions: `UPLOAD_FARM_BOUNDARY`, `DELETE_FARM_BOUNDARY`, `UPLOAD_REGISTRATION_BOUNDARY`, `DELETE_REGISTRATION_BOUNDARY`.

## Validações

1. Formato de arquivo (extensão)
2. Parse do conteúdo (JSON válido, KML válido etc.)
3. Extração de polígonos (ao menos 1 necessário)
4. Validação geométrica: mín. 3 vértices, anel fechado, sem auto-interseções, coordenadas WGS84
5. PostGIS ST_IsValid como verificação final
6. Alerta de divergência >10% entre área do perímetro e área cadastrada

## Arquivos

| Arquivo                              | Ação              |
| ------------------------------------ | ----------------- |
| `src/modules/farms/geo-parser.ts`    | Novo              |
| `src/modules/farms/farms.types.ts`   | Modificado        |
| `src/modules/farms/farms.service.ts` | Modificado        |
| `src/modules/farms/farms.routes.ts`  | Modificado        |
| `apps/backend/package.json`          | Modificado (deps) |
