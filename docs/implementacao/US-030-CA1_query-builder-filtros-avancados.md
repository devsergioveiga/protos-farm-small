# US-030 CA1 — Query Builder com Filtros Avançados e Exportação CSV

## Resumo

Amplia o backend de listagem de animais com filtros avançados (lote, datas, peso, idade), ordenação dinâmica e endpoint de exportação CSV. Base para a UI avançada dos CAs seguintes.

## Decisões de Design

| Decisão                        | Motivo                                                               |
| ------------------------------ | -------------------------------------------------------------------- |
| `buildAnimalsWhere()` extraído | Reutilizado por `listAnimals` e `exportAnimalsCsv`, DRY              |
| Default limit 20 → 50          | Rebanhos típicos têm centenas de animais, 20 era pouco               |
| Age via birthDate calc         | `minAgeDays`/`maxAgeDays` convertidos em range de birthDate no where |
| Merge age + birthDate          | Se ambos informados, usa o filtro mais restritivo                    |
| CSV com BOM + `;`              | Padrão pt-BR para abrir corretamente no Excel                        |
| Include `lot` na listagem      | Enriquece resposta, backward-compatible (campo adicional)            |
| Export sem paginação           | Busca todos os matches para gerar CSV completo                       |
| `parseNumericParam` na rota    | Valida NaN antes de chamar service, retorna 400 com campo específico |

## Backend

### Tipos (`animals.types.ts`)

**Novos campos em `ListAnimalsQuery`:**

- `lotId?: string` — filtro por lote atual
- `birthDateFrom?: string` / `birthDateTo?: string` — range de nascimento (ISO)
- `minWeightKg?: number` / `maxWeightKg?: number` — range de peso entrada
- `minAgeDays?: number` / `maxAgeDays?: number` — range de idade (calculado)
- `sortBy?: AnimalSortField` / `sortOrder?: 'asc' | 'desc'` — ordenação

**Novas constantes:**

- `ANIMAL_SORT_FIELDS` — `earTag`, `name`, `birthDate`, `entryWeightKg`, `createdAt`
- `ANIMAL_CSV_HEADERS` — 14 cabeçalhos pt-BR
- `ANIMAL_SEX_LABELS_PT` — `MALE → Macho`, `FEMALE → Fêmea`
- `ANIMAL_ORIGIN_LABELS_PT` — `BORN → Nascido`, `PURCHASED → Comprado`

### Service (`animals.service.ts`)

**`buildAnimalsWhere(farmId, query)`** — função interna:

- Filtros básicos: search (OR earTag/name/rfidTag), sex, category, origin, breedId
- `lotId` → `where.lotId`
- Weight range → `where.entryWeightKg = { gte, lte }`
- BirthDate range → `where.birthDate = { gte, lte }`
- Age → converte em birthDate: `minAgeDays` → `birthDate <= hoje - X`, `maxAgeDays` → `birthDate >= hoje - X`
- Merge inteligente: se age e birthDate coexistem, usa o mais restritivo

**`listAnimals` atualizado:**

- Default limit: 50 (max 100)
- Ordenação dinâmica: `orderBy: { [sortBy]: sortOrder }`, fallback `createdAt desc`
- Include adicional: `lot: { select: { id, name } }`

**`exportAnimalsCsv(ctx, farmId, query)`** — nova função:

- Reutiliza `buildAnimalsWhere`
- Sem paginação (busca todos)
- Retorna string: BOM (`\uFEFF`) + header + linhas, separador `;`
- 14 colunas: Brinco, Nome, Sexo, Nascimento, Categoria, Origem, Raça(s), Peso Entrada, ECC, Lote, Pai, Mãe, RFID, Observações

### Routes (`animals.routes.ts`)

| Método | Rota                                | Permissão      | Descrição            |
| ------ | ----------------------------------- | -------------- | -------------------- |
| GET    | `/org/farms/:farmId/animals`        | `animals:read` | Listagem com filtros |
| GET    | `/org/farms/:farmId/animals/export` | `animals:read` | Exportação CSV       |

**Novos query params (ambos endpoints):**

`lotId`, `birthDateFrom`, `birthDateTo`, `minWeightKg`, `maxWeightKg`, `minAgeDays`, `maxAgeDays`, `sortBy`, `sortOrder`

**Validação:** params numéricos passam por `parseNumericParam()` — NaN retorna 400 com nome do campo.

**Endpoint export:** registrado antes de `/:animalId`. Headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="animais-{farmId}.csv"`.

### Testes — 9 novos specs (`animals.routes.spec.ts`)

| Teste              | Verifica                                   |
| ------------------ | ------------------------------------------ |
| lotId filter       | Passa lotId ao service                     |
| birthDate range    | Passa birthDateFrom/To ao service          |
| weight range       | Converte para number e passa ao service    |
| age range          | Converte para number e passa ao service    |
| sortBy + sortOrder | Passa params de ordenação ao service       |
| NaN numeric param  | Retorna 400 com nome do campo              |
| export CSV headers | Content-Type, Content-Disposition corretos |
| export com filtros | Passa filtros ao exportAnimalsCsv          |
| export sem auth    | Retorna 401                                |

## Contagem de Testes

- **Backend:** 687 testes (9 novos)
- **Frontend:** sem alteração
- **Total:** 687 backend + frontend

## Referência — US-030 Completa

Documento original: `ProtosFarm_Fase1_Fundacao_MVP_UserStories.docx`

> **US-030 — Busca e filtros avançados do rebanho**
>
> Como gerente pecuário, quero buscar e filtrar animais por diversos critérios, para eu encontre rapidamente os animais que preciso para uma ação de manejo.
>
> 1. ✅ Busca por brinco, nome ou RFID — **CA1**
> 2. ⬜ Filtros combináveis: raça, sexo, categoria, lote, local, faixa de idade, faixa de peso
> 3. ⬜ Filtros especiais: prenhas, vazias, em carência, em lactação, secas, aptas para descarte
> 4. ⬜ Resultado com contagem total e peso médio do grupo filtrado
> 5. ✅ Exportação do resultado filtrado em CSV/Excel — **CA1**
> 6. ⬜ Seleção múltipla para ações em lote (mover, registrar evento)
