# Milestones

## v1.3 RH e Folha de Pagamento Rural (Shipped: 2026-03-27)

**Phases completed:** 28 phases, 123 plans, 143 tasks

**Key accomplishments:**

- Schema additions
- `supplier-file-parser.ts`
- Task 1: Foundation layer
- RC CRUD service with RC-YYYY/NNNN sequential numbering in Prisma transaction, 6 REST endpoints, Multer attachment upload, and 18 passing integration tests
- Approval rules CRUD, delegation routing, in-transaction notifications, and full RC state machine (SUBMIT/APPROVE/REJECT/RETURN/CANCEL) with double-approval and SLA deadline tracking
- 1. [Rule 1 - Bug] ESLint: react-hooks/set-state-in-effect in PurchaseRequestModal
- RC detail modal with approval timeline and action bar, approval rules card config page with delegation management, and NotificationBell in header with 30s polling badge
- Offline-capable purchase request creation (SQLite + offline-queue), Minhas Requisicoes list, Aprovacoes Pendentes with approve/reject/return, and expo-notifications push registration
- Task 1 — Prisma schema + migration:
- SC lifecycle API with state-machine guard, per-supplier comparative map, and atomic OC generation per winning supplier in single Prisma transaction
- purchase-orders.service.ts
- Task 1 — Foundation:
- Full purchase orders UI: list page with overdue alerts, emergency PO creation modal, and detail modal with PDF download, status lifecycle, frozen prices, and duplication
- Task 1 — Schema:
- One-liner:
- Atomic CONFERIDO->CONFIRMADO confirmation that creates StockEntry + Payable via inline tx calls in a single Prisma transaction, with PO delivery tracking, 6 receiving scenarios, and 29 passing tests.
- 1. [Rule 1 - Bug] Removed unused GR_STATUS_LABELS import
- One-liner:
- One-liner:
- CRUD budget management with real-time execution aggregation (requisitado/comprado/pago) and non-blocking budget check injection into RC approval and OC issuance flows
- Read-only procurement analytics module: saving from competitive bidding, price history per product, cycle indicators (% formal/emergency, avg days RC->GR), top 10 products and top 5 suppliers, combined dashboard endpoint
- useGoodsReturns hook
- Task 1: Schema + Types + Infrastructure
- 1. [Rule 1 - Bug] PurchaseRequestItem has no product relation
- One-liner:
- One-liner:
- One-liner:
- TDD RED phase: two failing spec files covering usePurchasingKanban DnD transition behaviors and KanbanBoard EM_COTACAO->OC_EMITIDA copy+navigation, unblocking Plan 13-01 fixes
- Fixed two broken Kanban DnD transitions: EM_COTACAO->OC_EMITIDA now navigates to /quotations instead of creating emergency PO; OC_EMITIDA->AGUARDANDO_ENTREGA now calls PATCH /transition with { status: EM_TRANSITO } instead of PUT /status — all 7 Wave 0 tests GREEN
- Wired 4 missing notification types across purchase-requests, purchase-orders, goods-receipts, and goods-returns services, fixing the GOODS_RETURN_APPROVED invalid type bug and completing the purchasing flow notification pipeline (DASH-03)
- Moved goods-return stock reversal from APROVADA to CONCLUIDA transition, fixing phantom stock decrement, and added GET /org/suppliers/:id/performance endpoint with history+breakdown+date-filter
- Rating alert badges in QuotationModal (critical/low) and SupplierPerformanceModal with Recharts LineChart + criteria bars wired into SuppliersPage
- One-liner:
- 48 it.todo() spec stubs across 4 backend modules (assets, asset-documents, fuel-records, meter-readings) establishing Nyquist RED state before any production code
- Asset entity backend: Prisma schema with CPC classification, PostGIS geometry, sequential PAT-NNNNN tag, full CRUD service+routes, photo upload, and 24 passing integration tests
- Fuel Records
- AssetsPage at /assets with breadcrumb, 4 summary cards, 5-filter bar, table+card list, AssetModal with type-conditional sections, PATRIMONIO sidebar group, and 7 passing render tests
- AssetDrawer with 6 tabs (Geral, Documentos, Combustivel, Leituras, Manutencao, Timeline), expiry badge on asset list, fuel benchmarking, and anti-regression meter reading validation
- `asset-file-parser.ts`
- FarmMapPage (ATIV-02):
- One-liner:
- 4 Prisma depreciation models with migration applied, pure arithmetic engine supporting 4 methods (STRAIGHT_LINE, ACCELERATED, HOURS_OF_USE, UNITS_OF_PRODUCTION) with pro-rata-die and residual clamping, validated by 21 unit tests
- One-liner:
- One-liner:
- Preventive maintenance plan API with CRUD, trigger-based next-due calculation (HOURMETER/ODOMETER/CALENDAR), daily alert cron with Redis lock, and 28 integration tests
- React pages and modals for maintenance plans and work orders — 2 list pages with filters/tables/empty states, 2 modals with parts inline table + live cost summary + photo upload, hooks, types, sidebar navigation, and lazy routes
- One-liner:
- One-liner:
- startMaintenanceAlertsCron() and startMaintenanceProvisionCron() wired to server startup in main.ts, closing Gaps 1 and 2 from VERIFICATION.md
- One-liner:
- One-liner:
- One-liner:
- types/asset.ts additions:
- AssetNfeImportModal 3-step wizard for NF-e XML upload, item-to-asset assignment, and CP-generating confirmation with proportional rateio of accessory expenses
- Prisma schema foundation for asset alienation — 4 models (AssetDisposal, AssetFarmTransfer, AssetInventory, AssetInventoryItem), 2 enums, ASSET_SALE receivable category, and depreciation batch exclusion for ALIENADO assets
- Atomic disposal transaction cancels depreciation entries, sets ALIENADO status, and generates CR with gain/loss calculation — 14 integration tests green
- One-liner:
- GET /org/financial-dashboard/patrimony endpoint returning total asset value, accumulated depreciation, net book value, period acquisitions/disposals, and asset breakdowns by type/status
- New types in `types/asset.ts`:
- One-liner:
- One-liner:
- 1. [Rule 2 - Missing entity type] Added meter_readings to OperationEntity
- Prisma schema extended with AssetRenovation/AssetWipStage/AssetWipContribution models and a 3-level hierarchy depth guard in assets.service with circular reference detection and parent value totalization
- Asset renovation module with CAPITALIZAR/DESPESA accounting decisions and WIP contribution tracking with budget alerts, activation, and depreciationConfigMissing warning flag
- Four new React components (AssetHierarchyTab, AssetRenovationModal, AssetWipContributionsTab, AssetWipContributionModal) plus two hooks integrated into AssetDrawer with conditional tab visibility based on asset state.
- 1. [Rule 1 - Bug] Decimal.max() is not an instance method
- 4-step cost-center creation wizard with asset-type radio cards (MAQUINA/VEICULO/IMPLEMENTO/BENFEITORIA/TERRA), code prefix suggestion, and accessible form submitting to POST /api/org/farms/:farmId/cost-centers
- Asset Reports page with 3 tabs (Inventario KPIs + table + export, Depreciacao Recharts projection chart, TCO fleet table with repair-vs-replace alerts), wired to 3 API hooks and sidebar navigation
- CPC 29 biological asset fair value registration with auto-calculated fairValueChange using decimal.js, backend CRUD + frontend page with KPI summary cards
- CPC 06 leasing module with atomic ROU Asset + DepreciationConfig + CP installment generation via generateInstallments, full lifecycle (exercise/return/cancel)
- Atomic asset trade-in with NBV-based gain/loss calculation, old asset disposal + new asset creation + CP generation for net payable
- 1. [Rule 2 - Missing Critical] BankAccountType enum name collision
- One-liner:
- EmployeesPage
- One-liner:
- 1. [Rule 1 - Bug] INSS bracket boundary discrepancy
- One-liner:
- One-liner:
- Prisma schema with 5 time tracking models (TimeEntry, TimeEntryActivity, OvertimeBankEntry, Timesheet, TimesheetCorrection), 3 enums, migration applied, date-holidays installed, and TypeScript type contracts for all 4 backend modules
- One-liner:
- One-liner:
- PayrollRun/PayrollRunItem/SalaryAdvance Prisma models + calculateEmployeePayroll with pro-rata, DSR via date-holidays, and calculateThirteenthSalary with 10 unit tests
- 1. [Rule 3 - Blocking] Plan 01 types file not created yet
- 1. [Rule 1 - Bug] THIRTEENTH runs were creating PENDING_TIMESHEET items instead of calling calculateThirteenthSalary
- `usePayrollRuns`
- 1. [Rule 3 - Blocking] useSalaryAdvances hook signature changed by linter
- Human-verified end-to-end payroll processing: wizard flow, run management, salary advances, payslip PDF, and 13th salary
- One-liner:
- Employee termination module with pure calculation (5 rescision types, Lei 12.506/2011 notice, 40%/20%/0% FGTS penalty), TRCT/GRRF PDF generation via pdfkit, DRAFT→PROCESSED→PAID state machine, and 36 tests passing
- Payroll provisions backend — batch vacation+13th salary calculation with employer charges (INSS 20%+RAT+FGTS 8%), accounting entry JSON stubs, per-employee reversal, and cost-center report with CSV export
- 4 type files:
- EmployeeTerminationsPage.tsx
- 1. [Rule 3 - Blocking] Fixed .js → .ts module resolution in Jest
- 1. [Rule 2 - Missing critical functionality] Used `employees:read`/`employees:manage` instead of `hr:read`/`hr:admin`
- medical-exams.service.ts
- Type files (4):
- ComplianceStatusBadge
- One-liner:
- One-liner:
- `useTaxGuides.ts`
- 1. [Rule 1 - Bug] TypeScript TS7022 implicit 'any' in esocial-xsd-validator.ts
- `useEsocialEvents.ts`
- `notifications.types.ts`
- One-liner:
- One-liner:
- One-liner:
- getAbsenceImpactForMonth wired into payroll orchestrator transaction and payslip PDF now shows Base FGTS in rodape using fgtsAmount/0.08 derivation

---

## v1.0 Financeiro Base (Shipped: 2026-03-17)

**Phases completed:** 6 phases, 30 plans, 10 tasks

**Key accomplishments:**

- Money type (decimal.js) + FEBRABAN bank list + contas bancárias com saldo real-time e extrato exportável
- Contas a pagar/receber com parcelamento, rateio CC, CNAB 240/400 (BB+Sicoob), aging e alertas
- Dashboard financeiro consolidado com saldo total, CP/CR 7/30d, resultado do mês, endividamento
- Transferências entre contas, cartões corporativos com fatura→CP, cheques pré-datados (máquina de estados)
- Conciliação bancária (OFX/CSV) com score matching + fluxo de caixa 12 meses (3 cenários + DFC)
- Crédito rural (PRONAF/PRONAMP/Funcafé/CPR) com amortização SAC/Price/Bullet e carência

**Stats:**

- 236 files, ~71,600 lines added
- Timeline: 2 days (2026-03-15 → 2026-03-17)
- Git range: feat(01-funda-o-financeira-01)..feat(06-05)
- Tech debt: 6 minor items (see audit)

---
