# US-014 Etapa 1 — Migration: Vinculacao Produtor-Fazenda-Matricula

## O que foi feito

### Migration `20260305100000_producer_farm_registration_links`

**Alteracoes em `producer_farm_links`:**

- `startDate` TIMESTAMP(3) — inicio do vinculo
- `endDate` TIMESTAMP(3) — fim do vinculo (arrendamentos com prazo)
- `isItrDeclarant` BOOLEAN NOT NULL DEFAULT false — indicador de declarante ITR/DITR
- `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
- Indice em `endDate` para queries de vencimento

**Nova tabela `producer_registration_links`:**

Associacao N:M entre vinculo produtor-fazenda e matriculas especificas:

| Coluna             | Tipo      | Descricao                      |
| ------------------ | --------- | ------------------------------ |
| id                 | TEXT PK   | Identificador                  |
| farmLinkId         | FK        | Referencia producer_farm_links |
| farmRegistrationId | FK        | Referencia farm_registrations  |
| createdAt          | TIMESTAMP | Data de criacao                |

- Unique constraint: `(farmLinkId, farmRegistrationId)`
- ON DELETE CASCADE em ambas as FKs

**RLS:**

- `producer_registration_links` com policy via subquery:
  `farmLinkId → producer_farm_links.producerId → producers.organizationId`

### Schema Prisma

- `ProducerFarmLink`: + startDate, endDate, isItrDeclarant, updatedAt, registrationLinks[]
- Novo modelo `ProducerRegistrationLink` com relacoes
- `FarmRegistration`: + producerLinks[] (back-relation)

## Por que

- Vigencia (startDate/endDate) e essencial para arrendamentos e contratos com prazo
- isItrDeclarant identifica o contribuinte responsavel pelo ITR da fazenda
- Vinculo com matriculas permite saber exatamente quais areas cada produtor explora
- RLS garante isolamento multi-tenant

## Arquivos

- `prisma/migrations/20260305100000_producer_farm_registration_links/migration.sql` (novo)
- `prisma/schema.prisma` (modificado)
