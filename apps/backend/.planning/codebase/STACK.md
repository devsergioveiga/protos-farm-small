# Technology Stack

**Analysis Date:** 2026-03-15

## Languages

**Primary:**

- TypeScript 5.7 - Used across all apps (backend, frontend, mobile, shared)
- JavaScript (CommonJS/ESM) - Backend CommonJS, frontend/mobile ES modules

**Secondary:**

- SQL - PostgreSQL queries via Prisma 7 ORM
- YAML - Docker Compose, Kubernetes configs in `infra/`

## Runtime

**Environment:**

- Node.js 20.0.0+ (required engine in `package.json`)
- React 19.0.0+ - Frontend (web) and mobile (both use React 19.1.0)
- React Native 0.81.5 - Mobile app runtime

**Package Manager:**

- pnpm 10.27.0 (monorepo workspaces)
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core Backend:**

- Express 5.1.0 - HTTP server, REST API
- Prisma 7.4.1 - ORM with PostgreSQL adapter
- TypeScript 5.7 - Strict typing compilation

**Core Frontend:**

- Vite 6.0.0 - Build tool, dev server (port 5173)
- React 19.0.0 - UI framework
- React Router DOM 7.13.1 - Client-side routing
- React Leaflet 5.0.0 - Interactive maps
- Recharts 3.7.0 - Data visualization/charts

**Core Mobile:**

- Expo 54.0.33 - Build system and runtime
- Expo Router 6.0.23 - File-based routing (`app/` directory)
- React Native 0.81.5 - Native UI framework
- React Native Maps 1.27.1 - Native map component
- React Native Reanimated 4.1.6 - Gesture animations

**Testing:**

- Jest 29.7.0 - Backend/shared test runner (`**/*.spec.ts`)
- Vitest 3.0.0 - Frontend test runner
- ts-jest 29.2.0 - TypeScript Jest transformer
- Supertest 7.2.2 - HTTP endpoint testing (backend)
- @testing-library/react 16.3.2 - Component testing (frontend)
- jsdom 28.1.0 - DOM simulation (frontend)

**Build/Dev:**

- tsx 4.19.0 - TypeScript executor (backend dev: `tsx watch src/main.ts`)
- Prisma CLI 7.4.1 - Database migrations (`prisma migrate dev`)
- Vite Plugins - React support via `@vitejs/plugin-react`
- Metro 0.84.2 - React Native bundler (via Expo)

## Key Dependencies

**Critical - Backend:**

- `@prisma/client` 7.4.1 - Query builder, migrations
- `@prisma/adapter-pg` 7.4.1 - PostgreSQL driver
- `bcrypt` 6.0.0 - Password hashing
- `jsonwebtoken` 9.0.3 - JWT token creation/verification
- `google-auth-library` 10.6.1 - Google OAuth 2.0 client
- `nodemailer` 8.0.1 - SMTP email sending
- `ioredis` 5.9.3 - Redis client (caching, session state)
- `cors` 2.8.5 - CORS middleware
- `helmet` 8.0.0 - Security headers middleware
- `pino` 10.3.1 - Structured logging
- `prom-client` 15.1.3 - Prometheus metrics export

**Infrastructure - Backend:**

- `multer` 2.1.0 - File upload handling
- `exceljs` 4.4.0 - XLSX/XLS parsing/generation
- `jszip` 3.10.1 - ZIP handling
- `pdfkit` 0.17.2 - PDF generation
- `shapefile` 0.6.6 - Shapefile parsing
- `@turf/*` (7.3.4+) - Geospatial analysis
- `@tmcw/togeojson` 7.1.2 - GeoJSON conversion
- `@xmldom/xmldom` 0.8.11 - XML parsing

**Frontend:**

- `leaflet` 1.9.4 - Map library (loaded by react-leaflet)
- `leaflet-draw` 1.0.4 - Map drawing tools
- `lucide-react` 0.575.0 - Icon library (web)
- `recharts` 3.7.0 - Charts and graphs

**Mobile:**

- `expo-sqlite` 55.0.10 - Local SQLite database (offline cache)
- `expo-location` 19.0.8 - GPS coordinates
- `expo-file-system` 55.0.10 - Local filesystem access
- `expo-secure-store` 55.0.8 - Secure credential storage (tokens)
- `expo-image-picker` 17.0.10 - Camera/gallery photos
- `expo-local-authentication` 55.0.8 - Biometric auth (fingerprint)
- `expo-constants` 18.0.13 - App constants
- `expo-crypto` 55.0.9 - Crypto operations
- `expo-haptics` 55.0.8 - Vibration feedback
- `react-native-maps` 1.27.1 - Native maps (iOS/Android)
- `react-native-reanimated` 4.1.6 - Gesture animations
- `lucide-react-native` 0.577.0 - Icon library (mobile)
- `@react-native-community/netinfo` 12.0.1 - Network status detection
- `@react-native-community/datetimepicker` 8.6.0 - Date/time picker

**Shared Package:**

- `@protos-farm/shared` - Types, constants, tokens (used by all apps)

## Configuration

**Environment:**

- Configuration via `process.env` with defaults in `apps/backend/src/config/env.ts`
- Defaults per NODE_ENV: development, test, staging, production
- Environment file: `.env` (not committed, secrets only)

**Key Environment Variables:**

- Database: `DATABASE_URL`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Redis: `REDIS_HOST`, `REDIS_PORT`
- Auth: `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Frontend: `FRONTEND_URL`

**Build:**

- Backend: `apps/backend/tsconfig.json` (CommonJS, strict mode, path alias `@/*`)
- Frontend: `apps/frontend/vite.config.ts` (React plugin, port 5173, API proxy to `:3200`)
- Mobile: `expo.json` (Expo config, managed workflow)
- Root: `tsconfig.base.json` (shared TypeScript base config)
- Prettier: `.prettierrc` (100 char width, 2-space indent, trailing commas)
- ESLint: `eslint.config.mjs` (flat config, TypeScript + Prettier integration)

**Monorepo:**

- `pnpm-workspace.yaml` - Defines workspaces: `apps/*`, `packages/*`
- Root `package.json` - Shared dev deps, scripts for multi-app dev/build/test

## Platform Requirements

**Development:**

- Node.js ≥ 20.0.0
- pnpm ≥ 10.0.0
- PostgreSQL 16 (via Docker: `postgis/postgis:16-3.4`)
- Redis 7 (via Docker: `redis:7-alpine`)
- Docker + Docker Compose
- Git (Husky pre-commit hooks installed)

**Production:**

- PostgreSQL 16 with PostGIS 3.4 extension
- Redis 7 (session/cache)
- Node.js ≥ 20.0.0
- Prometheus 2.51.0 (metrics scraping)
- Grafana 11.5.2 (metrics dashboard)
- Loki 3.4.2 (centralized logging)
- iOS 13+ (mobile) / Android 6+ (mobile)

**Infrastructure Containers:**

- Postgres 16 + PostGIS 3.4: `protos-farm-postgres` (port 5432)
- Redis 7: `protos-farm-redis` (port 6379)
- Prometheus: `protos-farm-prometheus` (port 9090)
- Grafana: `protos-farm-grafana` (port 3001)
- Loki: `protos-farm-loki` (port 3100)
- Promtail: `protos-farm-promtail` (log collection)
- AlertManager: `protos-farm-alertmanager` (port 9093)

## Development Setup

**Backend Start:**

```bash
pnpm dev:backend  # Runs: tsx watch src/main.ts (watches on :3000 or $PORT)
pnpm test         # Jest runner
pnpm lint:fix     # ESLint + Prettier
```

**Frontend Start:**

```bash
pnpm dev:frontend  # Vite dev server on :5173, proxies /api/* to :3200
pnpm build         # tsc + vite build
```

**Mobile Start:**

```bash
pnpm dev:mobile    # Expo dev mode (preview, Android, iOS)
```

**Database:**

```bash
pnpm infra:up                  # Docker Compose up (all services)
prisma migrate dev             # Run migrations
prisma db seed               # Seed dev data
```

---

_Stack analysis: 2026-03-15_
