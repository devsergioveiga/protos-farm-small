import path from 'node:path';
import dotenv from 'dotenv';

// Load .env from monorepo root (apps/backend -> root)
// Must run before any other module reads process.env
dotenv.config({ path: path.resolve(process.cwd(), '..', '..', '.env') });
