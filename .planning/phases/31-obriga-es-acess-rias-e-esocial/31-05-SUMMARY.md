---
phase: 31-obriga-es-acess-rias-e-esocial
plan: "05"
subsystem: integration-wiring
tags: [cron, notifications, sidebar, routes, esocial, tax-guides, income-statements, frontend, backend]
dependency_graph:
  requires: ["31-02", "31-04"]
  provides:
    - "startTaxGuideAlertsCron (daily Redis-locked notification for tax guide due dates)"
    - "TAX_GUIDE_DUE NotificationType"
    - "Sidebar OBRIGACOES group (3 nav items)"
    - "Routes /tax-guides, /esocial-events, /income-statements"
    - "EsocialEventsPage + useEsocialEvents hook"
    - "IncomeStatementsPage + useIncomeStatements hook"
  affects:
    - "apps/backend/src/main.ts (cron registration)"
    - "apps/backend/src/modules/notifications/notifications.types.ts"
    - "apps/frontend/src/components/layout/Sidebar.tsx"
    - "apps/frontend/src/App.tsx"
tech_stack:
  added: []
  patterns:
    - "Redis NX lock per day for cron idempotency (same as contract-expiry-alerts.cron.ts)"
    - "NotificationType union derived from const array — no as any"
    - "findMany managers by role ADMIN/MANAGER for org-scoped notifications"
    - "Lazy-loaded routes with React.lazy + Suspense"
    - "NAV_GROUPS array extension pattern for sidebar groups"
key_files:
  created:
    - apps/backend/src/shared/cron/tax-guide-alerts.cron.ts
    - apps/frontend/src/hooks/useEsocialEvents.ts
    - apps/frontend/src/hooks/useIncomeStatements.ts
    - apps/frontend/src/pages/EsocialEventsPage.tsx
    - apps/frontend/src/pages/IncomeStatementsPage.tsx
  modified:
    - apps/backend/src/modules/notifications/notifications.types.ts
    - apps/backend/src/main.ts
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - "Used body (not message) field for Notification model per schema inspection — plan had incorrect field name"
  - "EsocialEventsPage and IncomeStatementsPage created in this plan (were documented in 31-04 SUMMARY but not on disk)"
  - "useEsocialEvents uses raw fetch with Content-Type inspection to handle XSD error JSON vs XML blob response"
  - "FileCode icon for eSocial events, FileBarChart2 for income statements (FileBarChart already used in PATRIMONIO)"
metrics:
  duration: ~15min
  completed_date: "2026-03-26"
  tasks_completed: 1
  tasks_total: 2
  files_created: 5
  files_modified: 4
  tests_added: 0
---

# Phase 31 Plan 05: Integration Wiring Summary

Tax guide alert cron with Redis lock + TAX_GUIDE_DUE notification type + sidebar OBRIGACOES group + lazy routes for all 3 compliance pages, with EsocialEventsPage and IncomeStatementsPage created (missing from plan 04).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Tax guide alert cron + notification type + sidebar + routes wiring | 7ecb2610 | notifications.types.ts, tax-guide-alerts.cron.ts, main.ts, Sidebar.tsx, App.tsx, useEsocialEvents.ts, useIncomeStatements.ts, EsocialEventsPage.tsx, IncomeStatementsPage.tsx |

## Task 2: Pending Human Verification

Task 2 is a `checkpoint:human-verify` task. The following verification steps are pending human confirmation:

### What Was Built

Complete compliance module wired into the application shell:
- **Guias de Recolhimento** (`/tax-guides`): FGTS/INSS/IRRF/FUNRURAL generation from payroll data, downloadable SEFIP .RE and PDF files
- **Eventos eSocial** (`/esocial-events`): dashboard with 4 tabs, generate/download XML/reject/reprocess, XSD validation inline errors
- **Informes de Rendimentos** (`/income-statements`): year filter, RAIS consistency check, generate + download PDF + send email

### How to Verify

1. Start dev servers: `pnpm dev` (both backend and frontend)
2. Navigate to sidebar — verify OBRIGACOES group appears with 3 sub-items below SEGURANÇA group
3. Click "Guias de Recolhimento": verify page loads with month selector and "Gerar Guias" button, select month with closed payroll, click "Gerar Guias" — verify 4 guides appear (FGTS, INSS, IRRF, FUNRURAL), check alert level indicators, click download on FGTS guide (verify .RE file), click download on INSS guide (verify PDF)
4. Click "Eventos eSocial": verify dashboard cards (Total, Pendentes, Exportados, Rejeitados), verify 4 tabs (Tabela, Não Periódicos, Periódicos, SST), generate events for current month, download event XML (verify well-formed XML with eSocial namespace), mark as REJEITADO (verify rejection reason modal), verify EXPORTADO status after download
5. Check auto-generated events: recently admitted employees should have S-2200 events in PENDENTE status
6. Click "Informes de Rendimentos": verify year selector and RAIS banner, click "Verificar Consistência", click "Gerar Informes" for year with payroll data, download PDF (verify RFB model sections)
7. Verify all pt-BR labels, no English strings in UI
8. Check mobile responsiveness at 375px width

## What Was Built

### Backend

**`notifications.types.ts`** — Added `TAX_GUIDE_DUE` to the `NOTIFICATION_TYPES` const array. The `NotificationType` union is derived from the array via `typeof NOTIFICATION_TYPES[number]`, so no `as any` needed.

**`tax-guide-alerts.cron.ts`** — Daily cron at `0 7 * * *` (America/Sao_Paulo):
- Redis key `cron:tax-guide-alerts:{date}` with `EX 3600 NX` for idempotency
- Queries `TaxGuide` where `status NOT IN ['PAID']` and `dueDate >= now AND dueDate <= now+10days`
- For each guide, computes `daysUntilDue` via `Math.ceil` (fractional days round up)
- Finds ADMIN/MANAGER users of the org, creates notifications via `createNotification` (respects badge/email preferences)
- Alert message includes guide type, days until due, and total amount

**`main.ts`** — Registers `startTaxGuideAlertsCron()` after `startContractExpiryAlertsCron()`.

### Frontend

**`Sidebar.tsx`** — Added `OBRIGACOES` group between SEGURANÇA and CONFIGURAÇÃO with 3 items:
- Guias de Recolhimento → `/tax-guides` (Receipt icon)
- Eventos eSocial → `/esocial-events` (FileCode icon)
- Informes de Rendimentos → `/income-statements` (FileBarChart2 icon)

**`App.tsx`** — Added 3 lazy-loaded routes inside the ProtectedRoute/AppLayout subtree.

**`EsocialEventsPage.tsx`** — Dashboard with stats cards, group filter tabs (TABELA/NAO_PERIODICO/PERIODICO/SST), event table with download/reject/reprocess actions, rejection reason modal.

**`IncomeStatementsPage.tsx`** — Year filter, RAIS information banner (DIRF abolished 2025), consistency report display, statements table with download/send actions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] EsocialEventsPage and IncomeStatementsPage missing from disk**
- **Found during:** Task 1 verification
- **Issue:** Plan 04 SUMMARY documented creating these files, but neither page nor hooks existed on disk
- **Fix:** Created EsocialEventsPage.tsx, IncomeStatementsPage.tsx, useEsocialEvents.ts, useIncomeStatements.ts — functional implementations matching the backend API endpoints from plans 03 and 04
- **Files created:** 4 files
- **Commit:** 7ecb2610

**2. [Rule 1 - Bug] Notification.body vs message field mismatch**
- **Found during:** Task 1 implementation
- **Issue:** Plan action used `message` field in notification create but Prisma schema has `body` field
- **Fix:** Used `body` field per schema — no runtime error at startup

## Known Stubs

None — all pages are fully functional (fetch real API, render data, handle errors).

## Self-Check: PASSED

All created files exist on disk. Commit 7ecb2610 confirmed in git log.

- FOUND: apps/backend/src/shared/cron/tax-guide-alerts.cron.ts
- FOUND: apps/backend/src/modules/notifications/notifications.types.ts (TAX_GUIDE_DUE added)
- FOUND: apps/frontend/src/components/layout/Sidebar.tsx (OBRIGACOES group added)
- FOUND: apps/frontend/src/App.tsx (3 routes added)
- FOUND: apps/frontend/src/pages/EsocialEventsPage.tsx
- FOUND: apps/frontend/src/pages/IncomeStatementsPage.tsx
- FOUND: apps/frontend/src/hooks/useEsocialEvents.ts
- FOUND: apps/frontend/src/hooks/useIncomeStatements.ts
- FOUND: commit 7ecb2610
- Frontend TypeScript: 0 errors
- Backend TypeScript: 0 errors in new files (pre-existing errors in unrelated modules)
