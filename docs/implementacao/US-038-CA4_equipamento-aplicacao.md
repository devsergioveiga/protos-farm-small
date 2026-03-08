# US-038 CA4 — Equipamento de Aplicação

## O que foi implementado

Campos opcionais para registrar o equipamento utilizado na aplicação de defensivos: tipo de pulverizador, tipo de bico, pressão de trabalho e velocidade de aplicação.

## Campos adicionados

| Campo              | Tipo         | Descrição                                              |
| ------------------ | ------------ | ------------------------------------------------------ |
| `sprayerType`      | Text         | Tipo de pulverizador (select com opções pré-definidas) |
| `nozzleType`       | Text         | Tipo de bico (select com opções pré-definidas)         |
| `workingPressure`  | Decimal(7,2) | Pressão de trabalho em bar                             |
| `applicationSpeed` | Decimal(5,2) | Velocidade de aplicação em km/h                        |

Todos opcionais (nullable).

## Opções de pulverizador

Costal manual, Costal motorizado, Barra tratorizado, Autopropelido, Pivô central, Drone/VANT, Outro.

## Opções de bico

Leque (plano), Cônico vazio, Cônico cheio, Defletor, Indução de ar, Outro.

## Migration

`20260320700000_add_pesticide_equipment_fields` — 4 colunas `ALTER TABLE ADD COLUMN`.

## Arquivos alterados

### Backend

- `prisma/schema.prisma` — 4 campos no model PesticideApplication
- `modules/pesticide-applications/pesticide-applications.types.ts` — tipos atualizados
- `modules/pesticide-applications/pesticide-applications.service.ts` — create, update, toItem
- `modules/pesticide-applications/pesticide-applications.routes.spec.ts` — +1 teste (15 total)

### Frontend

- `types/pesticide-application.ts` — interfaces + constantes SPRAYER_TYPES e NOZZLE_TYPES
- `components/pesticide-applications/PesticideApplicationModal.tsx` — seção "Equipamento de aplicação"
- `pages/PesticideApplicationsPage.tsx` — exibição de equipamento no card
- `pages/PesticideApplicationsPage.css` — estilos equipamento no card
- `pages/PesticideApplicationsPage.spec.tsx` — +1 teste (12 total)

## Testes

- Backend: 15 testes (1 novo para equipamento)
- Frontend: 749 testes (1 novo — exibição de equipamento no card)
