import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { metricsMiddleware, metricsHandler } from './middleware/metrics';
import { requestLoggerMiddleware } from './middleware/request-logger';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { organizationsRouter } from './modules/organizations/organizations.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { orgUsersRouter } from './modules/org-users/org-users.routes';
import { rolesRouter } from './modules/roles/roles.routes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);
app.use(requestLoggerMiddleware);

app.get('/metrics', metricsHandler);
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', organizationsRouter);
app.use('/api', adminRouter);
app.use('/api', orgUsersRouter);
app.use('/api', rolesRouter);

export { app };
