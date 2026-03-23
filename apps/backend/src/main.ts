import './preload';
import { app } from './app';
import { logger } from './shared/utils/logger';
import { startDigestCron } from './shared/cron/digest.cron';
import { startDepreciationCron } from './shared/cron/depreciation.cron';
import { startMaintenanceAlertsCron } from './shared/cron/maintenance-alerts.cron';
import { startMaintenanceProvisionCron } from './shared/cron/maintenance-provision.cron';

const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  logger.info({ port }, 'Backend running');

  if (process.env.NODE_ENV !== 'test') {
    startDigestCron();
    logger.info('Daily digest cron scheduled');
    startDepreciationCron();
    logger.info('Depreciation cron scheduled');
    startMaintenanceAlertsCron();
    logger.info('Maintenance alerts cron scheduled');
    startMaintenanceProvisionCron();
    logger.info('Maintenance provision cron scheduled');
  }
});
