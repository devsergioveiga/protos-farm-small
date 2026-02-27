import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';

const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
  base: {
    service: 'backend',
    environment: process.env.NODE_ENV ?? 'development',
  },
});

export { logger };
