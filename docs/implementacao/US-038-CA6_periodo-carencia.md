# US-038 CA6 — Período de Carência

## O que foi implementado

Registro automático do período de carência: o usuário informa os dias de carência do produto e o sistema calcula automaticamente a data segura para colheita (data de aplicação + dias de carência).

## Por que

A legislação exige respeitar o período de carência (intervalo de segurança) entre a última aplicação de defensivo e a colheita. Calcular automaticamente a data segura evita erros manuais e garante rastreabilidade.

## Alterações

### Backend

- **Migration** `20260320900000_add_pesticide_withdrawal_period`: 2 colunas (`withdrawal_period_days INT`, `safe_harvest_date TIMESTAMP`)
- **Schema Prisma**: campos `withdrawalPeriodDays Int?`, `safeHarvestDate DateTime?`
- **Types**: input aceita `withdrawalPeriodDays?`, response inclui `withdrawalPeriodDays` e `safeHarvestDate`
- **Service**:
  - `toItem()`: mapeia os 2 campos
  - `create()`: calcula `safeHarvestDate = appliedAt + withdrawalPeriodDays * 24h`
  - `update()`: recalcula `safeHarvestDate` quando `appliedAt` ou `withdrawalPeriodDays` mudam

### Frontend

- **Types** (`pesticide-application.ts`): `withdrawalPeriodDays` e `safeHarvestDate` adicionados
- **Modal** (`PesticideApplicationModal.tsx`):
  - Seção "Período de carência" com input de dias e exibição calculada da data segura
  - `computedSafeHarvestDate` via `useMemo` (preview em tempo real)
  - CSS `.pesticide-modal__computed-value` para campo calculado
- **Page** (`PesticideApplicationsPage.tsx`): cards exibem carência e data segura com ícone `ShieldAlert`

### Testes

- **Backend**: teste "should create application with withdrawal period and compute safe harvest date"
- **Frontend**: teste "should display withdrawal period on cards"
