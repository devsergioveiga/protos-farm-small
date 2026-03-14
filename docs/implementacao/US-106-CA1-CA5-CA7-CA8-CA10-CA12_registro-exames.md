# US-106 — Registro de exames dos animais

## CAs implementados: CA1-CA5, CA7-CA8, CA10, CA12

### CA1 — Tipos de exame configuráveis

- Modelo `ExamType` com seed data configurável pelo admin/veterinário
- CRUD completo via `/org/exam-types` (org-scoped)
- Soft delete para manter histórico

### CA2 — Configuração por tipo de exame

- Campos: name, category (MANDATORY/DIAGNOSTIC/ROUTINE), method (LABORATORY/FIELD/IMAGING), material, defaultLab
- Modelo `ExamTypeParam` com parâmetros de referência (paramName, unit, minReference, maxReference, isBooleanResult)
- isRegulatory flag + validityDays para exames obrigatórios

### CA3 — Registro de exame

- Modelo `AnimalExam` com animal individual ou lote (bulk via campaignId)
- Campos: collectionDate, sendDate, laboratory, protocolNumber, responsibleName, veterinaryName
- Endpoint bulk: `/org/farms/:farmId/animal-exams/bulk` (cria para todos animais do lote)

### CA4 — Resultados com comparação automática

- Modelo `ExamResult` com numericValue, booleanValue, textValue
- Auto-cálculo de indicator: NORMAL/ABOVE/BELOW (numérico) ou POSITIVE/NEGATIVE (booleano)
- Endpoint: `POST /org/farms/:farmId/animal-exams/:examId/results`
- Atualiza status do exame para COMPLETED automaticamente

### CA5 — Múltiplos parâmetros

- ExamTypeParam suporta múltiplos parâmetros por tipo (hemograma, bioquímico, OPG)
- Frontend ExamResultsModal renderiza tabela dinâmica baseada nos parâmetros do tipo
- Preview de indicador em tempo real no modal

### CA7 — Exames regulatórios

- isRegulatory flag no ExamType, validityDays para cálculo de vencimento
- Campos no AnimalExam: veterinaryCrmv, certificateNumber, certificateValidity
- Frontend mostra seção regulatória condicional no modal
- Indicador de vencidos no dashboard

### CA8 — Vinculação com tratamento

- Campo linkedTreatmentId no AnimalExam (preparado para integração futura)

### CA10 — Histórico animal

- Listagem por animalId: `GET /org/farms/:farmId/animal-exams?animalId=xxx`
- Resultados incluídos no response para visualização na ficha

### CA12 — Indicadores

- Endpoint: `GET /org/farms/:farmId/animal-exams/indicators`
- pendingResults: exames PENDING + IN_PROGRESS
- expiredRegulatory: exames regulatórios com certificateValidity vencida
- positivityRates: taxa de positividade por tipo de exame

## CAs postergados

- **CA6:** Upload de laudo (PDF/foto) — requer infra de storage
- **CA9:** Vinculação com GTA — depende de módulo GTA futuro
- **CA11:** Importação CSV/Excel em lote — complexo, postergar

## Estrutura

### Backend

- Migration: `20260356100000_add_animal_exams`
- Módulo: `modules/animal-exams/` (types, service, routes, spec)
- 4 enums: ExamCategory, ExamMethod, ExamStatus, ResultIndicator
- 4 modelos: ExamType, ExamTypeParam, AnimalExam, ExamResult
- 14 endpoints (5 exam types + 9 animal exams)
- 24 testes

### Frontend

- Tipos: `types/animal-exam.ts`
- Hooks: `hooks/useExamTypes.ts`, `hooks/useAnimalExams.ts`
- Página: `pages/AnimalExamsPage.tsx` (3 tabs: Exames, Tipos, Indicadores)
- Modais: ExamTypeModal, AnimalExamModal, BulkExamModal, ExamResultsModal
- Sidebar: Exames (FlaskConical icon) no grupo REBANHO
- Rota: `/animal-exams`
