type NodeEnv = 'development' | 'test' | 'staging' | 'production';

interface Env {
  NODE_ENV: NodeEnv;
  PORT: number;
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
  DATABASE_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  REFRESH_TOKEN_EXPIRES_IN: number;
}

const DEFAULTS: Record<NodeEnv, Partial<Env>> = {
  development: {
    PORT: 3000,
    POSTGRES_HOST: 'localhost',
    POSTGRES_PORT: 5432,
    POSTGRES_USER: 'protos',
    POSTGRES_PASSWORD: 'protos',
    POSTGRES_DB: 'protos_farm',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    JWT_SECRET: 'dev-jwt-secret-do-not-use-in-production',
    JWT_EXPIRES_IN: '15m',
    REFRESH_TOKEN_EXPIRES_IN: 604800,
  },
  test: {
    PORT: 3000,
    POSTGRES_HOST: 'localhost',
    POSTGRES_PORT: 5432,
    POSTGRES_USER: 'protos',
    POSTGRES_PASSWORD: 'protos',
    POSTGRES_DB: 'protos_farm',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    JWT_SECRET: 'test-jwt-secret-do-not-use-in-production',
    JWT_EXPIRES_IN: '15m',
    REFRESH_TOKEN_EXPIRES_IN: 604800,
  },
  staging: {
    PORT: 3000,
    POSTGRES_HOST: 'postgres',
    POSTGRES_PORT: 5432,
    REDIS_HOST: 'redis',
    REDIS_PORT: 6379,
  },
  production: {
    PORT: 3000,
    POSTGRES_HOST: 'postgres',
    POSTGRES_PORT: 5432,
    REDIS_HOST: 'redis',
    REDIS_PORT: 6379,
  },
};

const REQUIRED_IN_NON_DEV: (keyof Env)[] = [
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'JWT_SECRET',
];

function loadEnv(processEnv: Record<string, string | undefined> = process.env): Env {
  const nodeEnv = (processEnv.NODE_ENV ?? 'development') as NodeEnv;

  if (!['development', 'test', 'staging', 'production'].includes(nodeEnv)) {
    throw new Error(
      `Invalid NODE_ENV: "${nodeEnv}". Must be development, test, staging, or production.`,
    );
  }

  const defaults = DEFAULTS[nodeEnv];

  const pgHost = processEnv.POSTGRES_HOST ?? defaults.POSTGRES_HOST ?? 'localhost';
  const pgPort = toNumber(processEnv.POSTGRES_PORT) ?? defaults.POSTGRES_PORT ?? 5432;
  const pgUser = processEnv.POSTGRES_USER ?? (defaults.POSTGRES_USER as string);
  const pgPassword = processEnv.POSTGRES_PASSWORD ?? (defaults.POSTGRES_PASSWORD as string);
  const pgDb = processEnv.POSTGRES_DB ?? (defaults.POSTGRES_DB as string);

  const databaseUrl =
    processEnv.DATABASE_URL ??
    `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDb}?schema=public`;

  const env: Env = {
    NODE_ENV: nodeEnv,
    PORT: toNumber(processEnv.PORT) ?? defaults.PORT ?? 3000,
    POSTGRES_HOST: pgHost,
    POSTGRES_PORT: pgPort,
    POSTGRES_USER: pgUser,
    POSTGRES_PASSWORD: pgPassword,
    POSTGRES_DB: pgDb,
    DATABASE_URL: databaseUrl,
    REDIS_HOST: processEnv.REDIS_HOST ?? defaults.REDIS_HOST ?? 'localhost',
    REDIS_PORT: toNumber(processEnv.REDIS_PORT) ?? defaults.REDIS_PORT ?? 6379,
    JWT_SECRET: processEnv.JWT_SECRET ?? (defaults.JWT_SECRET as string),
    JWT_EXPIRES_IN: processEnv.JWT_EXPIRES_IN ?? defaults.JWT_EXPIRES_IN ?? '15m',
    REFRESH_TOKEN_EXPIRES_IN:
      toNumber(processEnv.REFRESH_TOKEN_EXPIRES_IN) ?? defaults.REFRESH_TOKEN_EXPIRES_IN ?? 604800,
  };

  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    const missing = REQUIRED_IN_NON_DEV.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables for ${nodeEnv}: ${missing.join(', ')}`,
      );
    }
  }

  return env;
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export { loadEnv, type Env };
