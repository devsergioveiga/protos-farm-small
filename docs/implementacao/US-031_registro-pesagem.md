# US-031 — Registro de Pesagem

## Resumo

CRUD completo de pesagens de animais com gráfico de evolução de peso, cálculo automático de ganho (GMD), alerta de variação anormal, cards de estatísticas, exportação CSV e seed com dados realistas. Implementado como US-029 CA2 no código.

## Referência — Critérios de Aceite Originais

> **US-031 — Registro de pesagem**
>
> Como vaqueiro, quero registrar o peso dos animais, para eu acompanhe o desenvolvimento das crias/novilhas e a condição corporal do rebanho.

| #   | Critério                                                                               | Status                           |
| --- | -------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | Registro por animal: brinco, peso, data, tipo (nascimento, desmama, rotina, pré-parto) | ✅                               |
| 2   | Cálculo automático de ganho de peso desde última pesagem                               | ✅                               |
| 3   | Modo de registro rápido: digitar brinco + peso em sequência                            | ⬜ Futuro (US-031 CA3 ou mobile) |
| 4   | Integração futura com balança digital (campo para observação)                          | ✅ Campo `notes` disponível      |
| 5   | Alerta se peso registrado for > 20% diferente do último (possível erro)                | ✅ Validação no service          |
| 6   | Pesagem em lote: pesar e registrar grupo sequencialmente                               | ⬜ Futuro (mobile)               |

## Decisões de Design

| Decisão                           | Motivo                                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| Tabela `animal_weighings`         | Separada de `animals` para histórico ilimitado de pesagens          |
| `weightKg` DECIMAL(8,2)           | Precisão de centésimos de kg, suficiente para bovinos               |
| `measuredAt` DATE (não TIMESTAMP) | Pesagem é evento diário, não precisa horário                        |
| `bodyConditionScore` CHECK 1-5    | Constraint no banco garante integridade mesmo sem validação app     |
| Sem soft-delete                   | Pesagens podem ser deletadas — não são documentos legais            |
| `animals:update` para CUD         | Operador pode registrar pesagens sem ter permissão de CRUD completo |
| Chart lazy-loaded (recharts)      | Evita bundle pesado se usuário não visualiza aba Pesagens           |
| GMD = (última - primeira) / dias  | Ganho Médio Diário calculado no stats, não persistido               |

## Database

### Migration `20260316100000_animal_weighings`

```sql
CREATE TABLE animal_weighings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "animalId" TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  "farmId" TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  "weightKg" DECIMAL(8,2) NOT NULL,
  "measuredAt" DATE NOT NULL,
  "bodyConditionScore" INTEGER CHECK ("bodyConditionScore" BETWEEN 1 AND 5),
  notes TEXT,
  "recordedBy" TEXT NOT NULL REFERENCES users(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- RLS habilitado com `tenant_isolation_policy` (via `farms.organizationId`)
- 3 índices: `animalId`, `farmId`, `measuredAt`

## Backend

### Tipos (`animal-weighing.types.ts`)

- `AnimalWeighingError` — error class com statusCode
- `CreateWeighingInput` — `{ weightKg, measuredAt, bodyConditionScore?, notes? }`
- `UpdateWeighingInput` — partial update
- `WeighingItem` — resposta com `recorderName`, datas formatadas
- `WeighingStats` — `currentWeightKg`, `entryWeightKg`, `totalGainKg`, `gmdKgDay`, `minWeightKg`, `maxWeightKg`, `totalWeighings`

### Service (`animal-weighing.service.ts`) — 6 funções

| Função               | Descrição                                                      |
| -------------------- | -------------------------------------------------------------- |
| `listWeighings`      | Lista pesagens por animal, ordena por `measuredAt` DESC        |
| `createWeighing`     | Valida peso (0.01-9999), data (não futuro), BCS (1-5)          |
| `updateWeighing`     | Update parcial com mesmas validações                           |
| `deleteWeighing`     | Deleção permanente (não soft-delete)                           |
| `getWeighingStats`   | Calcula peso atual, GMD, ganho total, min/max, contagem        |
| `exportWeighingsCsv` | BOM UTF-8 + `;`, colunas: Data, Peso, ECC, Registrado por, Obs |

**Cálculo de Stats:**

- **Peso atual:** última pesagem por `measuredAt`
- **Peso entrada:** `animal.entryWeightKg` (do cadastro)
- **Ganho total:** peso atual − peso entrada (ou primeira pesagem se sem entrada)
- **GMD:** (última − primeira) / dias entre elas
- **Min/Max:** valores extremos do histórico

### Routes (`animal-weighing.routes.ts`)

| Método | Rota                                                         | Permissão        |
| ------ | ------------------------------------------------------------ | ---------------- |
| GET    | `/org/farms/:farmId/animals/:animalId/weighings`             | `animals:read`   |
| POST   | `/org/farms/:farmId/animals/:animalId/weighings`             | `animals:update` |
| PATCH  | `/org/farms/:farmId/animals/:animalId/weighings/:weighingId` | `animals:update` |
| DELETE | `/org/farms/:farmId/animals/:animalId/weighings/:weighingId` | `animals:update` |
| GET    | `/org/farms/:farmId/animals/:animalId/weighings/stats`       | `animals:read`   |
| GET    | `/org/farms/:farmId/animals/:animalId/weighings/export`      | `animals:read`   |

Middleware stack: `authenticate` → `checkPermission` → `checkFarmAccess` + `logAudit` (fire-and-forget) para CUD.

### Testes — 13 specs (`animal-weighing.routes.spec.ts`)

- LIST: retorna pesagens, 401 sem token, 403 sem permissão
- CREATE: nova pesagem + audit, 400 validação
- UPDATE: atualiza + audit, 404 não encontrado
- DELETE: deleta + audit, 404 não encontrado
- STATS: retorna stats, stats vazio sem pesagens
- EXPORT: headers CSV, content-disposition
- Error handling: 500 para erros inesperados

## Frontend

### Hook (`useAnimalWeighings.ts`)

```typescript
useAnimalWeighings(farmId, animalId) → {
  weighings, stats, isLoading, error,
  refetch(), createWeighing(), updateWeighing(), deleteWeighing()
}
```

- Fetch paralelo (weighings + stats) via `Promise.all`
- Auto-refetch após mutações
- Null-safe (verifica farmId && animalId)

### Componentes

| Componente            | Descrição                                                        |
| --------------------- | ---------------------------------------------------------------- |
| `WeighingTab`         | Container principal — skeleton loading, empty state, toast       |
| `WeighingStatsCards`  | 4 cards: Peso atual, GMD (com seta trend), Ganho total, Total    |
| `WeighingChart`       | Gráfico recharts (lazy-loaded via `React.lazy` + `Suspense`)     |
| `WeighingRecordsList` | Desktop: tabela. Mobile: cards empilhados. Botões edit/delete    |
| `CreateWeighingModal` | Modal HTML `<dialog>` — peso, data, ECC, notas. Modo edit/create |
| `WeighingExport`      | Botão download CSV via `api.getBlob()`                           |

**Integração:** Aba "Pesagens" no `AnimalDetailPage.tsx`.

### Testes — 12 specs (`WeighingTab.spec.tsx`)

## Seed

14 pesagens para 3 animais da Fazenda Santa Helena:

- **Mimosa (SH-001)** — Vaca lactação, 5 pesagens (520-530 kg)
- **Trovão (SH-004)** — Touro, 5 pesagens (680-695 kg)
- **Flor (SH-007)** — Bezerra, 4 pesagens (180-210 kg)

## Dependências Adicionadas

- **Frontend:** `recharts` — gráficos de evolução de peso

## Contagem de Testes

- **Backend:** 638 testes (13 novos)
- **Frontend:** 35 testes (12 WeighingTab + 23 AnimalDetailPage ajustados)

## Arquivos Criados

### Backend

- `prisma/migrations/20260316100000_animal_weighings/migration.sql`
- `src/modules/animals/animal-weighing.types.ts`
- `src/modules/animals/animal-weighing.service.ts`
- `src/modules/animals/animal-weighing.routes.ts`
- `src/modules/animals/animal-weighing.routes.spec.ts`

### Frontend

- `src/hooks/useAnimalWeighings.ts`
- `src/components/animals/WeighingTab.tsx` + `.css`
- `src/components/animals/WeighingStatsCards.tsx` + `.css`
- `src/components/animals/WeighingChart.tsx` + `.css`
- `src/components/animals/WeighingRecordsList.tsx` + `.css`
- `src/components/animals/CreateWeighingModal.tsx` + `.css`
- `src/components/animals/WeighingExport.tsx` + `.css`
- `src/components/animals/WeighingTab.spec.tsx`

### Modificados

- `prisma/schema.prisma` — model AnimalWeighing
- `prisma/seed.ts` — 14 pesagens
- `src/app.ts` — registro do router
- `src/types/animal.ts` — tipos frontend
- `src/pages/AnimalDetailPage.tsx` — aba Pesagens
