---
phase: 30-seguranca-trabalho-nr31
verified: 2026-03-26T00:00:00Z
status: human_needed
score: 15/15 must-haves verified
human_verification:
  - test: "Navegar sidebar — verificar grupo SEGURANÇA aparece abaixo de RH/Folha com 6 itens"
    expected: "Sidebar mostra SEGURANÇA com ítens: EPIs, Entregas EPI, Treinamentos, Registros de Treinamento, ASOs, Dashboard NR-31"
    why_human: "Visibilidade e ordem de itens na sidebar só pode ser confirmada por inspeção visual no browser"
  - test: "Visitar /epi-products e criar um EPI com número CA e validade"
    expected: "Formulário salva, lista atualiza, badge de status CA aparece conforme data de validade"
    why_human: "Fluxo de criação com validação de CA (5-6 dígitos) e comportamento de ComplianceStatusBadge exige interação real"
  - test: "Registrar entrega de EPI e confirmar baixa automática de estoque"
    expected: "Toast 'Entrega registrada. Estoque atualizado automaticamente.' aparece; saldo do produto decresce"
    why_human: "Requer produto em estoque e verificação visual do saldo antes/depois"
  - test: "Registrar treinamento coletivo (2 participantes) e baixar certificado PDF"
    expected: "PDF gerado com nome do colaborador, tipo de treinamento, data, e validade calculada"
    why_human: "Geração de PDF e conteúdo correto só verificável por download e inspeção visual"
  - test: "Registrar ASO com resultado INAPTO e verificar banner de aviso"
    expected: "Banner amarelo aparece dentro do modal com texto 'Colaborador inapto para trabalho'"
    why_human: "Comportamento condicional do banner UI exige interação com o formulário"
  - test: "Visitar /safety-dashboard e verificar 4 KPI cards e 4 abas"
    expected: "Cards mostram Total, Conformes, Com pendências, Vencimentos 30 dias; abas Visao Geral/EPIs/Treinamentos/ASOs visíveis"
    why_human: "Layout responsivo dos cards e contagens corretas de KPI dependem de dados reais do banco"
  - test: "Exportar CSV do dashboard NR-31"
    expected: "Download de arquivo conformidade-nr31-YYYY-MM-DD.csv disparado com dados de conformidade"
    why_human: "Comportamento de download de blob no browser exige verificação manual"
  - test: "Rodar testes do backend: cd apps/backend && npx jest --testPathPattern='epi|training|medical|safety' --no-coverage"
    expected: "Todos os testes passam (82 testes no mínimo)"
    why_human: "Requer ambiente de banco de dados ativo; não executável neste contexto sem servidor"
---

# Phase 30: Segurança do Trabalho NR-31 — Verification Report

**Phase Goal:** Conformidade legal NR-31: EPIs com ficha de entrega, treinamentos obrigatórios com matriz de validade, ASO/PCMSO com alertas de vencimento
**Verified:** 2026-03-26
**Status:** human_needed (todos os checks automatizados passaram)
**Re-verification:** No — verificação inicial

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                              | Status     | Evidence                                                                                                   |
|----|-----------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------|
| 1  | Todas as 8 tabelas NR-31 existem no schema do banco                               | VERIFIED   | schema.prisma linhas 8534-8700: EpiProduct, EpiDelivery, PositionEpiRequirement, TrainingType, TrainingRecord, EmployeeTrainingRecord, PositionTrainingRequirement, MedicalExam |
| 2  | 5 novos enums existem no schema                                                   | VERIFIED   | schema.prisma linhas 8361-8400: EpiType, EpiDeliveryReason, InstructorType, AsoType, AsoResult             |
| 3  | Position.asoPeriodicityMonths com default 12 existe                               | VERIFIED   | schema.prisma linha 7785: `asoPeriodicityMonths Int @default(12)`                                          |
| 4  | EPI: Gerente pode cadastrar produto EPI com CA e configurar requisitos por cargo   | VERIFIED   | epi-products.service.ts 299 linhas, exporta createEpiProduct, listEpiProducts, createPositionEpiRequirement |
| 5  | EPI: Entrega com baixa automática de estoque e restauração ao excluir             | VERIFIED   | epi-deliveries.service.ts linhas 91-119: tx.stockOutput.create + tx.stockBalance.update em transação atômica; INSUFFICIENT_STOCK em linha 82 |
| 6  | EPI: Ficha de EPI em PDF (NR-6) por colaborador                                   | VERIFIED   | epi-deliveries.service.ts: `import('pdfkit')` linha 330, `FICHA DE CONTROLE DE EPI` linha 345             |
| 7  | Treinamento: Tipos NR-31 seedados e protegidos contra edição                     | VERIFIED   | training-types.service.ts: seedNr31TrainingTypes linha 45, SYSTEM_TYPE_READONLY linhas 158/211, NR31_TRAINING_TYPES linha 5 |
| 8  | Treinamento: Registro coletivo com N participantes e expiresAt calculado          | VERIFIED   | training-records.service.ts: createTrainingRecord linha 71, setMonth linha 126, employeeTrainingRecord implícito |
| 9  | Treinamento: Certificado PDF por participante                                     | VERIFIED   | training-records.service.ts: `import('pdfkit')` linha 266, `CERTIFICADO DE TREINAMENTO` linha 280         |
| 10 | ASO: nextExamDate auto-calculado de Position.asoPeriodicityMonths                 | VERIFIED   | medical-exams.service.ts: asoPeriodicityMonths linhas 48/59/61, setMonth linha 89, classifyExpiryAlert linha 9/18 |
| 11 | ASO: Alertas amarelo/vermelho/vencido calculados corretamente                     | VERIFIED   | classifyExpiryAlert() em safety-compliance.types.ts; consumido por medical-exams.service.ts e safety-compliance.service.ts |
| 12 | Dashboard: Agrega EPI + treinamento + ASO por colaborador com resumo e exportação | VERIFIED   | safety-compliance.service.ts 694 linhas: getComplianceSummary linha 347, listNonCompliantEmployees linha 400, generateComplianceReportCsv linha 492, generateComplianceReportPdf linha 557 |
| 13 | app.ts registra os 6 roteadores NR-31                                             | VERIFIED   | app.ts linhas 148-153 (imports) + linhas 295-300 (app.use registrations)                                  |
| 14 | Frontend: 6 páginas existem com hooks wired para APIs reais                       | VERIFIED   | Todas as 6 páginas >100 linhas; hooks importados e usados (EpiProductsPage linha 77, EpiDeliveriesPage linha 73, SafetyDashboardPage linha 79) |
| 15 | Sidebar SEGURANÇA com 6 ítens e router com 6 rotas registradas                   | VERIFIED   | Sidebar.tsx: grupo 'SEGURANÇA' linha 271 com 6 ítens; App.tsx linhas 134-139 + 262-267                    |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact                                                                    | Min Lines | Actual | Status     | Evidence                                                              |
|-----------------------------------------------------------------------------|-----------|--------|------------|-----------------------------------------------------------------------|
| `apps/backend/prisma/schema.prisma`                                         | —         | ~8700+ | VERIFIED   | 8 modelos + 5 enums + asoPeriodicityMonths confirmados                |
| `apps/backend/prisma/migrations/20260507100000_add_safety_nr31_models/migration.sql` | — | presente | VERIFIED | Arquivo existe em migrations/                                    |
| `apps/backend/src/modules/epi-products/epi-products.service.ts`             | —         | 299    | VERIFIED   | Exporta createEpiProduct, listEpiProducts, createPositionEpiRequirement |
| `apps/backend/src/modules/epi-products/epi-products.routes.spec.ts`         | 100       | 17 testes | VERIFIED | 17 casos de teste (mínimo era 8)                                  |
| `apps/backend/src/modules/epi-deliveries/epi-deliveries.service.ts`         | —         | 447    | VERIFIED   | tx.stockOutput.create + INSUFFICIENT_STOCK + pdfkit wired            |
| `apps/backend/src/modules/epi-deliveries/epi-deliveries.routes.spec.ts`     | 150       | 14 testes | VERIFIED | 14 casos de teste (mínimo era 10)                                 |
| `apps/backend/src/modules/training-types/training-types.service.ts`         | —         | 317    | VERIFIED   | seedNr31TrainingTypes + SYSTEM_TYPE_READONLY                          |
| `apps/backend/src/modules/training-types/training-types.routes.spec.ts`     | —         | 18 testes | VERIFIED | 18 casos de teste (mínimo era 10)                                 |
| `apps/backend/src/modules/training-records/training-records.service.ts`     | —         | 340    | VERIFIED   | createTrainingRecord + setMonth + CERTIFICADO DE TREINAMENTO          |
| `apps/backend/src/modules/training-records/training-records.routes.spec.ts` | —         | 12 testes | VERIFIED | 12 casos de teste (mínimo era 8)                                  |
| `apps/backend/src/modules/medical-exams/medical-exams.service.ts`           | —         | 226    | VERIFIED   | createMedicalExam + asoPeriodicityMonths + classifyExpiryAlert        |
| `apps/backend/src/modules/medical-exams/medical-exams.routes.spec.ts`       | —         | 11 testes | VERIFIED | 11 casos de teste (mínimo era 8)                                  |
| `apps/backend/src/modules/safety-compliance/safety-compliance.service.ts`   | —         | 694    | VERIFIED   | getComplianceSummary + listNonCompliantEmployees + CSV + PDF           |
| `apps/backend/src/modules/safety-compliance/safety-compliance.routes.spec.ts` | —       | 10 testes | VERIFIED | 10 casos de teste (mínimo era 8)                                  |
| `apps/frontend/src/types/epi.ts`                                            | —         | presente | VERIFIED | EpiProduct, EpiDelivery, EPI_TYPES, EPI_TYPE_LABELS                  |
| `apps/frontend/src/types/training.ts`                                       | —         | presente | VERIFIED | TrainingType, TrainingRecord, INSTRUCTOR_TYPE_LABELS                  |
| `apps/frontend/src/types/medical-exam.ts`                                   | —         | presente | VERIFIED | MedicalExam, AsoType, AsoResult, ASO_TYPE_LABELS, ASO_RESULT_LABELS   |
| `apps/frontend/src/types/safety.ts`                                         | —         | presente | VERIFIED | ComplianceSummary, EmployeeCompliance, ComplianceAlertLevel           |
| `apps/frontend/src/hooks/useEpiProducts.ts`                                 | —         | presente | VERIFIED | fetchEpiProducts wired                                               |
| `apps/frontend/src/hooks/useEpiDeliveries.ts`                               | —         | presente | VERIFIED | downloadEpiFichaPdf wired                                            |
| `apps/frontend/src/hooks/useTrainingTypes.ts`                               | —         | presente | VERIFIED | fetchTrainingTypes + seedNr31Types                                   |
| `apps/frontend/src/hooks/useTrainingRecords.ts`                             | —         | presente | VERIFIED | downloadCertificatePdf wired                                         |
| `apps/frontend/src/hooks/useMedicalExams.ts`                                | —         | presente | VERIFIED | fetchMedicalExams + createMedicalExam                                |
| `apps/frontend/src/hooks/useSafetyCompliance.ts`                            | —         | presente | VERIFIED | fetchSummary + fetchNonCompliantEmployees + exportCsv + exportPdf     |
| `apps/frontend/src/components/shared/ComplianceStatusBadge.tsx`             | —         | 71 linhas | VERIFIED | Exporta ComplianceStatusBadge, 4 estados com ícone + cor             |
| `apps/frontend/src/components/shared/SafetyKpiCard.tsx`                     | —         | presente | VERIFIED | Exporta SafetyKpiCard, toLocaleString, safety-kpi-card__value         |
| `apps/frontend/src/pages/EpiProductsPage.tsx`                               | 100       | 456    | VERIFIED   | ComplianceStatusBadge + aba "Requisitos por Cargo" + empty state      |
| `apps/frontend/src/pages/EpiDeliveriesPage.tsx`                             | 100       | 514    | VERIFIED   | "Ficha por Colaborador" tab + downloadEpiFichaPdf                     |
| `apps/frontend/src/pages/TrainingTypesPage.tsx`                             | 100       | 362    | VERIFIED   | Badge "Sistema" + aria-label "nao editavel" + aba "Requisitos por Cargo" |
| `apps/frontend/src/pages/TrainingRecordsPage.tsx`                           | 100       | 372    | VERIFIED   | ComplianceStatusBadge + "Registrar Treinamento"                       |
| `apps/frontend/src/pages/MedicalExamsPage.tsx`                              | 100       | 359    | VERIFIED   | ASO_TYPE_LABELS + ComplianceStatusBadge + "Nenhum ASO registrado"     |
| `apps/frontend/src/pages/SafetyDashboardPage.tsx`                           | 200       | 628    | VERIFIED   | 4 SafetyKpiCard + 4 tabs + Exportar CSV + Relatorio PDF + empty state |

---

### Key Link Verification

| From                                | To                                             | Via                                          | Status   | Evidence                                                         |
|-------------------------------------|------------------------------------------------|----------------------------------------------|----------|------------------------------------------------------------------|
| `epi-deliveries.service.ts`         | StockOutput + StockBalance                     | `tx.stockOutput.create` em withRlsContext     | WIRED    | Linhas 91-119: criação atômica de StockOutput + decremento de StockBalance |
| `epi-deliveries.service.ts`         | pdfkit                                         | `import('pdfkit')` dinâmico                  | WIRED    | Linha 330: `const PDFDocument = (await import('pdfkit')).default` |
| `training-records.service.ts`       | EmployeeTrainingRecord                         | createMany com cálculo de expiresAt           | WIRED    | Linha 126: `d.setMonth(d.getMonth() + defaultValidityMonths)`    |
| `training-types.service.ts`         | NR31_TRAINING_TYPES                            | seed via upsert/findFirst+create              | WIRED    | Linha 5: import NR31_TRAINING_TYPES; linha 45: seedNr31TrainingTypes loop |
| `medical-exams.service.ts`          | Position.asoPeriodicityMonths                  | employee.contract.position.asoPeriodicityMonths | WIRED  | Linhas 48/59/61: query da posição; linha 89: setMonth            |
| `safety-compliance.service.ts`      | EpiDelivery + EmployeeTrainingRecord + MedicalExam | 3 queries paralelas fundidas por employeeId | WIRED  | Linhas 291/318/347: classifyExpiryAlert em cada dimensão         |
| `app.ts`                            | 6 roteadores Phase 30                          | import + app.use('/api', router)             | WIRED    | Linhas 148-153 (imports) + 295-300 (registrations)              |
| `EpiProductsPage.tsx`               | /api/epi-products                              | useEpiProducts hook                           | WIRED    | Linha 3: import; linha 77: destructuring de useEpiProducts()     |
| `SafetyDashboardPage.tsx`           | /api/safety-compliance/summary + /employees   | useSafetyCompliance hook                     | WIRED    | Linha 13: import; linha 79: destructuring; hook aponta para /org/safety-compliance/* |
| `useSafetyCompliance.ts`            | /safety-compliance/report/csv + /report/pdf    | api.getBlob + download/window.open           | WIRED    | Linhas 89 e 111: api.getBlob para CSV e PDF                      |
| `Sidebar.tsx`                       | Grupo SEGURANÇA com 6 ítens                    | array de rotas com ícones                    | WIRED    | Linha 271: title 'SEGURANÇA' + linhas 273-278: 6 ítens           |
| `App.tsx`                           | 6 rotas NR-31                                  | lazy() + Route element                       | WIRED    | Linhas 134-139 (lazy) + 262-267 (Route)                          |

---

### Data-Flow Trace (Level 4)

| Artifact                        | Data Variable     | Source                                    | Produces Real Data | Status    |
|---------------------------------|-------------------|-------------------------------------------|--------------------|-----------|
| `EpiProductsPage.tsx`           | epiProducts       | useEpiProducts → GET /api/epi-products    | Sim (Prisma query) | FLOWING   |
| `SafetyDashboardPage.tsx`       | summary           | useSafetyCompliance → GET /org/safety-compliance/summary | Sim (5 queries paralelas + merge) | FLOWING |
| `safety-compliance.service.ts`  | complianceSummary | getComplianceSummary: queries EpiDelivery, EmployeeTrainingRecord, MedicalExam | Sim (DB queries) | FLOWING |
| `epi-deliveries.service.ts`     | StockBalance      | tx.stockBalance.findUnique + tx.stockBalance.update | Sim (Prisma transaction) | FLOWING |

---

### Behavioral Spot-Checks

| Behavior                                              | Command                                                                                     | Result  | Status |
|-------------------------------------------------------|---------------------------------------------------------------------------------------------|---------|--------|
| epi-products module exporta funções corretas          | `grep -c "export async function" apps/backend/src/modules/epi-products/epi-products.service.ts` | 8       | PASS   |
| epi-deliveries: tx.stockOutput.create existe          | `grep -c "tx.stockOutput.create" apps/backend/src/modules/epi-deliveries/epi-deliveries.service.ts` | 1     | PASS   |
| safety-compliance: CSV e PDF exportam                 | `grep -c "export async function generate" apps/backend/src/modules/safety-compliance/safety-compliance.service.ts` | 2 | PASS |
| Frontend compila (tsc —noEmit)                        | (não executável sem ambiente; declarado PASSED em 30-07-SUMMARY.md)                        | PASSED  | ? SKIP |
| Backend testes (82 tests)                             | `cd apps/backend && npx jest —testPathPattern="epi\|training\|medical\|safety"` — requer DB | —       | ? SKIP (banco necessário) |

---

### Requirements Coverage

| Requirement | Source Plan   | Description                                                                                                                              | Status         | Evidence                                                                    |
|-------------|---------------|-----------------------------------------------------------------------------------------------------------------------------------------|----------------|-----------------------------------------------------------------------------|
| SEGUR-01    | 30-01, 30-02, 30-05 | Controle de EPIs: cadastro com CA e validade, ficha de entrega por colaborador, baixa de estoque, alertas, PDF                  | SATISFIED      | epi-products.service.ts + epi-deliveries.service.ts (stock + PDF) + EpiProductsPage + EpiDeliveriesPage |
| SEGUR-02    | 30-01, 30-03, 30-06 | Treinamentos obrigatórios NR-31: seed, registro coletivo, validade configurável, alerta 30 dias, certificado PDF, matriz por cargo | SATISFIED      | training-types.service.ts (seed + SYSTEM_TYPE_READONLY) + training-records.service.ts (expiresAt calc + PDF) + TrainingTypesPage + TrainingRecordsPage |
| SEGUR-03    | 30-01, 30-04, 30-06, 30-07 | ASOs: tipos completos, periodicidade configurável, alertas de vencimento, integração com dashboard, relatório conformidade    | SATISFIED      | medical-exams.service.ts (asoPeriodicityMonths + classifyExpiryAlert) + safety-compliance.service.ts (CSV + PDF) + MedicalExamsPage + SafetyDashboardPage |

Nenhum requisito SEGUR-* orfão identificado. Todos os 3 IDs declarados nos planos correspondem às entradas em REQUIREMENTS.md com status "Complete" na coluna Phase 30.

---

### Anti-Patterns Found

Nenhum anti-padrão crítico encontrado. Verificação realizada nos 6 services do backend e nas 6 páginas frontend:

- Sem `return null` como implementação completa de componentes
- Sem `TODO/FIXME/PLACEHOLDER` em código de produção
- Sem rotas API retornando `[]` sem query ao banco
- Sem handlers de formulário com apenas `e.preventDefault()`
- Sem props com valores hardcoded vazios (`={}`, `=[]`) passados para componentes de renderização

Nota informativa (não bloqueante): `(tx as any)` cast em `epi-deliveries.service.ts` (padrão herdado de outros módulos conforme SUMMARY 30-02 — "Auto-fixed" jest.config.js). Não afeta funcionalidade.

---

### Human Verification Required

#### 1. Sidebar e navegação visual

**Test:** Abrir o frontend no browser, verificar que o grupo "SEGURANÇA" aparece na sidebar abaixo de "RH/Folha" com exatamente 6 ítens na ordem correta.
**Expected:** EPIs, Entregas EPI, Treinamentos, Registros de Treinamento, ASOs, Dashboard NR-31
**Why human:** Ordem e visibilidade na sidebar dependem de renderização real; grep confirma ítens mas não posição relativa.

#### 2. Fluxo completo de entrega de EPI com baixa de estoque

**Test:** Cadastrar um EPI (produto com CA), criar entrega para colaborador, verificar toast e saldo de estoque decrementado.
**Expected:** Toast "Entrega registrada. Estoque atualizado automaticamente." + saldo decresce no módulo de Estoque.
**Why human:** Integração entre epi-deliveries e stock-outputs requer banco ativo e verificação de saldo antes/depois.

#### 3. PDF da Ficha de EPI (NR-6)

**Test:** Acessar aba "Ficha por Colaborador" em /epi-deliveries, selecionar colaborador, clicar "Imprimir Ficha EPI".
**Expected:** PDF abre em nova aba com header "FICHA DE CONTROLE DE EPI", tabela de entregas, rodapé de assinatura.
**Why human:** Conteúdo visual do PDF gerado pelo pdfkit só verificável por inspeção.

#### 4. Certificado de treinamento por participante

**Test:** Em /training-records, expandir um registro de treinamento, clicar "Baixar Certificado" para um participante.
**Expected:** PDF com "CERTIFICADO DE TREINAMENTO", nome do colaborador, data, validade calculada.
**Why human:** Conteúdo do PDF só verificável por inspeção visual.

#### 5. Dashboard KPIs com dados reais

**Test:** Acessar /safety-dashboard com dados de EPI, treinamentos e ASOs cadastrados.
**Expected:** 4 KPI cards mostram valores corretos; tabs EPI/Treinamentos/ASOs mostram pendências filtradas.
**Why human:** Lógica de agregação dos 5 queries paralelos em getComplianceSummary só verificável com dados reais no banco.

#### 6. Exportação CSV e PDF do dashboard

**Test:** Clicar "Exportar CSV" e "Relatório PDF" no dashboard NR-31.
**Expected:** Download de `conformidade-nr31-YYYY-MM-DD.csv` + PDF abre em nova aba.
**Why human:** Comportamento de download de blob e abertura de janela requer verificação manual no browser.

#### 7. Testes backend completos

**Test:** `cd apps/backend && npx jest --testPathPattern="epi|training|medical|safety" --no-coverage`
**Expected:** Todos os 82 testes passam (17 epi-products + 14 epi-deliveries + 18 training-types + 12 training-records + 11 medical-exams + 10 safety-compliance).
**Why human:** Requer banco de dados PostgreSQL ativo — não executável no ambiente de verificação.

---

### Gaps Summary

Nenhum gap bloqueante identificado. Todos os 15 must-haves foram verificados como VERIFIED nos níveis 1 (existência), 2 (substantividade) e 3 (wiring). Os data-flows Level 4 confirmam que as queries ao banco são reais (sem retornos estáticos ou arrays vazios hardcoded).

O status `human_needed` reflete que 8 itens precisam de verificação manual — principalmente fluxos de UI, geração de PDFs, e execução do suite de testes completo (que requer banco de dados). Todos os checks automatizados programáticos passaram.

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
