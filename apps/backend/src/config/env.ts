type NodeEnv = 'development' | 'staging' | 'production';

interface Env {
  NODE_ENV: NodeEnv;
  PORT: number;
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
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

const REQUIRED_IN_NON_DEV: (keyof Env)[] = ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'];

function loadEnv(processEnv: Record<string, string | undefined> = process.env): Env {
  const nodeEnv = (processEnv.NODE_ENV ?? 'development') as NodeEnv;

  if (!['development', 'staging', 'production'].includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV: "${nodeEnv}". Must be development, staging, or production.`);
  }

  const defaults = DEFAULTS[nodeEnv];

  const env: Env = {
    NODE_ENV: nodeEnv,
    PORT: toNumber(processEnv.PORT) ?? defaults.PORT ?? 3000,
    POSTGRES_HOST: processEnv.POSTGRES_HOST ?? defaults.POSTGRES_HOST ?? 'localhost',
    POSTGRES_PORT: toNumber(processEnv.POSTGRES_PORT) ?? defaults.POSTGRES_PORT ?? 5432,
    POSTGRES_USER: processEnv.POSTGRES_USER ?? (defaults.POSTGRES_USER as string),
    POSTGRES_PASSWORD: processEnv.POSTGRES_PASSWORD ?? (defaults.POSTGRES_PASSWORD as string),
    POSTGRES_DB: processEnv.POSTGRES_DB ?? (defaults.POSTGRES_DB as string),
    REDIS_HOST: processEnv.REDIS_HOST ?? defaults.REDIS_HOST ?? 'localhost',
    REDIS_PORT: toNumber(processEnv.REDIS_PORT) ?? defaults.REDIS_PORT ?? 6379,
  };

  if (nodeEnv !== 'development') {
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
