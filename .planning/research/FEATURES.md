# Feature Research

**Domain:** Asset Lifecycle Management (Gestao de Patrimônio) — Farm Management ERP Brazil
**Researched:** 2026-03-19
**Confidence:** HIGH — Fixed asset management is a mature domain (CPC 27/IAS 16 standards are unambiguous); CMMS patterns verified against MaintainX, Fiix, FTMaintenance documentation; CPC 29 biological assets verified against CPC official pronouncements; financial integration patterns verified against SAP FI-AA, TOTVS Protheus SIGAATF, and ERPNext documentation.

---

## Context: What Already Exists

The system already ships:

- `payables` module — CP with installments, cost center rateio, CNAB 240/400, aging, alerts
- `receivables` module — CR with FUNRURAL, renegociação, PDD, aging
- `bank-accounts` module — saldo real-time, extrato, tipo Money (decimal.js)
- `stock-entries` module — entries with accessory expense rateio, custo medio ponderado
- `stock-outputs` module — FEFO, historical movements, CSV export
- `stock-balances` module — current balance per product per farm
- `products` module — product catalog with measurement units, conversions, reorder points
- `suppliers` module — fiscal data, avaliação, ranking, import/export
- `purchase-orders` module — PO with PDF, GRN (6 scenarios), automatic CP + stock entry on GRN
- `producers` module — fiscal entity (CNPJ/CPF) linked to bank accounts
- `cost-centers` module — fazenda/setor rateio
- `cash-flow` module — 12-month projection with 3 scenarios, DFC classification
- `rural-credit` module — PRONAF/PRONAMP/Funcafé/CPR, SAC/Price/Bullet amortization
- `installmentGenerator` (packages/shared) — reusable installment schedule generator
- `farms` module — fazendas with PostGIS boundaries, plots, land parcels
- `herd` module — animals, batches, locations, sanitary, reproductive, nutrition

The asset management module (Gestao de Patrimônio) sits at the intersection of the financial and operational layers. It does NOT build new financial infrastructure — it consumes the existing `payables`, `receivables`, `cost-centers`, and `installmentGenerator` as integration points. The core value is: a single asset entity that accumulates the full lifecycle (acquisition → depreciation → maintenance → disposal) and connects it to the financial module bidirectionally.

---

## Feature Landscape

### Table Stakes — Asset Registration

Features users expect in any fixed asset module. Missing = the module cannot function.

| Feature                                           | Why Expected                                                                                                                                                                                       | Complexity | Dependencies              | Notes                                                                                                                                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Asset catalog with classification tree            | Assets must be classified by type (machinery, vehicle, implement, building, land, biological) for depreciation routing and reporting                                                               | MEDIUM     | none                      | At minimum 6 types: Máquinas e Equipamentos, Veículos, Implementos Agrícolas, Benfeitorias, Terras/Imóveis, Ativos Biológicos. Classification drives which fields appear and which depreciation rules apply. |
| Asset registration form with acquisition data     | Every fixed asset starts with a purchase event. Form captures: description, classification, serial number, manufacturer, acquisition date, acquisition value, NF number, supplier.                 | MEDIUM     | `suppliers` module        | Acquisition value is the initial cost basis for all subsequent depreciation. NF number links to purchasing records even without NF-e XML parsing.                                                            |
| Farm and location assignment                      | Assets belong to a specific farm. Buildings and land need geolocation. Mobile/field equipment assigned to a plot or sector.                                                                        | LOW        | `farms` module            | farmId required on all assets. Buildings can reference PostGIS coordinates.                                                                                                                                  |
| Cost center assignment (fixed, rateio %, dynamic) | Depreciation and maintenance costs must flow to specific cost centers for P&L by activity. Fixed = single CC. Rateio % = split across multiple CCs. Dynamic = changes with operational assignment. | HIGH       | `cost-centers` module     | Three assignment modes cover all farm structures. Dynamic mode is needed for tractors shared across crops. Without this, depreciation cannot be meaningfully attributed.                                     |
| Asset status lifecycle                            | Assets move through states: EM_USO → EM_MANUTENCAO → INATIVO → BAIXADO. Status determines whether depreciation runs and whether maintenance orders can be created.                                 | LOW        | none                      | State machine prevents depreciation on disposed or inactive assets.                                                                                                                                          |
| Unique asset tag / plate                          | Physical identification of assets (patrimônio number, chassis, RENAVAM for vehicles). Required for inventory reconciliation.                                                                       | LOW        | none                      | Sequential numbering per org. Optional QR code generation for mobile scan.                                                                                                                                   |
| Asset photo attachment                            | Field teams need visual identification. Useful for insurance claims and maintenance records.                                                                                                       | LOW        | none                      | Multiple photos per asset. Store as file references.                                                                                                                                                         |
| Asset specification fields by type                | Tractors need HP, RENAVAM, model year. Implements need width, working depth. Buildings need area m², address. Land needs area ha, coordinates, matricula (registration number).                    | MEDIUM     | none                      | Configurable spec fields per asset type. Farm-specific fields (e.g., coffee plantation maturity year) must be extensible.                                                                                    |
| Complete asset record (ficha)                     | Single-view of asset showing: acquisition data, depreciation schedule, maintenance history, fuel log, document expiry, and financial summary (TCO).                                                | MEDIUM     | all modules               | The "ficha do ativo" is the anchor UI that everything links to. Tabs: Dados Gerais, Depreciação, Manutenção, Combustível/Horímetro, Documentos, Financeiro.                                                  |
| Asset search and filtering                        | Asset list grows quickly; without search it is unusable at 50+ assets.                                                                                                                             | LOW        | none                      | Filter by: type, farm, status, cost center, acquisition date range, depreciation status.                                                                                                                     |
| Mass import (CSV/Excel)                           | Farms typically have existing asset inventories in spreadsheets. Typed-field manual entry for 200 assets is impractical.                                                                           | MEDIUM     | none                      | CSV/Excel with column mapping. Same pattern as existing product/animal import. Required fields validation before import.                                                                                     |
| Asset transfer between farms                      | Tractors and equipment move between farms in multi-farm operations. Ownership, depreciation, and cost center must follow the asset.                                                                | MEDIUM     | `farms` module            | Transfer creates a history entry. Depreciation continues under new farm/CC assignment from transfer date.                                                                                                    |
| Asset write-off (baixa)                           | Assets removed from service by sale, disposal, obsolescence, or casualty loss. Baixa triggers: stop depreciation, optionally generate financial event (CR for sale, expense for disposal).         | MEDIUM     | `payables`, `receivables` | Three baixa types: Venda (generates CR), Descarte/Obsolescência (expense recognition), Sinistro (insurance recovery).                                                                                        |

### Table Stakes — Depreciation

| Feature                               | Why Expected                                                                                                                                                                                     | Complexity | Dependencies      | Notes                                                                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linear depreciation (quota constante) | CPC 27/IAS 16 requirement. Most common method. Annual rate = 1 / useful life. Monthly quota = (acquisition value - residual value) / useful life in months.                                      | MEDIUM     | none              | Pro rata die required for the acquisition month and disposal month (depreciation starts from the day asset enters service, not just first of month).                                                                                     |
| Hours-of-use depreciation (horas-uso) | Required for heavy machinery where usage intensity varies. Quota = (acquisition value - residual value) / estimated total hours × hours used this period.                                        | MEDIUM     | hourmeter log     | Depends on hourmeter readings being updated monthly. Without horímetro updates, this method degrades to approximation.                                                                                                                   |
| Production-based depreciation         | Required for assets whose wear correlates with output volume (e.g., grain elevators, milking equipment). Quota = (acq. value - residual value) / lifetime production volume × period production. | MEDIUM     | production module | Requires production volume input for each depreciation period. Complex to operationalize — limit to assets explicitly configured for this method.                                                                                        |
| Accelerated depreciation              | Fiscal incentive available for rural properties under Brazilian income tax rules (IRPF/IRPJ). Machines and implements can use 25%/35%/50% annual rates depending on shift usage.                 | MEDIUM     | none              | Two calculation bases: CPC (accounting) and Fiscal (for IR). System must track both independently because CPC value ≠ fiscal value after accelerated depreciation.                                                                       |
| Residual value configuration          | CPC 27 requires residual value estimation. System must store residual value per asset, use it in quota calculations, and allow revision.                                                         | LOW        | none              | Default residual value = 10% of acquisition value. Must be editable per asset.                                                                                                                                                           |
| Useful life estimation                | CPC 27: useful life is a management estimate, not a tax table. System must allow farm manager to set useful life independently per asset (different from tax table).                             | LOW        | none              | Display estimated end-of-life date based on useful life. Alert when useful life is due for review (typically every 3 years per CPC 27).                                                                                                  |
| Monthly depreciation run              | Automated batch computation of all active assets at month-end (or triggered manually). One depreciation entry per asset per period.                                                              | HIGH       | `cost-centers`    | Idempotent: running twice for the same period must not double-post. Requires a `depreciation_entries` table with period lock. Batch must respect cost center rateio — if asset has 3 CCs at 40/35/25%, three line entries are generated. |
| Depreciation ledger / history         | Finance manager needs to see depreciation history per asset: date, period, method, quota, accumulated depreciation, book value.                                                                  | LOW        | none              | Computed view over `depreciation_entries`. Should also show full schedule (past + future) at any point in time.                                                                                                                          |
| Dual-track: CPC vs Fiscal             | Brazilian companies often maintain two depreciation schedules simultaneously: CPC 27 (accounting) and fiscal (based on RFB tables). System must track both book values independently.            | HIGH       | none              | Adds significant complexity. Consider making Fiscal track optional (flag per org) for farms that are Simples Nacional (no separate fiscal depreciation needed).                                                                          |
| Impairment test (valor recuperável)   | CPC 01/IAS 36 requires annual review that book value does not exceed recoverable amount.                                                                                                         | LOW        | none              | Manual input: farm manager records impairment amount when market value falls below book value. Rare for agricultural assets but required for CPC compliance.                                                                             |

### Table Stakes — Biological Asset Valuation (CPC 29)

| Feature                              | Why Expected                                                                                                                                                                                                           | Complexity | Dependencies                              | Notes                                                                                                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Biological asset registration        | CPC 29/IAS 41 requires separate classification for living organisms that undergo biological transformation: cattle (corte, leite, reprodução), perennial crops (café, laranja, eucalipto), annual crops in progress.   | MEDIUM     | `herd`, `farms` modules                   | Link herd animals to biological assets for valuation. Perennial crops linked to farm plots/talhões.                                                                                              |
| Fair value measurement (valor justo) | CPC 29 requires biological assets to be measured at fair value minus estimated selling costs at each reporting date. Fair value = quoted market price for the biological group in that state of transformation.        | HIGH       | none                                      | For cattle: price per arroba (Cepea/B3 indices). For crops: commodity prices (CBOT, ESALQ). System stores the index used and the price per period. Complex because market prices change monthly. |
| Cost-based fallback                  | When fair value cannot be reliably measured (e.g., new breeds, experimental crops), CPC 29 allows cost-based measurement: accumulated cost minus impairment.                                                           | MEDIUM     | none                                      | Flag per asset: "mensuração pelo custo" vs "valor justo". Cost accumulation includes: implantation, insumos, labor, infrastructure allocation.                                                   |
| Biological transformation gain/loss  | Changes in fair value from one period to the next are recognized in P&L (not in OCI). This is a distinctive feature of CPC 29 — unlike fixed assets, biological assets create income/expense entries from revaluation. | HIGH       | none                                      | Net gain or loss per period = closing fair value − opening fair value ± acquisitions/disposals. Must generate a P&L line item per period.                                                        |
| Harvest product separation           | At harvest, the biological asset produces an "agricultural product" (product of harvest) that must be measured at fair value at the point of harvest and transferred to inventory.                                     | HIGH       | `stock-entries`, `grain-harvests` modules | CPC 29 para 13: agricultural products must be measured at fair value at point of harvest. This is the handoff from biological asset to stock.                                                    |
| Perennial crop maturity tracking     | Perennial crops (café, laranja, eucalyptus) have a formation period (not yet productive) before they are productive assets. Formation costs are capitalized during this period.                                        | MEDIUM     | `farms` module                            | Formation phase: costs accumulate in "ativo biológico em formação" (similar to imobilizado em andamento). After first harvest: reclassify to "ativo biológico em produção".                      |

### Table Stakes — Asset Under Construction (Imobilizado em Andamento)

| Feature                       | Why Expected                                                                                                                                                                         | Complexity | Dependencies | Notes                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Construction project registry | Obras in progress (barns, silos, irrigation infrastructure) accumulate costs over time before activation. Must be tracked separately from active assets.                             | MEDIUM     | none         | CPC 27 para 22: costs during construction are capitalized in a separate "Imobilizado em Andamento" account until the asset is placed in service.                                         |
| Partial cost contributions    | Multiple invoices, labor entries, and material costs accumulate against the project over weeks or months.                                                                            | MEDIUM     | `payables`   | Each CP payment linked to a construction project adds to the accumulated capitalized cost. Integration: paying a CP for a building project updates the imobilizado em andamento balance. |
| Activation event              | When construction is complete, a single activation event: (a) sets activation date, (b) moves accumulated cost from "em andamento" to the new active asset, (c) starts depreciation. | MEDIUM     | none         | Critical: depreciation only starts after activation. Before activation, no depreciation quota is generated even if months have passed.                                                   |
| Progress tracking             | Farm manager needs to track budget vs. actual costs for the project and estimated completion date.                                                                                   | LOW        | none         | Simple: project budget vs. accumulated cost, estimated completion date, list of linked CPs.                                                                                              |

### Table Stakes — Operational Control

| Feature                             | Why Expected                                                                                                                                                                   | Complexity | Dependencies       | Notes                                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hourmeter / odometer log            | Tractors, harvesters, and trucks have hour or km meters. Log readings are required for: (a) hours-based depreciation, (b) maintenance triggers, (c) cost-per-hour calculation. | LOW        | none               | Entry per asset per date: reading value, type (hours/km), operator, farm. Alert when reading is not updated for >30 days on active assets.                                                       |
| Fuel consumption log                | Fuel cost is typically 30-40% of farm machinery TCO. Without fuel tracking, cost-per-hour and cost-per-hectare calculations are unreliable.                                    | LOW        | none               | Entry: date, asset, liters filled, cost per liter, total R$, operator. Consumption rate computed as liters/hour between readings. Flag abnormal consumption (>20% deviation from asset average). |
| Document control with expiry alerts | Vehicles require CRLV, insurance, revisão periódica. Buildings may have AVCB, habite-se. Land has ITR, CCIR. Expiry management prevents legal and operational risk.            | LOW        | none               | Per asset: document type, issue date, expiry date. Alert 30/15/7 days before expiry. Alert destinations: farm manager + system notification.                                                     |
| Cost-per-hour calculation           | TCO KPI for machinery decisions (repair vs. replace). Computed as: (depreciation + maintenance + fuel + insurance) / total hours used.                                         | MEDIUM     | all cost inputs    | Requires all cost categories to be linked to the asset with timestamps. Computed as dashboard metric, not stored.                                                                                |
| Availability index                  | Uptime KPI: % of time asset was available (not in maintenance). Critical for planning-intensive operations like planting and harvesting windows.                               | MEDIUM     | maintenance orders | Computed from maintenance order start/end dates vs. calendar hours. MTBF (mean time between failures) and MTTR (mean time to repair) also derivable.                                             |

### Table Stakes — Maintenance (CMMS)

| Feature                                 | Why Expected                                                                                                                                                                                                                                  | Complexity | Dependencies                | Notes                                                                                                                                                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preventive maintenance plans            | Structured plans define what must be done, how often, and what triggers the work. Without plans, maintenance is reactive only.                                                                                                                | MEDIUM     | none                        | Plan components: asset, task description, trigger type (calendar interval / hourmeter interval / production volume), estimated duration, assigned team, required parts (from stock).                              |
| Maintenance trigger types               | Calendar: every 30 days. Hourmeter: every 250 hours. Seasonal: before/after harvest. Condition-based: reading deviates from baseline.                                                                                                         | MEDIUM     | hourmeter log               | System monitors readings and auto-generates work order when trigger condition is met. Calendar triggers are simplest; hourmeter triggers require daily reading checks.                                            |
| Work Order (OS) — CRUD                  | The OS is the unit of work in a CMMS. Fields: asset, type (preventiva/corretiva/reforma), description, requested by, assigned team/technician, priority, scheduled date, estimated duration, status.                                          | HIGH       | `stock` module (for parts)  | State machine: SOLICITADA → APROVADA → EM_EXECUCAO → CONCLUIDA / CANCELADA. Status drives asset availability calculation and cost accumulation.                                                                   |
| Work Order accounting classification    | Each OS must be classified before closure: Despesa Operacional (routine maintenance expensed immediately), Capitalização (improvement extends asset life — added to book value), Diferimento (prepaid expense amortized over future periods). | HIGH       | `payables`, asset module    | This is the single most complex feature in the maintenance module. The classification decision determines P&L vs balance sheet impact. Require classification input on OS closure. Default = Despesa Operacional. |
| Parts consumption from stock            | OS consumes spare parts from stock inventory. On OS closure: stock output created against parts used. Stock reservation on OS approval prevents parts from being allocated elsewhere.                                                         | MEDIUM     | `stock-outputs`, `products` | Spare parts are regular products in the existing products module with a "peça de reposição" category flag. No separate spare-parts database needed.                                                               |
| Maintenance cost accumulation           | Total OS cost = labor + parts + external services. All costs must be captured and rolled up to the asset's TCO.                                                                                                                               | MEDIUM     | none                        | Labor: R$/hour × hours worked. Parts: valued from stock at custo médio. External services: entered as R$ amount. Total post-closure.                                                                              |
| OS cost center attribution              | OS costs flow to the asset's cost center(s) following the same rateio as depreciation.                                                                                                                                                        | LOW        | `cost-centers`              | Inherit asset's cost center assignment at OS creation. Allow override per OS if asset is reassigned.                                                                                                              |
| Corrective maintenance request (mobile) | Operators in the field identify problems and must report them immediately. Mobile creates a maintenance request (not a full OS) that a manager approves and converts to OS.                                                                   | MEDIUM     | mobile app                  | Simplified mobile form: asset (scanned by QR or selected), problem description, photo, urgency. Web manager reviews and promotes to OS.                                                                           |
| Maintenance dashboard                   | Manager view: open OS count by priority, assets in maintenance now, upcoming preventive OS by next 30 days, average MTBF by asset type.                                                                                                       | MEDIUM     | none                        | Single page with KPI cards + list of open/upcoming OS. Filter by farm, asset type, date range.                                                                                                                    |
| Maintenance history per asset           | Complete log of all OS (preventive, corrective, capitalize) for an asset, with dates, durations, costs, and closing notes.                                                                                                                    | LOW        | none                        | Tab in ficha do ativo. Sort by date desc. Export to PDF for insurance/resale documentation.                                                                                                                       |
| Maintenance cost provision              | Monthly accounting provision for expected maintenance costs (reserves for future major repairs). Recognizes expense before cash outflow.                                                                                                      | HIGH       | `payables`                  | CPC 25 provision: Dr. Despesa de Manutenção / Cr. Provisão de Manutenção. Monthly provision amount set by manager (estimated annual cost / 12). Provision reverses when actual OS cost is posted.                 |

### Table Stakes — Financial Integration

| Feature                                          | Why Expected                                                                                                                                                          | Complexity | Dependencies                          | Notes                                                                                                                                                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cash purchase → auto CP                          | Buying an asset for cash must create a Conta a Pagar automatically, just like purchasing inventory.                                                                   | LOW        | `payables`                            | On asset acquisition confirmation: create CP with supplier, value, due date, payment terms. Link CP to asset record. Reuse `installmentGenerator` from packages/shared.                                                                |
| Financed purchase → CP with installment schedule | Financed machinery (common for tractors, combine harvesters in Brazil) generates a multi-installment CP.                                                              | MEDIUM     | `payables`, `installmentGenerator`    | OC-like form: down payment + number of installments + interval. Creates CP with installments. Links installments to asset. Shows total financing cost vs asset book value.                                                             |
| Multiple assets on same NF                       | One invoice may include multiple pieces of equipment (e.g., 3 irrigation pumps). Each creates its own asset record from the same acquisition event.                   | MEDIUM     | none                                  | NF total must equal sum of per-asset values. Value allocation: proportional or user-specified per asset.                                                                                                                               |
| Leasing (CPC 06 / IFRS 16)                       | Common for high-value machinery (colheitadeiras, tratores de grande porte) in Brazilian agro. CPC 06 R2 requires recognition of right-of-use asset + lease liability. | HIGH       | `payables`                            | Two entries at inception: Dr. Ativo de Direito de Uso / Cr. Obrigação de Arrendamento. Monthly: Dr. Depreciação / Cr. Acc Depreciation + Dr. Juros / Cr. Obrigação. Complex: amortization schedule distinct from regular depreciation. |
| Asset trade-in (troca)                           | Equipment traded in against a new purchase. Old asset is written off at book value; any difference from trade-in credit vs book value creates gain or loss.           | MEDIUM     | `payables`, asset write-off           | Net entry: old asset off at book value + any gain/loss + new CP for balance due to supplier.                                                                                                                                           |
| Asset sale → auto CR                             | Selling a fixed asset generates a Conta a Receber automatically. Gain or loss = sale price − book value at sale date.                                                 | MEDIUM     | `receivables`                         | On sale confirmation: create CR with buyer (may be a non-supplier contact), link to asset, record sale price. Compute gain/loss: sale price − net book value. Post gain/loss as non-operating income/expense.                          |
| Partial installment sale                         | Large equipment sold with payment in installments (common in rural transactions — "parcelado na safra").                                                              | MEDIUM     | `receivables`, `installmentGenerator` | Same as financed purchase but generating CRs. Reuse installmentGenerator.                                                                                                                                                              |
| Write-off by casualty (sinistro)                 | Asset destroyed by fire, flood, or theft. Remaining book value is recognized as a loss. Insurance recovery (if any) generates a CR.                                   | MEDIUM     | `receivables`                         | Two events: (a) loss recognition = book value as expense, (b) insurance recovery = CR creation if insurance claim is filed.                                                                                                            |
| Financial summary per asset                      | Dashboard panel on ficha do ativo showing: acquisition cost, accumulated depreciation, book value today, total maintenance spend YTD, total fuel YTD, effective TCO.  | MEDIUM     | all financial inputs                  | Purely computed. No separate storage required beyond what is already accumulated in existing modules.                                                                                                                                  |

### Table Stakes — Reports and Inventory

| Feature                                     | Why Expected                                                                                                                                       | Complexity | Dependencies   | Notes                                                                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset inventory (physical vs. contábil)     | Annual or ad-hoc count of all physical assets vs. system records. Required for audit, insurance, and bank financing.                               | MEDIUM     | none           | Same pattern as stock inventory module: create inventory session, count assets physically (QR code scan on mobile), reconcile with system. Discrepancy report. |
| Patrimônio report (balance sheet schedule)  | Required for external audits and bank financing applications. Shows: asset class, gross value, accumulated depreciation, net book value, per farm. | MEDIUM     | none           | Replicates SAP FI-AA Asset Explorer report structure. Export to PDF and Excel.                                                                                 |
| Depreciation schedule report                | Projected depreciation quotas for next 12/36/60 months by asset and by cost center. Input to cash flow planning.                                   | LOW        | none           | Computed from existing depreciation parameters. Feeds into the existing `cash-flow` module.                                                                    |
| Cost center depreciation attribution report | Finance manager needs to see total depreciation charge allocated to each cost center per period.                                                   | LOW        | `cost-centers` | Aggregated from `depreciation_entries` grouped by cost center × period.                                                                                        |
| Asset utilization report                    | Hours used vs. available hours per asset, per period. Input to replacement decision.                                                               | LOW        | hourmeter log  | Computed from hourmeter entries. Useful for underutilized vs. overloaded equipment decisions.                                                                  |

---

## Differentiators (Competitive Advantage)

Features that go beyond generic fixed asset software. These justify Protos Farm over Siagri, AgroReceita, or a generic TOTVS implementation for Brazilian farm operators.

| Feature                                       | Value Proposition                                                                                                                                                                                                | Complexity | Dependencies                      | Notes                                                                                                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composite asset hierarchy (pai-filho)         | Tractors have attached implements (grades, plantadeiras). Building systems (irrigation pump + pipes + emitters) are managed as a unit. Cost and depreciation can be tracked at component level.                  | HIGH       | none                              | Up to 3 levels. Child assets inherit cost center from parent by default. Child depreciation is independent (different useful lives). Parent ficha shows aggregate book value and TCO across children. |
| Asset under construction with budget tracking | Obras on farms often run over budget. A farm-specific construction project module with budget vs. actual tracking is rare in generic ERPs and extremely valuable for fazenda owners building new infrastructure. | MEDIUM     | `payables`                        | Simple: project budget (manual entry), list of linked CPs, % complete (manual), estimated completion date. Visual: budget gauge.                                                                      |
| TCO dashboard per asset and per fleet         | Knowing the true cost-per-hour for each tractor over its lifetime is the #1 input to "repair vs. replace" decisions. This insight is what separates a farm manager from a farm owner who guesses.                | MEDIUM     | all cost inputs                   | Key KPI: custo/hora = (depreciation + maintenance + fuel + insurance) / total hours. Historical trend chart per asset. Fleet comparison chart (rank by custo/hora).                                   |
| Repair-vs-replace recommendation              | When cumulative maintenance cost exceeds 60-70% of replacement cost, replacement is financially superior. System can surface this decision when OS cost crosses the threshold.                                   | LOW        | maintenance costs, book value     | Single alert: "Custo acumulado de manutenção deste ativo atingiu X% do valor de reposição. Considere a troca." Not an auto-decision, just a flag.                                                     |
| Seasonal maintenance calendar                 | Brazilian agriculture has hard deadlines (planting windows, harvest windows) where equipment downtime is very expensive. Preventive maintenance must be scheduled AROUND those windows, not during them.         | MEDIUM     | maintenance plans, `farms` module | Integration with farm planting/harvest calendar: maintenance scheduling wizard warns if a planned OS overlaps with an active planting or harvest operation for the same farm.                         |
| Biological asset dashboard                    | Herd value, crop formation value, and total biological asset portfolio at current fair value — on one screen. Rare in farm ERPs, high value for bank financing and net worth reporting.                          | MEDIUM     | `herd`, CPC 29 module             | Cards: total herd FV, total perennial crops FV, total biological asset FV, period change in FV (gain/loss). Drill down to per-category and per-animal-group.                                          |
| QR code asset tags (mobile scan)              | Field workers identify assets by scanning a QR code to open the ficha, log hourmeter, or request maintenance — without knowing the system asset ID.                                                              | LOW        | mobile app                        | Generate printable QR codes per asset. QR encodes the asset UUID. Mobile deep-link opens ficha. Required for inventory counting via mobile.                                                           |
| Fuel efficiency benchmarking                  | Compare fuel consumption per hour or per hectare across similar equipment models. Flag machines consuming 20%+ above fleet average.                                                                              | LOW        | fuel log                          | Computed from fuel log. Requires at least 2 similar assets to produce a comparison.                                                                                                                   |

---

## Anti-Features (Commonly Requested, Often Problematic)

| Anti-Feature                                                        | Why Requested                                         | Why Avoid                                                                                                                                                                                                                                                                  | Alternative                                                                                                                                                           |
| ------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NF-e XML import for asset acquisition                               | Eliminate manual NF data entry                        | NF-e XML parsing requires SEFAZ integration, digital certificate validation, and fiscal rule interpretation. This is a full fiscal module (explicitly out of scope per PROJECT.md).                                                                                        | Manual NF data capture on acquisition form: number, series, date, value, chave NF-e as future hook. Takes 60 seconds, always works.                                   |
| Full CIAP (ICMS credit on fixed assets) management                  | Recover ICMS paid on asset acquisition over 48 months | CIAP involves complex fiscal rules, SPED EFD integration, and interaction with the fiscal module. It requires monthly apportionment of ICMS recovery linked to taxed vs. exempt revenue. Belongs in a dedicated fiscal module.                                             | Store the chave NF-e on the asset as a future integration hook. Let the fiscal module use it when built.                                                              |
| IoT / telematics integration (GPS, engine hours via CAN bus)        | Automatic hourmeter updates without manual entry      | High integration complexity, device fragmentation (each tractor brand has its own API), and ongoing maintenance cost. Benefit is real but not proportionate to cost at current scale.                                                                                      | Manual hourmeter log with monthly reminder notification. QR code scan + manual entry on mobile covers 90% of the benefit at 5% of the cost.                           |
| Predictive maintenance via ML                                       | Prevent failures before they occur                    | Requires 2-3 years of failure history with correlated sensor data to build any useful model. The system doesn't have that history. A model trained on generic agricultural equipment data won't fit this farm's specific fleet and conditions.                             | Preventive maintenance plans with hourmeter-based triggers achieve 80% of downtime reduction from predictive maintenance without the complexity and data requirement. |
| Asset-level P&L (embedded profit center accounting)                 | Know exactly how profitable each tractor or plot is   | This is responsibility center accounting — a full management accounting module. It requires revenue allocation rules (which crops did this tractor service?) that are arbitrary and contentious. Adds enormous configuration complexity for questionable marginal insight. | Cost center attribution + TCO dashboard gives sufficient cost visibility. Revenue attribution belongs in a management accounting module, not the asset module.        |
| Lease vs. buy decision wizard                                       | Automated NPV comparison to guide financing decisions | Decision depends on tax rate, opportunity cost of capital, expected inflation, and credit access — all farm-specific inputs that change constantly. A canned wizard will produce wrong answers with false confidence.                                                      | Simple TCO report + depreciation schedule + financing cost summary gives the CFO the inputs to make the decision. Don't automate the judgment.                        |
| Insurance integration (SUSEP API)                                   | Auto-fetch insurance policy data                      | SUSEP does not expose a public API for policy data retrieval. Integration would require each insurer's proprietary API. Complexity far exceeds benefit.                                                                                                                    | Manual insurance document record with expiry alert. Store policy number, insurer name, coverage value, premium, and expiry date.                                      |
| Full project management (gantt, resource leveling) for construction | Manage obra projects like an MS Project plan          | This is project management software, not an asset module. The cost-capture and activation features of imobilizado em andamento already provide the accounting value. The gantt/resource problem is out of scope.                                                           | Budget vs. actual tracking + estimated completion date + list of linked payments is sufficient for farm-scale construction projects.                                  |

---

## Feature Dependencies

```
[Asset Registration]
    required-by --> [Depreciation Module]
    required-by --> [Maintenance Module]
    required-by --> [Operational Control]
    required-by --> [Financial Integration]
    required-by --> [Biological Asset Valuation]

[Cost Center Module (existing)]
    required-by --> [Depreciation attribution]
    required-by --> [Maintenance OS cost attribution]
    required-by --> [Asset registration cost center assignment]

[Suppliers Module (existing)]
    required-by --> [Asset acquisition (CP generation)]
    required-by --> [Maintenance parts procurement]

[Payables Module (existing)]
    feeds-from --> [Asset cash purchase]
    feeds-from --> [Financed asset installments]
    feeds-from --> [Leasing monthly installments]
    feeds-from --> [OS cost settlement (external services)]

[Receivables Module (existing)]
    feeds-from --> [Asset sale → CR]
    feeds-from --> [Casualty insurance recovery]
    feeds-from --> [Parcelada asset sale installments]

[installmentGenerator (packages/shared, existing)]
    reused-by --> [Financed asset installments]
    reused-by --> [Leasing amortization]
    reused-by --> [Parcelada asset sale]

[Stock Module (products, outputs — existing)]
    required-by --> [Maintenance parts consumption from stock]
    feeds-from --> [Biological asset harvest → stock entry]

[Herd Module (existing)]
    feeds-into --> [Biological asset valuation (cattle)]

[Farm/Plots Module (existing)]
    required-by --> [Asset farm assignment]
    feeds-into --> [Biological asset valuation (perennial crops)]
    feeds-into --> [Seasonal maintenance calendar]

[Hourmeter Log]
    required-by --> [Hours-based depreciation]
    required-by --> [Maintenance hourmeter triggers]
    required-by --> [Cost-per-hour calculation]
    required-by --> [Fuel efficiency calculation]

[Depreciation Engine]
    required-by --> [Book value at any date]
    required-by --> [Gain/loss on asset sale]
    required-by --> [Asset write-off loss amount]
    required-by --> [TCO calculation]

[Maintenance Work Order (OS)]
    required-by --> [Parts stock reservation and consumption]
    required-by --> [Maintenance cost attribution to asset]
    required-by --> [Availability/MTBF calculation]
    required-by --> [Maintenance provision usage]

[Asset Write-off (Baixa)]
    required-by --> [Asset sale → CR generation]
    required-by --> [Casualty loss → expense]
    required-by --> [Disposal → book value expense]

[Imobilizado em Andamento]
    feeds-into --> [Active asset on activation]
    required-by --> [Construction cost capitalization]

[Biological Asset (CPC 29)]
    feeds-from --> [Herd (cattle FV)]
    feeds-from --> [Plots/Crops (perennial crop FV)]
    feeds-into --> [Stock Entries on harvest (FV at point of harvest)]
    generates --> [Fair value gain/loss in P&L per period]
```

### Dependency Notes

- **Asset Registration is the root dependency.** All other features presuppose a clean, classified asset entity. It must be the first story in any phase ordering.
- **Depreciation engine must be built before write-off.** Gain/loss on sale requires net book value, which requires the depreciation engine to have run correctly for all prior periods. Do not build the financial integration stories before the depreciation engine is validated.
- **Hourmeter log is a prerequisite for hours-based depreciation and maintenance triggers.** Without daily or weekly readings, the trigger mechanism cannot function. Prioritize hourmeter log UX (simple mobile entry) early.
- **Maintenance OS classification (expense vs. capitalize) is the most complex integration point.** It is the one decision that can distort both P&L and balance sheet if handled incorrectly. Require explicit classification before OS closure; do not auto-default to either.
- **CPC 29 biological assets are independent from CPC 27 fixed assets.** They have a different valuation model (fair value, not cost). Biological asset valuation is its own sub-module. Do not build it into the fixed asset depreciation engine.
- **Financial integration (purchase → CP) reuses existing payables infrastructure.** Do not create new payment tracking; route all asset-related payments through the existing `payables` module.
- **Leasing (CPC 06) is the highest complexity financial integration.** It requires a separate amortization schedule (right-of-use asset + lease liability), interest calculation, and dual depreciation entry. Consider deferring to a later phase unless leasing is common in the specific farm's fleet.
- **Imobilizado em andamento is low complexity but high value.** Simple data model (project → aportes → activation). Build early because farm construction projects are always ongoing and managers want to see them tracked.

---

## MVP Definition

### Phase 1 — Foundation (Build First)

The minimum coherent unit that delivers value for a farm manager who needs to know what assets exist and their current book value.

- [ ] Asset catalog with classification tree (6 types)
- [ ] Asset registration form (machines, vehicles, implements)
- [ ] Farm, cost center, and status assignment
- [ ] Hourmeter / odometer log (simple entry)
- [ ] Document control with expiry alerts
- [ ] Mass import from CSV/Excel
- [ ] Linear depreciation with pro rata die
- [ ] Monthly depreciation run (batch, idempotent)
- [ ] Depreciation ledger per asset
- [ ] Asset ficha (tabs: Dados Gerais, Depreciação, Documentos)
- [ ] Patrimônio report (gross value / accumulated dep / book value)
- [ ] Cash purchase → auto CP (simplest financial integration)
- [ ] Asset write-off (descarte / baixa simples)

### Phase 2 — Maintenance CMMS

Add after Phase 1 has at least 4-6 weeks of production data.

- [ ] Preventive maintenance plans with calendar and hourmeter triggers
- [ ] Work Order (OS) CRUD with state machine
- [ ] Parts consumption from stock (reuse existing stock-outputs)
- [ ] OS accounting classification (despesa / capitalização / diferimento)
- [ ] Mobile maintenance request from operator
- [ ] Maintenance dashboard (open OS, upcoming preventive, MTBF)
- [ ] Cost-per-hour calculation (powered by Phase 1 data + OS costs)
- [ ] Maintenance cost provision (CPC 25)

### Phase 3 — Advanced Depreciation and Financial Integration

- [ ] Hours-based depreciation (requires hourmeter data from Phase 1)
- [ ] Production-based depreciation
- [ ] Accelerated depreciation (dual-track CPC vs Fiscal)
- [ ] Financed purchase (installments → CP reusing installmentGenerator)
- [ ] Asset sale with gain/loss → auto CR
- [ ] Asset trade-in (troca com compensação)
- [ ] Imobilizado em andamento (obras + partial contributions + activation)
- [ ] Composite asset hierarchy (pai-filho up to 3 levels)

### Phase 4 — Biological Assets and Advanced Reports

- [ ] Biological asset registration (cattle + perennial crops)
- [ ] Fair value measurement with price index reference
- [ ] Biological asset transformation gain/loss in P&L
- [ ] Harvest product separation (FV at harvest → stock entry)
- [ ] Perennial crop maturity tracking (formação → produção)
- [ ] Leasing / arrendamento (CPC 06 right-of-use asset)
- [ ] Biological asset dashboard
- [ ] Asset inventory (physical vs. contábil reconciliation)
- [ ] TCO dashboard per asset and per fleet
- [ ] Repair-vs-replace alert

### Defer to Future Milestone

- [ ] CIAP (ICMS credit recovery) — requires fiscal module as prerequisite
- [ ] NF-e XML import for asset acquisition — explicitly out of scope
- [ ] IoT/telematics integration — complexity vs. benefit not justified at this scale
- [ ] Predictive maintenance — requires 2-3 years of failure history
- [ ] Full project management (gantt) for construction — out of scope

---

## Feature Prioritization Matrix

| Feature                                        | User Value | Implementation Cost | Priority     |
| ---------------------------------------------- | ---------- | ------------------- | ------------ |
| Asset registration (machines, buildings, land) | HIGH       | MEDIUM              | P1           |
| Linear depreciation engine                     | HIGH       | MEDIUM              | P1           |
| Monthly depreciation run (batch)               | HIGH       | HIGH                | P1           |
| Document control with expiry alerts            | HIGH       | LOW                 | P1           |
| Hourmeter log                                  | HIGH       | LOW                 | P1           |
| Mass import CSV/Excel                          | MEDIUM     | MEDIUM              | P1           |
| Cash purchase → CP                             | HIGH       | LOW                 | P1           |
| Asset write-off (baixa)                        | HIGH       | MEDIUM              | P1           |
| Patrimônio report                              | HIGH       | MEDIUM              | P1           |
| Preventive maintenance plans                   | HIGH       | MEDIUM              | P2           |
| Work Order (OS) CRUD                           | HIGH       | HIGH                | P2           |
| OS accounting classification                   | HIGH       | HIGH                | P2           |
| Parts from stock on OS                         | HIGH       | MEDIUM              | P2           |
| Mobile maintenance request                     | MEDIUM     | MEDIUM              | P2           |
| Maintenance dashboard                          | HIGH       | MEDIUM              | P2           |
| Cost-per-hour (TCO)                            | HIGH       | MEDIUM              | P2           |
| Financed purchase → installments               | HIGH       | MEDIUM              | P3           |
| Asset sale → CR + gain/loss                    | HIGH       | MEDIUM              | P3           |
| Imobilizado em andamento                       | HIGH       | MEDIUM              | P3           |
| Composite asset hierarchy (pai-filho)          | MEDIUM     | HIGH                | P3           |
| Hours-based depreciation                       | MEDIUM     | MEDIUM              | P3           |
| Accelerated depreciation (dual-track)          | MEDIUM     | HIGH                | P3           |
| Biological asset valuation (CPC 29)            | HIGH       | VERY HIGH           | P4           |
| Leasing / CPC 06                               | MEDIUM     | HIGH                | P4           |
| Asset trade-in                                 | LOW        | MEDIUM              | P4           |
| Asset inventory reconciliation                 | MEDIUM     | MEDIUM              | P4           |
| CIAP                                           | MEDIUM     | VERY HIGH           | Out of scope |
| NF-e XML import                                | LOW        | VERY HIGH           | Out of scope |
| IoT / telematics                               | LOW        | VERY HIGH           | Out of scope |

**Priority key:**

- P1: Phase 1 (Foundation) — must have for first delivery
- P2: Phase 2 (CMMS Maintenance)
- P3: Phase 3 (Advanced Depreciation + Financial Integration)
- P4: Phase 4 (Biological Assets + Advanced Reports)

---

## Brazilian Agricultural Asset Context

### Typical Asset Profile of a Mid-Sized Brazilian Farm (500-5000 ha)

**Machinery (most complex, highest value):**

- 2-6 tractors (R$300k–R$800k each, 10-12 year useful life)
- 1-2 colheitadeiras (R$600k–R$2M each, 8-10 year useful life)
- Plantadeiras, grades, pulverizadores (implements, linked to tractors as children)
- Caminhões (truck fleet for grain transport)

**Buildings and infrastructure:**

- Galpões (machinery storage, grain storage — R$200k–R$500k)
- Armazéns and silos (can be R$1M–R$5M for a medium grain farm)
- Casas de funcionários (staff housing — low value but many)
- Irrigação infrastructure (pivôs centrais — R$200k–R$800k each)

**Land:**

- Not depreciated per CPC 27
- Multiple titles (matrículas) per farm
- ITR (imposto territorial rural) must be tracked annually

**Biological assets:**

- Cattle herd (corte: valued by arroba price; leite: by annual milk yield)
- Perennial crops: café (3-5 year formation, 15-20 year productive life), laranja, eucalipto
- Formation costs for perennial crops are significant — R$8k–R$15k per hectare for coffee implantation

### Depreciation Rates — Brazilian Tax Reference (RFB tables)

These are the fiscal depreciation rates commonly used in Brazilian agriculture (not CPC 27 accounting rates — those are management estimates):

| Asset Type                     | Annual Rate (Fiscal)     | Useful Life | Notes                                          |
| ------------------------------ | ------------------------ | ----------- | ---------------------------------------------- |
| Tratores e máquinas agrícolas  | 10%                      | 10 years    | Can be 25-50% accelerated for rural producers  |
| Colheitadeiras                 | 10%                      | 10 years    | Accelerated available                          |
| Implementos agrícolas          | 20%                      | 5 years     |                                                |
| Veículos                       | 20%                      | 5 years     |                                                |
| Galpões e armazéns             | 4%                       | 25 years    |                                                |
| Silos (metálicos)              | 10%                      | 10 years    |                                                |
| Sistemas de irrigação          | 10%                      | 10 years    |                                                |
| Perennial crops (café, citros) | Not depreciated fiscally | —           | Treated as permanent (CPC 29 biological asset) |

### Accelerated Depreciation (Rural Fiscal Benefit)

Brazilian tax law allows rural producers to apply accelerated depreciation for income tax purposes:

- 1 shift/day (8h): normal 100% rate
- 2 shifts/day (16h): 150% rate
- 3 shifts/day (24h): 200% rate

This creates the dual-track requirement: the CPC (accounting) book value uses management-estimated useful life; the fiscal book value uses accelerated rates. Both must be tracked separately.

---

## Competitor Feature Analysis

| Feature               | TOTVS Protheus SIGAATF                             | SAP FI-AA                          | Siagri Agro (Brazilian vertical) | Our Approach                                                                                         |
| --------------------- | -------------------------------------------------- | ---------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Asset catalog         | Full with 100+ config fields                       | Full with enterprise hierarchy     | Farm-specific types              | 6 asset types, farm-specific fields per type. Extensible spec fields.                                |
| Depreciation methods  | Linear, hours, production, accelerated, dual-track | All methods + planned/unplanned    | Linear and accelerated           | Linear (Phase 1) + hours + production + accelerated (Phase 3). Dual-track optional.                  |
| CMMS integration      | Separate module (SIGAMNT)                          | PM module with complex integration | Basic work order                 | Integrated OS in same monorepo. Parts from existing stock module.                                    |
| CPC 29                | Yes (separate module)                              | Via IFRS add-on                    | Partial (cattle only)            | Full CPC 29 with fair value + cost fallback + perennial crops (Phase 4).                             |
| CPC 06 leasing        | Yes                                                | Yes                                | No                               | Phase 4. Right-of-use + lease liability amortization.                                                |
| Financial integration | Auto CP/CR on events                               | Full FI-AA integration             | Partial, manual steps            | Auto CP on purchase, auto CR on sale, gain/loss calculation — all via existing payables/receivables. |
| Mobile                | No                                                 | Minimal                            | No                               | Mobile maintenance request + QR code scan + hourmeter log.                                           |
| Farm-specific context | No farm/plot concept                               | No                                 | Yes (talhão integration)         | Full farm/plot/cost center context on all assets. Seasonal maintenance calendar.                     |

---

## Sources

- [CPC 27 — Ativo Imobilizado (CVM)](https://conteudo.cvm.gov.br/export/sites/cvm/menu/regulados/normascontabeis/cpc/CPC_27_rev_12.pdf) — Depreciation methods, useful life, residual value, impairment. Confidence: HIGH.
- [CPC 29 — Ativos Biológicos e Produtos Agrícolas (CVM)](https://conteudo.cvm.gov.br/export/sites/cvm/menu/regulados/normascontabeis/cpc/CPC_29_rev_14.pdf) — Fair value measurement, harvest product, biological transformation. Confidence: HIGH.
- [CPC 06 R2 — TOTVS Blog](https://www.totvs.com/blog/negocios/cpc-06/) — Leasing accounting under IFRS 16: right-of-use asset, lease liability, financial vs. operational unification. Confidence: HIGH.
- [TOTVS Protheus SIGAATF — CPC no Ativo Fixo](https://centraldeatendimento.totvs.com/hc/pt-br/articles/4411126012439-Cross-Segmento-Backoffice-Linha-Protheus-SIGAATF-IFRS-CPC-no-Ativo-fixo) — Brazilian ERP asset module with dual-track CPC vs Fiscal. Confidence: HIGH.
- [MaintainX — Agricultural CMMS](https://www.getmaintainx.com/industries/agriculture-and-farm-maintenance-software) — Work order patterns, preventive maintenance triggers, ERP integration. Confidence: HIGH.
- [FTMaintenance — Modernizing Agricultural Maintenance](https://ftmaintenance.com/maintenance-management/modernizing-agricultural-maintenance-with-cmms-software/) — CMMS patterns for farm machinery. Confidence: MEDIUM.
- [AfixCode — CPC 27 Depreciação](https://www.afixcode.com.br/blog/cpc-27/) — Brazilian accounting context for fixed asset depreciation. Confidence: HIGH.
- [AfixCode — Imobilizado em Andamento](https://www.afixcode.com.br/blog/imobilizado-em-andamento-contabilizacao/) — Construction in progress accounting. Confidence: HIGH.
- [AfixCode — Contabilização Reformas e Reparos](https://www.afixcode.com.br/blog/contabilizacao-ativo-imobilizado/) — Capitalize vs. expense maintenance costs. Confidence: HIGH.
- [Asset Disposal Accounting — Corporate Finance Institute](https://corporatefinanceinstitute.com/resources/accounting/asset-disposal/) — Gain/loss on disposal journal entries, ERP integration pattern. Confidence: HIGH.
- [PWC — Maintenance Capitalization (IAS 16 / IFRS)](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/property_plant_equip/property_plant_equip_US/chapter_1_capitaliza_US/14_maintenance_inclu_US.html) — Capitalize vs. expense decision framework for maintenance. Confidence: HIGH.
- [MaintainX EAM — Financial Integration Patterns](https://www.getmaintainx.com/learning-center/enterprise-asset-management-software) — EAM-ERP integration patterns for cost center and financial module. Confidence: MEDIUM.
- [Fleet TCO Calculation — Fleetio](https://www.fleetio.com/blog/calculating-total-cost-of-ownership-for-fleet) — TCO formula: acquisition + admin/operating + depreciation + downtime. Confidence: HIGH.
- PROJECT.md — Milestone requirements, out-of-scope items, existing module inventory. Confidence: HIGH (primary source).

---

_Feature research for: Protos Farm v1.2 — Gestao de Patrimônio (Asset Lifecycle Management)_
_Researched: 2026-03-19_
