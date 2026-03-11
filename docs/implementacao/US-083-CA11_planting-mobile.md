# US-083 CA11 — Formulário de plantio mobile (offline, GPS, câmera)

## O que foi implementado

Formulário completo de registro de plantio no app mobile, otimizado para uso em campo com suporte offline-first, GPS automático e câmera para foto do plantio.

## Critério de Aceite

> App mobile: formulário otimizado para campo com modo offline, GPS automático, câmera para foto do plantio

## Arquivos Criados/Modificados

### Novos

- `apps/mobile/app/(app)/planting-operation.tsx` — Tela de registro de plantio
- `apps/mobile/services/db/planting-operation-repository.ts` — Repositório SQLite offline
- `apps/mobile/services/db/cultivar-repository.ts` — Repositório de cultivares offline

### Modificados

- `apps/mobile/services/database.ts` — Migration V10 (tabelas `planting_operations` + `cultivars`)
- `apps/mobile/services/sync.ts` — Sync de cultivares do backend para uso offline
- `apps/mobile/services/db/index.ts` — Export dos novos repositórios
- `apps/mobile/services/db/pending-operations-repository.ts` — `planting_operations` no enum de entidades
- `apps/mobile/types/offline.ts` — Tipos `OfflinePlantingOperation`, `OfflineCultivar`, enums auxiliares
- `apps/mobile/app/(app)/(tabs)/register.tsx` — Navegação para tela de plantio

## Funcionalidades

### GPS automático

- Captura localização de alta precisão ao abrir a tela
- Auto-detecção de talhão via point-in-polygon nos boundaries offline
- Badge "Talhão detectado por GPS" quando auto-detectado
- Exibição de coordenadas na tela
- Seleção alternativa via map picker

### Câmera

- Captura de foto com qualidade 80% (otimizado para tamanho)
- Extração de GPS do EXIF da foto se localização não disponível
- Preview com opções remover/retomar

### Offline-first

- Salva localmente em SQLite (`planting_operations`)
- Enfileira para sync no `pending_operations`
- Flush automático quando online
- Banner "Sem conexão" quando offline
- Cultivares sincronizados para uso offline

### Seções do formulário

1. **Dados básicos (CA1):** talhão, cultura, cultivar, data, safra, tipo safra, % área
2. **Dados técnicos (CA2):** pop. sem/m, espaçamento, profundidade, taxa semeadura
3. **Tratamento de sementes (CA3):** lista dinâmica (produto, dose, unidade, responsável)
4. **Adubação de base (CA4):** lista dinâmica (formulação, dose kg/ha, modo aplicação)
5. **Máquina e operador (CA5):** máquina, operador, velocidade média
6. **Custos (CA8):** sementes, adubação, tratamento, operação + total automático
7. **Foto do plantio:** câmera com preview
8. **Observações:** campo multiline

## DB Schema (V10)

```sql
-- Cultivares (synced from backend)
cultivars (id, name, crop, obtainer, cycle_days, maturity_group, technology, seed_type, ...)

-- Operações de plantio (offline-first)
planting_operations (id, farm_id, field_plot_id, field_plot_name, cultivar_id, cultivar_name,
  crop, planting_date, season_year, season_type, planted_area_percent,
  population_per_m, row_spacing_cm, depth_cm, seed_rate_kg_ha,
  seed_treatments JSON, base_fertilizations JSON,
  machine_name, operator_name, average_speed_km_h,
  seed_cost, fertilizer_cost, treatment_cost, operation_cost,
  notes, photo_uri, latitude, longitude, synced, ...)
```

## Navegação

Register tab → tipo "Plantio" → `/planting-operation` (tela dedicada)

## API Sync

Payload enqueued para `POST /org/farms/{farmId}/planting-operations` com campos em camelCase,
matching o `CreatePlantingInput` do backend.
