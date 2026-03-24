# Project Research Summary

**Project:** Protos Farm — v1.3 RH e Folha de Pagamento Rural
**Domain:** HR and Rural Payroll module integrated into existing agricultural ERP monolith
**Researched:** 2026-03-23
**Confidence:** HIGH overall — research is grounded in direct codebase analysis, official Brazilian labor law (Lei 5.889/73, CLT, eSocial S-1.3), and verified npm package metadata.

---

## Executive Summary

This milestone adds a complete HR and Rural Payroll module to an existing, well-structured agricultural ERP. The system already has financial (payables, cost centers), procurement (stock, products), asset (depreciation, maintenance), and field operations modules live. The HR module is the missing link between "who did the work" and "what it cost." Building on top of v1.0–v1.2 means the architectural contracts, integration patterns, and infrastructure are already established — new work must extend them, not re-create them.

The recommended approach is additive and dependency-respecting: build the employee and contract foundation first, then the payroll calculation engine (which is custom — no npm library exists for Brazilian payroll), then time tracking and approval, and finally the payroll-to-payables integration and eSocial obligations. The existing BullMQ, pdfkit, nodemailer, exceljs, and @xmldom/xmldom stack covers most needs. Only four new dependencies are required: `xmlbuilder2` for eSocial XML generation, `xml-crypto` for digital signing, `pdfkit-table` for payslip table layout, and `date-holidays` for Brazilian holiday calendars.

The dominant risks are correctness risks, not technical risks. Brazilian payroll law has several non-obvious rules that differ from urban CLT defaults: progressive INSS (not flat-rate), IRRF calculated after INSS deduction, rural night shift at 21h–5h with 25% premium (not 22h–5h with 20%), and FUNRURAL as a farm-level annual election with different calculation bases. eSocial adds compliance risk — events must be transmitted in strict ordering (table events → cadastral events → periodic events) and the XML must be digitally signed with an ICP-Brasil certificate. The atomicity of payroll runs and the locking of time entries before payroll approval are the critical engineering design decisions to get right early.

---

## Key Findings

### Recommended Stack

The existing monorepo stack handles almost everything. No new framework, ORM, or infrastructure is needed. The four net-new backend packages are surgical additions. See `STACK.md` for full detail.

**Core technologies (new additions only):**
- `xmlbuilder2@^4.0.3`: eSocial XML event generation — fluent API handles namespaces and character encoding; replaces verbose @xmldom/xmldom API for generation (keep @xmldom for existing uses)
- `xml-crypto@^6.1.2`: ICP-Brasil XMLDSig signing — 1.98M weekly downloads, RSA-SHA256 and X509 embedding, protects against signature wrapping attacks
- `pdfkit-table@^0.1.99`: tabular layout for payslips and TRCT — wraps existing pdfkit, data-driven row/column API
- `date-holidays@^3.26.11`: Brazilian national + 26 state holiday calendars — actively maintained (published 8 days ago), required for DSR and overtime classification
- `expo-task-manager@~14.0.9` (mobile, conditional): background geolocation for continuous shift tracking — only needed if background tracking is required; foreground-only punch-in/out works with existing `expo-location`

**Custom-built (no library exists):**
- `PayrollEngine` in `packages/shared` — Brazilian tax bracket calculations (INSS progressive, IRRF with dependent deductions, FUNRURAL rural-specific rates)
- eSocial XML builders — one builder per event type (S-2200, S-1200, S-2299, etc.) using `xmlbuilder2`

### Expected Features

See `FEATURES.md` for full feature tables with legal basis citations.

**Must have (table stakes) — cannot legally employ workers without these:**
- Employee profile with CPF, PIS/PASEP, CTPS, CBO code — required for eSocial S-2200 and IRRF/FGTS calculations
- Contract types: CLT permanent, safra, intermitente, experiência, aprendiz — each has different termination rules and eSocial event variants
- Work schedule assignment — 44h/week rural standard, night shift 21h–5h window, multiple escalas
- Salary history (not just current salary) — required for correct vacation/13th provision recalculation after raises
- Mobile time clock with GPS geofence — field workers cannot use web; reuses PostGIS farm boundary for validation
- INSS progressive table, IRRF with dependent deductions, FGTS 8%, FUNRURAL — all required for legal payroll
- Payslip (holerite) generation and delivery — employee legal right; digital PDF via mobile app
- Vacation accrual, scheduling, and payment calculation — 30-day rural, fractionable to 3 periods
- Leave of absence management (sick leave, CAT, maternity) — CAT is also an eSocial event (S-2210)
- Termination calculation (TRCT) with proportional aviso prévio extension — Lei 12.506/2011: 30 + 3 days/year, max 90
- eSocial XML event generation and transmission — mandatory for rural employers since 2021, version S-1.3
- Payroll-to-payables integration — creates AP entries for net salaries and FGTS/INSS/IRRF/FUNRURAL guides

**Should have (competitive differentiators):**
- Activity-linked time entries from field operations — bridges "who worked" to "what it cost per talhão/crop" (unique to this system)
- Safra contract lifecycle bulk termination wizard — 50+ safristas auto-terminated at harvest end with full TRCT
- Mobile payslip delivery — rural workers rarely have email; push notification + in-app PDF
- eSocial error triage workflow — maps government rejection codes to human-readable fix actions
- FUNRURAL regime comparison calculator — annual election (receita bruta vs folha) with cost comparison
- Vacation planning calendar with crop cycle overlay — prevents conflicts with harvest peaks
- Labor cost per hectare reporting — payroll cost center + PostGIS plot area = R$/ha KPI

**Defer to v2+:**
- Biometric hardware integration — GPS geofencing achieves same anti-fraud goal without infrastructure dependency
- Real-time payroll calculation during time entry — creates false expectations; label estimates clearly
- Full accounting chart of accounts — deferred to v1.4 contabilidade milestone
- WhatsApp payslip delivery — Meta approval complexity, out of scope for v1.3
- Production-based pay (piece-rate) — high litigation risk, deferred to future epic
- Homologação sindical workflow — repealed by 2017 Labor Reform for most scenarios

### Architecture Approach

The architecture extends the existing monolith with 14 new collocated modules under `apps/backend/src/modules/`, following the exact same controller+service+routes+types pattern used by all v1.0–v1.2 modules. Two new cron jobs are added to `shared/cron/`. The build order is strictly dependency-respecting: foundation (employees, rubrics, job-positions) → contracts and time entries → time approval + mobile clock → payroll engine → lifecycle events (vacations, leaves, terminations) → compliance/safety (EPI, trainings, ASOs) → eSocial → dashboard and reports. See `ARCHITECTURE.md` for the complete module map and data flow diagrams.

**Major components:**
1. `modules/employees/` + `modules/contracts/` + `modules/job-positions/` — foundation; everything else depends on this
2. `modules/time-entries/` + `modules/time-approval/` + mobile `time-clock.tsx` — time tracking pipeline; feeds payroll engine
3. `modules/rubrics/` + `modules/payroll-runs/` (with `payroll-engine.service.ts`) — core value delivery; mirrors `DepreciationRun` state machine
4. `modules/vacations/` + `modules/leaves/` + `modules/terminations/` + `modules/payroll-provisions/` — lifecycle events
5. `modules/epi-deliveries/` + `modules/trainings/` + `modules/asos/` — NR-31 compliance safety layer
6. `modules/esocial-events/` (with `esocial-xml.service.ts` and `esocial-transmission.service.ts`) — government obligations
7. `modules/hr-dashboard/` — KPI aggregation

**Key patterns to follow:**
- `PayrollRun` state machine: `PENDING → PROCESSING → COMPLETED | ERROR` (mirrors `DepreciationRun`)
- Payroll to Payables: always `tx.payable.create(...)` inside `prisma.$transaction`, never `payablesService.createPayable()` — established deadlock avoidance pattern from `asset-acquisitions.service.ts`
- eSocial events: each module triggers its own event via shared `createEsocialEvent()` helper; `esocial-events` module handles XML and transmission generically
- BullMQ queues: `payroll-processing`, `payslip-generation`, `esocial-events` — add to existing infrastructure

### Critical Pitfalls

See `PITFALLS.md` for full prevention detail, warning signs, and phase assignments.

1. **INSS calculated as flat rate instead of progressive** — over-deducts R$100–200/employee/month; implement bracket accumulation with `Decimal.js` and unit-test against official Receita Federal tables for 2025 and 2026
2. **IRRF calculated before INSS deduction or without dependent deductions** — inflates IRRF base; enforce strict calculation order (gross → INSS → dependents deduction → IRRF base → IRRF); add 2026 partial exemption for R$5,000–R$7,350 band
3. **Payroll run not atomic** — partial failure leaves inconsistent state; entire employee batch must be inside `prisma.$transaction()`; idempotency key = `runId + employeeId`; payables only created on APPROVE, not during calculation
4. **eSocial events sent out of order** — S-1010 rubrics table must exist before S-2200 admission; S-2200 before S-1200 payroll; enforce via BullMQ job dependencies with separate named queues
5. **Rural labor rules defaulted to urban CLT** — night shift 21h–5h at 25% (not 22h–5h at 20%); housing/food deductions against regional minimum wage (not salary); safra termination has no 40% FGTS penalty; FUNRURAL is a farm-level annual election
6. **Payroll to Payables creates duplicates on re-processing** — add `originType` + `originId` unique constraint to `Payable` model in Phase 1 schema; use upsert not create
7. **Time entries editable after payroll calculation** — add `lockedByPayrollRunId` to attendance records; mobile offline sync must check lock before applying edits
8. **Vacation/13th provision uses simple accrual instead of provision/reversal** — must store `EmployeeSalaryHistory` (not just current salary); provision = `currentSalary × elapsed / 12` recalculated monthly
9. **Termination omits proportional aviso prévio extension** — Lei 12.506/2011: 30 + 3 days/complete year, max 90 days; affects all downstream termination calculations

---

## Implications for Roadmap

Based on the dependency graph from FEATURES.md and the build order from ARCHITECTURE.md, the natural phase structure follows the prerequisite chain strictly.

### Phase 1: Cadastro de Colaboradores e Contratos

**Rationale:** Nothing else is buildable without employees, contracts, job positions, and salary history. eSocial S-2200 events, INSS/IRRF calculations, and time tracking all depend on this foundation. This phase also includes the `EmployeeSalaryHistory` table (Pitfall 8) and the `originType`/`originId` constraint on `Payable` (Pitfall 6) — two schema decisions that must be in place before any other module writes data.

**Delivers:** Employee registration (CPF, PIS/PASEP, CTPS, dependents), contract type management (CLT/safra/intermitente/experiência/aprendiz), CBO/job position catalog, work schedule configuration, salary history, mass import via CSV/XLSX, complete employee ficha (tabbed UI).

**Addresses:** EPIC-RH1 table stakes — all employee and contract features.

**Avoids:** Pitfall 5 (rural vs urban rules — contract type enum established here), Pitfall 6 (schema constraint added here), Pitfall 8 (salary history table created here).

### Phase 2: Parâmetros de Rubrica e Motor de Cálculo da Folha

**Rationale:** The payroll calculation engine is custom-built with no npm library available. It must be fully implemented and unit-tested (with official Receita Federal table values) before time tracking UI is built — time entries feed this engine. Rubric master data also seeds the eSocial S-1010 table event, which must precede all other eSocial transmissions.

**Delivers:** Configurable rubric/event system (proventos e descontos), INSS progressive table calculation, IRRF with dependents and 2026 partial exemption, FGTS 8%, FUNRURAL dual-mode (receita bruta vs folha), moradia/alimentação deductions against regional minimum wage, DSR calculation, payroll calculation unit test suite with known official values.

**Uses:** `date-holidays@3.26.11` for DSR and overtime classification; `Decimal.js` `Money()` factory throughout.

**Avoids:** Pitfall 1 (INSS progressive), Pitfall 2 (IRRF order and dependent deductions), Pitfall 5 (rural-specific rates and deduction bases).

### Phase 3: Controle de Ponto e Jornada

**Rationale:** Time tracking must exist before payroll can process real hours. This phase builds the mobile-first time clock (reusing existing offline sync infrastructure), the web clock for administrative staff, and the approval workflow (espelho de ponto). Critically, the attendance locking mechanism (Pitfall 7) must be designed into the model from the start.

**Delivers:** Mobile time clock with GPS geofence validation (PostGIS), offline sync via existing queue infrastructure, overtime calculation with rural rules (21h–5h at 25%), banco de horas, web time clock, time sheet mirror with approval workflow, attendance record locking on payroll calculation, PDF export for audit.

**Implements:** `modules/time-entries/`, `modules/time-approval/`, mobile `time-clock.tsx`, `time-entry-repository.ts` (SQLite offline store mirrors `operation-repository.ts`).

**Avoids:** Pitfall 7 (time entries locked by payroll run ID when run reaches CALCULATED).

### Phase 4: Processamento da Folha Mensal

**Rationale:** With employees, rubrics, and time tracking in place, the payroll run orchestration can be built. This is the core value delivery of v1.3. The state machine, atomicity design, and BullMQ processing must be implemented correctly before any live payroll is run.

**Delivers:** Payroll run creation and batch processing (BullMQ), per-employee payroll item calculation, payslip PDF generation (pdfkit + pdfkit-table), email and mobile delivery (nodemailer), 13th salary processing (1st and 2nd installments), salary advance management, payroll run status dashboard with progress polling.

**Implements:** `modules/payroll-runs/` with `payroll-engine.service.ts`, `payroll-batch.service.ts`, `payslip.service.ts`.

**Avoids:** Pitfall 3 (payroll atomicity — `prisma.$transaction()` for all employee items; payables only on APPROVE), Pitfall 7 (lock attendance records when run reaches CALCULATED).

### Phase 5: Férias, Afastamentos, Rescisão e Integração Financeira

**Rationale:** Lifecycle events (vacation, leave, termination) depend on the payroll engine and salary history from earlier phases. Financial integration (payroll to payables) is last in the chain — payable entries must only be created after payroll approval, and termination payments require accurate vacation and 13th balances.

**Delivers:** Vacation accrual with provision/reversal method, vacation scheduling calendar with crop cycle overlay, leave management (sick leave, CAT, maternity), TRCT calculation with proportional aviso prévio extension (Lei 12.506/2011), safra bulk termination wizard, monthly provision cron for vacation and 13th, automatic payables creation for net salaries and tax guides, cost center rateio per employee activity.

**Implements:** `modules/vacations/`, `modules/leaves/`, `modules/terminations/`, `modules/payroll-provisions/`, `shared/cron/payroll-provision.cron.ts`, payroll to payables integration with `originType`/`originId` upsert.

**Avoids:** Pitfall 6 (duplicate payables via originId upsert), Pitfall 8 (provision/reversal method), Pitfall 9 (proportional aviso prévio extension).

### Phase 6: Segurança do Trabalho (NR-31) e eSocial

**Rationale:** Safety compliance (EPI, trainings, ASOs) can be built largely independently since it only depends on the employee record. eSocial is deferred to last because it wraps all previous modules — admission, payroll, leaves, accidents, and terminations must all be working before their XML events can be correctly generated and transmitted.

**Delivers:** EPI delivery records consuming existing products/stock module, NR-31 training matrix with certificate tracking, ASO/PCMSO records with expiry alerts, eSocial XML generation for all event types using `xmlbuilder2`, ICP-Brasil digital signing with `xml-crypto`, eSocial transmission with BullMQ job ordering (table events → cadastral events → periodic events), transmission status dashboard with error triage workflow, RAIS export, Informe de Rendimentos PDF.

**Implements:** `modules/epi-deliveries/`, `modules/trainings/`, `modules/asos/`, `modules/esocial-events/` with `esocial-xml.service.ts`, `esocial-signer.service.ts`, `esocial-transmission.service.ts`, `shared/cron/esocial-retry.cron.ts`.

**Avoids:** Pitfall 4 (eSocial event ordering via BullMQ job dependencies with strict queue sequencing).

### Phase 7: Dashboard RH e Relatórios

**Rationale:** Aggregation and reporting can only be meaningful after all previous modules are live and generating data. This phase is pure read-side — no new writes to any existing module.

**Delivers:** HR KPI dashboard (headcount by contract type, payroll cost vs prior month, cost per activity/crop, overtime hours by team, NR-31 compliance %), labor cost per hectare report (payroll cost center + PostGIS talhão area), FUNRURAL regime comparison calculator, headcount and payroll cost export to CSV.

**Implements:** `modules/hr-dashboard/`.

---

### Phase Ordering Rationale

- Phases 1–2 establish the foundation and the calculation engine that all other phases depend on — no downstream work is valid without correct employees, contracts, and tax calculations.
- Phase 3 (time tracking) is sequenced after Phase 2 so time entry data can be immediately validated against calculation requirements; they could be built in parallel if sprint capacity allows.
- Phase 4 (payroll runs) is gated on Phases 1–3 — it reads all three to produce a correct payroll.
- Phase 5 bundles lifecycle events and financial integration because vacation/13th/termination balances are all prerequisites for generating payables — splitting them would leave an incomplete integration for the first deployable payroll run.
- Phase 6 (eSocial) is explicitly last because it wraps all previous events. Retroactive eSocial correction events are costly and error-prone; building eSocial last means events are generated from correct, approved data.
- Phase 7 is pure aggregation and can be developed incrementally alongside Phases 4–6 if sprint capacity allows.

---

### Research Flags

**Phases needing `/gsd:research-phase` during planning:**

- **Phase 6 (eSocial):** ICP-Brasil certificate management in cloud environments (AWS Secrets Manager vs KMS vs HSM), eSocial sandbox endpoint URLs and mTLS configuration for development, S-1.3 XSD files download and validation setup, specific XML structure for rural employer (PF vs PJ) eSocial S-1000 employer table. High complexity, sparse Node.js documentation.
- **Phase 5 (Termination / TRCT):** Validation of CCT edge cases per collective agreement (homologação residual risk), GRRF guide generation specifics, seguro-desemprego eligibility check logic for safra workers. Legal edge cases may surface implementation details not covered in general research.

**Phases with standard/well-documented patterns (skip research-phase):**

- **Phase 1 (Employee + Contracts):** Standard CRUD following existing module patterns. Brazilian CPF and PIS/NIT checksum algorithms are well-known and trivially tested.
- **Phase 2 (Rubrics + Calculation Engine):** Tax tables and formulas are officially published. Calculation logic is pure functions amenable to comprehensive unit testing.
- **Phase 3 (Time Tracking):** Reuses existing mobile offline sync infrastructure and PostGIS geofence from EPIC-06. Pattern is established in the codebase.
- **Phase 4 (Payroll Runs):** Mirrors `DepreciationRun` state machine exactly. BullMQ pattern already proven in the codebase.
- **Phase 7 (Dashboard):** Pure aggregation using existing recharts setup and established service patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | xmlbuilder2, xml-crypto, date-holidays verified at specific versions via npm (March 2026). pdfkit-table is MEDIUM confidence (0.x semver). expo-task-manager is MEDIUM (iOS/Android permission complexity). All existing libraries are production-proven in the codebase. |
| Features | HIGH | Brazilian labor law (Lei 5.889/73, CLT, eSocial S-1.3) is codified and unambiguous. Feature scope verified against TOTVS RM and Senior HCM documentation. 2026 INSS/IRRF tables cross-checked across 3 sources. |
| Architecture | HIGH | Derived from direct codebase analysis of schema.prisma (7400+ lines) and all existing modules. Integration patterns (`tx.payable.create`, `withRlsContext`, batch state machine) are live in production. |
| Pitfalls | HIGH | Brazilian labor law pitfalls sourced from official legislation and current-year searches. Payroll atomicity and concurrency design is established ERP practice verified by multiple sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **2026 INSS and IRRF exact table values:** Sourced from contabilizei.com.br and praticasdepessoal.com.br, not directly from the Receita Federal portal. Recommend cross-checking against official RFB Instrução Normativa before implementing the production tax engine.
- **eSocial sandbox access:** Development and testing require access to the eSocial sandbox (Ambiente de Produção Restrita). Confirm credentials and endpoint URLs with the client before Phase 6 begins.
- **ICP-Brasil certificate in production:** Where the PFX is stored, how it is rotated, and whether AWS KMS is used must be decided before Phase 6 starts. This is an infrastructure decision outside the scope of code.
- **FUNRURAL receita bruta integration:** The receita-bruta option requires reading commercialization totals from the receivables module (v1.1). Confirm the receivables module exposes the necessary data before Phase 2 configures the FUNRURAL rubric.
- **Regional minimum wage values:** Housing and food deductions are capped against the regional minimum wage (varies by state). Confirm whether a configurable table per state is required or whether the federal minimum wage is an acceptable approximation for v1.3.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `apps/backend/prisma/schema.prisma` (7400+ lines), `modules/asset-acquisitions/`, `modules/depreciation/`, `modules/field-teams/`, `modules/payables/`, `modules/maintenance-provisions/`
- Lei 5.889/73 — Rural Labor Statute (night shift, housing, food, safra contract rules)
- CLT — Consolidação das Leis do Trabalho (general labor law base)
- eSocial S-1.3 schema (NT 05/2025) — event ordering and XML structure requirements
- Lei 8.212/91 + IN 2.110/2022 — FUNRURAL calculation and election rules
- Lei 8.036/1990 — FGTS
- Lei 12.506/2011 — proportional aviso prévio extension
- npm registry — xmlbuilder2@4.0.3, xml-crypto@6.1.2, date-holidays@3.26.11 (verified March 2026)

### Secondary (MEDIUM confidence)
- contabilizei.com.br + praticasdepessoal.com.br — 2026 INSS/IRRF table values (cross-checked 3 sources, not fetched from RFB directly)
- TOTVS RM and Senior HCM documentation — feature scope validation for Brazilian HR ERP
- eSocial NT 05/2025 production move announcement — S-1.3 schema confirmation
- pdfkit-table@0.1.99 — npm-verified compatibility with pdfkit@0.17.x; community-use confirmed

### Tertiary (LOW confidence)
- No npm source for payroll calculation libraries — confirmed absence by registry search; custom engine is the only option
- expo-task-manager background location behavior on iOS 17+ — documentation exists but app store submission complexity not fully characterized

---

*Research completed: 2026-03-23*
*Ready for roadmap: yes*
