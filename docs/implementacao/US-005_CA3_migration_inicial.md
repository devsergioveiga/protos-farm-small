# US-005 CA3 — Migration Inicial (Tabelas Core)

**Status:** ✅ Concluído
**Data:** 2026-02-27

## Critério de Aceite

> A migration inicial deve criar as tabelas core: organização, fazenda e usuário.

## Schema Core

### Diagrama Entidade-Relacionamento (textual)

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  organizations   │       │     users        │       │     farms        │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id          (PK) │──┐    │ id          (PK) │──┐    │ id          (PK) │
│ name             │  │    │ email       (UQ) │  │    │ name             │
│ type        (enum)  │    │ name             │  │    │ nickname         │
│ document    (UQ) │  │    │ passwordHash     │  │    │ address          │
│ plan             │  │    │ phone            │  │    │ city             │
│ status      (enum)  │    │ role        (enum)  │    │ state            │
│ maxUsers         │  │    │ status      (enum)  │    │ zipCode          │
│ maxFarms         │  ├───→│ organizationId(FK)  │    │ totalAreaHa      │
│ createdAt        │  │    │ lastLoginAt      │  │    │ cib              │
│ updatedAt        │  │    │ createdAt        │  │    │ incraCode        │
└──────────────────┘  │    │ updatedAt        │  │    │ carCode          │
                      │    └──────────────────┘  │    │ status      (enum)
                      │                          │    │ organizationId(FK)│──→ organizations
                      │    ┌──────────────────┐  │    │ location    (geo) │
                      │    │ user_farm_access  │  │    │ boundary    (geo) │
                      │    ├──────────────────┤  │    │ createdAt        │
                      │    │ id          (PK) │  │    │ updatedAt        │
                      │    │ userId      (FK) │──┘    └──────────────────┘
                      │    │ farmId      (FK) │──────→ farms
                      │    │ (userId+farmId UQ)│
                      │    └──────────────────┘
                      │
                      └───→ farms.organizationId
```

### Tabelas

#### `organizations` — Organização (PF ou PJ)

| Campo     | Tipo         | Restrições      | Descrição                    |
| --------- | ------------ | --------------- | ---------------------------- |
| id        | UUID         | PK              | Identificador único          |
| name      | TEXT         | NOT NULL        | Nome/razão social            |
| type      | ENUM(PF, PJ) | NOT NULL        | Pessoa Física ou Jurídica    |
| document  | TEXT         | UNIQUE          | CPF ou CNPJ                  |
| plan      | TEXT         | DEFAULT 'basic' | Plano contratado             |
| status    | ENUM         | DEFAULT ACTIVE  | ACTIVE, SUSPENDED, CANCELLED |
| maxUsers  | INT          | DEFAULT 10      | Limite de usuários           |
| maxFarms  | INT          | DEFAULT 5       | Limite de fazendas           |
| createdAt | TIMESTAMP    | DEFAULT now()   | Data de criação              |
| updatedAt | TIMESTAMP    | Auto            | Última atualização           |

#### `users` — Usuário do sistema

| Campo          | Tipo      | Restrições         | Descrição                   |
| -------------- | --------- | ------------------ | --------------------------- |
| id             | UUID      | PK                 | Identificador único         |
| email          | TEXT      | UNIQUE             | E-mail (login)              |
| name           | TEXT      | NOT NULL           | Nome completo               |
| passwordHash   | TEXT      | NULLABLE           | Hash da senha (bcrypt)      |
| phone          | TEXT      | NULLABLE           | Telefone                    |
| role           | ENUM      | DEFAULT OPERATOR   | Papel no sistema (8 roles)  |
| status         | ENUM      | DEFAULT ACTIVE     | ACTIVE ou INACTIVE          |
| lastLoginAt    | TIMESTAMP | NULLABLE           | Último login                |
| organizationId | UUID      | FK → organizations | Organização à qual pertence |
| createdAt      | TIMESTAMP | DEFAULT now()      | Data de criação             |
| updatedAt      | TIMESTAMP | Auto               | Última atualização          |

#### `farms` — Fazenda/propriedade rural

| Campo          | Tipo                    | Restrições         | Descrição                      |
| -------------- | ----------------------- | ------------------ | ------------------------------ |
| id             | UUID                    | PK                 | Identificador único            |
| name           | TEXT                    | NOT NULL           | Nome oficial                   |
| nickname       | TEXT                    | NULLABLE           | Apelido                        |
| address        | TEXT                    | NULLABLE           | Endereço                       |
| city           | TEXT                    | NULLABLE           | Cidade                         |
| state          | TEXT                    | NOT NULL           | UF (2 caracteres)              |
| zipCode        | TEXT                    | NULLABLE           | CEP                            |
| totalAreaHa    | DECIMAL(12,4)           | NOT NULL           | Área total em hectares         |
| cib            | TEXT                    | NULLABLE           | Cadastro Imóvel Rural          |
| incraCode      | TEXT                    | NULLABLE           | Código INCRA                   |
| carCode        | TEXT                    | NULLABLE           | Código CAR                     |
| status         | ENUM                    | DEFAULT ACTIVE     | ACTIVE ou INACTIVE             |
| organizationId | UUID                    | FK → organizations | Organização proprietária       |
| location       | geometry(Point, 4326)   | NULLABLE           | Coordenada da sede (PostGIS)   |
| boundary       | geometry(Polygon, 4326) | NULLABLE           | Perímetro da fazenda (PostGIS) |
| createdAt      | TIMESTAMP               | DEFAULT now()      | Data de criação                |
| updatedAt      | TIMESTAMP               | Auto               | Última atualização             |

#### `user_farm_access` — Acesso de usuário a fazendas

| Campo  | Tipo | Restrições             | Descrição                                |
| ------ | ---- | ---------------------- | ---------------------------------------- |
| id     | UUID | PK                     | Identificador único                      |
| userId | UUID | FK → users             | Usuário                                  |
| farmId | UUID | FK → farms             | Fazenda                                  |
| —      | —    | UNIQUE(userId, farmId) | Um usuário não pode ter acesso duplicado |

### Enums

- **OrganizationType:** PF (Pessoa Física), PJ (Pessoa Jurídica)
- **OrgStatus:** ACTIVE, SUSPENDED, CANCELLED
- **UserRole:** SUPER_ADMIN, ADMIN, MANAGER, AGRONOMIST, FINANCIAL, OPERATOR, COWBOY, CONSULTANT
- **UserStatus:** ACTIVE, INACTIVE
- **FarmStatus:** ACTIVE, INACTIVE

## Decisões de Design

1. **UUIDs como PK:** Melhor para sistemas distribuídos e evita exposição de sequência
2. **`document` unique em organizations:** Garante que CPF/CNPJ é único no sistema
3. **`email` unique em users:** Login por email, único globalmente
4. **UserFarmAccess como tabela separada:** Permite controle granular de acesso por fazenda (RBAC), requisito central das US-006 a US-010
5. **Campos PostGIS (geometry):** Preparação para US-015/US-016 (mapas e geolocalização); marcados como `Unsupported` no Prisma (operados via raw queries)
6. **DECIMAL(12,4) para área:** Precisão suficiente para áreas rurais brasileiras (até 99.999.999,9999 ha)
7. **8 UserRoles:** Cobertura completa dos perfis descritos nos requisitos (incluindo "Peão/Cowboy" e "Consultor")

## Migration Gerada

```
apps/backend/prisma/migrations/
└── 20260227091447_init_core_tables/
    └── migration.sql
```

## Como Executar

```bash
# Subir PostgreSQL (se não estiver rodando)
docker compose up -d postgres

# Aplicar migration (dev)
cd apps/backend && npx prisma migrate dev

# Verificar tabelas
docker exec protos-farm-postgres psql -U protos -d protos_farm -c "\dt"
```

## Arquivos Relevantes

| Arquivo                                                                        | Função                       |
| ------------------------------------------------------------------------------ | ---------------------------- |
| `apps/backend/prisma/schema.prisma`                                            | Schema com os 4 modelos core |
| `apps/backend/prisma/migrations/20260227091447_init_core_tables/migration.sql` | SQL da migration             |
| `apps/backend/src/database/prisma.ts`                                          | Singleton PrismaClient       |
