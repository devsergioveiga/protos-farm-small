# Feature Research

**Domain:** HR & Rural Payroll (RH e Folha de Pagamento Rural) — Brazilian Farm Management ERP
**Researched:** 2026-03-23
**Confidence:** HIGH — Brazilian labor law (CLT + Lei 5.889/73) is codified and unambiguous; eSocial leiautes are officially published at gov.br (v S-1.3, verified 2026); FUNRURAL alíquotas verified against official CNA/FAEMG sources; NR-31 requirements verified against MTE official publication; payroll calculation patterns verified against TOTVS RM and Senior HCM documentation.

---

## Context: What Already Exists

The system already ships all financial, purchasing, asset, and operational modules. This HR module sits at the intersection of operations and finance. It does NOT build new financial infrastructure — it consumes existing modules as integration points:

- `payables` — folha → Contas a Pagar (salários, guias FGTS/INSS/FUNRURAL)
- `cost-centers` — rateio de custo de pessoal por fazenda/atividade
- `field-teams` (operações de campo) — equipes e apontamento parcialmente implementados; reuse possible for horas por atividade
- `work-orders` (patrimônio) — custo de mão de obra já existe em OS; labor cost attribution reusable
- `suppliers` — prestadores de serviço PJ via suppliers, not employees
- `installmentGenerator` (shared) — adiantamento/parcelas reutilizável
- `farms` — geofencing for ponto eletrônico validation
- `products`/`stock` — EPI tratado como produto de estoque (ficha de entrega)
- `producers` — entidade fiscal (CNPJ/CPF) vinculada a empregador rural

The HR module is the missing link between "who did the work" (field operations) and "what it cost" (financial module). It does NOT replace any existing module.

---

## Feature Landscape

### Table Stakes — Employee Registration & Contracts (EPIC-RH1)

Features every HR system must have. Missing = cannot legally employ workers.

| Feature | Why Expected | Complexity | Legal Basis | Notes |
|---------|--------------|------------|-------------|-------|
| Employee profile with personal and tax data | Required for eSocial S-2200, IRRF, FGTS, seguro-desemprego. CPF, PIS/PASEP, CTPS, RG, birth date, address mandatory | MEDIUM | CLT art. 29; eSocial S-2200 | PIS/PASEP mandatory for FGTS. CTPS digital now preferred but physical CTPS still legal. |
| Dependents registration | IRRF deduction (R$189.59/dependent 2026 table), salário-família qualification | LOW | CLT art. 65; RIR art. 42 | Link to IRRF calculation engine. CPF mandatory for dependents since 2021. |
| Work contract types: CLT, safra, intermitente, experiência, aprendiz | Rural properties use all types. Safra (harvest contract) is the most common rural-specific type | HIGH | Lei 5.889/73 art. 14-A; CLT art. 428 | Each type has different termination rules, proportional rights, and eSocial event variants. Safra is linked to crop cycle dates, not calendar dates. |
| Position (cargo) and salary structure | Position hierarchy determines base salary. Required for RAIS, eSocial S-2200, and salary progression | MEDIUM | CLT art. 461 | CBO code (Classificação Brasileira de Ocupações) mandatory for eSocial. Rural positions have specific CBOs (e.g., 6110-10 Agricultor). |
| Work schedule (escala) assignment | Determines expected hours per day/week, night shift windows, and overtime thresholds | MEDIUM | Lei 5.889/73 art. 5; CLT art. 58 | Rural standard: 44h/week, 8h/day. Rural night shift: 21h–5h (not 22h–5h). Multiple escalas needed: 5x1, 6x1, regime de turno. |
| Salary history and movements | Salary changes, promotions, transfers must be traceable. Required for eSocial S-2206 | LOW | CLT art. 468 | Each movement generates an eSocial event. Keep full history, never edit old records. |
| Mass import of employees (CSV/Excel) | Farms can have 50–500+ workers at peak of harvest season | MEDIUM | — | Map CTPS, CPF, PIS, CBO, salary, hire date from spreadsheet. Validate CPF checksum and PIS checksum. |
| Complete employee record (ficha do colaborador) | Single-view: contract, salary history, payslips, leave balance, EPIs, trainings, operational assignments | MEDIUM | — | Tabs: Dados Pessoais, Contrato, Folha/Holerites, Férias/Afastamentos, EPIs/Treinamentos, Operações de Campo. This is the anchor UI. |

---

### Table Stakes — Time Tracking (EPIC-RH2)

| Feature | Why Expected | Complexity | Legal Basis | Notes |
|---------|--------------|------------|-------------|-------|
| Mobile time clock with geolocation | Field workers cannot use web. GPS validates worker is on the farm property (geofence from PostGIS boundary). Offline-first for poor connectivity | HIGH | Portaria MTE 1.510/2009; Lei 5.889/73 | Reuse farms.boundary (PostGIS) for geofence validation. Reuse mobile offline sync infrastructure from EPIC-06. |
| Web time clock for administrative/office workers | Farm managers, accountants, office staff clock in via browser | LOW | Portaria MTE 1.510/2009 | Simple form: in/out + optional reason for irregularities. |
| Activity and operation tagging on time entry | Rural worker cost attribution requires knowing WHAT they were doing (plantio, colheita, trato, manutenção). Links to cost center automatically. | HIGH | — | Reuse operação types from field-operations module. This is the bridge between HR and operations. Without it, labor cost per activity is impossible. |
| Overtime calculation with rural rules | Rural overtime: 50% for first daily extra hours, 100% on Sundays/holidays (if no DSR). Night shift 21h–5h = 25% premium (not 20%). Hour reduction for rural night: 52m30s = 1h (same as urban) | HIGH | Lei 5.889/73 art. 7; CLT art. 59 | Rural night differential is 25% (not urban 20%). This is a common miscalculation. The 21h–5h window must be configurable or hardcoded as rural constant. |
| Hour bank (banco de horas) | Common practice on farms to compensate harvest overtime with off-peak rest | MEDIUM | CLT art. 59 §5; Portaria MTE 671/2021 | Agreement required (individual or ACT). Balance tracked. Compensation within 6 months for individual agreement. Never goes negative without explicit rules. |
| Time sheet mirror (espelho de ponto) with approval flow | Legal requirement to show employee their own time record. Manager approves before payroll closes. Required for eSocial | MEDIUM | Portaria MTE 1.510/2009 art. 10 | Employee views → disputes within 48h → manager approves/adjusts → locked for payroll. PDF export for SEFIP/eSocial audit. |
| DSR (Descanso Semanal Remunerado) calculation | Sunday or weekly rest day. If DSR falls on holiday = extra pay. Missed DSR = additional payment in payroll | MEDIUM | Lei 605/1949; CLT art. 67 | Rural workers paid daily or by production also have DSR rights. Complex interaction with banco de horas. |

---

### Table Stakes — Payroll Calculation (EPIC-RH3)

| Feature | Why Expected | Complexity | Legal Basis | Notes |
|---------|--------------|------------|-------------|-------|
| Rubric/event configuration (proventos e descontos) | Every payroll item (salário, HE, AN, INSS, IRRF, FGTS, VA, moradia, alimentação) must be a configurable rubric with calculation rule | HIGH | — | Formula engine: fixed value, % of base, progressive table, or custom formula. Rural-specific: moradia (max 25% salário), alimentação (max 20% salário). These are DISCOUNTS, not additions — common confusion. |
| INSS employee table (tabela progressiva) | Mandatory employee contribution. 2026 table: up to R$1.518,00 = 7,5%; up to R$2.793,88 = 9%; up to R$4.190,83 = 12%; up to R$8.157,41 = 14%. Progressive since 2021. | HIGH | Lei 8.212/91; Portaria MPS 9/2021 | Progressive calculation (not marginal-only): each range is calculated on that slice of salary. Must update table annually. NOT flat rate. |
| IRRF progressive table with deductions | Mandatory income tax withholding. 2026 table active. Deductions: R$189.59/dependent, INSS employee, pension payments | HIGH | RIR Decreto 9.580/2018; IN RFB 1.500/2014 | 13º salário has separate IRRF table. Férias: salary+1/3 has separate calculation base. Common source of audit findings when miscalculated. |
| FGTS calculation and guide generation | 8% of gross salary monthly. Employer pays to Caixa Econômica Federal via GFIP/SEFIP (FGTS) | MEDIUM | Lei 8.036/1990 | Guide generated automatically after payroll close. Integration with payables module: creates AP with due date. FGTS on safra termination: 40% penalty on fund balance. |
| FUNRURAL patronal calculation | Rural employer's social security contribution. Two options: (a) 1.2% INSS + 0.1% RAT + 0.2% SENAR on receita bruta; OR (b) 20% INSS + 3% RAT on folha. Choice irrevocable for the fiscal year (January deadline). | HIGH | Lei 8.212/91 art. 25; Instrução Normativa 2.110/2022 | Choice between receita bruta vs folha must be a farm-level setting. Most farms choose receita bruta (lower rate). Folha option requires integration with receivables module for receita bruta calculation. |
| Housing and food deductions (moradia/alimentação) | Rural employer may provide housing and food and discount up to 25%/20% of salary respectively. These are salary-in-kind — reduce INSS/IRRF base. | MEDIUM | Lei 5.889/73 art. 9; Decreto 73.626/1974 art. 20 | Must be declared in employment contract. Reduces liquid pay but base for INSS purposes must be the full salary. Common audit risk if incorrectly configured. |
| Salary advance (adiantamento/vale) management | Common practice: 40–50% of salary paid around the 15th. Balance paid on last business day. Discount is automatic in monthly payroll. | LOW | CLT art. 459 | Reuse installmentGenerator from shared. Creates payable entry in financial module on advance payment date. |
| 13th salary processing (1st and 2nd installments) | Mandatory. 1st installment: November or on employee request (férias). 2nd installment: December 20th. INSS and IRRF apply on 2nd installment only. | HIGH | CLT art. 7-A; Lei 4.090/1962 | Separate calculation engine: 2nd installment IRRF uses annual total, not monthly. FGTS 8% applies to both. 13th for safra workers is proportional to months worked. |
| Payslip generation (holerite) | Employee right to receive itemized payslip. Digital delivery via app/email sufficient since 2020. | MEDIUM | CLT art. 464 parágrafo único | PDF generation. Delivery confirmation log for audit. Mobile app delivery preferred for field workers without email. |

---

### Table Stakes — Leave, Vacation & Termination (EPIC-RH4)

| Feature | Why Expected | Complexity | Legal Basis | Notes |
|---------|--------------|------------|-------------|-------|
| Vacation accrual and scheduling | After 12 months (período aquisitivo), 30 days earned. Can be fractioned into up to 3 periods (min 14 + min 5 + min 5 days). Must be scheduled 30 days in advance. | HIGH | CLT art. 129–153 | Visual calendar view essential. Safra workers: proportional férias on contract end. Alert if worker approaching 24-month limit (employer pays double if not given). |
| Vacation payment calculation | Salary + 1/3 constitutional. INSS and IRRF apply. Paid 2 working days before vacation start. Includes abono pecuniário (1/3 of vacation convertible to cash) if requested. | HIGH | CLT art. 143 | Abono pecuniário reduces vacation days but generates immediate cash payment. Complex interaction with IRRF table (full amount in single month can change bracket). |
| Leave of absence management (afastamentos) | Sick leave (atestado médico): 1st–15th days = employer pays; from 16th day = INSS pays (benefício). Work accident (CAT): from 1st day = INSS. Maternity: 120 days = INSS pays via payroll advance (salário-maternidade). | HIGH | Lei 8.213/1991; CLT art. 472 | CAT (Comunicado de Acidente de Trabalho) is both an HR event AND an eSocial event (S-2210). Integration between leave management and eSocial transmission is critical. Stability period: 12 months after work accident. |
| Termination calculation (rescisão/TRCT) | TRCT (Termo de Rescisão do Contrato de Trabalho) is legally required document. Items: saldo salário, férias vencidas+proporcionais, 13º proporcional, aviso prévio. Safra: + indenização 1/12 por mês. | HIGH | CLT art. 477; Lei 5.889/73 art. 14-A | Without-cause termination: + 40% FGTS multa + GRRF guide. Safra termination: no 40% FGTS penalty (prazo determinado), but 1/12 indenização per month. Seguro-desemprego eligibility check. |
| Monthly provision for vacation and 13th (provisão) | Accounting principle: accrue 1/12 of vacation+13th+encargos monthly, regardless of when paid. Integration with accounting module (future) and cost center attribution | MEDIUM | NBC TG 19; CLT | Provisão must be attributed to same cost center as worker's activity. When worker moves cost center, reverse provision in old CC and re-provision in new CC. Integration with financial module creates AP entry monthly. |

---

### Table Stakes — Tax Obligations & eSocial (EPIC-RH5)

| Feature | Why Expected | Complexity | Legal Basis | Notes |
|---------|--------------|------------|-------------|-------|
| eSocial XML event generation | Mandatory for all rural employers since 2021. Covers all employment lifecycle events. Non-compliance = fines + inability to generate guides. | HIGH | Res. CGSN 140/2018; Portaria Conjunta RFB/SEPRT 71/2018 | Version S-1.3 currently active. Key events: S-2200 (admissão), S-2206 (alteração), S-2230 (afastamento), S-2299 (desligamento), S-1200 (remuneração), S-2210 (CAT), S-2220 (ASO), S-2240 (condições trabalho). |
| eSocial transmission and status dashboard | Events generated as XML must be transmitted to government portal. Response includes receipt (protocolo) and status (aprovado/pendente/rejeitado/erro). | HIGH | Portal eSocial API | Dashboard showing: pending transmission, transmission errors with error codes, approved events. Error resolution workflow. Retry mechanism. |
| Tax guide generation (FGTS, INSS, IRRF, FUNRURAL) | After payroll close, guides must be generated for payment. Each guide has barcode, due date, competência. | MEDIUM | Various | FGTS: GFIP/SEFIP monthly. INSS: GPS (Guia da Previdência Social). IRRF: DARF. FUNRURAL: GPS with specific code. Guides become AP entries in financial module. |
| RAIS annual report | Annual employment data for Ministry of Labor statistics. All employees in the year, with wages, hours, dates. Deadline: February following year. | MEDIUM | Lei 7.998/1990; Portaria MTE 1.127/2021 | Since 2024, RAIS is being progressively replaced by eSocial's S-1000 to S-2299 events. System should support RAIS export for transition period. |
| Informe de Rendimentos (annual earnings statement) | Annual document per employee showing total income and IRRF withheld. Required for employee income tax return. DIRF was abolished 01/2025; data now flows through eSocial + EFD-Reinf. | MEDIUM | IN RFB 2.060/2021; DIRF extinction Portaria RFB 2025 | Generate PDF per employee. Deliver via email or mobile app. Must cover: salários, 13º, férias, IRRF retido, INSS descontado. |

---

### Table Stakes — Safety (EPIC-RH6)

| Feature | Why Expected | Complexity | Legal Basis | Notes |
|---------|--------------|------------|-------------|-------|
| EPI control with delivery record (ficha de entrega) | Employer must provide PPE free of charge and document delivery with employee signature. Required for NR-31 compliance and labor court defense. | MEDIUM | NR-31 item 31.5; NR-6 | EPIs treated as products from stock module (existing inventory). Ficha de entrega: EPI, quantity, date, condition, employee signature (or digital acknowledgment). Expiry date tracking per EPI item. |
| Mandatory training management (NR-31 matrix) | Rural workers must receive training before starting work. Min 20h initial training. Certificate with CBO, instructor, date, content. Matrix view: who is trained, who is overdue, who is untrained. | MEDIUM | NR-31 item 31.20 | CIPATR training (rural safety committee) required for farms >10 employees. PGRTR (Risk Management Program) is the farm-level document. Training records link to employee profile and eSocial S-2240. |
| ASO (Medical Examination) and PCMSO tracking | Admissional, periodic, return-to-work, change-of-function, and dismissal exams. PCMSO is the farm-level occupational health program document. | MEDIUM | NR-7; eSocial S-2220 | Expiry alerts for periodic ASO. On overdue = block payroll processing (warning). ASO result links to eSocial S-2220 (Monitoramento da Saúde do Trabalhador). CAT (accident report) links to eSocial S-2210. |

---

### Table Stakes — Financial & Accounting Integration (EPIC-RH7)

| Feature | Why Expected | Complexity | Legal Basis | Notes |
|---------|--------------|------------|-------------|-------|
| Automatic payroll-to-payables integration | After payroll approval, create AP entries: net salary per employee, FGTS guide, INSS guide, IRRF DARF, FUNRURAL GPS. Each AP has correct due date and cost center attribution. | HIGH | — | Reuse existing `payables` module with all its features (CNAB, aging, cost center rateio). This is the primary financial output of payroll. One payroll run = N+4 AP entries (N employees + 4 guides). |
| Cost center attribution per employee activity | Payroll cost must be attributed to the same cost center as the work done (safra de soja, pecuária de corte, administração). When worker splits time across activities, payroll splits too. | HIGH | — | Rateio engine: if worker has time entries tagged by activity, split payroll cost proportionally. If no activity tagging, use employee's default cost center. This is the core labor cost reporting feature. |
| HR dashboard: headcount, payroll cost, cost/activity | Managers need: total headcount by contract type, total payroll cost this month vs last, cost per activity/crop, overtime hours by team, NR-31 compliance %. | MEDIUM | — | Aggregate from payroll module. Cards + sparklines. Export to CSV. No heavy BI — just operational visibility. |

---

## Differentiators (Competitive Advantage)

Features that make this HR module stand out in the rural farm management context.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Safra contract lifecycle management | Few systems handle the complete safra lifecycle: hire before harvest → calculate proportional rights → auto-generate TRCT with 1/12 indenização at harvest end → bulk terminations for 50+ safristas simultaneously | HIGH | Bulk termination wizard for harvest-end scenarios. Auto-calculates all TRCT items for each safrista. One-click generation of all eSocial S-2299 events. |
| Activity-linked time entries from field operations | Worker clocks in AND tags the operation (plantio talhão 3, colheita café lote B). Cost flows automatically from HR to the operation record. Managers see labor cost per talhão, per crop, per operation. | HIGH | This bridges the gap between "who worked" and "what it cost per hectare." No competitor integrates this tightly with field operations. Reuse field-teams infrastructure. |
| Mobile payslip delivery with offline-capable access | Workers in rural areas often have no email. Mobile app delivers payslip as PDF, readable offline. Push notification when payslip is ready. | MEDIUM | Reuse mobile app infrastructure from EPIC-06. Rural workers expect to receive payslips on phone. WhatsApp delivery (via API) is an additional option since 2023. |
| eSocial error triage workflow | eSocial rejections have opaque error codes. System maps rejection code to human-readable explanation + fix action. E.g., error E508 "CPF não cadastrado no CNIS" → action: verify worker's CPF at Receita Federal and update. | HIGH | Reduces dependency on accountant for eSocial error resolution. Competitive advantage for smaller farms without dedicated RH staff. |
| FUNRURAL regime comparison calculator | Farm owner can see: "this year, paying FUNRURAL by receita bruta = R$X; by folha = R$Y. Recommendation: escolher X." Updated monthly as production and headcount change. | MEDIUM | Requires integration with receivables (receita bruta) and payroll (folha total). Directly saves money. No rural system does this automatically. |
| Vacation planning calendar with crop cycle awareness | Vacation scheduler shows: who is on vacation when, overlaid with planned harvest dates from field operations module. Prevents scheduling all workers on vacation during peak colheita. | MEDIUM | Reuse crop operation dates from field operations module. Prevents costly operational conflicts. |
| Labor cost per hectare reporting | Combining payroll cost center attribution + farm plot area (PostGIS) = labor cost per hectare per crop. Core KPI for farm efficiency analysis. | HIGH | Requires payroll → cost center → talhão chain working end-to-end. Dashboard metric: R$/ha labor by crop type and season. |

---

## Anti-Features

Features that seem reasonable but create problems in this domain.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Biometric time clock hardware integration | Seems like fraud prevention | Hardware varies per farm, requires physical installation, connectivity issues, maintenance cost. Rural farms often have poor infrastructure. | GPS geofencing via mobile phone achieves the same anti-fraud goal without hardware dependency. |
| Real-time payroll calculation during time entry | Seems like good UX | Payroll has multiple dependencies (rubrics, tables, advances, leaves) that aren't finalized mid-month. Real-time calculation creates false expectations and performance issues. | Show estimate label clearly as "estimativa não definitiva." Finalize only during payroll close. |
| Direct eSocial API transmission (without queue) | Seems faster | eSocial API has rate limits and maintenance windows. Synchronous transmission blocks payroll workflow if portal is down. | Async queue: generate XML, queue transmission, poll status, update dashboard. Portal downtime ≠ system downtime. |
| Full accounting chart of accounts (plano de contas) | Seems like natural next step | Contabilidade module is a separate milestone (v1.4). Building chart of accounts in HR creates schema conflicts and delays the HR milestone. | Cost center codes in payroll entries carry enough attribution for v1.3. Full accounting integration deferred to v1.4 contabilidade milestone. |
| Homologation workflow for terminations (sindicato) | Legally required in some scenarios | Since 2017 Labor Reform (Lei 13.467/2017), homologação sindical is no longer mandatory for most terminations. CLT art. 477 §1 was repealed. | TRCT with employee and employer signatures is sufficient. Alert if worker has >1 year tenure where union involvement may still be expected per CCT. |
| WhatsApp payslip delivery (native integration) | Workers prefer WhatsApp | WhatsApp Business API requires Meta approval, monthly costs, and compliance complexity. Out of scope for v1.3. | Mobile app push notification + in-app PDF is sufficient. WhatsApp integration can be added as v1.x feature if users demand it. |
| Production-based pay (pagamento por produção) | Common in coffee and cane cutting | Piece-rate pay requires integration with harvest production data, individual counters per worker, and DSR calculation complexity (OJ 235 TST). High litigation risk if miscalculated. | Defer to future milestone. For v1.3: hourly + fixed daily rate covers 90% of rural workers. Production-based pay can be an add-on epic. |

---

## Feature Dependencies

```
[Employee Profile + Contract]
    └──requires──> [Position/CBO catalog]
    └──requires──> [Farm + Cost Center] (existing modules)
    └──enables──> [eSocial S-2200 event generation]
    └──enables──> [IRRF/INSS calculation]

[Time Tracking]
    └──requires──> [Employee Profile + Contract] (work schedule, cost center)
    └──requires──> [Farm PostGIS boundary] (geofence validation)
    └──enhances──> [Field Operations] (labor cost per operation)
    └──enables──> [Payroll Calculation] (hours worked, overtime, night shift)
    └──enables──> [Activity cost attribution]

[Payroll Calculation]
    └──requires──> [Employee Profile + Contract] (salary, rubrics)
    └──requires──> [Time Tracking] (hours, overtime, banco de horas balance)
    └──requires──> [Leave Management] (afastamentos, absences)
    └──requires──> [Salary Advance] (deduct from net)
    └──enables──> [Payslip generation]
    └──enables──> [Tax guide generation]
    └──enables──> [eSocial S-1200 event]
    └──enables──> [Payables integration]

[Vacation & Leave Management]
    └──requires──> [Employee Profile + Contract] (hire date for aquisitivo period)
    └──requires──> [Time Tracking] (leave days affect payroll hours)
    └──enables──> [Vacation payment calculation]
    └──enables──> [Monthly provision accounting]
    └──enables──> [eSocial S-2230 event]

[eSocial Events]
    └──requires──> [Employee Profile] (S-2200, S-2206)
    └──requires──> [Payroll] (S-1200)
    └──requires──> [Leave Management] (S-2230)
    └──requires──> [Safety/ASO] (S-2210, S-2220, S-2240)
    └──requires──> [Termination] (S-2299)

[Safety: EPI + Training + ASO]
    └──requires──> [Employee Profile] (links to worker)
    └──requires──> [Stock/Products module] (EPI items from inventory)
    └──enables──> [eSocial S-2210, S-2220, S-2240]

[Financial Integration]
    └──requires──> [Payroll Calculation] (closed payroll run)
    └──requires──> [Tax guide generation]
    └──consumes──> [Payables module] (creates AP entries)
    └──consumes──> [Cost Centers module] (attribution)

[Termination (Rescisão)]
    └──requires──> [Employee Profile + Contract]
    └──requires──> [Vacation balance] (férias vencidas + proporcionais)
    └──requires──> [13th balance] (13º proporcional)
    └──requires──> [FGTS balance] (40% multa if sem justa causa)
    └──enables──> [eSocial S-2299]
    └──enables──> [TRCT document generation]
```

### Dependency Notes

- **Time Tracking must precede Payroll:** Overtime, banco de horas, and night shift additionals cannot be calculated without time data. Payroll cannot close without an approved time sheet mirror.
- **Employee Profile + Contract must precede everything:** No eSocial event, no payroll calculation, no time entry is valid without a registered employee with valid CPF/PIS.
- **Safety (ASO) blocks payroll optionally:** If ASO is expired, payroll should warn (not block by default — legal liability is employer's, not system's). Hard block is an anti-pattern that creates workaround pressure.
- **Financial integration is last in the chain:** Payables entries should only be created after payroll is approved and guides are generated. Reversals must cascade (if payroll is re-opened, reverse the AP entries).

---

## MVP Definition

### Launch With (v1.3 — this milestone)

These are the 27 stories across 7 EPICs already scoped. Ordering priority within the milestone:

- [x] **Employee Profile + Contracts** (EPIC-RH1) — Foundation. Nothing works without this. Build first.
- [x] **Payroll Rubrics + Payroll Calculation Engine** (EPIC-RH3, stories 1–3) — Core value. Build before time tracking UI (calculation engine can use manual input initially).
- [x] **Time Tracking: Mobile + Web** (EPIC-RH2, stories 1–2) — Build after payroll engine exists so time entries immediately feed calculations.
- [x] **Overtime + Hour Bank** (EPIC-RH2, stories 3–4) — Builds on time tracking foundation.
- [x] **Payslip, Salary Advance, 13th** (EPIC-RH3, stories 4–5) — Completes the payroll cycle.
- [x] **Vacation + Leave + Termination** (EPIC-RH4) — Dependent on payroll engine for calculations.
- [x] **Tax Guides + eSocial** (EPIC-RH5) — Dependent on complete payroll data.
- [x] **Safety: EPI + Training + ASO** (EPIC-RH6) — Can build in parallel with later payroll stories.
- [x] **Financial + Dashboard Integration** (EPIC-RH7) — Final: consumes all prior modules.

### Add After Validation (v1.x)

- [ ] **WhatsApp payslip delivery** — Add if users demand alternative to mobile app delivery.
- [ ] **Production-based pay (pagamento por produção)** — High complexity, litigation risk, needed by coffee/cane farms.
- [ ] **EFD-Reinf integration** — Companion to eSocial for non-payroll tax withholdings. Add when contabilidade module (v1.4) is built.
- [ ] **Biometric/facial recognition via mobile camera** — Anti-fraud enhancement for large farms.

### Future Consideration (v2+)

- [ ] **Union agreement (CCT/ACT) management** — Store collective agreements, auto-apply salary floors, validate against minimum wage.
- [ ] **Competency and performance management (avaliação de desempenho)** — Requires HR maturity beyond compliance.
- [ ] **e-CAT (electronic accident report to INSS)** — Requires INSS web services integration.
- [ ] **Labor litigation risk scoring** — Flag employees with patterns suggesting litigation risk (short tenure, frequent overtime, missed DSR).

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Employee profile + contract registration | HIGH | MEDIUM | P1 |
| Payroll calculation engine (INSS, IRRF, FGTS, FUNRURAL) | HIGH | HIGH | P1 |
| Mobile time clock with geolocation | HIGH | HIGH | P1 |
| Payslip generation (PDF + app) | HIGH | MEDIUM | P1 |
| Vacation accrual + calculation | HIGH | HIGH | P1 |
| Termination calculation (TRCT) | HIGH | HIGH | P1 |
| eSocial XML generation + transmission | HIGH | HIGH | P1 |
| EPI delivery control | MEDIUM | LOW | P1 |
| Salary advance (vale) | MEDIUM | LOW | P1 |
| Hour bank (banco de horas) | MEDIUM | MEDIUM | P1 |
| 13th salary processing | HIGH | MEDIUM | P1 |
| Leave/afastamento management + CAT | HIGH | MEDIUM | P1 |
| Tax guide generation (FGTS, INSS, IRRF, FUNRURAL) | HIGH | MEDIUM | P1 |
| Payroll → AP financial integration | HIGH | LOW | P1 |
| NR-31 training matrix | MEDIUM | MEDIUM | P2 |
| ASO/PCMSO tracking | MEDIUM | MEDIUM | P2 |
| Activity-tagged time entries | HIGH | HIGH | P2 |
| Monthly vacation + 13th provision (provisão) | MEDIUM | MEDIUM | P2 |
| RAIS / Informe de Rendimentos | MEDIUM | MEDIUM | P2 |
| eSocial error triage workflow | MEDIUM | HIGH | P2 |
| FUNRURAL regime comparison calculator | MEDIUM | MEDIUM | P3 |
| Vacation calendar with crop cycle overlay | MEDIUM | MEDIUM | P3 |
| Labor cost per hectare reporting | HIGH | HIGH | P3 |
| Mass employee import (CSV/Excel) | MEDIUM | MEDIUM | P2 |
| HR dashboard: headcount + cost | HIGH | LOW | P2 |

---

## Brazilian Rural Labor Specifics — Quick Reference

Critical rules that differ from standard CLT (urban) systems:

| Rule | Urban (CLT) | Rural (Lei 5.889/73) |
|------|-------------|----------------------|
| Night shift window | 22h–5h | 21h–5h |
| Night shift premium | 20% | 25% |
| Night hour reduction | 52m30s = 1h | 52m30s = 1h (same) |
| Harvest contract | Not applicable | Contrato de safra (prazo determinado por ciclo produtivo) |
| Safra termination | CLT art. 479 (50% remaining salary) | 1/12 indenização per month worked (instead of 50% remaining) |
| Housing deduction | Not applicable | Up to 25% of salary |
| Food deduction | Not applicable (PAT rules differ) | Up to 20% of salary |
| FUNRURAL patronal | INSS 20% + RAT on folha | Option: 1.2% + 0.1% + 0.2% on receita bruta OR 20% + 3% on folha |
| SENAR contribution | Not applicable | 0.2% (receita bruta option) or included in folha option |

---

## Competitor Feature Analysis

| Feature | TOTVS RM | Senior HCM | Aegro | Our Approach |
|---------|----------|------------|-------|--------------|
| Rural payroll rules | Yes (lei 5.889 supported) | Yes (rural module) | No (operations only, no payroll) | Full support — differentiate on integration depth |
| eSocial transmission | Yes (built-in) | Yes (built-in) | No | Yes, with error triage workflow |
| Mobile time clock | Yes | Yes | Partial (field ops) | Yes, with farm geofence and operation tagging |
| Activity cost attribution | Partial (via RM workflow) | Partial | No | Full integration with field operations module |
| Farm management integration | No (separate product) | No (separate product) | Operations only | Deep integration — single platform advantage |
| FUNRURAL regime comparison | No | No | Partial (blog content only) | Yes — unique differentiator |

---

## Sources

- [Lei 5.889/73 — Trabalho Rural (Guia Trabalhista)](https://www.guiatrabalhista.com.br/legislacao/lei5889.htm) — HIGH confidence
- [eSocial Manual de Orientação S-1.3 (gov.br)](https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais/mos-s-1-3-consolidada-ate-a-no-s-1-3-03-2025.pdf) — HIGH confidence
- [NR-31 Segurança e Saúde no Trabalho na Agricultura (MTE 2024)](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-31-atualizada-2024-1.pdf) — HIGH confidence
- [FUNRURAL 2026 — FarmPlus](https://www.farmplus.com.br/aprenda/funrural-2026-o-que-e-quem-paga-aliquotas-como-calcular) — MEDIUM confidence (secondary source, consistent with official rules)
- [Contrato de Safra — TST](https://www.tst.jus.br/en/-/direito-garantido-contrato-por-safra) — HIGH confidence
- [Jornada do Trabalhador Rural — Guia Trabalhista](https://www.guiatrabalhista.com.br/tematicas/jornadatrab_rural.htm) — HIGH confidence
- [eSocial para Produtor Rural — Aegro Blog](https://blog.aegro.com.br/esocial-para-produtor-rural/) — MEDIUM confidence (practitioner guide)
- [DIRF extinction and Informe de Rendimentos 2026 — Receita Federal](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2025/julho/a-declaracao-do-imposto-sobre-a-renda-retido-na-fonte-dirf-nao-sera-mais-utilizada) — HIGH confidence
- [TOTVS RH Folha de Pagamento Linha RM](https://produtos.totvs.com/ficha-tecnica/tudo-sobre-o-totvs-rh-folha-de-pagamento-linha-rm/) — MEDIUM confidence (competitor benchmark)
- [Senior HCM Cálculo de Provisões](https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/manual-processos/relacoes-trabalhistas/administracao-de-pessoal/provisoes.htm) — MEDIUM confidence (competitor benchmark)

---

*Feature research for: RH e Folha de Pagamento Rural — Protos Farm v1.3*
*Researched: 2026-03-23*
