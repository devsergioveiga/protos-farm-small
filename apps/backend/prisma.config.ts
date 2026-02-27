import { defineConfig } from 'prisma/config';

const pgUser = process.env.POSTGRES_USER ?? 'protos';
const pgPassword = process.env.POSTGRES_PASSWORD ?? 'protos';
const pgHost = process.env.POSTGRES_HOST ?? 'localhost';
const pgPort = process.env.POSTGRES_PORT ?? '5432';
const pgDb = process.env.POSTGRES_DB ?? 'protos_farm';

const databaseUrl =
  process.env.DATABASE_URL ??
  `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDb}?schema=public`;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
