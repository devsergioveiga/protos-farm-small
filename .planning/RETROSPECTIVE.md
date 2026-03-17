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

## Cross-Milestone Trends

| Metric               | v1.0    |
| -------------------- | ------- |
| Phases               | 6       |
| Plans                | 30      |
| Avg plan duration    | 10.7min |
| Files changed        | 236     |
| Lines added          | ~71,600 |
| Tech debt items      | 6       |
| Requirements covered | 15/15   |
