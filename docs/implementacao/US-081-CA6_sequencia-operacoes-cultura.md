# US-081 CA6 — Sequência/ordem sugerida de operações por cultura

## O que foi implementado

Possibilidade de definir, para cada cultura, a ordem típica de operações no ciclo produtivo. A sequência serve como guia visual no planejamento de safra — não bloqueia registro fora de ordem.

## Modelo de dados

Nova tabela `crop_operation_sequences`:

- `id` (PK), `organization_id`, `crop`, `operation_type_id` (FK), `sequence_order`, `notes`
- Unique: (org, crop, operation_type) e (org, crop, sequence_order)
- RLS por organização

## Endpoints

| Método | Rota                                  | Permissão    | Descrição                                 |
| ------ | ------------------------------------- | ------------ | ----------------------------------------- |
| GET    | `/api/org/operation-sequences?crop=X` | farms:read   | Sequência de uma cultura                  |
| GET    | `/api/org/operation-sequences`        | farms:read   | Todas as sequências agrupadas por cultura |
| PUT    | `/api/org/operation-sequences`        | farms:update | Define/substitui sequência de uma cultura |
| DELETE | `/api/org/operation-sequences/:crop`  | farms:update | Remove sequência de uma cultura           |
| POST   | `/api/org/operation-sequences/seed`   | farms:update | Carrega sequências padrão                 |

### PUT body

```json
{
  "crop": "Café",
  "items": [
    { "operationTypeId": "uuid-1", "notes": "Após colheita" },
    { "operationTypeId": "uuid-2" }
  ]
}
```

A ordem do array define `sequenceOrder` (1, 2, 3...). Substituição completa (delete + insert).

## Sequências pré-carregadas (seed)

5 culturas com sequências padrão:

- **Café** (12 operações): poda → calagem → adubação → pulverização → capina → roçada → arruação → derriça → varrição → lavagem → secagem → beneficiamento
- **Soja** (11): calagem → gessagem → dessecação → trat. sementes → plantio → adubação → pulverização (2x) → colheita → secagem → armazenagem
- **Milho** (11): calagem → gradagem pesada → gradagem leve → trat. sementes → plantio → pulverização → adubação cobertura → pulverização → colheita → secagem → armazenagem
- **Pastagem** (6): roçada → calagem → adubação → controle invasoras → vedação → reforma
- **Laranja** (8): poda → calagem → adubação → pulverização → roçada → desbrota → irrigação → colheita

## Validações

- Cultura obrigatória
- Mínimo 1 operação na sequência
- Sem operação duplicada na mesma sequência
- Todos os operation_type_ids devem existir na organização
- Seed só se org ainda não tem sequências

## Testes

13 testes em `operation-types.routes.spec.ts` cobrindo GET, PUT, DELETE, seed, permissões e erros.
