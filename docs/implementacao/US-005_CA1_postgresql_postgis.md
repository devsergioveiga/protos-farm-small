# US-005 CA1 — PostgreSQL 16+ com PostGIS

**Status:** ✅ Concluído
**Data:** 2026-02-27

## Critério de Aceite

> O sistema deve utilizar PostgreSQL 16+ com extensão PostGIS habilitada.

## Implementação

Este CA já estava satisfeito pela infraestrutura criada na **US-003 CA1**:

- **Imagem Docker:** `postgis/postgis:16-3.4` (PostgreSQL 16 + PostGIS 3.4)
- **Init script:** `infra/postgres/init-postgis.sql` — executa `CREATE EXTENSION IF NOT EXISTS postgis` na inicialização do container
- **Docker Compose:** `docker-compose.yml` monta o init script em `/docker-entrypoint-initdb.d/`

## Verificação

```bash
# Confirmar versão do PostgreSQL
docker exec protos-farm-postgres psql -U protos -d protos_farm -c "SELECT version()"
# → PostgreSQL 16.x

# Confirmar PostGIS habilitado
docker exec protos-farm-postgres psql -U protos -d protos_farm -c "SELECT PostGIS_Full_Version()"
# → POSTGIS="3.4.x" ...
```

## Uso no Schema

A extensão PostGIS é declarada no Prisma schema e usada nos campos geoespaciais da tabela `farms`:

```prisma
datasource db {
  provider   = "postgresql"
  extensions = [postgis]
}

model Farm {
  location  Unsupported("geometry(Point, 4326)")?
  boundary  Unsupported("geometry(Polygon, 4326)")?
}
```

## Arquivos Relevantes

| Arquivo                             | Função                                       |
| ----------------------------------- | -------------------------------------------- |
| `docker-compose.yml`                | Container PostgreSQL + PostGIS               |
| `infra/postgres/init-postgis.sql`   | Habilitação da extensão PostGIS              |
| `apps/backend/prisma/schema.prisma` | Declaração da extensão e campos geoespaciais |
