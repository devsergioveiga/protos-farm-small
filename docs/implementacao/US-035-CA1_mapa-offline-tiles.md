# US-035 CA1 — Download prévio de tiles de mapa

## O que foi feito

Implementação do cache manual de tiles de mapa para uso offline no app mobile.

## Decisões técnicas

- **react-native-maps** com `UrlTile` para renderização do mapa (estável com Expo, Apple/Google Maps nativos)
- **expo-file-system v55** (nova API class-based: File, Directory, Paths) para download e armazenamento de tiles
- **OpenStreetMap** como fonte de tiles (gratuito, sem API key)
- Tiles armazenados em `Paths.document/tiles/{farmId}/{z}/{x}/{y}.png`
- Zoom range padrão: 10–16 (bom equilíbrio entre cobertura e tamanho)
- Download paralelo com concorrência 4 para performance

## Arquivos criados/modificados

### Novos

- `services/tile-cache.ts` — Serviço de cache de tiles (cálculo de tiles por bounding box, download, gerenciamento)
- `services/db/tile-cache-repository.ts` — Repositório SQLite para metadados do cache
- `types/react-native-maps.d.ts` — Type declarations para compatibilidade React 19

### Modificados

- `services/database.ts` — Migration V4: colunas `boundary_geojson` em farms/plots/locations + tabela `tile_cache_meta`
- `types/offline.ts` — Adicionado `boundary_geojson` e `TileCacheMeta` types
- `services/db/farm-repository.ts` — Upsert com boundary_geojson
- `services/db/field-plot-repository.ts` — Upsert com boundary_geojson
- `services/db/farm-location-repository.ts` — Upsert com boundary_geojson
- `services/db/index.ts` — Export do tile cache repository
- `services/sync.ts` — Busca boundaries durante sync (farm boundary, plot boundaries, location /map endpoint)
- `app/(app)/(tabs)/map.tsx` — Tela do mapa com download de tiles offline
- `app.json` — Permissões de localização (iOS/Android)
- `package.json` — react-native-maps, expo-file-system

## Fluxo do usuário

1. Seleciona fazenda → Tela do mapa mostra mapa online
2. Sync baixa boundary da fazenda + talhões + pastos
3. Bounding box calculado automaticamente (do boundary GeoJSON ou centro + área)
4. Usuário toca "Baixar mapa" → Confirmação com estimativa de tamanho
5. Tiles são baixados com barra de progresso
6. Badge "Offline" aparece quando cache completo
7. Sem conexão → Tiles servidos do cache local
