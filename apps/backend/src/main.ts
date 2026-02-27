import { app } from './app';
import { logger } from './shared/utils/logger';

const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  logger.info({ port }, 'Backend running');
});
