# US-038 CA5 — Calda / Tank Mix

## O que foi implementado

Campos de calda (tank mix) na aplicação de defensivos: adjuvante, dose do adjuvante, pH da calda e ordem de mistura.

## Por que

O preparo correto da calda é essencial para eficácia do defensivo. Registrar adjuvante, pH e ordem de mistura garante rastreabilidade e reprodutibilidade da aplicação.

## Alterações

### Backend (já concluído em sessão anterior)

- **Migration** `20260320800000_add_pesticide_tank_mix_fields`: 4 colunas (`adjuvant`, `adjuvant_dose`, `tank_mix_order`, `tank_mix_ph`)
- **Schema Prisma**: campos `adjuvant String?`, `adjuvantDose Decimal?`, `tankMixOrder String?`, `tankMixPh Decimal?`
- **Service**: `toItem()`, `create()`, `update()` incluem os 4 campos
- **Types**: `PesticideApplicationInput` e `PesticideApplicationResponse` atualizados

### Frontend

- **Types** (`pesticide-application.ts`): `PesticideApplicationItem` e `CreatePesticideApplicationInput` com os 4 campos
- **Modal** (`PesticideApplicationModal.tsx`):
  - 4 estados: `adjuvant`, `adjuvantDose`, `tankMixOrder`, `tankMixPh`
  - Reset/populate no `useEffect`
  - Inclusão no payload do `handleSubmit`
  - Seção "Calda" no formulário (entre Equipamento e Observações)
- **Page** (`PesticideApplicationsPage.tsx`): cards exibem adjuvante e pH da calda com ícone `FlaskConical`
- **CSS**: classe `.pesticides__card-tank-mix`

### Testes

- **Backend** (`pesticide-applications.routes.spec.ts`): `SAMPLE_APPLICATION` com campos null + teste "should create application with tank mix data"
- **Frontend** (`PesticideApplicationsPage.spec.tsx`): `MOCK_APPLICATIONS` com dados de calda + teste "should display tank mix info on cards"
