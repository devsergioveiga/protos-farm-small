import './preload';
import { app } from './app';
import { logger } from './shared/utils/logger';
import { startDigestCron } from './shared/cron/digest.cron';

const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  logger.info({ port }, 'Backend running');

  if (process.env.NODE_ENV !== 'test') {
    startDigestCron();
    logger.info('Daily digest cron scheduled');
  }
});
