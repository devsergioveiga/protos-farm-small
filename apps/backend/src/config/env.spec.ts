import { loadEnv } from './env';

describe('loadEnv', () => {
  it('should use development defaults when NODE_ENV is not set', () => {
    const env = loadEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.POSTGRES_HOST).toBe('localhost');
    expect(env.POSTGRES_USER).toBe('protos');
    expect(env.POSTGRES_PASSWORD).toBe('protos');
    expect(env.POSTGRES_DB).toBe('protos_farm');
    expect(env.REDIS_HOST).toBe('localhost');
    expect(env.REDIS_PORT).toBe(6379);
  });

  it('should override defaults with provided env values', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      PORT: '4000',
      POSTGRES_HOST: 'custom-host',
    });

    expect(env.PORT).toBe(4000);
    expect(env.POSTGRES_HOST).toBe('custom-host');
  });

  it('should throw when required vars are missing in staging', () => {
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(
      'Missing required environment variables for staging: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB',
    );
  });

  it('should throw when required vars are missing in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(
      'Missing required environment variables for production',
    );
  });

  it('should not throw in staging when all required vars are provided', () => {
    const env = loadEnv({
      NODE_ENV: 'staging',
      POSTGRES_USER: 'staging_user',
      POSTGRES_PASSWORD: 'staging_pass',
      POSTGRES_DB: 'staging_db',
    });

    expect(env.NODE_ENV).toBe('staging');
    expect(env.POSTGRES_USER).toBe('staging_user');
    expect(env.POSTGRES_HOST).toBe('postgres');
  });

  it('should use production defaults for host values', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      POSTGRES_USER: 'prod_user',
      POSTGRES_PASSWORD: 'prod_pass',
      POSTGRES_DB: 'prod_db',
    });

    expect(env.POSTGRES_HOST).toBe('postgres');
    expect(env.REDIS_HOST).toBe('redis');
  });

  it('should throw on invalid NODE_ENV', () => {
    expect(() => loadEnv({ NODE_ENV: 'invalid' })).toThrow('Invalid NODE_ENV: "invalid"');
  });
});
