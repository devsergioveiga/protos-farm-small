# US-030 CA4 — Resultado com contagem total e peso médio do grupo filtrado

## Critério de Aceite

> Resultado com contagem total e peso médio do grupo filtrado

## O que foi feito

### Backend

- **`animals.service.ts`**: A função `listAnimals` agora executa `tx.animal.aggregate({ _avg: { entryWeightKg } })` em paralelo com as queries existentes (findMany + count), retornando um campo `groupStats` na resposta:
  ```json
  {
    "groupStats": {
      "totalCount": 42,
      "averageWeightKg": 387.5
    }
  }
  ```
- `averageWeightKg` é `null` quando nenhum animal do grupo possui peso cadastrado
- O cálculo respeita todos os filtros ativos (busca, sexo, categoria, raça, lote, local, filtros especiais, faixas de peso/idade)

### Frontend

- **`useAnimals.ts`**: Hook expõe `groupStats` (tipo `GroupStats`) além de `animals` e `meta`
- **`AnimalsPage.tsx`**: Barra de estatísticas do grupo sempre visível quando há dados:
  - Ícone + contagem total de animais (com texto "encontrado(s)" quando filtros ativos)
  - Ícone + peso médio em kg (oculto quando `null`)
  - Botão "Limpar filtros" aparece condicionalmente quando há filtros ativos
- **`AnimalsPage.css`**: Estilos `.animals__group-stats*` com layout flex, ícones, peso em JetBrains Mono
- **`animal.ts`**: Tipo `GroupStats` e `AnimalsResponse` atualizado

### Testes

- Backend: 2 testes novos (groupStats na resposta + averageWeightKg null), 62 total
- Frontend: 2 testes novos (barra com peso + peso null oculto), 731 total

## Decisões técnicas

- Usou `aggregate({ _avg })` do Prisma em vez de query raw — mais simples e type-safe
- `groupStats` é computado sobre o grupo filtrado inteiro (não apenas a página), para dar visão global ao usuário
- A barra de stats é sempre visível (não apenas quando filtros ativos), para dar contexto sobre o rebanho
