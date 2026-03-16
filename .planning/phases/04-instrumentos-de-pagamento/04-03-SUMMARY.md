---
phase: 04-instrumentos-de-pagamento
plan: '03'
subsystem: payments
tags: [credit-cards, billing, installments, payables, prisma, express, jest]

requires:
  - phase: 04-instrumentos-de-pagamento
    provides: PayableCategory.CARTAO_CREDITO enum, createPayable() function, withRlsContext pattern, BankAccount model

provides:
  - CreditCard CRUD with closingDay/dueDay 1-28 validation
  - CreditCardExpense installment splitting across billing periods
  - CreditCardBill lazy creation per billing period with getBillPeriod helper
  - closeBill() auto-generates Payable with category CARTAO_CREDITO via createPayable()
  - getOpenBillsCount() for sidebar badge
  - 9 REST endpoints under /api/org/credit-cards
  - 23 passing Jest tests

affects:
  - 04-04 (checks module — shares financial module pattern)
  - frontend credit-cards page (consumes these endpoints)

tech-stack:
  added: []
  patterns:
    - Lazy bill creation via getOrCreateBill helper — creates CreditCardBill on first expense assignment
    - Floor-division installment splitting — baseAmount = floor(total * 100 / n) / 100, residual on first installment
    - Route ordering — /open-bills-count and /bills/:billId/close registered before /:id to avoid Express param capture
    - closeBill calls createPayable() directly (not via HTTP) — reuses existing CP creation logic atomically

key-files:
  created:
    - apps/backend/src/modules/credit-cards/credit-cards.types.ts
    - apps/backend/src/modules/credit-cards/credit-cards.service.ts
    - apps/backend/src/modules/credit-cards/credit-cards.routes.ts
    - apps/backend/src/modules/credit-cards/credit-cards.routes.spec.ts
  modified:
    - apps/backend/src/app.ts

key-decisions:
  - 'Floor-division for installment splitting (not Money.divide with ROUND_HALF_UP) — avoids residual accumulation when splitting odd amounts across many installments; residual goes to first installment'
  - 'closeBill calls createPayable() function directly (not HTTP) — preserves atomicity and avoids double-RLS wrapping'
  - "Route /open-bills-count and /bills/:billId/close registered before /:id — Express greedy param matching would capture 'open-bills-count' and 'bills' as :id values"

patterns-established:
  - 'Pattern: CreditCardBill lazy creation — getOrCreateBill creates bills only when first expense is added, avoiding empty bill accumulation'
  - 'Pattern: getBillPeriod(closingDay, dueDay, referenceDate) — pure function for billing cycle calculation, testable in isolation'

requirements-completed: [FN-02, FN-05]

duration: 12min
completed: '2026-03-16'
---

# Phase 4 Plan 03: Credit Cards Backend Module Summary

**Corporate credit card management with installment splitting across billing periods and automatic CP generation on bill closure via existing createPayable()**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-16T23:13:41Z
- **Completed:** 2026-03-16T23:24:17Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Complete credit card CRUD (create, list, get, update, soft-delete) with closingDay/dueDay 1-28 validation
- Expense registration with automatic installment splitting — R$1200 in 3x creates 3 CreditCardExpense records of R$400 in consecutive billing periods, each lazy-creating its bill
- Bill closure generates CP with category CARTAO_CREDITO via createPayable(), with 422 guard for empty or already-closed bills
- 23 Jest tests covering all CRUD, validation edge cases, installment splitting, and bill closure scenarios

## Task Commits

1. **Task 1: Credit cards types + service** - `01346ce` (feat)
2. **Task 2: Credit cards routes + app registration + tests** - `5b9ab56` (feat)

## Files Created/Modified

- `apps/backend/src/modules/credit-cards/credit-cards.types.ts` - CreditCardError, CreateCreditCardInput, AddExpenseInput, CreditCardOutput, BillOutput, ExpenseOutput interfaces
- `apps/backend/src/modules/credit-cards/credit-cards.service.ts` - createCreditCard, listCreditCards, getCreditCard, updateCreditCard, deleteCreditCard, addExpense, listBills, closeBill, getOpenBillsCount, getBillPeriod, getOrCreateBill
- `apps/backend/src/modules/credit-cards/credit-cards.routes.ts` - creditCardsRouter with 9 endpoints, route ordering for /open-bills-count and /bills/:billId/close
- `apps/backend/src/modules/credit-cards/credit-cards.routes.spec.ts` - 23 tests
- `apps/backend/src/app.ts` - creditCardsRouter registration after checksRouter

## Decisions Made

- Floor-division for installment splitting: `Math.floor(amount * 100 / n) / 100` avoids ROUND_HALF_UP accumulation across many installments. Residual (always < 1 cent per installment) assigned to first installment.
- `closeBill` calls `createPayable()` as a function (not via HTTP). This keeps the operation in the same RLS context and avoids creating a nested withRlsContext transaction.
- Route order matters: `/open-bills-count` and `/bills/:billId/close` must be registered before `/:id` in Express; otherwise Express would capture the literal strings as the `:id` param value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Money.divide call signature**

- **Found during:** Task 1 (service compilation)
- **Issue:** Plan specified `Money(amount).divide(n, Money.ROUND_DOWN)` but the Money interface only accepts one argument; `ROUND_DOWN` is not a property of MoneyFactory
- **Fix:** Replaced with floor-division arithmetic: `Math.floor(amount * 100 / n) / 100`, residual computed as `totalMoney.subtract(baseAmount.multiply(n))`
- **Files modified:** apps/backend/src/modules/credit-cards/credit-cards.service.ts
- **Verification:** TypeScript compilation passes, installment math verified in tests
- **Committed in:** 01346ce (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix required for correct compilation. Floor-division achieves same intent as ROUND_DOWN described in plan.

## Issues Encountered

- Pre-existing ESLint error in `TransfersPage.tsx` caused hook failure on first commit attempt. Resolved by ensuring only the new files were staged (lint-staged only checks staged files).

## Next Phase Readiness

- Credit cards module fully operational; endpoints ready for frontend CreditCardsPage (plan 04-04 or later)
- closeBill() integration with payables tested — CP creation verified via category CARTAO_CREDITO assertion
- getOpenBillsCount() available for financial dashboard sidebar badge

---

_Phase: 04-instrumentos-de-pagamento_
_Completed: 2026-03-16_
