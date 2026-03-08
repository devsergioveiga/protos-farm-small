# US-038 CA7 — Alerta de Pré-Colheita

## O que foi implementado

Sistema de alertas visuais que identifica talhões em período de carência ativo, bloqueando/alertando sobre colheita prematura.

## Por que

A colheita durante o período de carência do defensivo resulta em produto com resíduo acima do permitido, gerando risco sanitário e legal. O alerta previne colheitas prematuras.

## Alterações

### Backend

- **Service** (`getWithdrawalAlerts`): busca aplicações com `safeHarvestDate > now`, calcula `daysRemaining` por aplicação
- **Route** `GET /farms/:farmId/pesticide-applications/withdrawal-alerts`: retorna array de alertas ativos (posicionado antes da rota `:applicationId` para evitar conflito de rotas)
- **Type** `WithdrawalAlert`: applicationId, fieldPlotId, fieldPlotName, productName, activeIngredient, appliedAt, withdrawalPeriodDays, safeHarvestDate, daysRemaining

### Frontend

- **Type** `WithdrawalAlert` em `pesticide-application.ts`
- **Hook** `useWithdrawalAlerts.ts`: fetch do endpoint de alertas
- **Page** (`PesticideApplicationsPage.tsx`):
  - Banner de alerta (laranja) listando talhões em carência com dias restantes
  - Cards com borda lateral laranja (`--withdrawal-active`) para aplicações em carência
- **CSS**: `.pesticides__withdrawal-banner`, `.pesticides__card--withdrawal-active`

### Testes

- **Backend**: 2 testes (alertas ativos + array vazio)
- **Frontend**: teste "should show withdrawal alert banner when there are active alerts"
