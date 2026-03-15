# Pitfalls Research

**Domain:** Brazilian Agricultural Financial Management (ERP rural)
**Researched:** 2026-03-15
**Confidence:** MEDIUM — Based on existing codebase patterns, deep domain knowledge of Brazilian financial regulation, and known failure modes in agribusiness ERP systems. WebSearch unavailable; Brave API key not configured. Claims marked LOW where external verification was not possible.

---

## Critical Pitfalls

### Pitfall 1: Monetary Arithmetic with JavaScript Floats

**What goes wrong:**
Financial calculations (interest, penalties, rounding on installments, CNAB remittance totals) accumulate floating-point errors. `0.1 + 0.2 !== 0.3` in JavaScript. A 12-instalment plan for R$ 100,000 at 1.5% a.m. produces rounding residuals that break CNAB file checksums, produce off-by-cent totals in bank reconciliation, and cause audit failures.

**Why it happens:**
The existing codebase already uses `toNumber()` helpers converting Prisma `Decimal` to native `number` for arithmetic, then rounds with `Math.round`. This is acceptable for quantities (stock) but is dangerously insufficient for monetary values — even a single intermediate float multiplication can introduce a cent of error that bank files reject.

**How to avoid:**

- Store all monetary values as `Decimal(15,2)` in PostgreSQL (never Float or Int in centavos without explicit contract).
- Use the `decimal.js` or `big.js` library for all monetary arithmetic in the service layer — never native JS numbers.
- Define a project-wide `Money` type wrapper in `packages/shared/src/types/money.ts` that enforces Decimal arithmetic.
- Reconcile installment totals against the original value and assign residual to the last instalment (standard Brazilian banking practice).
- CNAB files require specific integer representations (values in centavos, zero-padded); convert only at the I/O boundary, never during computation.

**Warning signs:**

- `toNumber()` called on a monetary Decimal field anywhere other than the final serialization step.
- Instalment sum differs from loan principal by R$ 0.01–R$ 0.10.
- CNAB file rejected by bank with "valor inconsistente" or checksum error.

**Phase to address:** US-FN07 (Contas a Pagar — lançamento, parcelamento) and US-FN08 (baixa com juros/multa) — establish the Money type before any payment arithmetic is written.

---

### Pitfall 2: CNAB Layout Variance Between Banks

**What goes wrong:**
CNAB 240 and CNAB 400 are FEBRABAN standards but every major bank (Itaú, Bradesco, BB, Caixa, Santander, Sicoob, Sicredi) publishes its own "layout manual" with proprietary extensions, non-standard segment sequences, and divergent field interpretations. A single CNAB generator that works for Banco do Brasil (the dominant rural bank for PRONAF/PRONAMP operations) will be silently rejected by Bradesco or Sicoob cooperatives without a clear error.

**Why it happens:**
Developers treat CNAB as a single spec. The FEBRABAN base document is real, but bank-specific manuals add or override segments. Rural operations heavily use Sicoob and Sicredi cooperatives for crédito rural — these cooperatives use non-standard header layouts for Banco Cooperado identification.

**How to avoid:**

- Design a bank-adapter pattern: a `CnabAdapter` interface per bank code (FEBRABAN bank codes), with a default fallback to FEBRABAN baseline.
- Start implementation with Banco do Brasil (341) and Caixa Econômica Federal (104) — they handle the majority of PRONAF/PRONAMP disbursements.
- Accept the bank's layout manual as a first-class configuration artifact, not inline code.
- Build a dry-run CNAB validator that checks against the specific bank's segment rules before file generation.
- For retorno (return files), implement tolerant parsing — accept unknown optional segments gracefully rather than hard-failing.

**Warning signs:**

- A single `generateCnab240()` function with no bank-specific branching.
- CNAB tested only against one bank's sandbox.
- Return file parsing uses strict positional parsing without fallback on optional segments.

**Phase to address:** US-FN08 (CNAB 240/400 remessa/retorno) — define the adapter interface before writing any bank-specific parser.

---

### Pitfall 3: Cheques Pré-Datados as a Balance Distortion

**What goes wrong:**
A cheque pré-datado issued today for R$ 50,000 due in 60 days appears nowhere in standard AP/AR until it is cashed. If the system records it only as a "note" without affecting the projected cash flow, the user sees available balance that does not account for committed outflows. Rural suppliers routinely transact in pre-dated cheques; their entire season's input purchases may be covered this way. Missing them produces dangerously optimistic cash flow projections.

**Why it happens:**
Standard accounting treats cheques as cash-equivalent on issue date. Brazilian rural practice treats them as deferred instruments. Systems copy the accounting model without acknowledging the operational reality.

**How to avoid:**

- Model cheques as a first-class entity with states: `EMITIDO` → `A_COMPENSAR` → `COMPENSADO` / `DEVOLVIDO` / `CANCELADO`.
- On issue, create both a `ChequeEmitido` record (with `dataPrevista`) and an AP entry with `paymentMethod = CHEQUE_PRE_DATADO` linked to it.
- The projected cash flow (US-FN13) must consume `dataPrevista` from cheques in the `A_COMPENSAR` state, not the issue date.
- Real bank balance (extrato) versus contábil balance must be clearly labelled — the difference IS the outstanding pre-dated cheques.
- Never merge saldo bancário real with saldo contábil in any dashboard display.

**Warning signs:**

- Cheque managed as a metadata field on a payment record rather than its own entity.
- Cash flow projection queries do not join `ChequeEmitido` in the `A_COMPENSAR` state.
- Dashboard shows a single "saldo" figure without qualifying it as real or projected.

**Phase to address:** US-FN09 (Gestão de cheques) — the data model must be correct from the start; retrofitting the cash-flow engine later is expensive.

---

### Pitfall 4: Multiple Producers Per Farm Break Single-Org Financial Isolation

**What goes wrong:**
The existing system models `ProducerFarmBond` with types including ARRENDATARIO, MEEIRO, PARCEIRO, and CONDOMINO (see schema.prisma line 56–64). A single physical farm can have multiple fiscal entities (CPF/CNPJ producers). If bank accounts and CP/CR are attached only to `organizationId`, transactions that legally belong to producer A leak into the financial view of producer B. This is not just a UX issue — it is a fiscal compliance issue. Each producer's ITR (rural tax), FUNRURAL, and crédito rural limits are computed on their individual financial position.

**Why it happens:**
The RLS mechanism enforces `organizationId` isolation (confirmed in `rls.ts`). Adding `producerId` as a second isolation dimension is an afterthought. Developers attach financial entities to the farm (convenient, already exists) not to the producer (correct, but requires another FK and filter dimension).

**How to avoid:**

- Bank accounts (US-FN01) must have a required `producerId` FK — not optional.
- All AP (US-FN07), AR (US-FN11), and crédito rural (US-FN14) entries must carry `producerId`.
- Reporting endpoints must offer filtering by both `farmId` and `producerId` independently.
- Dashboard (US-FN15) must show consolidation options: by org, by farm, by producer.
- Seed data and tests must include multi-producer farm scenarios.

**Warning signs:**

- `BankAccount` model draft has `farmId` but no `producerId`.
- Financial report endpoints filter only by `organizationId` and `farmId`.
- Test scenarios use a single producer per farm.

**Phase to address:** US-FN01 (Cadastro de contas bancárias) — the producer FK must be in the initial migration. Adding it after financial data exists requires a complex backfill.

---

### Pitfall 5: Crédito Rural Amortization Models Implemented Incorrectly

**What goes wrong:**
PRONAF, PRONAMP, and FuncaFé contracts use SAC, Price (French amortization), or Bullet schedules with subsidized interest rates set by the Plano Safra (published annually by MAPA/BCB). Systems implement a generic loan calculator and apply the nominal interest rate — missing: (a) the equalization subsidy that reduces the effective rate, (b) grace periods (carência) during which only interest accrues with no principal, (c) agricultural year alignment (principal due at harvest, not monthly), and (d) IGP-M or IPCA monetary correction on some line types.

**Why it happens:**
Generic financial libraries provide standard amortization. Rural credit rules are documented in the Plano Safra MCR (Manual de Crédito Rural do Banco Central), not in mainstream developer documentation. Developers apply what they know.

**How to avoid:**

- Implement a `CreditoRuralSchedule` generator distinct from any generic loan calculator.
- Store the Plano Safra reference year on the contract — rate equalization tables change annually.
- Model grace periods explicitly: `gracePeriodMonths`, `graceType` (INTEREST_ONLY vs FULL_GRACE).
- Payment schedule must align with the crop calendar, not calendar months. For coffee/citrus (present in this system), the harvest month drives principal due dates.
- Validate generated schedules against BCB MCR examples for each credit line type (Custeio, Investimento, Comercialização).

**Warning signs:**

- A single `calculateAmortization(principal, rate, periods, type)` function used for all credit lines.
- No `carência` concept in the CreditoRural schema.
- Rate stored as a raw decimal without reference to the equalization source.

**Phase to address:** US-FN14 (Gestão de operações de crédito rural) — this story must explicitly include carência, schedule alignment with crop calendar, and Plano Safra rate sourcing as acceptance criteria.

---

### Pitfall 6: Bank Reconciliation Matching Engine Too Strict

**What goes wrong:**
OFX/CSV bank statements have transaction descriptions that do not match internal payment descriptions. A TED payment description from Banco do Brasil reads "TED 47.000,00 AGRO INSUMOS LTDA 12/03" while the internal AP entry says "Fertilizante NPK — Fazenda Boa Vista — Fev/2026". Exact-string matching produces near-zero auto-match rates. Users abandon the reconciliation tool and mark everything as "manually reconciled" — defeating its purpose.

**Why it happens:**
Developers implement string equality or simple substring matching because fuzzy matching seems complex. Banking statement formats for rural banks include additional fields (like Transferência Credito Rural identifiers) that generic parsers ignore.

**How to avoid:**

- Implement a scored matching engine with weighted criteria: amount exact match (highest weight), date proximity (within 3 business days), amount with partial tolerance (for tax withholdings like FUNRURAL), description fuzzy match (lowest weight).
- Expose a confidence score on each match suggestion (`alto`, `médio`, `baixo`) — the UI in US-FN06 already specifies "pareamento com confiança".
- Learn from user confirmations: when a user confirms a low-confidence match, increase weight for that pattern.
- Handle FUNRURAL: a R$ 100,000 sale may appear as R$ 98,500 in the bank (1.5% FUNRURAL withheld) — the matcher must handle net-vs-gross with a configurable deduction percentage.

**Warning signs:**

- Reconciliation matching implemented as `amount === txAmount && date === txDate`.
- No confidence score persisted on matched pairs.
- FUNRURAL deduction not mentioned in any reconciliation matching code.

**Phase to address:** US-FN06 (Conciliação bancária automática) — the matching algorithm design must be done before implementation, not discovered during QA.

---

### Pitfall 7: Seasonal Cash Flow Makes "Current Balance" Misleading

**What goes wrong:**
A fazenda with R$ 2 million in grain sales in March shows a healthy balance. The system reports "saldo positivo" through October while the producer draws down that balance for year-round operating expenses, input purchases, and loan payments — with the next harvest income not arriving until March again. If the system only shows current balance without 12-month forward projection, the producer cannot see they will be cashflow-negative in August.

**Why it happens:**
Generic cash flow tools show realized + short-term projected (30–90 days). Agricultural cycles demand 12–18 month horizons. Implementing multi-year projections is deprioritized as "advanced analytics."

**How to avoid:**

- US-FN13 must explicitly require a 12-month forward projection horizon, not just 90 days.
- The cash flow projection must consume: pending CP due dates, pending CR expected dates, crédito rural repayment schedules, recurring entries (salaries, arrendamentos), and seasonal income estimates (configurable by crop type).
- Implement harvest income planning: allow the producer to enter expected harvest quantities and price estimates to feed the projection model.
- The "saldo negativo" alert (specified in US-FN13) must fire at future projected dates, not just when the current balance goes negative.

**Warning signs:**

- Cash flow projection endpoint returns only 30 or 90 days of data.
- Projection does not consume crédito rural repayment schedules from US-FN14.
- No concept of recurring entries or harvest income estimates in the data model.

**Phase to address:** US-FN13 (Fluxo de caixa) — define the projection horizon and data sources as hard requirements in the acceptance criteria, not the UI.

---

### Pitfall 8: OFX Parsing Ignoring Encoding and Decimal Format

**What goes wrong:**
OFX files from Brazilian banks use ISO-8859-1 (Latin-1) encoding and represent amounts with comma as decimal separator in some legacy formats (`<TRNAMT>-1.250,00`), while the OFX 1.x spec uses period. Some banks export "SGML OFX" (no XML declaration), others export OFX 2.x (XML). A parser that handles one format silently fails on others.

**Why it happens:**
Most OFX parsing libraries target North American banks (period decimal, UTF-8). Brazilian bank exports are not tested with these libraries.

**How to avoid:**

- Implement OFX parsing with explicit encoding detection (check BOM, `<CHARSET>` header).
- Normalize decimal separator before numeric parsing: strip `.` as thousands separator, replace `,` with `.`.
- Handle both SGML (OFX 1.x) and XML (OFX 2.x) formats in the same parser.
- Test with actual export files from Banco do Brasil, Bradesco, Itaú, Sicoob — collect samples during development.
- Validate parsed transaction count and total against file header `<DTEND>` and `<BALANCE>` fields.

**Warning signs:**

- Using a generic npm OFX library without Brazilian bank testing.
- Amount parsing does not handle the comma-as-decimal case.
- Parser crashes on non-UTF8 input.

**Phase to address:** US-FN06 (Conciliação bancária) — OFX parser is the foundation; build and test it before the matching engine.

---

## Technical Debt Patterns

| Shortcut                                                    | Immediate Benefit         | Long-term Cost                                                            | When Acceptable                                                        |
| ----------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Use native JS `number` for monetary arithmetic              | No extra dependency       | Cent-level errors in CNAB, audit failures, reconciliation mismatches      | Never — use `decimal.js`                                               |
| Single CNAB generator without bank adapters                 | Faster initial build      | Works only for one bank; every new bank is a rewrite                      | Never — the adapter costs one extra interface up front                 |
| Attach financial records to `farmId` only (no `producerId`) | Simpler schema            | Fiscal compliance failure for multi-producer farms; backfill is expensive | Never in Brazilian rural context                                       |
| 90-day cash flow projection                                 | Simpler query             | Useless for seasonal agriculture; defeats the feature's purpose           | Never — 12 months is the minimum viable horizon                        |
| Hard-code Plano Safra rates                                 | Avoids rate management UI | Rates change annually; hardcoded values go stale after 12 months          | Only as seed data with explicit "expires" flag                         |
| Skip cheque as first-class entity                           | Simpler AP model          | Cash flow projection is wrong; saldo displayed is misleading              | Never for Brazilian rural context                                      |
| Exact-match reconciliation                                  | Simple to implement       | Near-zero auto-match rate; users abandon the feature                      | Only as initial MVP if confidence-scored matching ships in next sprint |

---

## Integration Gotchas

| Integration          | Common Mistake                                                                  | Correct Approach                                                                                        |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| CNAB 240 remessa     | Generating the file without verifying against the specific bank's layout manual | Implement bank-adapter pattern; test remessa file against each bank's sandbox before shipping           |
| CNAB 400 retorno     | Failing on unknown or bank-specific optional segments                           | Parse tolerantly; log unknown segments; only fail on mandatory record types                             |
| OFX import           | Using a generic parser without Brazilian bank encoding handling                 | Detect charset from OFX header; normalize decimal separator; test with BB, Bradesco, Itaú, Sicoob files |
| CSV extrato import   | Assuming fixed column layout                                                    | Allow configurable column mapping per bank (bank-specific CSV templates)                                |
| FUNRURAL withholding | Treating sale amount in AP as the net bank credit                               | Store gross AP amount; model FUNRURAL as a deduction on AR; match net in reconciliation with tolerance  |
| Plano Safra rates    | Hard-coding PRONAF/PRONAMP rates in source                                      | Store rates as database records with effective date ranges; update annually from MCR                    |

---

## Performance Traps

| Trap                                                                                 | Symptoms                                                       | Prevention                                                                                                             | When It Breaks             |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Cash flow projection computing all future AP/CR in a single query                    | Slow dashboard load, timeout on farms with 5+ years of history | Paginate projection by month; cache 12-month projection on demand with invalidation on new entries                     | ~500 AP/CR entries         |
| Bank reconciliation loading all unreconciled transactions into memory for matching   | Memory spike on import of 12-month bank statement              | Process matching in batches (100 bank transactions at a time); use database-side fuzzy match for pre-filtering         | ~1,000 bank statement rows |
| Aging report (US-FN10) scanning all AP entries without index on `dueDate` + `status` | Slow aging dashboard                                           | Composite index on `(organizationId, status, dueDate)` from day one                                                    | ~2,000 AP entries          |
| CNAB file generation in synchronous request                                          | HTTP timeout on files with >200 payment records                | Generate CNAB in background job; return a file ID; poll or webhook when ready                                          | >200 payment records       |
| Crédito rural schedule generation computing all future instalments on every GET      | Repeated expensive calculation                                 | Generate and store schedule rows in `CreditoRuralInstalment` table on contract creation; recalculate only on amendment | >10 active contracts       |

---

## Security Mistakes

| Mistake                                                                 | Risk                                                            | Prevention                                                                                                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Financial reports accessible without `FINANCIAL` role check             | Any authenticated user sees all payment data                    | Enforce `UserRole.FINANCIAL` or `ADMIN` on all FN endpoints via existing RBAC middleware                                                                |
| CNAB files stored in a publicly accessible path                         | Bank file with all payment details downloadable by URL guessing | Store generated CNAB files in private S3/filesystem path; serve via signed URL with short expiry                                                        |
| Bank account credentials (agência, conta, convênio) stored in plaintext | Data breach exposes banking relationship details                | Encrypt sensitive banking fields at rest; at minimum, mask in API responses (show only last 4 digits of account)                                        |
| Audit log missing for financial mutations                               | No traceability for fraud investigation or BACEN audit          | Every CP/CR create/update/delete, every baixa, every reconciliation action must emit an audit event with `userId`, `timestamp`, `before/after` snapshot |
| Reconciliation "force match" accessible to all financial users          | Any user can match unrelated transactions                       | Require elevated role (`ADMIN` or specific `FINANCIAL_RECONCILER` permission) for force-match and manual override                                       |

---

## UX Pitfalls

| Pitfall                                                                                        | User Impact                                                                        | Better Approach                                                                                        |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Showing a single "saldo" figure that mixes real and projected balance                          | Producer makes decisions based on wrong available balance                          | Always label: "Saldo bancário real (hoje)" vs "Saldo projetado (data X)"; never merge them             |
| Date fields without Brazilian format (DD/MM/YYYY)                                              | Data entry errors on due dates, especially for pre-dated cheques                   | All date inputs must use DD/MM/YYYY display; store as UTC ISO internally                               |
| Monetary input accepting free text without masking                                             | User types "1500" meaning R$ 1.500,00 but system reads R$ 1500.00                  | Use a money input component with automatic BRL formatting (period as thousands, comma as decimal)      |
| Aging report showing overdue amounts without FUNRURAL context                                  | Manager sees "overdue R$ 200K" but does not know 1.5% is already withheld by buyer | Include FUNRURAL deduction notes on AR entries from commodity sales                                    |
| Crédito rural contract showing next instalment date in calendar months                         | Producer plans harvests in agricultural years, not calendar months                 | Show instalment due dates aligned with crop calendar; highlight harvest months                         |
| CNAB generation burying the file download in a sub-menu                                        | Finance staff cannot find the file to submit to the bank                           | Place "Gerar Remessa CNAB" as a primary action on the bank account detail page, not nested in settings |
| Parcelamento showing equal instalments without flagging the final-instalment rounding residual | User gets confused when last payment is R$ 0.02 different                          | Display rounding residual explicitly: "Última parcela: R$ 1.234,58 (inclui ajuste de R$ 0,02)"         |

---

## "Looks Done But Isn't" Checklist

- [ ] **Parcelamento de CP:** Often missing rounding residual handling on last instalment — verify sum of all instalments equals original amount to the cent.
- [ ] **CNAB remessa:** Often missing bank-specific header fields (convênio, modalidade carteira) — verify file is accepted by the target bank's sandbox, not just syntactically valid.
- [ ] **Conciliação bancária:** Often missing FUNRURAL net-vs-gross tolerance — verify a R$ 100,000 CR matches a R$ 98,500 bank credit when FUNRURAL rate is configured.
- [ ] **Cheques pré-datados:** Often missing state transitions (DEVOLVIDO, CANCELADO) — verify devolution flow decrements the outstanding balance correctly and creates a new open AP.
- [ ] **Crédito rural schedule:** Often missing grace period (carência) — verify that during carência only interest is due, principal balance is unchanged.
- [ ] **Cash flow projection:** Often missing integration with crédito rural instalment schedule — verify a newly created PRONAF contract's instalments appear in the 12-month projection.
- [ ] **Producer isolation:** Often missing producerId filter on financial reports — verify that a MEEIRO's CP entries do not appear in the PROPRIETARIO's financial dashboard.
- [ ] **OFX import:** Often missing encoding detection — verify import of a Banco do Brasil OFX file with accentuated merchant names (ISO-8859-1) does not corrupt descriptions.
- [ ] **CNAB retorno:** Often missing "liquidado pelo banco" vs "devolvido" status mapping — verify that a returned payment (code 04 or 09 depending on bank) correctly marks the CP as open again.
- [ ] **Dashboard consolidado:** Often missing multi-farm aggregation — verify a user with 3 farms sees combined totals when "todas as fazendas" is selected, not just the last active farm.

---

## Recovery Strategies

| Pitfall                                              | Recovery Cost | Recovery Steps                                                                                                                                                              |
| ---------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Float monetary arithmetic found in production        | HIGH          | Audit all financial records for cent-level discrepancies; write migration to recalculate using `decimal.js`; reconcile against bank statements before re-enabling mutations |
| Bank account attached to farmId only (no producerId) | HIGH          | Requires new migration adding nullable `producerId`; backfill by prompting user to assign producer; mark unassigned records as requiring review                             |
| CNAB files rejected by bank after go-live            | MEDIUM        | Switch to manual payment file as interim; implement bank-specific adapter; validate against bank sandbox before re-enabling automated generation                            |
| Cash flow projection 90-day horizon shipped          | MEDIUM        | Extend projection query to 12 months (additive change); add harvest income planning fields in follow-up sprint                                                              |
| OFX encoding corruption                              | LOW           | Re-import files with fixed parser; previously imported corrupted descriptions are correctable via reconciliation manual review                                              |
| Reconciliation exact-match only                      | LOW           | Implement confidence-scored matching as a parallel algorithm; existing exact matches remain valid; deploy without data migration                                            |

---

## Pitfall-to-Phase Mapping

| Pitfall                                | Prevention Phase                              | Verification                                                                                                 |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Float monetary arithmetic              | US-FN07 (first story with payment arithmetic) | Sum of 12 instalments for R$ 99,999.99 equals principal to the cent                                          |
| CNAB layout variance                   | US-FN08 (CNAB remessa/retorno)                | Remessa file accepted by Banco do Brasil sandbox without error                                               |
| Cheques pré-datados balance distortion | US-FN09 (Gestão de cheques)                   | Cash flow projection includes cheques in A_COMPENSAR state at dataPrevista                                   |
| Multi-producer financial isolation     | US-FN01 (Cadastro contas bancárias)           | Financial report for MEEIRO shows only their entries when farmId has multiple producers                      |
| Crédito rural amortization errors      | US-FN14 (Crédito rural)                       | PRONAF Custeio SAC schedule with 6-month carência produces correct schedule verified against BCB MCR example |
| Reconciliation matching too strict     | US-FN06 (Conciliação bancária)                | Auto-match rate >60% on a 3-month real bank statement sample                                                 |
| Seasonal cash flow horizon too short   | US-FN13 (Fluxo de caixa)                      | 12-month projection visible in dashboard; saldo-negativo alert fires at future date                          |
| OFX encoding failure                   | US-FN06 (Conciliação bancária)                | Successful import of ISO-8859-1 OFX file from Banco do Brasil with correct description encoding              |

---

## Sources

- Codebase analysis: `apps/backend/prisma/schema.prisma` (ProducerFarmBond types, RLS architecture)
- Codebase analysis: `apps/backend/src/database/rls.ts` (organizationId isolation model)
- Codebase analysis: `apps/backend/src/modules/stock-entries/stock-entries.service.ts` (existing toNumber/round pattern)
- Project requirements: `.planning/PROJECT.md` (EPIC-FN1 to FN4 acceptance criteria, stated constraints)
- Domain knowledge: FEBRABAN CNAB 240/400 standard layouts (HIGH confidence — widely documented)
- Domain knowledge: BCB Manual de Crédito Rural (MCR) — PRONAF/PRONAMP amortization rules (HIGH confidence)
- Domain knowledge: Plano Safra annual rate equalization mechanism (HIGH confidence)
- Domain knowledge: Brazilian OFX file encoding practices from Banco do Brasil, Bradesco, Itaú (MEDIUM confidence — training data, not verified against current bank documentation)
- Domain knowledge: FUNRURAL contribution rules (Lei 8.212/1991, art. 25) — 1.5% on gross rural revenue withheld by buyer (HIGH confidence)
- Domain knowledge: Cheque pré-datado legal treatment in Brazil — treated as deferred payment instrument, not as immediate cash equivalent (HIGH confidence — established jurisprudence)

---

_Pitfalls research for: Brazilian agricultural financial management module (EPIC-FN1 to FN4)_
_Researched: 2026-03-15_
