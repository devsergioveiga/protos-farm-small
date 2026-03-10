# US-081 CA8 — Cadastro de fases fenológicas/estádios por cultura

## O que foi implementado

Tabela configurável de fases fenológicas por cultura, pré-carregada com dados agronômicos padrão. Editável pelo agrônomo para incluir culturas regionais ou subdivisões.

## Modelo de dados

Nova tabela `crop_phenological_stages`:

- `id`, `organization_id`, `crop`, `code` (ex: "VE", "R1"), `name`, `description`
- `stage_order` (posição no ciclo), `is_system` (true para pré-carregados)
- Unique: (org, crop, code) e (org, crop, stage_order)
- RLS por organização

## Endpoints

| Método | Rota                                  | Permissão    | Descrição                           |
| ------ | ------------------------------------- | ------------ | ----------------------------------- |
| GET    | `/api/org/phenological-stages?crop=X` | farms:read   | Listar fases (todas ou por cultura) |
| GET    | `/api/org/phenological-stages/:id`    | farms:read   | Detalhes de uma fase                |
| POST   | `/api/org/phenological-stages`        | farms:update | Criar fase                          |
| PATCH  | `/api/org/phenological-stages/:id`    | farms:update | Atualizar fase                      |
| DELETE | `/api/org/phenological-stages/:id`    | farms:update | Remover fase                        |
| POST   | `/api/org/phenological-stages/seed`   | farms:update | Carregar fases padrão               |

## Fases pré-carregadas (seed)

7 culturas, 73 fases no total:

- **Milho** (18): VE → V1-V18 → VT → R1-R6
- **Soja** (16): VE → VC → V1-V6 → R1-R8
- **Café** (7): Vegetativo → Florada → Chumbinho → Expansão → Granação → Maturação → Repouso
- **Laranja** (7): Dormência → Brotação → Floração → Fixação → Crescimento → Maturação → Colheita
- **Pastagem** (5): Brotação → Perfilhamento → Elongação → Florescimento → Senescência
- **Feijão** (10): V0-V4 → R5-R9
- **Trigo** (10): GS10-GS92 (escala Zadoks simplificada)

## Validações

- Crop, code e name obrigatórios
- stageOrder deve ser positivo
- Código e ordem únicos por cultura/organização
- Seed só se org ainda não tem fases

## Integração com CA7

O campo `phenoStage` nos agendamentos (CA7) agora pode referenciar os códigos cadastrados nesta tabela. A validação cruzada é soft (string livre) para permitir flexibilidade, mas o frontend poderá oferecer autocomplete a partir da lista de fases cadastradas.

## Testes

15 testes cobrindo GET (listagem, filtro por cultura), POST (criação, duplicata, validações, permissão), PATCH (update, 404), DELETE (remoção, 404), seed (sucesso, 409, permissão).
Total: 78 testes no módulo operation-types.
