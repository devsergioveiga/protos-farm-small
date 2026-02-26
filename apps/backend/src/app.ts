import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { healthRouter } from './modules/health/health.routes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api', healthRouter);

export { app };
