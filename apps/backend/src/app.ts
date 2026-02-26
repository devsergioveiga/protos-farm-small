import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { metricsMiddleware, metricsHandler } from './middleware/metrics';
import { healthRouter } from './modules/health/health.routes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

app.get('/metrics', metricsHandler);
app.use('/api', healthRouter);

export { app };
