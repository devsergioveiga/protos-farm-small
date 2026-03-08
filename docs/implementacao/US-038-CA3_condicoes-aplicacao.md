# US-038 CA3 — Condições da Aplicação

## O que foi implementado

Campos opcionais para registrar condições ambientais no momento da aplicação de defensivos, com alerta visual automático quando as condições são inadequadas.

## Campos adicionados

| Campo              | Tipo         | Descrição                   |
| ------------------ | ------------ | --------------------------- |
| `temperature`      | Decimal(5,2) | Temperatura em °C           |
| `relativeHumidity` | Decimal(5,2) | Umidade relativa em %       |
| `windSpeed`        | Decimal(5,2) | Velocidade do vento em km/h |

Todos opcionais (nullable).

## Regras de alerta (condições inadequadas)

- Temperatura > 30°C
- Umidade relativa < 55%
- Velocidade do vento > 10 km/h

Quando qualquer condição é violada:

- **Modal**: banner de alerta laranja com lista de condições inadequadas
- **Card na listagem**: ícone de alerta triangular ao lado dos dados de condição

## Migration

`20260320600000_add_pesticide_application_conditions` — 3 colunas `ALTER TABLE ADD COLUMN`.

## Arquivos alterados

### Backend

- `prisma/schema.prisma` — campos temperature, relativeHumidity, windSpeed no model PesticideApplication
- `modules/pesticide-applications/pesticide-applications.types.ts` — tipos de input e response
- `modules/pesticide-applications/pesticide-applications.service.ts` — create, update, toItem
- `modules/pesticide-applications/pesticide-applications.routes.spec.ts` — +1 teste (14 total)

### Frontend

- `types/pesticide-application.ts` — interfaces atualizadas
- `components/pesticide-applications/PesticideApplicationModal.tsx` — seção "Condições da aplicação" + alerta visual
- `components/pesticide-applications/PesticideApplicationModal.css` — estilos do alerta
- `pages/PesticideApplicationsPage.tsx` — exibição de condições no card + ícone de alerta
- `pages/PesticideApplicationsPage.css` — estilos condições no card
- `pages/PesticideApplicationsPage.spec.tsx` — +2 testes (11 total)

## Testes

- Backend: 14 testes (1 novo para condições ambientais)
- Frontend: 748 testes (2 novos — exibição de condições e ícone de alerta)
