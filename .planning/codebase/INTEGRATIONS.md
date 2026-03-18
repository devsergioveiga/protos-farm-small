# External Integrations

**Analysis Date:** 2026-03-15

## APIs & External Services

**Authentication - Google OAuth 2.0:**

- Service: Google Identity Services
- What it's used for: Social login (optional), email/profile verification, OIDC flow
- SDK/Client: `google-auth-library` 10.6.1
- Auth: Environment variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`)
- Implementation: `apps/backend/src/modules/auth/google-oauth.service.ts`
- Flow: Build auth URL → Verify state → Exchange code for ID token → Extract email → Link/verify user
- Conditional: Only enabled if `GOOGLE_CLIENT_ID` is set; can be disabled per organization (`allowSocialLogin` flag)

**Email Delivery - SMTP:**

- Service: Generic SMTP (e.g., Gmail, SendGrid, local MailHog for dev)
- What it's used for: Password reset, invitations, notifications
- Client: `nodemailer` 8.0.1
- Auth: Environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`)
- Implementation: `apps/backend/src/shared/mail/mail.service.ts`
- Default dev: MailHog on localhost:1025 (no auth)
- Configuration: Supports optional auth (user/pass) or anonymous SMTP

**Geospatial APIs - Third-party:**

- Not integrated in production. Uses local computation via Turf.js and PostGIS.

## Data Storage

**Primary Database - PostgreSQL 16:**

- Provider: PostgreSQL 16 with PostGIS 3.4 extension
- Purpose: All persistent data (organizations, users, farms, animals, operations, etc.)
- Connection: Via `DATABASE_URL` (constructed from `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`)
- ORM Client: Prisma 7.4.1 with PostgreSQL adapter (`@prisma/adapter-pg`)
- Schema: `apps/backend/prisma/schema.prisma` (54k+ tokens, managed by Prisma migrations)
- Migrations: `apps/backend/prisma/migrations/` (auto-generated, run via `prisma migrate dev/deploy`)
- Row-Level Security: Enabled (multitenancy isolation, bypassed only for system operations)

**Session Cache - Redis 7:**

- Provider: Redis 7 (Alpine image, in-memory)
- Purpose: Temporary data (session tokens, OAuth state, email verification codes)
- Connection: `apps/backend/src/database/redis.ts` via `ioredis` 5.9.3
- Configuration: `REDIS_HOST`, `REDIS_PORT`
- Key Prefixes Used:
  - `google_state:` - CSRF protection for OAuth (TTL: 600s)
  - `google_exchange:` - One-time exchange codes (TTL: 60s)
  - (Other prefixes managed by modules, see MEMORY.md for details)
- Lazy connect: Yes (connects on first use)
- Singleton: Global instance, reused in development

**Local Database - Mobile (SQLite):**

- Provider: Expo SQLite 55.0.10
- Purpose: Offline cache (farms, plots, animals, operations, monitoring records)
- Implementation: `apps/mobile/services/database.ts`
- Schema: 11 migrations (see `apps/mobile/services/database.ts` for migration versions)
- Tables: Mirror offline entities defined in `apps/mobile/types/offline.ts`
- Sync Management: `apps/mobile/services/db/sync-meta-repository.ts` tracks last sync per entity
- Migrations: Auto-run on app launch via `migrateDbIfNeeded(db)` (called by SQLiteProvider `onInit`)

**File Storage - Local Filesystem:**

- Images: Uploaded to `apps/mobile/` cache (via `expo-file-system`)
- Photos: Stored locally with sync queue tracking
- Maps: Tile cache in SQLite (PostGIS geometries encoded as GeoJSON)
- Exports: CSV/PDF generated temporarily, sent as blobs

## Authentication & Identity

**Auth Provider:**

- Custom JWT-based (backend issues tokens)
- Optional: Google OAuth 2.0 social login

**Implementation Approach:**

**JWT Tokens:**

- Access Token: Short-lived (`JWT_EXPIRES_IN`, default 15m)
- Refresh Token: Long-lived (`REFRESH_TOKEN_EXPIRES_IN`, default 7 days = 604800s)
- Secret: `JWT_SECRET` (required in production)
- Verification: Done at `apps/backend/src/middleware/auth.ts`
- Issuance: `apps/backend/src/modules/auth/auth.service.ts` → `createSessionForUser()`

**Password Hashing:**

- Algorithm: bcrypt (via `bcrypt` 6.0.0)
- Used in: User registration, password reset flows
- Salting: Default bcrypt salts (10 rounds)

**Email-based Flows:**

- Password Reset: Token email sent, valid for `PASSWORD_RESET_EXPIRES_IN` (default 3600s)
- Accept Invite: Token emailed to new user, valid for `INVITE_TOKEN_EXPIRES_IN` (default 172800s = 2 days)
- Organization Invite: Token emailed, valid for `ORG_INVITE_TOKEN_EXPIRES_IN` (default 604800s = 7 days)

**Mobile Token Storage:**

- Tokens stored in `expo-secure-store` 55.0.8 (encrypted OS credential storage)
- Key names: `protos_access_token`, `protos_refresh_token`
- Web: localStorage (development), HttpOnly cookies (recommended for production)

**Authorization (RBAC):**

- Roles: `SUPER_ADMIN`, `ORG_ADMIN`, `FARM_MANAGER`, `OPERATOR`, `VIEWER` (defined in Prisma schema)
- Row-Level Security: PostgreSQL RLS policies (organization isolation)
- Enforcement: Middleware at `apps/backend/src/middleware/authorize.ts`
- Features: Organization-scoped access, farm-level permissions, scope-based filtering

## Monitoring & Observability

**Metrics - Prometheus:**

- Client: `prom-client` 15.1.3
- Endpoint: `/metrics` on backend
- What's collected: HTTP request rate/latency, database queries, custom counters per module
- Scrape config: `infra/prometheus/prometheus.yml` (interval: typically 15s)
- Dashboards: Grafana 11.5.2 (port 3001)

**Logs - Structured Logging:**

- Framework: `pino` 10.3.1 (JSON logger)
- Implementation: `apps/backend/src/shared/utils/logger.ts`
- Output: Stdout (JSON format in production, pretty-printed in dev via `pino-pretty`)
- Aggregation: Loki 3.4.2 (via `Promtail` log shipper)
- Loki URL: `http://localhost:3100` (scraped from Docker containers)

**Alerts:**

- Tool: AlertManager 0.27.0
- Rules: `infra/alertmanager/alertmanager.yml`
- Conditions: Defined in `infra/prometheus/alert-rules.yml`
- Receivers: Email, Slack (configured in alertmanager.yml)

**Error Tracking:**

- Not integrated. Manual logging via pino.

## CI/CD & Deployment

**Hosting:**

- Development: Local Docker Compose (`apps/backend` on :3200 or :3000, `apps/frontend` on :5173)
- Production: Not specified in codebase (assumed K8s or Docker on cloud platform)

**CI Pipeline:**

- System: Not detected in `.github/` (assume GitHub Actions, GitLab CI, or manual deployment)
- Key requirement: `prisma generate` must run before `tsc` (see CLAUDE.md)

**Docker:**

- Compose file: `docker-compose.yml` (7 services)
- Services: PostgreSQL, Redis, Prometheus, Grafana, Loki, Promtail, AlertManager
- Volumes: Named volumes for data persistence
- Health checks: Defined for each service
- Entry script: `infra/scripts/reset-dev.sh` (reset DB + seed)

## Environment Configuration

**Required Environment Variables (Non-Dev/Test):**

```
# Database
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB

# Auth
JWT_SECRET

# Email
SMTP_HOST
FRONTEND_URL
```

**Optional Environment Variables:**

```
# Database (can be derived from components)
DATABASE_URL

# Redis (defaults: localhost:6379)
REDIS_HOST
REDIS_PORT

# Auth Timing
JWT_EXPIRES_IN (default: 15m)
REFRESH_TOKEN_EXPIRES_IN (default: 604800)
PASSWORD_RESET_EXPIRES_IN (default: 3600)
INVITE_TOKEN_EXPIRES_IN (default: 172800)
ORG_INVITE_TOKEN_EXPIRES_IN (default: 604800)

# Email
SMTP_PORT (default: 1025)
SMTP_USER
SMTP_PASSWORD
SMTP_FROM

# OAuth (optional)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

**Secrets Location:**

- Development: `.env.local` (git-ignored)
- Production: Environment variables injected at deployment time
- Not in repo: `.env`, `.env.production`, any file with "secret" or "credential" in name

## Webhooks & Callbacks

**Incoming Webhooks:**

- Not detected in codebase

**Outgoing Webhooks:**

- Not detected in codebase

**Callbacks Used:**

**OAuth Callback (Google):**

- Endpoint: `/api/auth/google/callback`
- Method: POST (receives authorization code and state)
- Backend processor: `apps/backend/src/modules/auth/google-oauth.service.ts` → `handleGoogleCallback()`
- Generates one-time exchange code (60s TTL in Redis) returned to frontend
- Frontend then exchanges code for tokens via `/api/auth/google/exchange`

## Map & Geospatial Data

**Tile Server:**

- Frontend: OpenStreetMap tiles (default Leaflet provider)
- No custom tile server (uses public OSM)

**Geospatial Libraries:**

- `leaflet` 1.9.4 - Web maps
- `@turf/*` 7.3.4+ - Geospatial calculations (area, intersection, validity checks)
- `PostGIS 3.4` - Database spatial queries
- `shapefile` 0.6.6 - Shapefile import parsing
- `@tmcw/togeojson` 7.1.2 - GeoJSON format conversion

**Map Offline (Mobile):**

- Tile Cache: SQLite (stored as `tile_cache_meta` table in `apps/mobile/services/database.ts`)
- Download: On-demand download via map tile layers
- Storage: Via `expo-file-system` 55.0.10

## Data Sync (Offline-First)

**Sync Framework:**

- Implementation: `apps/mobile/services/sync.ts`
- Local Queue: SQLite tables marked with `synced` field (0=pending, 1=synced)
- Detection: Network status via `@react-native-community/netinfo` 12.0.1
- Trigger: Manual sync button + auto-sync when connection detected

**Offline Entities Supported:**

- Farms, field plots, farm locations, animal lots, animals, breed compositions
- Pests, monitoring points, monitoring records, field teams, cultivars
- Field operations, pesticide applications, planting operations
- Quick service entries, team operations
- Reference data: Bulls, IATF protocols, diseases, treatment protocols, exam types, feed ingredients, products

**Sync Metadata:**

- Table: `sync_meta` in SQLite (entity name, last sync timestamp, record count)
- Repository: `apps/mobile/services/db/sync-meta-repository.ts`

## PDF Generation

**PDF Library:**

- `pdfkit` 0.17.2
- Used for: Pesticide prescription PDFs, reports, exports
- Location: Called by `apps/backend/src/modules/pesticide-prescriptions/` and harvest modules
- Format: Generated dynamically, sent as blob to client

## File Formats & Parsing

**Excel/Spreadsheet:**

- Library: `exceljs` 4.4.0
- Used for: Bulk animal import, operation records import, report export
- Formats: .xlsx, .xls

**Shapefile:**

- Library: `shapefile` 0.6.6
- Used for: Farm boundary import from CAR (Cadastro Ambiental Rural)
- Processing: Parsed to GeoJSON, stored in PostGIS

**GeoJSON:**

- Library: `@tmcw/togeojson` 7.1.2
- Used for: KML/GeoJSON conversion, storage in PostGIS geometry column

**ZIP Archives:**

- Library: `jszip` 3.10.1
- Used for: Multi-file uploads, export packages

---

_Integration audit: 2026-03-15_
