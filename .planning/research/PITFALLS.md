# Pitfalls Research

**Domain:** HR and Rural Payroll module added to existing agricultural ERP (financial v1.0, procurement v1.1, assets v1.2 already live)
**Researched:** 2026-03-23
**Confidence:** HIGH for Brazilian labor law specifics (Lei 5.889/73, INSS/IRRF progressive tables, eSocial event ordering — verified with official sources and current-year searches); HIGH for integration pitfalls (derived from codebase analysis of existing payables/team-operations modules); MEDIUM for payroll atomicity and concurrency design (established ERP practice verified by multiple sources); LOW where only training data supports a claim.

---

## Critical Pitfalls

### Pitfall 1: INSS Progressive Table Calculated as Flat Rate Instead of Per-Bracket

**What goes wrong:**
The INSS contribution since 2020 uses a fully progressive table (7.5%, 9%, 12%, 14%), not a flat rate applied to the total salary. The common incorrect implementation multiplies the total gross salary by the rate for the bracket it falls into. For a worker earning R$ 5,000/month in 2026, the incorrect flat-rate calculation gives R$ 700.00 (14% × R$ 5,000). The correct progressive calculation gives R$ 527.27 — a difference of R$ 172.73 per employee per month. Multiplied across a 20-person rural team, this is R$ 3,454.60/month in over-deductions, which are illegal discounts from the worker's salary.

**Why it happens:**
Older payroll reference material and informal tax calculators still describe the pre-2020 flat-rate method. Developers searching for "como calcular INSS" will find both methods mixed in results, and the flat-rate is simpler to code. The progressive method requires applying each rate only to the portion of salary within that bracket, then summing all brackets — the same logic as IRRF but with different table values.

**How to avoid:**
- Implement `calculateINSS(grossSalary: Decimal): Decimal` in `packages/shared/src/utils/payroll-calculations.ts` using bracket-by-bracket accumulation, not `Decimal.mul(rate)` on total.
- Use the "parcela a deduzir" shortcut as cross-check: `INSS = salary × topRateForBracket - deductionAmount`. Both methods must return the same result to ±R$ 0.01 (rounding difference only).
- Store the INSS table as a versioned config (year → brackets array), not hardcoded — tables change annually with inflation. Structure: `{ year: 2026, brackets: [{ upTo: 1518.00, rate: 0.075, deduction: 0 }, ...] }`.
- Use `Decimal.js` throughout — never `number` for any intermediate calculation. The existing `Money()` factory in `packages/shared` must wrap all payroll arithmetic.
- Write parametric unit tests with known-correct values from the official Receita Federal table for 2025 and 2026.

**Warning signs:**
- Unit test with salary = R$ 3,000 passes but salary = R$ 4,500 gives wrong result (straddles a bracket boundary).
- INSS deduction matches gross × 14% exactly (indicates flat-rate bug).
- The same function is used for both INSS and IRRF with just different table parameters — IRRF has dependent deductions and INSS does not; conflating them causes silent errors.

**Phase to address:** Parâmetros e Rubricas da Folha (Phase 2) — the calculation engine must exist and be fully tested before any payroll run phase.

---

### Pitfall 2: IRRF Calculated Before INSS Deduction, or Without Dependent Deductions

**What goes wrong:**
IRRF (income tax) in Brazil is calculated on the salary minus: (a) the INSS contribution already withheld, (b) R$ 189.59 per legal dependent per month (2026 value). Skipping step (a) inflates the IRRF base. A worker earning R$ 4,000 gross with two dependents and INSS of R$ 348.52: correct IRRF base = R$ 4,000 - R$ 348.52 - R$ 379.18 = R$ 3,272.30 (zero tax at 2026 rates). Calculated incorrectly on R$ 4,000 gross, tax = R$ 214.62. Every worker at that salary level would be over-taxed by R$ 214.62/month.

Additionally, from January 2026, monthly income up to R$ 5,000.00 is fully exempt from IRRF. Income between R$ 5,000.01 and R$ 7,350.00 has a partial exemption mechanism. Systems that apply the standard progressive table without this 2026 exemption rule will over-withhold IRRF for workers in that band.

**Why it happens:**
The sequence dependency (INSS first, then IRRF on reduced base) is non-obvious to developers who have not processed Brazilian payroll before. The 2026 exemption rule is new and pre-2026 code examples do not implement it. Dependents must be registered in the system and linked to the `Employee` record for the deduction to apply — missing the dependent table integration causes this error silently.

**How to avoid:**
- Enforce calculation order in the payroll engine: `grossSalary → otherAdditions → grossBase → INSS deduction → dependentDeductions → IRRFBase → IRRF calculation → netSalary`.
- The `Employee` model must have a `dependents` relation before any payroll run; the payroll engine reads `dependents.filter(d => d.isIRRFEligible).length` at calculation time.
- Store the IRRF table with year flag, and add a boolean `hasPartialExemption` for the 2026+ bands (R$ 5,000–R$ 7,350).
- Write a regression test for the 2026 partial exemption scenario. Salary = R$ 6,000, two dependents: expected IRRF = R$ 0 (within exemption band after deductions).

**Warning signs:**
- IRRF for a worker with two dependents equals IRRF for a worker with zero dependents at the same salary.
- IRRF is non-zero for a worker with gross salary = R$ 4,800 and 2+ dependents in 2026.
- Payslip shows IRRF deduction that is exactly gross × applicable rate without any base reduction.

**Phase to address:** Parâmetros e Rubricas da Folha (Phase 2) — same payroll calculation engine phase as INSS.

---

### Pitfall 3: Payroll Run is Not Atomic — Partial Failures Leave Inconsistent State

**What goes wrong:**
Payroll generation touches multiple tables: `PayrollRun`, `PayrollEntry` (one per employee), `PayrollRubric` (line items per entry), `StockEntry` (housing/meal deductions if controlled by stock), and `Payable` records (FGTS guide, INSS guide, IRRF guide, net salary). If the process crashes after creating 15 of 30 employee payroll entries, the run is in a partial state. Re-running creates duplicate entries. Rolling back manually requires identifying which records were written — impossible without an audit table.

**Why it happens:**
Payroll generation is a BullMQ background job (the project already uses BullMQ for async). Jobs that span multiple Prisma operations across many employees tend to be written as sequential `await prisma.create()` calls. A timeout, DB connection drop, or code error mid-run leaves orphaned records. The BullMQ retry mechanism will re-enqueue the job, creating duplicates.

**How to avoid:**
- The `PayrollRun` record has a `status` field: `DRAFT | PROCESSING | CALCULATED | APPROVED | PAID | CANCELLED | FAILED`.
- All `PayrollEntry` records for a run must be created inside a single `prisma.$transaction()`. If the transaction fails, nothing is written. Use `prisma.$transaction([], { maxWait: 10000, timeout: 30000 })` for large farms.
- For large payrolls (>50 employees), use batched transactions: process in batches of 10 with each batch in its own transaction; the `PayrollRun.status` tracks `processedCount`. A re-run skips already-processed employees (idempotency key = `runId + employeeId`).
- The `Payable` records (FGTS guide, INSS guide, etc.) are NOT created during calculation — they are created on `APPROVE` action only, in a separate transaction. This keeps the financial module clean of unapproved data.
- Approved `PayrollRun` records and their `PayrollEntry` children are immutable. Any correction requires creating a new supplementary run (`runType: COMPLEMENTAR`), never editing an approved run.

**Warning signs:**
- `PayrollEntry` records exist for a `PayrollRun` with `status = FAILED`.
- Re-running a failed payroll without idempotency check doubles entries.
- `Payable` records for a payroll run exist with `status = PENDING` before the run is `APPROVED`.
- No `$transaction` wrapping in the payroll calculation service.

**Phase to address:** Processamento da Folha Mensal (Phase 4) — atomicity design must be the first implementation decision in that phase.

---

### Pitfall 4: eSocial Events Sent Out of Order — Table Events Must Precede Cadastral Events

**What goes wrong:**
eSocial has a strict prerequisite chain: table events must be transmitted before cadastral events, and cadastral events must be transmitted before periodic events. The order is: `S-1000/S-1005/S-1010/S-1020` (employer tables + rubrics table + cost centers) → `S-2200` (employee admission) → `S-1200/S-1210` (monthly payroll remunerations and payments) → `S-1299` (payroll period closing). If `S-2200` for a new rural employee is sent before `S-1010` (rubrics table), the government server returns error 0237 ("Categoria do trabalhador incompatível com a classificação tributária"). If `S-1200` is sent before the payroll is closed in the system, the eSocial server calculates its own INSS value and may reject the event if it diverges from the transmitted value by more than R$ 0.01.

**Why it happens:**
Developers treat eSocial as a simple "POST XML to endpoint" integration. The prerequisite chain and idempotency rules are buried in the Manual de Orientação do eSocial (MoS S-1.3), which is 400+ pages. The rubrics table (S-1010) in particular is easy to forget — it must list every payroll rubric (earnings and deductions) your system uses before any employee's payroll data is transmitted.

**How to avoid:**
- Model eSocial transmission as a state machine per event: `PENDING → QUEUED → SENT → ACCEPTED | REJECTED → CORRECTED`.
- Enforce prerequisite ordering in the BullMQ job queue: table jobs (S-1000 group) complete before cadastral jobs (S-2200 group); cadastral jobs complete before periodic jobs (S-1200 group). Use BullMQ job dependencies or separate named queues with explicit ordering.
- The `S-1010` rubrics table must be populated from the system's `PayrollRubric` master data when the payroll module is first configured — this is a setup wizard step, not optional.
- For `S-1200`: only generate the XML after the `PayrollRun` is in `CALCULATED` status and the internal INSS values have been frozen. The eSocial server validates the INSS independently; if your internal calculation differs by more than rounding tolerance, the event is rejected.
- For rural employers (`tipInscr = employer PF` using the FUNRURAL on gross revenue option): use `indMEI = N`, `classTrib = 01` (Pessoa Física), and the `tpCR` contribution type for FUNRURAL — not the standard INSS patronal fields. Getting this wrong means eSocial accepts the event but the tax calculation is wrong.

**Warning signs:**
- eSocial returns error code "S-1010 rubrica não cadastrada" on first S-1200 submission.
- Error 0237 on S-2200 for any employee.
- S-1299 (closing event) sent before S-1200 for all employees.
- System sends S-1200 events immediately after payroll calculation without waiting for closed status.

**Phase to address:** eSocial e Obrigações Acessórias (Phase 6) — but prerequisite: payroll rubric master data must be defined in Phase 2.

---

### Pitfall 5: Rural-Specific Labor Rules Applied as Urban CLT Defaults

**What goes wrong:**
The system is built for rural farms, but a developer implementing the payroll engine without deep domain knowledge defaults to the CLT urban rules. Five specific rural rules differ:

1. **Night shift**: Rural agriculture = 21h–5h (not 22h–5h), adicional = 25% (not 20%). Livestock = 20h–4h, also 25%. The `hora noturna reduzida` (52.5-min urban night hour) does NOT apply in rural work — each night hour is 60 minutes.
2. **Housing deduction**: Deducted from salary up to 20% of the regional minimum wage (not 20% of the worker's salary). Combined cap with food at 25% of minimum wage.
3. **Food deduction**: Up to 25% of minimum wage (not percentage of salary). Both housing and food deductions require written contract and worker consent — without a signed addendum, they count as salary in natura and inflate FGTS/INSS base.
4. **Harvest contract (safra)**: No `aviso prévio` on normal termination (contract ends naturally with harvest). No 40% FGTS penalty. But the employer must pay proportional 13th and proportional vacation + 1/3. Incorrectly applying the 40% FGTS penalty to a safra termination overpays; incorrectly applying the CLT permanent contract rules to safra reopens months of FGTS liability.
5. **FUNRURAL patronal**: Rural PF employers contributing on gross revenue pay 1.5% (PF) or 2.05% (PJ) of commercialization, NOT the 20% INSS patronal of urban employers. This election is annual (must be formalized in January). If the employer switches from gross-revenue to payroll-based, SENAR (0.2%) continues on gross revenue regardless.

**Why it happens:**
Express + Prisma give no guardrails for labor law domain logic. Enum values like `CONTRACT_TYPE` or `NIGHT_SHIFT_RULES` default to the urban CLT variant in most code examples. The 5.889/73 distinctions exist in HR textbooks but not in any npm package or widely-searched Stack Overflow answer.

**How to avoid:**
- The `Employee` record must have `contractType: ContractType` enum with values: `CLT_PERMANENT | CLT_EXPERIENCE | CLT_HARVEST | CLT_INTERMITTENT | CLT_APPRENTICE`. The payroll engine switches rule sets based on this field.
- Implement rural night shift detection separately from urban: the time range check differs, the percentage differs, and the hour reduction never applies.
- Housing/food deductions: calculate against `regionalMinimumWage` (configurable per state/region), not against the worker's salary.
- For safra termination: the system must check `contractType === 'CLT_HARVEST'` and apply the termination variant that excludes `aviso prévio` and 40% FGTS penalty but includes proportional 13th and vacation.
- FUNRURAL mode: store as an annual election on the `Organization` record — `funruralBasis: 'GROSS_REVENUE' | 'PAYROLL'` — and apply the correct contribution type in payroll calculation and eSocial events.

**Warning signs:**
- Night shift additional of 20% or a time range starting at 22h in the payroll for a rural worker.
- FGTS penalty charge on a safra contract termination.
- Housing deduction exceeds 25% of regional minimum wage.
- FUNRURAL patronal calculated as 20% of payroll for a PF employer who elected gross-revenue basis.

**Phase to address:** Contratos e Jornada de Trabalho (Phase 1) — contract type differentiation and rural-specific rule sets must be established before any payroll calculation is written.

---

### Pitfall 6: Payroll → Payables Integration Creates Duplicate CPs on Re-Processing

**What goes wrong:**
When a payroll run is approved, the system generates `Payable` records in the existing financial module: one CP for net salary (per employee or batched), one CP for FGTS guide (per competence), one CP for INSS guide, one CP for IRRF guide, one CP for FUNRURAL (if applicable). If a payroll run is recalculated (e.g., after a retroactive salary adjustment), the integration creates new CPs without voiding the previous ones. The accounts payable module now shows double the payroll obligation, which overstates liabilities in the financial dashboard and cash flow projection.

**Why it happens:**
The existing `payables.service.ts` has a `createPayable()` method that creates a new record unconditionally. It has no concept of an `originType/originId` deduplication check. The payroll module developer calls `createPayable()` on each approved run without checking whether a CP for that `runId + guideType` already exists.

**How to avoid:**
- Add `originType: 'PAYROLL_RUN' | 'PAYROLL_FGTS' | 'PAYROLL_INSS' | 'PAYROLL_IRRF' | 'PAYROLL_FUNRURAL'` and `originId: string` to the `Payable` model (the pattern already exists: `ASSET_ACQUISITION` uses this same field).
- Add a unique constraint on `(originType, originId)` in the Prisma schema so a duplicate insert fails at the DB level.
- The payroll → CP integration must be: `upsert` (create if not exists, update amount if exists and status is PENDING) — never `create` unconditionally.
- A re-processed payroll run creates a new `PayrollRun` with `runType: COMPLEMENTAR` — it does NOT modify or reprocess the approved run. The complementary run generates its own CPs via the same idempotency path.
- On `PayrollRun` cancellation: void (not delete) the associated CPs by setting their status to `CANCELLED`. The `PayableStatus` enum already has `CANCELADO` in the existing system.

**Warning signs:**
- Multiple `Payable` records with `category = PAYROLL` for the same `farmId` and same `competenceMonth`.
- Financial dashboard shows payroll liability double the expected amount.
- The payroll service calls `payablesService.create()` without querying for existing records by origin first.
- `Payable.originType` is NULL for any payroll-generated CP.

**Phase to address:** Integração Financeira (Phase 5) — but the `originType` unique constraint must be added to the schema in Phase 1 before any payroll data is written.

---

### Pitfall 7: Time Tracking → Payroll Pipeline Has No Approval Lock — Edits After Payroll Calculation Invalidate the Run

**What goes wrong:**
A time sheet entry (ponto) is edited after the payroll run that includes it has been calculated. The `PayrollEntry` for that employee already captured 176 hours; the corrected time sheet now shows 184 hours (8 hours of overtime that were missed). The payroll run is internally consistent but wrong. If the system does not prevent this, the approved holerite does not match the actual hours, creating a labor law exposure.

**Why it happens:**
The time tracking module (registro de ponto) and the payroll calculation module operate independently. There is no foreign key or status check that prevents editing a time sheet record whose competence period has been locked by an approved payroll run. The offline sync pattern (already proven in the project for mobile) makes this worse: offline edits sync after the payroll is approved, silently overwriting the payroll's source data.

**How to avoid:**
- The `AttendanceRecord` (ponto) must have a `lockedByPayrollRunId: string | null` field. When a `PayrollRun` transitions to `CALCULATED`, lock all attendance records for the competence period and all employees in that run.
- Attempting to edit a locked attendance record returns HTTP 409 with message: "Ponto bloqueado — folha de [competence] já calculada. Use a folha complementar para ajustes."
- Mobile offline sync: when syncing an attendance record, check if `lockedByPayrollRunId` is non-null before applying the sync. If locked, queue the edit as a "pending correction" instead of applying it, and surface an alert to the HR manager.
- The `MirrorReport` (espelho de ponto) is a read-only snapshot generated when the payroll is calculated — never a live view of attendance records.

**Warning signs:**
- Attendance records for a closed competence period have `updatedAt` after the `PayrollRun.calculatedAt`.
- Mobile sync applies hours edits without checking payroll lock status.
- The payroll run service reads attendance records directly at payment time (not from a frozen snapshot).
- `MirrorReport` and the actual attendance records diverge for the same employee and period.

**Phase to address:** Controle de Ponto e Jornada (Phase 3) — the locking mechanism must be designed into the attendance model from the start.

---

### Pitfall 8: Vacation and 13th Salary Provisioning Uses Simple Accrual, Not Salary-at-Current-Rate

**What goes wrong:**
Monthly vacation provision should be `1/12 of current monthly salary × (1 + 1/3)` — based on the current salary at the time of provisioning, not the salary at the time of accrual. If a worker earns R$ 2,000 in January–June and gets a raise to R$ 2,500 in July, the system must recalculate the entire provision balance at the new rate for months 1–6, not just accrue at R$ 2,500 from month 7 onward. The "accumulated months × old rate" approach understates the provision by the raise delta times months elapsed, which means when the worker takes vacation and the provision is reversed, the reversal exceeds the balance — creating a negative provision account.

The same issue applies to 13th salary provision: the provision must always reflect `months elapsed × current salary / 12`.

**Why it happens:**
The "accrual-only" method (add 1/12 per month) is simpler and used in many basic payroll guides. The correct "provision/reversal" method (fully recalculate the provision each month and reverse the previous month's balance) requires storing the current provision balance per employee and recalculating it on every salary change. Under salary stability this is invisible — the bug only manifests on raises, which happen infrequently.

**How to avoid:**
- Use the provision/reversal method: each monthly payroll run calculates `vacationProvision = currentMonthlySalary × monthsElapsed / 12 × 1.333`. Compare this to `previousMonthProvision`. The delta is the monthly provision entry (can be negative on salary decrease).
- The `EmployeeSalaryHistory` table must exist (not just a current salary field on `Employee`) so the system can always determine the salary valid at any point in time. Salary history is the foundation of correct provision calculation and retroactive corrections.
- The provision ledger entry (to a liability account) records both the provision amount and the employee reference. When vacation is taken, the provision is reversed (not debited as new expense) and only the difference (if any, due to INSS/IRRF on vacation payout) is a new entry.

**Warning signs:**
- After a salary raise, the vacation provision for months 1–6 is not retroactively corrected.
- Provision balance is calculated as a running sum of monthly additions rather than `currentSalary × elapsed / 12`.
- `Employee` model has a `salary: Decimal` field but no `salaryHistory: SalaryHistory[]` relation.
- Accounting entries for vacation provision become negative after a salary increase.

**Phase to address:** Férias e 13º Salário (Phase 5) — but `EmployeeSalaryHistory` table must be created in Phase 1 (Cadastro de Colaboradores), not deferred.

---

### Pitfall 9: Termination Calculation Omits Proportional Aviso Prévio Extension

**What goes wrong:**
Since Lei 12.506/2011, the aviso prévio is not flat 30 days. It is 30 days + 3 days per complete year of service, up to a maximum of 90 days. A worker with 12 years of service has 30 + (12 × 3) = 66 days of aviso prévio. This extension directly impacts: (a) the termination date for proportional 13th calculation, (b) the proportional vacation base period (includes the aviso period), and (c) the FGTS 40% penalty base (must include deposits for the aviso period). A flat 30-day aviso prévio for a 12-year employee underpays the worker by roughly 36 days of rights — a labor lawsuit risk.

**Why it happens:**
Aviso prévio proportional extension is a 2011 law that many online examples still ignore. Termination calculators that omit it produce plausible-looking (but wrong) numbers for workers under 2 years.

**How to avoid:**
- Implement `calculateNoticePeriodDays(admissionDate: Date, terminationDate: Date): number` returning `Math.min(90, 30 + 3 * completeYears)`.
- The termination service must use the extended notice period for all downstream calculations (13th base months, vacation base period, FGTS penalty period).
- Add a dedicated `TerminationCalculation` record that stores each input and output component: `admissionDate, terminationDate, contractType, noticePeriodDays, fgtsBalanceAtTermination, 13thPropSalary, vacationBalance, irrf, inss, netTerminationAmount`. This makes auditing and correction possible.
- Unit test with a 12-year employee, 8-year employee, and 1-year employee to cover boundary cases.

**Warning signs:**
- `noticePeriodDays` is always 30 regardless of service duration.
- The termination service does not query `admissionDate` from the employee record.
- 13th proportional calculation uses the calendar year end as the termination month, ignoring the notice period extension.

**Phase to address:** Rescisão Contratual (Phase 6) — notice period calculation must be the first implemented function in the termination feature.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode 2025 INSS/IRRF table values as constants | Fast to ship | Annual table updates require code deploys; wrong deductions in new year | Never — use versioned config table in DB |
| Store payroll amounts as `number` (float) instead of `Decimal` | Less code | Rounding drift creates irreconcilable ledger; INSS and IRRF differ by centavos from government systems | Never — the project already uses `Decimal.js` everywhere |
| Reuse existing `FieldTeamMember` as the Employee entity | Avoids new model | `FieldTeamMember` has no CPF, PIS, admission date, contract type; extending it with nullable fields creates a monster model | Never — create `Employee` as a separate model with optional `fieldTeamMemberId` link |
| Create one "HR payroll" Payable per payroll run (batched) | Fewer CP records | Cannot identify per-employee costs in financial reports; cannot reconcile holerite with CP | Never for FGTS/INSS guides (must be individual); acceptable for batching individual net salaries if `originId` is preserved |
| Skip eSocial transmission until after payroll is live | Faster initial delivery | eSocial acceptance is a legal requirement; cannot retroactively transmit months of S-1200 events without correction events | Only if the milestone explicitly designates eSocial as Phase 6 (acceptable phase deferral, not permanent skip) |
| Use `date` JS type for payroll competence period | Simple | Rural payroll has multiple competence types (monthly, safra, intermittent) that need typed period representation | Only for MVP if `competencePeriod` is typed as `{ year: number; month: number }` not raw `Date` |
| Allow editing approved payroll runs "by admin" | Faster fixes | Destroys audit trail; eSocial retification events (S-1295) are complex and legally required | Never — use supplementary/complementary run instead |

---

## Integration Gotchas

Common mistakes when connecting HR/Payroll to existing modules.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Payroll → Payables | Calling `payablesService.create()` unconditionally on each run approval | Use upsert with `(originType, originId)` unique constraint; void existing CP before recreating if status is still PENDING |
| Payroll → Payables | Creating one CP for the entire payroll batch | Create separate CPs for: FGTS guide (single), INSS/INSS patronal guide (single), IRRF guide (single), FUNRURAL guide (single), individual net salaries or one batched CP with `originType = PAYROLL_NET_SALARY_BATCH` |
| Time Tracking → Payroll | Reading live attendance records during payroll calculation | Freeze attendance snapshot when run reaches CALCULATED status; payroll engine reads from snapshot, not live records |
| FieldTeamMember → Employee | Assuming the existing `hourlyRate` on the User model covers payroll salary | `hourlyRate` is for cost accounting; `Employee.baseSalary` follows CLT rules (monthly, not hourly); both exist but serve different purposes |
| Work Orders → Labor Cost | Work order `laborCostPerHour` already exists but is a manual entry field | When HR module is active, `laborCostPerHour` on work orders should auto-populate from the employee's derived hourly rate (`monthlySalary / 220`); not a breaking change but must be gated on HR module enabled flag |
| eSocial transmission | Sending events synchronously in the HTTP request cycle | All eSocial transmission must be async via BullMQ (already proven pattern in project); the API endpoint enqueues the job and returns a job ID; status is polled separately |
| Digital certificate | Storing ICP-Brasil A1 certificate in the codebase or environment variable as base64 | Store in encrypted secrets manager (or at minimum AES-encrypted in DB); certificate rotation (annual for A1) must be a UI operation, not a deploy |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Computing payroll for all employees in a single Prisma transaction | Timeout errors on farms with 50+ employees | Use batched transactions (10 employees per batch) with idempotency keys; BullMQ job tracks progress | Around 30–40 employees with complex rubrics |
| Generating all eSocial S-1200 events in a single BullMQ job | Job exceeds BullMQ timeout (default 1 min), retries cause duplicates | One BullMQ job per employee per event; parent job tracks aggregate completion | Around 20 employees, sooner with slow eSocial endpoint |
| Recalculating vacation and 13th provision for all employees every month inside the main payroll run | Payroll run takes minutes | Provision calculation can run as a separate monthly BullMQ job, not inside the main payroll run | 20+ employees with frequent salary changes |
| Querying all time tracking records for a competence period without index on `(employeeId, competenceStart, competenceEnd)` | Slow payroll calculation | Add composite index at migration time; the payroll engine queries by these fields exclusively | Around 10,000 attendance records total |
| Storing payroll history as JSONB snapshots in the PayrollRun record | Fast to write, but no queryability | Use normalized `PayrollEntry + PayrollRubric` tables; JSONB is acceptable only for the printable holerite PDF template data (not source of truth) | When financial reports need to query individual rubric totals across runs |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Returning salary and INSS data in the general employee list API | Any user with `hr:read` sees all salary data | Salary fields require `hr:payroll:read` permission; base employee data (name, contract type) has lower permission level |
| eSocial XML stored in the file system without encryption | Contains CPF, PIS, salary data for all employees | Store XML in DB column with field-level encryption or in object storage with server-side encryption; never plain filesystem |
| Payroll run approval via a GET endpoint or without CSRF protection | CSRF attack approves payroll, triggering financial consequences | Payroll approval must be a POST/PATCH with CSRF token; add `hr:payroll:approve` permission separate from `hr:payroll:write` |
| Allowing the same user to both calculate and approve a payroll run | Fraud risk — someone could inflate their own salary and approve it | Enforce four-eyes principle: `calculatedBy` and `approvedBy` must be different user IDs; enforce at the service level, not just UI |
| Exporting holerite (payslip) PDF without validating the requesting user is the employee or an HR admin | Salary data leak | The payslip endpoint must verify: `requestingUser.id === payrollEntry.employeeId` OR `requestingUser.hasPermission('hr:payroll:read')` |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw INSS brackets and tax tables to the user | HR managers are not tax accountants — they get confused and lose trust in the system | Show the calculated result with a collapsible "Como foi calculado?" breakdown; never expose the raw table |
| Putting the payroll approval button inside the same list view as the calculation | Accidental approvals; approved payroll cannot be reversed without complexity | Two-step flow: CALCULATED list → review screen with full breakdown → separate APPROVE action with confirmation modal |
| Mobile ponto registration that does not validate geolocation against farm perimeter | Fraudulent clock-ins from outside the farm; labor law exposure if ponto data is contested | Validate GPS coordinates against the farm's PostGIS boundary polygon (already exists in the system); show warning if outside perimeter |
| Displaying the payslip only as a downloadable PDF with no preview | Workers with limited connectivity cannot open the PDF on a slow mobile connection | Show an HTML payslip preview inline in the app before offering the PDF download |
| Termination calculation presented as a single total with no itemization | Worker cannot verify the calculation; source of labor disputes | Always show the TRCT breakdown: each component (saldo de salário, férias vencidas, férias proporcionais + 1/3, 13º proporcional, FGTS penalty, net total) in a table before generating the document |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Payroll calculation engine:** Often missing the IRRF partial exemption for R$ 5,000–R$ 7,350 band valid from January 2026 — verify with salary = R$ 6,000, no dependents: expected IRRF ≠ 0 under old rules but = 0 under 2026 rules.
- [ ] **Rural night shift:** Appears correct for urban CLT (20%, 22h–5h) but rural should be 25%, 21h–5h for agriculture or 20h–4h for livestock — verify the time window and percentage in integration tests.
- [ ] **Vacation provisioning:** Calculates correctly at hire but does not recalculate on salary raise — verify by creating an employee, running 6 months of payroll, issuing a raise, running month 7, and checking the provision balance equals `newSalary × 7 / 12 × 1.333`.
- [ ] **Safra contract termination:** No 40% FGTS penalty and no aviso prévio — verify no `fgtsPenalty` line item appears in the termination calculation for `contractType = CLT_HARVEST`.
- [ ] **Payroll → Payables idempotency:** Running payroll approval twice should not create duplicate CPs — verify `(originType, originId)` constraint exists and is enforced at DB level.
- [ ] **eSocial event ordering:** S-1010 (rubrics table) must be transmitted before the first S-2200 (employee admission) — verify the BullMQ queue ordering guarantees this for a new company setup.
- [ ] **Employee dependents for IRRF:** Adding a dependent to an employee record should retroactively affect the current month's payroll if the run is not yet approved — verify the payroll engine reads current dependents, not a snapshot at run creation time.
- [ ] **Housing/food deductions against minimum wage:** The cap is based on the regional minimum wage, not the employee's salary — verify the deduction calculation uses `regionalMinimumWage` as the base.
- [ ] **Aviso prévio proportional extension:** A 12-year employee should have 66 days, not 30 — verify `calculateNoticePeriodDays` returns 66 for admissionDate 12 years ago.
- [ ] **Payroll lock on attendance records:** After payroll run reaches CALCULATED status, editing an attendance record for that period should return 409 — verify the lock check exists and is enforced by the attendance update endpoint.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| INSS calculated as flat rate for multiple past months | HIGH | Create a supplementary `PayrollRun` (runType: COMPLEMENTAR) for each affected month with the delta; generate eSocial S-1295 retification events; reissue corrected holerites; update FGTS deposit for the delta (FGTS is calculated on gross salary, not affected by INSS error — lower impact) |
| Duplicate Payable records from non-idempotent payroll→CP integration | MEDIUM | Write a one-time migration: identify duplicate CPs by `(category=PAYROLL, farmId, competenceMonth)`, void all but the most recent for each group; add the `(originType, originId)` unique constraint |
| Payroll run partially committed (orphaned entries) | MEDIUM | Set `PayrollRun.status = FAILED`; run a cleanup script that deletes `PayrollEntry` records where `payrollRunId` matches the failed run; re-enqueue the job |
| eSocial events sent in wrong order (S-1200 before S-2200 accepted) | HIGH | Transmit the missing prerequisite events first; wait for government acceptance; then use S-1295 (retification of S-1200) if values need correction; eSocial does not allow deleting accepted events — only rectification |
| Vacation provision balance negative after salary raise | HIGH | Run a one-time "provision reset" job that recalculates each employee's provision as `currentSalary × completedMonths / 12 × 1.333` and generates an accounting adjustment entry for the delta |
| Rural night shift calculated as urban (wrong %) for months of history | MEDIUM | Generate a supplementary payroll run for each affected competence month with the adicional noturno delta; mark the original run as `HAS_COMPLEMENTARY = true` |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| INSS flat-rate error | Phase 2: Parâmetros e Rubricas (calculation engine) | Unit test: salary = R$ 5,000 gives INSS = R$ 518.87 (not R$ 700) |
| IRRF without INSS deduction or dependents | Phase 2: Parâmetros e Rubricas (calculation engine) | Unit test: 2026, salary = R$ 6,000, 2 dependents: IRRF = 0 |
| Non-atomic payroll run | Phase 4: Processamento da Folha | Integration test: simulate crash after 5/30 employees; re-run; verify no duplicates |
| eSocial event ordering | Phase 6: eSocial e Obrigações | BullMQ queue config test: S-1010 job completes before S-2200 job starts |
| Rural CLT vs urban CLT defaults | Phase 1: Contratos e Jornada | Unit tests per rural rule (night shift period, housing cap, safra termination) |
| Duplicate Payables on re-processing | Phase 5: Integração Financeira | Integration test: approve payroll twice; count CPs = 1 not 2 |
| Time tracking edit after payroll calculation | Phase 3: Controle de Ponto | Integration test: edit attendance after CALCULATED status; expect HTTP 409 |
| Provision incorrect after salary raise | Phase 5: Férias e 13º Salário | Integration test: raise salary in month 7; verify provision balance = `newSalary × 7 / 12 × 1.333` |
| Termination aviso prévio flat 30 days | Phase 6: Rescisão Contratual | Unit test: 12-year employee; verify noticePeriodDays = 66 |
| FieldTeamMember/Employee model conflation | Phase 1: Cadastro de Colaboradores | Code review gate: `Employee` must be a distinct Prisma model with no inheritance from `FieldTeamMember` |

---

## Sources

- [Brazil Social Security updated table 2025 — Vialto Partners](https://vialtopartners.com/regional-alerts/brazil-social-security-updated-social-security-tax-table-for-2025)
- [Tabela INSS 2026 com dedução — Contabilizei](https://www.contabilizei.com.br/contabilidade-online/tabela-inss/)
- [INSS 2026 — alíquotas e faixas — Serasa Experian](https://www.serasaexperian.com.br/conteudos/tabela-inss-2026/)
- [IRRF partial exemption 2026 (R$ 5,000–R$ 7,350 band) — Remoly](https://remoly.net/blog-detail/590)
- [eSocial event ordering (S-1010 before S-2200 before S-1200) — Contabilidade Cidadã](https://contabilidadecidada.com.br/erros-nos-eventos-s-1200-e-s-1299-como-identificar-e-corrigir/)
- [eSocial S-1200 error: INSS values divergent — Alterdata KB](https://ajuda.alterdata.com.br/dpbase/esocial-erro-no-evento-s-1200-os-valores-do-campo-valor-calculado-pelo-sistema-e-valor-calculado-pelo-esocial-que-estao-localizados-nesse-registro-na-aba-inss-estao-divergentes-73673545.html)
- [eSocial event prerequisite chain — TOTVS Central de Atendimento](https://centraldeatendimento.totvs.com/hc/pt-br/articles/360045237814-RH-Linha-Protheus-GPE-eSocial-S-1200-S-1210)
- [Adicional noturno rural (25%, 21h–5h) vs urban — Tworh](https://tworh.com.br/leis/adicional-noturno-rural-e-urbano/)
- [Adicional noturno rural vs urban — Costa & Macedo](https://costaemacedo.adv.br/adicional-noturno-regras-para-trabalhadores-urbanos-rurais-e-diferenciados/)
- [Lei 5.889/73 — Lei do Trabalhador Rural — Planalto](https://www.planalto.gov.br/ccivil_03/leis/l5889.htm)
- [Desconto moradia/alimentação trabalhador rural — Martins Romanni](https://www.martinsromanni.com.br/descontos-no-salario-do-empregado-rural-destinados-a-moradia-e-alimentacao/)
- [Contrato de safra — TST Direito Garantido](https://www.tst.jus.br/en/-/direito-garantido-contrato-por-safra)
- [Contrato de safra — Sebrae PR](https://sebraepr.com.br/comunidade/artigo/contrato-de-trabalho-por-safra-cuidados-essenciais-e-regras-da-clt)
- [FUNRURAL 2026 — alíquotas e cálculo — FarmPlus](https://www.farmplus.com.br/aprenda/funrural-2026-o-que-e-quem-paga-aliquotas-como-calcular)
- [FUNRURAL opção folha vs receita bruta — FAEMG](https://www.sistemafaemg.org.br/Content/uploads/informacoes-juridicas/IcWt1642507395687.pdf)
- [Aviso prévio proporcional (Lei 12.506/2011) — VLV Advogados](https://vlvadvogados.com/recuperar-valores-de-rescisao-errada/)
- [Rescisão: aviso prévio proporcional erro comum — Casimiro Ribeiro Garcia](https://casimiroribeirogarcia.com.br/erros-pagamento-rescisao-trabalhista/)
- [Provisão de férias e 13º: método provisão/reversão — Vanin Contadores](https://www.vanin.com/noticias/provisao-de-ferias-e-13-salario)
- [Contabilização provisão — Consisa Sistemas](https://consisanet.movidesk.com/kb/pt-br/article/278171/contabilizacao-com-provisao-mensal-de-ferias-e-decimo-terceiro-s)
- [Idempotency in payroll/data pipelines — Airbyte](https://airbyte.com/data-engineering-resources/idempotency-in-data-pipelines)
- [eSocial digital certificate new standard 2026 — RRT Contabilidade](https://rrtcontabilidade.com.br/certificado-digital-novo-padrao-esocial/)
- Codebase analysis: `apps/backend/src/modules/payables/payables.types.ts` — existing `PayableCategory.PAYROLL` enum value and `originType/originId` pattern
- Codebase analysis: `apps/backend/src/modules/team-operations/team-operations.types.ts` — existing `FieldTeamMember` structure
- Codebase analysis: `apps/backend/prisma/schema.prisma` — `FieldTeam`, `laborCostPerHour` on work orders, `costCenterId` patterns

---
*Pitfalls research for: RH e Folha de Pagamento Rural — v1.3 milestone*
*Researched: 2026-03-23*
