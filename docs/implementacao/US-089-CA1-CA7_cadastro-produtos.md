# US-089 CA1-CA7 — Cadastro de Produtos, Insumos e Serviços

## O quê

CRUD completo de produtos (itens físicos com estoque) e serviços (sem estoque) com campos específicos por natureza, fabricante auto-criado, composição/princípio ativo e validações de tipo.

## Por quê

Base para todo o EPIC-10 (Estoque de Insumos). Cada produto/serviço cadastrado será usado em entradas/saídas de estoque (US-090/091), alertas (US-092), operações de campo e módulos financeiros.

## Modelos criados

### Product

- `nature` (PRODUCT/SERVICE) define campos visíveis
- `type` validado contra listas fixas (20 tipos produto, 12 tipos serviço)
- Soft delete via `deletedAt`
- Unique constraint: (organizationId, name, nature)

### Manufacturer

- Cadastro reutilizável entre produtos (nome + CNPJ opcional)
- Criado automaticamente ao cadastrar produto com `manufacturerName`
- Unique constraint: (organizationId, name)

### ProductComposition

- Princípio ativo, concentração, função
- Cascade delete com o produto pai
- Suporta múltiplas substâncias (formulações compostas)

## Migration

- `20260339100000_add_products_and_manufacturers`

## Endpoints

| Método | Rota                   | Permissão    | Descrição             |
| ------ | ---------------------- | ------------ | --------------------- |
| POST   | /api/org/products      | farms:update | Criar produto/serviço |
| GET    | /api/org/products      | farms:read   | Listar com filtros    |
| GET    | /api/org/products/:id  | farms:read   | Detalhe               |
| PUT    | /api/org/products/:id  | farms:update | Atualizar             |
| DELETE | /api/org/products/:id  | farms:update | Soft delete           |
| GET    | /api/org/manufacturers | farms:read   | Listar fabricantes    |

## Filtros de listagem

- `nature` (PRODUCT/SERVICE)
- `type` (semente, fertilizante, etc.)
- `status` (ACTIVE/INACTIVE)
- `category` (texto livre)
- `search` (nome, nome comercial, barcode)
- `manufacturerId`
- `page`, `limit`

## Testes

- 35 testes (routes spec com mocks)
- Cobertura: CRUD, permissões, validações CA1-CA7
