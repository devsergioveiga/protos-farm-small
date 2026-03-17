# Stack Research

**Domain:** Procurement / Purchasing Module (v1.1 Gestão de Compras)
**Researched:** 2026-03-17
**Confidence:** HIGH for backend additions; MEDIUM for frontend kanban

---

## Context: What Already Exists (Do Not Re-Add)

The following are already installed and must be reused:

| Library          | Version  | Already Covers                                                         |
| ---------------- | -------- | ---------------------------------------------------------------------- |
| `nodemailer`     | ^8.0.1   | Email sending — `src/shared/mail/mail.service.ts` already wraps it     |
| `pdfkit`         | ^0.17.2  | PDF generation — reuse pattern from `modules/pesticide-prescriptions/` |
| `exceljs`        | ^4.4.0   | Excel/CSV export — reuse pattern from `modules/stock-outputs/`         |
| `decimal.js`     | ^10.6.0  | Monetary arithmetic — Money type already established                   |
| `ioredis`        | ^5.9.3   | Redis client — already connected at `src/database/redis.ts`            |
| `multer`         | ^2.1.0   | File upload — already in use for NF-e XML                              |
| `@xmldom/xmldom` | ^0.8.11  | XML parsing — already used for NF-e                                    |
| `recharts`       | ^3.7.0   | Charts — already in frontend for dashboards                            |
| `lucide-react`   | ^0.575.0 | Icons — design system standard                                         |

---

## New Dependencies Required

### Backend: 3 new packages

#### 1. BullMQ — Async Job Queue for Approval Workflows and Notifications

| Attribute    | Value                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Package      | `bullmq`                                                                                                                                                                                                                                                                                                                                                                                                           |
| Version      | `^5.71.0` (latest as of March 2026, verified via npm)                                                                                                                                                                                                                                                                                                                                                              |
| Purpose      | Background jobs: approval escalation timers, notification dispatch, email sending async                                                                                                                                                                                                                                                                                                                            |
| Why          | Already have Redis (`ioredis ^5.9.3` installed). BullMQ uses ioredis internally at the exact same version — zero new Redis infrastructure needed. BullMQ is the successor to `bull` (which is in maintenance mode), written in TypeScript, MIT licensed. Supports delayed jobs (approval timeout escalation), job prioritization, retries, and job events (`completed`/`failed`/`stalled`) for notification hooks. |
| Why not cron | Cron-based notifications miss the event-driven model needed here: "send email when quotation status changes to APPROVED" is a job, not a schedule                                                                                                                                                                                                                                                                  |
| Confidence   | HIGH — npm-verified, ioredis peer dep matches existing version                                                                                                                                                                                                                                                                                                                                                     |

**Use for:**

- Send "cotação solicitada" email to supplier 30 seconds after quotation request is saved (fire-and-forget, retry on SMTP failure)
- Escalate unanswered approval requests after configurable timeout
- Generate PDF + email delivery of purchase order (OC) without blocking the HTTP response

**Do NOT use for:**

- Real-time UI push — use SSE for that (see below)
- Recurring reports — not in v1.1 scope

#### 2. validation-br — CNPJ/CPF Validation for Supplier Cadastro

| Attribute              | Value                                                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package                | `validation-br`                                                                                                                                                                                                                                                                                   |
| Version                | `^1.6.4` (latest as of March 2026, verified via npm; last published 2026-01-18)                                                                                                                                                                                                                   |
| Purpose                | Validate CNPJ, CPF, IE (Inscrição Estadual) on supplier registration                                                                                                                                                                                                                              |
| Why                    | Supports alphanumeric CNPJ (effective July 2026 per Receita Federal Technical Note COCAD/SUARA/RFB nº 49) — critical since the codebase must be compliant before the switch date. Covers CNPJ + CPF + IE + RENAVAM in one package, actively maintained (published Jan 2026). Ships its own types. |
| Why not `cnpj` (npm)   | `cnpj@5.0.0` only handles CNPJ, not the full supplier document set. `validation-br` is broader                                                                                                                                                                                                    |
| Why not `@fnando/cnpj` | Also only CNPJ, version 2.0.0, less actively maintained for the 2026 alphanumeric transition                                                                                                                                                                                                      |
| Confidence             | MEDIUM — npm-verified version and recent publish date; alphanumeric support confirmed in description but specific function API not verified via official docs                                                                                                                                     |

**Use on:**

- Backend: supplier CNPJ/CPF validation in `modules/suppliers/suppliers.service.ts`
- Shared: expose in `packages/shared/src/utils/br-document.ts` so frontend can reuse without duplicating logic

#### 3. Handlebars — HTML Email Templates for Purchase Orders

| Attribute                    | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Package                      | `handlebars`                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Version                      | `^4.7.8` (latest as of March 2026, verified via npm)                                                                                                                                                                                                                                                                                                                                                                                                         |
| Purpose                      | Render HTML email bodies for: quotation request to supplier, purchase order (OC) delivery, approval notifications                                                                                                                                                                                                                                                                                                                                            |
| Why                          | The existing `mail.service.ts` accepts raw HTML string — it has no templating. Purchase orders sent to external suppliers need branded, data-rich HTML email (company logo, line items, totals, payment terms). Handlebars is logic-less enough to stay safe (no arbitrary code execution), ships TypeScript types, integrates with nodemailer by generating the `html` string passed to `sendMail()`. 4.7.8 is a long-standing stable release with no CVEs. |
| Why not MJML                 | MJML (4.18.0) produces responsive email HTML but adds 4–8MB to bundle and build complexity. For internal B2B procurement emails (not marketing), standard HTML is sufficient.                                                                                                                                                                                                                                                                                |
| Why not string interpolation | Purchase orders have 10–50 line items — template literals become unmaintainable.                                                                                                                                                                                                                                                                                                                                                                             |
| Confidence                   | HIGH — widely used, stable, well-known fit for nodemailer integration                                                                                                                                                                                                                                                                                                                                                                                        |

**Pattern:**

```
apps/backend/src/shared/mail/templates/
  quotation-request.hbs
  purchase-order.hbs
  approval-request.hbs
  approval-approved.hbs
  approval-rejected.hbs
```

---

### Frontend: 1 new package

#### 4. @dnd-kit/core + @dnd-kit/sortable — Kanban Board for Procurement Flow

| Attribute                 | Value                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packages                  | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`                                                                                                                                                                                                                                                                                            |
| Versions                  | `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2` (verified via npm)                                                                                                                                                                                                                                                   |
| Purpose                   | Drag-and-drop kanban board for procurement flow (Requisição → Cotação → Aprovação → Pedido → Recebimento)                                                                                                                                                                                                                                             |
| Why                       | `react-beautiful-dnd` is unmaintained (Atlassian stopped development). `dnd-kit` is the established modern successor: 12KB gzipped core, 60fps with virtualization, accessible (keyboard + screen reader support), active maintenance (last @dnd-kit/react published 25 days ago per search). Peer deps `react >= 16.8.0` — compatible with React 19. |
| Why not react-dnd         | `react-dnd` has an open issue for React 19 support (#3655 on GitHub) — risky given this codebase uses React 19                                                                                                                                                                                                                                        |
| Why not @hello-pangea/dnd | Fork of react-beautiful-dnd; good for lists but less flexible than dnd-kit for multi-column boards                                                                                                                                                                                                                                                    |
| Confidence                | MEDIUM — React 19 compatibility confirmed via npm peer deps check; one open issue about `use client` in @dnd-kit/react (not relevant here, we use @dnd-kit/core)                                                                                                                                                                                      |

**Use only for** the kanban page. All other list interactions (sortable tables, filters) do not need drag-and-drop.

---

## No New Infrastructure Required

### Notifications: SSE via Express (Zero Dependencies)

The procurement flow needs real-time UI feedback ("sua cotação foi aprovada"). **Use Server-Sent Events (SSE) over standard Express responses** — no new package needed:

```typescript
// modules/notifications/notifications.routes.ts
router.get('/stream', authenticate, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Store res in memory map keyed by userId
  // BullMQ job completions write to this map
});
```

SSE is unidirectional (server → client) which is exactly what procurement notifications require. No WebSocket library needed. Redis pub/sub (already available via ioredis) coordinates across multiple Express processes if horizontally scaled.

**Why not socket.io or ws:** Bidirectional is overkill for notifications. SSE reconnects automatically on connection loss (mobile-friendly), works through HTTP/2, no CORS complications beyond standard headers.

### PDF Purchase Order: pdfkit (Already Installed)

Reuse the pattern from `modules/pesticide-prescriptions/` for purchase order (OC) PDF generation. No new library needed. The OC PDF requires: company header, supplier details, line items table, totals, payment terms, authorization signature line — all achievable with existing pdfkit.

### Budget Control: Pure PostgreSQL + decimal.js

Budget vs. committed vs. actual spend is a SQL aggregation problem. No specialized library needed. Use existing Prisma patterns with `decimal.js` for precision.

---

## Installation

```bash
# Backend additions (run from apps/backend/)
pnpm add bullmq validation-br handlebars
pnpm add -D @types/handlebars

# Frontend additions (run from apps/frontend/)
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Note: BullMQ ships its own TypeScript types. `validation-br` ships its own types. No `@types/*` needed for those two.

---

## Alternatives Considered

| Recommended   | Alternative            | Why Not                                                                                                             |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| BullMQ        | node-cron              | Cron doesn't model event-triggered jobs (approval → email). BullMQ's delayed jobs handle escalation timeouts better |
| BullMQ        | Agenda (MongoDB-based) | Project uses PostgreSQL + Redis, not MongoDB. Adding MongoDB is out of scope                                        |
| validation-br | Custom regex           | CNPJ check-digit algorithm is non-trivial; alphanumeric variant adds complexity. Package cost is negligible         |
| Handlebars    | Template literals      | Unmaintainable for 5+ email templates with 10–50 dynamic line items                                                 |
| Handlebars    | MJML                   | MJML adds 4–8MB, builds HTML from its own DSL, overkill for B2B procurement emails                                  |
| @dnd-kit      | react-beautiful-dnd    | Unmaintained since 2022                                                                                             |
| @dnd-kit      | @hello-pangea/dnd      | Community fork, less flexible for multi-column kanban                                                               |
| @dnd-kit      | react-dnd              | React 19 support issue open (GitHub #3655)                                                                          |
| SSE (native)  | socket.io              | socket.io adds 60KB+ bundle, requires separate server, bidirectional overkill                                       |
| SSE (native)  | Pusher/Ably            | External SaaS cost, data leaves system — not appropriate for procurement data                                       |

---

## What NOT to Use

| Avoid                     | Why                                                                        | Use Instead               |
| ------------------------- | -------------------------------------------------------------------------- | ------------------------- |
| `bull` (original)         | Maintenance mode since BullMQ launch; no new features                      | `bullmq`                  |
| `cnpj` npm package alone  | Only validates CNPJ numeric, misses CPF/IE, no 2026 alphanumeric support   | `validation-br`           |
| MJML                      | 4–8MB bundle, DSL learning curve, overkill for B2B procurement email       | `handlebars` + inline CSS |
| `react-dnd`               | React 19 support gap (open GitHub issue #3655)                             | `@dnd-kit/core`           |
| `socket.io`               | Bidirectional overhead for unidirectional notifications                    | Native SSE in Express     |
| New PostgreSQL extensions | PostGIS already installed; no additional extensions needed for procurement | Existing setup            |

---

## Integration Points

| New Capability    | Integrates With                   | Notes                                                          |
| ----------------- | --------------------------------- | -------------------------------------------------------------- |
| Supplier creation | `modules/payables/`               | Supplier becomes `payeeId` on CP auto-generated from receiving |
| Receiving + NF    | `modules/payables/`               | Receipt → auto-create Payable (existing service pattern)       |
| Purchase budget   | `modules/cost-centers/`           | Budget rateio uses existing cost center structure              |
| BullMQ workers    | `src/database/redis.ts`           | Reuse existing Redis connection; create `src/queue/` directory |
| Supplier email    | `src/shared/mail/mail.service.ts` | Add `sendMailWithAttachment()` variant for OC PDF              |
| SSE notifications | `src/shared/`                     | New `notifications/` directory under shared                    |

---

## Version Compatibility

| Package                     | Node.js | TypeScript | Peer Deps                   | Notes                    |
| --------------------------- | ------- | ---------- | --------------------------- | ------------------------ |
| `bullmq ^5.71.0`            | >=18    | >=4.7      | ioredis 5.9.3 (exact match) | Ships own types          |
| `validation-br ^1.6.4`      | >=14    | >=4        | none                        | Ships own types          |
| `handlebars ^4.7.8`         | >=6     | >=4        | none                        | Needs @types/handlebars  |
| `@dnd-kit/core ^6.3.1`      | N/A     | >=4        | react >=16.8.0              | Compatible with React 19 |
| `@dnd-kit/sortable ^10.0.0` | N/A     | >=4        | @dnd-kit/core               | Same peer req            |

---

## Sources

- `apps/backend/package.json` — existing dependencies (HIGH confidence)
- `apps/frontend/package.json` — existing frontend dependencies (HIGH confidence)
- `src/database/redis.ts`, `src/shared/mail/mail.service.ts` — existing infrastructure patterns (HIGH confidence)
- npm registry via `npm info bullmq version` → 5.71.0 (HIGH confidence, verified)
- npm registry via `npm info validation-br version` → 1.6.4, time.modified 2026-01-18 (HIGH confidence, verified)
- npm registry via `npm info handlebars version` → 4.7.8 (HIGH confidence, verified)
- npm registry via `npm info @dnd-kit/core version` → 6.3.1 (HIGH confidence, verified)
- npm registry via `npm info @dnd-kit/sortable version` → 10.0.0 (HIGH confidence, verified)
- WebSearch: BullMQ ioredis dep confirmed 5.9.3 (matches existing) (HIGH confidence)
- WebSearch: react-beautiful-dnd unmaintained, dnd-kit React 19 peer dep check (MEDIUM confidence)
- WebSearch: SSE vs WebSocket — SSE confirmed sufficient for unidirectional notifications (HIGH confidence)
- WebSearch: CNPJ alphanumeric July 2026 — Receita Federal Technical Note COCAD/SUARA/RFB nº 49 (MEDIUM confidence — source via web, not official Receita Federal site directly)
- [BullMQ official docs](https://docs.bullmq.io/) — job events, delayed jobs (MEDIUM confidence, training data + web search)
- [dnd-kit GitHub React 19 issue](https://github.com/clauderic/dnd-kit/issues/1654) — `use client` issue exists for @dnd-kit/react (not @dnd-kit/core) (MEDIUM confidence)

---

_Stack research for: v1.1 Gestão de Compras — Procurement Module_
_Researched: 2026-03-17_
