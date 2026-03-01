# US-013 — Etapa 1: Migration + Schema Prisma

## O que foi implementado

Migration para cadastro completo de produtores rurais com dados fiscais, inscrições estaduais, participantes de sociedade em comum e vinculação produtor-fazenda.

## 6 novos enums

| Enum                   | Valores                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `ProducerType`         | PF, PJ, SOCIEDADE_EM_COMUM                                                         |
| `ProducerStatus`       | ACTIVE, INACTIVE                                                                   |
| `ProducerFarmBondType` | PROPRIETARIO, ARRENDATARIO, COMODATARIO, PARCEIRO, MEEIRO, USUFRUTUARIO, CONDOMINO |
| `TaxRegime`            | REAL, PRESUMIDO, SIMPLES, ISENTO                                                   |
| `IeSituation`          | ACTIVE, SUSPENDED, CANCELLED                                                       |
| `IeCategory`           | PRIMEIRO_ESTABELECIMENTO, DEMAIS, UNICO                                            |

## 5 novas tabelas

1. **`producers`** — Produtor rural com dados fiscais completos. Unique parcial em `(document, organizationId)` onde `document IS NOT NULL`.
2. **`society_participants`** — Participantes de Sociedade em Comum com CPF e % de participação. Unique em `(producerId, cpf)`.
3. **`producer_state_registrations`** — Inscrições estaduais vinculadas opcionalmente a uma fazenda. Unique em `(producerId, number, state)`.
4. **`producer_farm_links`** — Vínculo produtor-fazenda com tipo e participação. Unique em `(producerId, farmId, bondType)`.
5. **`producer_documents`** — Esqueleto para documentos do produtor.

## RLS

- `producers`: direto via `organizationId = current_org_id()`
- Demais 4 tabelas: subquery via `producerId IN (SELECT id FROM producers WHERE "organizationId" = current_org_id())`

## Arquivos

- `prisma/migrations/20260304100000_add_producers/migration.sql` (novo)
- `prisma/schema.prisma` — 6 enums, 5 modelos, relations em Organization e Farm
