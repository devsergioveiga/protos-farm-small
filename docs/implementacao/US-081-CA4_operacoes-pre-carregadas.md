# US-081 CA4 — Operações pré-carregadas (seed) por cultura

**Data:** 2026-03-10
**Status:** Implementado

## Critério de aceite

> Operações pré-carregadas (seed) por cultura: sistema vem com operações comuns já cadastradas e vinculadas às respectivas culturas. Editáveis e expandíveis pelo admin.

## O que foi feito

### Dados pré-carregados

6 categorias (nível 1), 30 operações (nível 2), 3 sub-operações (nível 3) = **39 tipos** por organização.

| Categoria          | Operações                                                                                            | Culturas                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Preparo de Solo    | Aração, Gradagem leve/pesada, Subsolagem, Escarificação, Calagem, Gessagem, Dessecação               | Todas (Dessecação: Soja, Milho, Feijão, Algodão) |
| Plantio            | Mecanizado, Manual, Replantio, Tratamento de sementes                                                | Todas (Manual: Café, Laranja)                    |
| Tratos Culturais   | Adubação (cobertura, foliar, fertirrigação), Pulverização, Capina, Roçada, Irrigação, Poda, Desbrota | Variado por operação                             |
| Colheita           | Mecanizada, Manual, Derriça, Varrição, Arruação                                                      | Variado (Derriça/Varrição/Arruação: Café)        |
| Pós-Colheita       | Secagem, Beneficiamento, Armazenagem, Lavagem                                                        | Variado                                          |
| Manejo de Pastagem | Roçada, Adubação, Vedação, Reforma, Controle invasoras                                               | Pastagem                                         |

### Backend

- `DEFAULT_OPERATION_TYPES` constante em `operation-types.types.ts` — estrutura hierárquica com culturas
- `seedOperationTypes(ctx)` em `operation-types.service.ts` — cria defaults para a organização
- Validação: retorna 409 se organização já tem tipos cadastrados (evita duplicação)
- Todos criados com `isSystem: true` — editáveis e expansíveis pelo admin
- Endpoint: `POST /org/operation-types/seed` (requer `farms:update`)

### Frontend

- Botão "Carregar operações padrão" no empty state (com ícone Download)
- Opção alternativa "Criar do zero" para organizações que preferem cadastro manual
- Estado de loading durante o seed

### Seed file

- `prisma/seed.ts` atualizado para criar tipos de operação para ambas as organizações de seed

### Testes

- 3 testes novos (total: 29)
  - Seed com sucesso
  - 409 se já existe
  - 403 sem permissão
