import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { metricsMiddleware, metricsHandler } from './middleware/metrics';
import { requestLoggerMiddleware } from './middleware/request-logger';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { organizationsRouter } from './modules/organizations/organizations.routes';

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

export { app };
