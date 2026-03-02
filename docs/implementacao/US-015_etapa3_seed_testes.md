# US-015 Etapa 3 — Seed, Testes e Documentação

## Seed

Perímetros inseridos via raw SQL `ST_GeomFromGeoJSON` + `ST_Area`:

| Entidade             | Descrição                        |
| -------------------- | -------------------------------- |
| Fazenda Santa Helena | Retângulo ~5200 ha em Sorriso/MT |
| Sítio Recanto do Sol | Retângulo ~185 ha em Jaú/SP      |
| Matrícula 15.234     | Sub-polígono da Santa Helena     |

## Testes (38 novos → 413 total)

### `geo-parser.spec.ts` (16 testes)

- Detecção de formato (7): .geojson, .json, .kml, .kmz, .zip, extensão inválida, case-insensitive
- Parse GeoJSON (5): Feature com Polygon, FeatureCollection, JSON inválido, sem polígonos, formato não suportado
- Parse KML (1): arquivo KML válido
- Validação geométrica (5): polígono válido, poucos vértices, anel aberto, auto-interseção, coordenadas fora dos limites
- Cálculo de área (2): área conhecida, precisão de 4 decimais

### `farms-boundary.routes.spec.ts` (22 testes)

- POST farm boundary (7): upload com sucesso, audit log, sem arquivo, formato inválido, geometria inválida, sem auth, RBAC (COWBOY negado)
- GET farm boundary (2): com boundary, sem boundary
- DELETE farm boundary (3): sucesso, audit log, farm não encontrada
- POST registration boundary (2): upload com sucesso, audit log
- GET registration boundary (1): com boundary
- DELETE registration boundary (3): sucesso, audit log, matrícula não encontrada

### Fixtures (`__fixtures__/`)

- `sample-polygon.geojson` — Feature com Polygon válido
- `multi-polygon.geojson` — FeatureCollection com 2 polígonos
- `sample.kml` — KML com Polygon
- `invalid-self-intersecting.geojson` — Bowtie (auto-interseção)
- `point-only.geojson` — Feature com Point (sem polígono)

## Verificação

1. `prisma generate` — OK
2. `tsc --noEmit` — OK
3. `pnpm --filter backend test` — 413 testes passando (23 suites)
4. Seed atualizado com boundaries

## Arquivos

| Arquivo                                                | Ação       |
| ------------------------------------------------------ | ---------- |
| `prisma/seed.ts`                                       | Modificado |
| `src/modules/farms/geo-parser.spec.ts`                 | Novo       |
| `src/modules/farms/farms-boundary.routes.spec.ts`      | Novo       |
| `src/modules/farms/__fixtures__/*.geojson`             | Novos (4)  |
| `src/modules/farms/__fixtures__/sample.kml`            | Novo       |
| `docs/implementacao/US-015_etapa1_migration.md`        | Novo       |
| `docs/implementacao/US-015_etapa2_upload_perimetro.md` | Novo       |
| `docs/implementacao/US-015_etapa3_seed_testes.md`      | Novo       |
