# US-101 — Registro de Vacinação por Animal e Lote

## Contexto

EPIC-11 Manejo Sanitário Pecuário. Permite registrar vacinações individualmente ou em lote, com baixa automática de estoque e cálculo de reforço.

## Critérios de Aceite Implementados

| CA  | Descrição                                                                                 | Status                      |
| --- | ----------------------------------------------------------------------------------------- | --------------------------- |
| CA1 | Registro individual: animal, vacina, dose, via, lote produto, validade, data, responsável | COMPLETO                    |
| CA2 | Registro em lote: selecionar lote inteiro, mesma vacina para todos                        | COMPLETO                    |
| CA3 | Baixa automática do produto vacinal no estoque (nº animais × dose)                        | COMPLETO                    |
| CA4 | Cálculo automático da próxima dose (reforço) conforme protocolo                           | COMPLETO                    |
| CA5 | Registro via mobile no curral (offline)                                                   | POSTERGADO (EPIC-06 mobile) |
| CA6 | Comprovante de vacinação: relatório por campanha com lista de animais                     | COMPLETO                    |

## Modelo de Dados

### Vaccination (nova tabela `vaccinations`)

- `id`, `organizationId`, `farmId`, `animalId` — identificação
- `productId` (FK Product), `productName` — vacina
- `dosageMl` (Float), `administrationRoute` (enum IM/SC/IV/ORAL/etc)
- `productBatchNumber`, `productExpiryDate` — rastreabilidade do lote
- `vaccinationDate`, `responsibleName`, `veterinaryName`
- `protocolItemId` (FK SanitaryProtocolItem) — vinculação ao protocolo sanitário
- `campaignId` — agrupa vacinações em lote (UUID gerado no bulk)
- `doseNumber`, `nextDoseDate` — reforço calculado do protocolo
- `withdrawalMeatDays`, `withdrawalMilkDays`, `withdrawalEndDate` — carência
- `stockOutputId` (FK StockOutput) — rastreabilidade da baixa de estoque
- `animalLotId` — lote do animal no momento da vacinação
- Migration: `20260353100000_add_vaccinations`

## Endpoints

| Método | Rota                                                           | Descrição                      |
| ------ | -------------------------------------------------------------- | ------------------------------ |
| POST   | `/org/farms/:farmId/vaccinations`                              | Registro individual (CA1)      |
| POST   | `/org/farms/:farmId/vaccinations/bulk`                         | Registro em lote (CA2)         |
| GET    | `/org/farms/:farmId/vaccinations`                              | Listar com filtros e paginação |
| GET    | `/org/farms/:farmId/vaccinations/:id`                          | Detalhe                        |
| PATCH  | `/org/farms/:farmId/vaccinations/:id`                          | Atualizar                      |
| DELETE | `/org/farms/:farmId/vaccinations/:id`                          | Excluir                        |
| GET    | `/org/farms/:farmId/vaccinations/campaigns/:campaignId`        | Relatório campanha (CA6)       |
| GET    | `/org/farms/:farmId/vaccinations/campaigns/:campaignId/export` | CSV campanha (CA6)             |

## Decisões de Design

- **Modelo dedicado vs AnimalHealthRecord**: criou-se `Vaccination` separado para suportar FKs específicas (Product, SanitaryProtocolItem, StockOutput) e campos estruturados. Um `AnimalHealthRecord` type=VACCINATION é criado automaticamente para manter a timeline do animal unificada.
- **Stock deduction (CA3)**: usa StockOutput type=CONSUMPTION com status CONFIRMED. Deduz StockBalance automaticamente usando custo médio ponderado.
- **Reforço (CA4)**: consulta `SanitaryProtocolItem.isReinforcement` e `reinforcementIntervalDays` para calcular `nextDoseDate`.
- **Campanhas (CA2/CA6)**: `campaignId` (UUID) agrupa vacinações em lote. O relatório/CSV usa esse ID para listar todos os animais vacinados.
- **Permissões**: `animals:update` para criar/editar/excluir, `animals:read` para consultar.

## Frontend

### Página: VaccinationsPage (`/vaccinations`)

- Lista vacinações em cards com filtro por busca textual
- Seletor de campanhas para acesso aos relatórios (CA6)
- Paginação completa
- Empty state e loading state

### Modais

| Componente           | Arquivo                                            | Função                                         |
| -------------------- | -------------------------------------------------- | ---------------------------------------------- |
| VaccinationModal     | `components/vaccinations/VaccinationModal.tsx`     | CA1: registro/edição individual                |
| BulkVaccinationModal | `components/vaccinations/BulkVaccinationModal.tsx` | CA2: vacinação em lote com resultado e alertas |
| CampaignReportModal  | `components/vaccinations/CampaignReportModal.tsx`  | CA6: relatório campanha + export CSV           |

### Hook

- `useVaccinations(params)` — fetch com paginação, filtros por animal/campanha/produto/datas

### Rota e Navegação

- Rota: `/vaccinations` em `App.tsx` (lazy loaded)
- Sidebar: grupo REBANHO, ícone `Syringe`, label "Vacinações"

## Testes

- 20 testes backend (1 suite) cobrindo todos os endpoints, erros, permissões e CSV export.
- 883 testes frontend passando (89 suites) — sem regressão.
