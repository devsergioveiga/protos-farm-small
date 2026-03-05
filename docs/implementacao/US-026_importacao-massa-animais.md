# US-026: Importação em Massa de Animais

## Resumo

Importação em lote de animais via CSV/Excel, com preview de validação, mapeamento de colunas e resolução de genealogia dentro do batch.

## Decisões Técnicas

### Parser (`animal-file-parser.ts`)

- Suporta `.csv` (auto-detecta `;` vs `,`) e `.xlsx`/`.xls` (via exceljs)
- Strip BOM, normaliza line endings, pula linhas vazias
- Limite: 500 linhas por arquivo, 5 MB de tamanho

### Validação e Preview

- Auto-mapping de colunas por aliases normalizados (sem acentos, lowercase)
- Resolução de enums via alias maps (SEX_ALIASES, ORIGIN_ALIASES, CATEGORY_ALIASES)
- Suporte a datas em formato BR (DD/MM/AAAA) e ISO (AAAA-MM-DD)
- Validações: brinco obrigatório, sexo obrigatório, raça existente, soma percentuais = 100%
- Warnings: brinco duplicado no arquivo ou na fazenda, data/categoria/origem inválidos

### Execução da Importação

- Processa linhas sequencialmente para manter consistência
- Reutiliza `createAnimal()` existente para cada linha
- Mantém `Map<earTag, animalId>` para resolução de sire/dam dentro do batch
- Composição racial marcada como estimada (`isCompositionEstimated: true`)

### Frontend

- State machine 6 passos: idle → uploading → mapping → previewing → confirming → done
- Mapeamento agrupado por seção (Identificação, Dados básicos, Composição racial, Saúde)
- Preview com tabela mostrando brinco, nome, sexo, raça, validação
- Botão "Importar animais" (secundário) ao lado do "Novo animal" na AnimalsPage

## Endpoints

| Método | Rota                                      | Permissão        | Descrição             |
| ------ | ----------------------------------------- | ---------------- | --------------------- |
| POST   | `/org/farms/:farmId/animals/bulk/preview` | `animals:create` | Preview com validação |
| POST   | `/org/farms/:farmId/animals/bulk`         | `animals:create` | Executar importação   |

## Arquivos Criados/Modificados

### Criados

- `apps/backend/src/modules/animals/animal-file-parser.ts` — Parser CSV/Excel
- `apps/backend/src/modules/animals/animal-file-parser.spec.ts` — 8 testes do parser
- `apps/backend/fixtures/sample-animals.csv` — Fixture com 8 animais
- `apps/frontend/src/hooks/useBulkImportAnimals.ts` — State machine hook
- `apps/frontend/src/components/animal-bulk-import/AnimalBulkImportModal.tsx` — Modal orquestrador
- `apps/frontend/src/components/animal-bulk-import/AnimalBulkImportModal.css` — Estilos
- `apps/frontend/src/components/animal-bulk-import/AnimalBulkUploadZone.tsx` — Upload zone
- `apps/frontend/src/components/animal-bulk-import/AnimalColumnMappingForm.tsx` — Mapeamento colunas
- `apps/frontend/src/components/animal-bulk-import/AnimalBulkPreviewTable.tsx` — Tabela preview
- `apps/frontend/src/components/animal-bulk-import/AnimalBulkImportReport.tsx` — Relatório
- `apps/frontend/src/components/animal-bulk-import/AnimalBulkImportModal.spec.tsx` — 14 testes

### Modificados

- `apps/backend/package.json` — +exceljs
- `apps/backend/src/modules/animals/animals.types.ts` — Tipos bulk import + aliases
- `apps/backend/src/modules/animals/animals.service.ts` — 4 funções bulk + helpers
- `apps/backend/src/modules/animals/animals.routes.ts` — 2 endpoints + multer
- `apps/backend/src/modules/animals/animals.routes.spec.ts` — 12 novos testes
- `apps/frontend/src/types/animal.ts` — Tipos bulk import
- `apps/frontend/src/pages/AnimalsPage.tsx` — Botão importar + modal
- `apps/frontend/src/pages/AnimalsPage.css` — Estilos btn secondary

## Testes

- Backend: 8 (parser) + 12 (routes/service) = 20 novos testes
- Frontend: 14 novos testes
- Total US-026: 34 novos testes
