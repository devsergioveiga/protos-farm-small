# Phase 30 — Segurança do Trabalho Rural (NR-31) — CONTEXT

> Decisions locked during discuss-phase. Downstream agents (researcher, planner) must follow these.

## Scope

Conformidade legal NR-31: controle de EPIs com ficha e estoque, treinamentos obrigatórios com matriz de validade, ASOs/PCMSO com alertas de vencimento, e dashboard unificado de conformidade.

---

## Decision 1: Controle de EPIs

### EPI no estoque

- **EPI é um Product existente** com `category = 'EPI'`
- Tabela adicional `EpiProduct` vinculada ao `Product` com campos específicos: `caNumber` (número CA), `caExpiry` (validade CA), `epiType` (enum: CAPACETE, LUVA, BOTA, OCULOS, PROTETOR_AURICULAR, MASCARA, AVENTAL, CINTO, PERNEIRA, OUTROS)
- Saída de estoque via `StockOutput` existente (type = `CONSUMPTION`)

### Entrega de EPI ao colaborador

- Tabela `EpiDelivery`: date, employeeId, epiProductId, quantity, reason (enum: NOVO, TROCA, DANIFICADO, EXTRAVIO), signatureUrl (upload imagem assinatura, opcional), observations, stockOutputId (vínculo com baixa)
- Baixa automática no estoque via criação de `StockOutput` + `StockOutputItem` ao registrar entrega
- Upload de assinatura: mesmo padrão `uploads/employees/{employeeId}/epi/`

### EPI obrigatório por função

- Tabela `PositionEpiRequirement`: positionId + epiProductId (ou productId do EPI) + quantity (quantidade mínima)
- Alerta automático quando colaborador da função não tem EPI válido (entregue e CA não vencido)
- Compliance = colaborador tem todas as entregas ativas para os EPIs obrigatórios de sua Position

### Ficha de EPI em PDF

- PDF individual por colaborador (padrão NR-6) via pdfkit
- Cabeçalho: dados empresa, dados colaborador, função
- Tabela: data entrega, descrição EPI, número CA, quantidade, motivo, espaço assinatura
- Endpoint: `GET /api/epi-deliveries/employees/:employeeId/pdf`

---

## Decision 2: Treinamentos NR-31

### Tipos de treinamento (seed)

- Todos os obrigatórios NR-31 pré-cadastrados via seed:
  - Integração (NR-31.7) — 8h — validade 12 meses
  - Agrotóxicos (NR-31.8) — 20h — validade 12 meses
  - Máquinas e implementos (NR-31.12) — 16h — validade 24 meses
  - Instalações elétricas (NR-31.9) — 40h — validade 24 meses
  - Transporte de trabalhadores (NR-31.13) — 8h — validade 12 meses
  - Trabalho em altura (NR-35) — 8h — validade 24 meses
  - CIPA rural (NR-31.7.3) — 20h — validade 12 meses
- Tabela `TrainingType`: name, description, minHours, defaultValidityMonths, nrReference, isSystem (seed = true, não editável)
- Usuário pode criar treinamentos adicionais (isSystem = false)

### Treinamento obrigatório por função

- Tabela `PositionTrainingRequirement`: positionId + trainingTypeId
- Mesma lógica de compliance dos EPIs: alerta quando colaborador não tem treinamento válido
- Treinamentos com `isGlobal = true` (ex: Integração) são obrigatórios para TODAS as funções

### Registro de treinamento realizado

- Tabela `TrainingRecord`: date, trainingTypeId, instructorName, instructorType (enum: INTERNO, EXTERNO), instructorRegistration (CRM/CREA), effectiveHours, location, observations, certificateUrl (upload), attendanceListUrl (upload), farmId, organizationId
- Tabela `EmployeeTrainingRecord`: trainingRecordId + employeeId + expiresAt (calculado: date + validityMonths)
- Um TrainingRecord pode ter N participantes (treinamento coletivo)

### Certificado PDF

- PDF individual por participante via pdfkit
- Dados: nome treinamento, NR referência, carga horária, data, nome colaborador, instrutor, validade
- Endpoint: `GET /api/training-records/:id/employees/:employeeId/certificate`

---

## Decision 3: ASO e PCMSO

### Tipos de ASO

- Enum `AsoType`: ADMISSIONAL, PERIODICO, RETORNO_TRABALHO, MUDANCA_RISCO, DEMISSIONAL
- Tabela `MedicalExam` (ASO): employeeId, type (AsoType), date, doctorName, doctorCrm, result (enum: APTO, INAPTO, APTO_COM_RESTRICAO), restrictions (text, quando APTO_COM_RESTRICAO), nextExamDate, documentUrl (upload do ASO digitalizado), observations, farmId, organizationId

### Integração com admissão/rescisão

- **Alerta, não bloqueante**: ao admitir colaborador → dashboard mostra pendência de ASO admissional se não existe
- Ao rescindir → dashboard mostra pendência de ASO demissional
- Não bloqueia fluxos de admissão/rescisão

### Periodicidade por função/risco

- Campo `asoPeriodicityMonths` na tabela `Position` (default: 12, atividades de risco: 6)
- Ao registrar ASO periódico, `nextExamDate` = date + asoPeriodicityMonths da Position do colaborador
- Se Position não define, usa 12 meses padrão

### Alertas de vencimento

- Amarelo: 30 dias antes do vencimento
- Vermelho: 15 dias antes do vencimento
- Vencido: após nextExamDate
- Visível no dashboard de conformidade e na ficha do colaborador

---

## Decision 4: Dashboard e Relatórios

### Dashboard unificado por fazenda

- Rota: `/safety-dashboard`
- Cards resumo: total colaboradores, % conforme (tem EPI + treino + ASO ok), pendentes EPI, treinos vencendo (30d), ASOs vencendo (30d)
- Tabela de colaboradores irregulares com filtros por tipo de pendência (EPI, treinamento, ASO)
- Filtro por fazenda (FarmContext existente)

### Relatórios

- CSV: lista tabulada de pendências (nome, função, tipo pendência, detalhe, vencimento)
- PDF consolidado por fazenda: resumo de conformidade NR-31, seções EPI/treinamento/ASO, lista de irregulares
- Endpoints: `GET /api/safety-compliance/report/csv`, `GET /api/safety-compliance/report/pdf`

### Navegação frontend

- Novo grupo **SEGURANÇA** no sidebar, abaixo do grupo RH/Folha
- Sub-itens: EPIs, Treinamentos, ASOs, Dashboard NR-31
- Ícone: `Shield` (lucide-react)

---

## Reuse from existing codebase

| Asset                       | Where                              | Reuse how                                   |
| --------------------------- | ---------------------------------- | ------------------------------------------- |
| Product model               | `schema.prisma`                    | EPI = Product com category EPI + EpiProduct |
| StockOutput/StockOutputItem | `modules/stock-outputs/`           | Baixa automática ao entregar EPI            |
| Position model              | `schema.prisma`                    | Vincular EPIs e treinamentos obrigatórios   |
| Employee model              | `schema.prisma`                    | Destino de entregas, treinamentos e ASOs    |
| pdfkit pattern              | `modules/pesticide-prescriptions/` | Gerar fichas EPI, certificados e relatórios |
| stock-alerts pattern        | `modules/stock-alerts/`            | Alertas de vencimento CA, treinamento, ASO  |
| EmployeeDocument            | Phase 25                           | Upload de assinaturas, certificados, ASOs   |
| FarmContext                 | Frontend                           | Filtrar dashboard por fazenda               |
| Sidebar groups              | Frontend layout                    | Novo grupo SEGURANÇA                        |

---

## Módulos backend (novos)

1. `modules/epi-products/` — cadastro EpiProduct, PositionEpiRequirement
2. `modules/epi-deliveries/` — entregas, ficha PDF, compliance EPI
3. `modules/training-types/` — cadastro TrainingType, PositionTrainingRequirement, seed
4. `modules/training-records/` — registro treinamentos, certificado PDF, compliance treino
5. `modules/medical-exams/` — ASOs, alertas vencimento
6. `modules/safety-compliance/` — dashboard unificado, relatórios CSV/PDF

## Páginas frontend (novas)

1. `EpiProductsPage` — CRUD de EPIs (exibe Products com EpiProduct)
2. `EpiDeliveriesPage` — entregas por colaborador, ficha PDF
3. `TrainingTypesPage` — tipos de treinamento (seed + custom)
4. `TrainingRecordsPage` — registro de treinamentos realizados
5. `MedicalExamsPage` — ASOs por colaborador
6. `SafetyDashboardPage` — dashboard de conformidade NR-31

---

## Out of scope (deferred)

- PPRA/PGR (Programa de Gerenciamento de Riscos) — futuro
- CIPA rural (eleição e gestão da comissão) — futuro
- Integração com eSocial (eventos S-2220, S-2240) — futuro
- Mapa de risco — futuro
- Confirmação mobile de recebimento de EPI — pode adicionar depois
- Exames complementares (hemograma, audiometria) como sub-registros do ASO — pode adicionar depois
