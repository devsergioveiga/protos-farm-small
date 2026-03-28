# Project Retrospective

_A living document updated after each milestone. Lessons feed forward into future planning._

## Milestone: v1.0 — Financeiro Base

**Shipped:** 2026-03-17
**Phases:** 6 | **Plans:** 30

### What Was Built

- Contas bancárias com Money type (decimal.js), FEBRABAN, saldo real-time, extrato PDF/Excel
- AP/AR completo: parcelamento, rateio CC, FUNRURAL, CNAB 240/400, aging, alertas, borderô
- Dashboard financeiro consolidado com KPIs, gráficos, comparativo anual
- Instrumentos de pagamento: transferências, cartões corporativos (fatura→CP), cheques (máquina de estados)
- Conciliação bancária: import OFX/CSV, score matching, ações manuais, relatório
- Fluxo de caixa: 12 meses, 3 cenários, classificação DFC, alerta saldo negativo
- Crédito rural: PRONAF/PRONAMP/Funcafé/CPR, amortização SAC/Price/Bullet, carência, simulação

### What Worked

- Phase-based architecture with clear dependency chain (1→2→3, 2→4→5→6) enabled focused execution
- Money factory function in packages/shared reused across all 6 phases without modification
- CnabAdapter pattern (per bank) proved extensible and maintainable
- Human-verify gates caught integration issues early (backend array response format, saldo projetado placeholder)
- Pre-building sidebar entries and lazy routes in earlier phases reduced final integration plans to quick wiring
- Installment generator + cost center rateio validator in shared — reused in CP, CR, credit cards, rural credit

### What Was Inefficient

- STATE.md accumulated 60+ decisions and became stale (position, progress never auto-updated correctly)
- Phase 5 ROADMAP.md showed "5/6 plans" even after 6/6 complete — manual roadmap checkbox updates are unreliable
- Shadow database migration issues recurred in Phase 1 and Phase 6 — had to use psql + migrate resolve each time
- Nyquist validation never updated to compliant in any phase (all 6 partial) — either automate or drop

### Patterns Established

- Route ordering: static routes (/dashboard, /alert-count) always registered before /:id params
- Settlement operations: CP settlement = BankAccountBalance DECREMENT, CR = INCREMENT (symmetric)
- Inline confirmation for low-risk destructive actions (table row expansion) vs full modal for high-risk
- Financial permissions: financial:\* for most, reconciliation:manage as separate dedicated permission
- React.lazy + Suspense for heavy chart components hidden on mobile
- URL query params for deep-linking into filtered/selected states (e.g., ?importId=xxx)

### Key Lessons

1. Money type must exist before any financial data is written — retrofitting is an audit nightmare
2. OFX parser: custom SGML regex is more reliable than npm libraries for Brazilian bank formats
3. 12-month cashflow horizon is non-negotiable for agriculture — sazonalidade makes 90 days useless
4. Cheques as first-class entities (not payment metadata) enables proper accounting balance tracking
5. Floor-division (not ROUND_HALF_UP) for installment splitting — residual always on first installment

### Cost Observations

- 30 plans completed in ~5.3 hours of execution time
- Average 10.7 min/plan
- Frontend plans took longer (15-35min) vs backend (3-15min)
- Balanced model profile used throughout

---

## Milestone: v1.4 — Contabilidade e Demonstrações Financeiras

**Shipped:** 2026-03-28
**Phases:** 7 | **Plans:** 25

### What Was Built

- Plano de contas hierárquico rural (5 níveis, 115 contas CFC/Embrapa) com mapeamento SPED L300R
- Motor de lançamentos manuais com partidas dobradas, estorno auditável e wizard de saldo de abertura
- Auto-posting engine com 12 source types e idempotência via UNIQUE constraint
- Fechamento mensal com checklist de 6 etapas e conciliação bancária contábil
- DRE rural com CPC 29, análise V/H, filtro por centro de custo
- Balanço Patrimonial com indicadores e validação cruzada 4 invariantes
- DFC direto e indireto com reconciliação DFC↔BP
- Dashboard contábil executivo com resultado acumulado e alertas
- SPED ECD (blocos 0/I/J/9, L300R) com pré-validação PVA
- Relatório integrado PDF profissional para crédito rural

### What Worked

- Pure calculator pattern (no Prisma imports) for DRE/BP/DFC — testable without DB, follows payroll-calculation precedent
- Auto-posting hooks non-blocking (try/catch outside main tx) — GL failures never block business operations
- Reusing v1.0 cashflow classification for DFC direto — zero new data modeling
- AccountBalance cache table avoids recalculating from journal entries every time
- Phase dependency chain (35→36→37→38→39→40→41) kept each phase focused and self-contained

### What Was Inefficient

- SUMMARY.md one-liner extraction from gsd-tools was unreliable — many returned "One-liner:" or file paths instead of actual summaries
- Some phases had to discover schema field names at runtime (nature vs accountNature, debitTotal vs debitBalance)
- v1.3 accounting stubs (Phase 32) needed replacement rather than extension — partial work creates ambiguity

### Patterns Established

- Pure calculator + service wrapper pattern: calculator is a pure function, service fetches data and calls calculator
- Cross-validation invariants return PASSED/FAILED/PENDING — PENDING does not fail the overall check
- Hidden attribute (not conditional render) for tab switching — preserves panel state
- SpedEcdWriter as pure class with typed Block records — extensible for future SPED layouts

### Key Lessons

1. Pure calculators without DB dependencies are worth the extra indirection — testing is 10x faster
2. Cross-validation between financial statements catches real bugs in data aggregation
3. SPED ECD format is highly specific (pipe-delimited, CRLF, UTF-8) — a dedicated writer class is justified
4. Monthly closing checklist that queries real modules (not just checkboxes) catches actual missing data

### Cost Observations

- 25 plans completed in ~2 days
- 158 commits, 170 files changed
- 30/30 requirements delivered
- Balanced model profile used throughout

---

## Cross-Milestone Trends

| Metric               | v1.0    | v1.4    |
| -------------------- | ------- | ------- |
| Phases               | 6       | 7       |
| Plans                | 30      | 25      |
| Files changed        | 236     | 170     |
| Lines added          | ~71,600 | ~40,600 |
| Tech debt items      | 6       | 0       |
| Requirements covered | 15/15   | 30/30   |
