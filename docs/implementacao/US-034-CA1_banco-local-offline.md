# US-034 CA1 — Banco local com dados essenciais

## O que

Banco de dados SQLite local no app mobile com tabelas para dados essenciais:
fazendas, talhões, pastos/instalações, lotes e animais (incluindo composição racial).

## Por quê

Permitir que operadores de campo consultem dados sem conexão à internet.
Base para as demais funcionalidades offline (CA2-CA8).

## Decisões técnicas

### expo-sqlite

- Solução oficial do Expo SDK 54, integrada via `SQLiteProvider`
- API async moderna (`openDatabaseAsync`, `execAsync`, `prepareAsync`)
- Suporte a WAL mode para melhor performance em leituras concorrentes
- Migration system via `PRAGMA user_version`

### Schema offline (6 tabelas + sync_meta)

| Tabela                      | Campos principais                           | Índices                              |
| --------------------------- | ------------------------------------------- | ------------------------------------ |
| `farms`                     | id, name, status, total_area_ha, lat/lng    | PK                                   |
| `field_plots`               | id, farm_id, name, boundary_area_ha         | farm_id                              |
| `farm_locations`            | id, farm_id, name, type, capacity           | farm_id                              |
| `animal_lots`               | id, farm_id, name, category, location       | farm_id                              |
| `animals`                   | id, farm_id, ear_tag, sex, category, lot_id | farm_id, lot_id, pasture_id, ear_tag |
| `animal_breed_compositions` | id, animal_id, breed_name, percentage       | animal_id                            |
| `sync_meta`                 | entity, last_synced_at, record_count        | PK                                   |

### Repositórios tipados

Cada tabela tem um repositório com: `getAll/getById/upsertMany/delete/count/clear`.
Repositório de animais inclui: busca por ear_tag, lote, pasto e search textual.

### Sync service

- `syncFarmData(farmId)` — baixa todos os dados essenciais da fazenda
- Busca paginada automática (100 registros/página) para todas as entidades
- Mappers camelCase (API) → snake_case (SQLite) para cada entidade
- Progress callback para UI de sincronização
- `SyncProvider` no layout do app dispara sync ao selecionar fazenda

## Arquivos criados/modificados

- `services/database.ts` — migrations, DB_NAME
- `services/db/*.ts` — 6 repositórios tipados
- `services/sync.ts` — sync service com mappers e paginação
- `stores/SyncContext.tsx` — provider de estado de sync
- `hooks/useOfflineData.ts` — acesso aos repositórios
- `hooks/useInitialSync.ts` — hook de sync automático
- `types/offline.ts` — tipos das entidades offline
- `app/_layout.tsx` — SQLiteProvider integrado
- `app/(app)/_layout.tsx` — SyncProvider integrado
- `app.json` — plugin expo-sqlite adicionado
