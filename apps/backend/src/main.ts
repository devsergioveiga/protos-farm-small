import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { healthRouter } from './modules/health/health.routes';

const app = express();
const port = process.env.PORT ?? 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api', healthRouter);

app.listen(port, () => {
  console.log(`[Protos Farm] Backend running on http://localhost:${port}`);
});
