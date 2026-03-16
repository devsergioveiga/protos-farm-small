---
phase: 04-instrumentos-de-pagamento
plan: 04
subsystem: frontend/credit-cards
tags: [credit-cards, billing, frontend, react, hooks, modals]
depends_on:
  requires: [04-03]
  provides:
    [CreditCardsPage, useCreditCards, CreditCardModal, CreditCardExpenseModal, CloseBillModal]
  affects: [App.tsx, Sidebar.tsx]
tech_stack:
  added: []
  patterns:
    [two-panel-layout, bill-tabs, installment-preview, usage-bar, typing-confirmation-delete]
key_files:
  created:
    - apps/frontend/src/hooks/useCreditCards.ts
    - apps/frontend/src/components/credit-cards/CreditCardModal.tsx
    - apps/frontend/src/components/credit-cards/CreditCardModal.css
    - apps/frontend/src/components/credit-cards/CreditCardExpenseModal.tsx
    - apps/frontend/src/components/credit-cards/CreditCardExpenseModal.css
    - apps/frontend/src/components/credit-cards/CloseBillModal.tsx
    - apps/frontend/src/components/credit-cards/CloseBillModal.css
    - apps/frontend/src/pages/CreditCardsPage.tsx
    - apps/frontend/src/pages/CreditCardsPage.css
  modified:
    - apps/frontend/src/App.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
decisions:
  - useCreditCards fetchCard uses Promise.all to fetch card + bills in parallel — single loading state for both
  - CreditCardExpenseModal receives onSuccess as async callback (not cardId directly) — page handles API call and refetch
  - CloseBillModal receives bill and isSubmitting as props — page owns close-bill loading state
  - Delete confirmation uses typed card name pattern — proportional to risk (destructive + irreversible)
  - Bill tabs limited to 3 (current + last 2) — per UI spec, reduces cognitive load
metrics:
  duration: 9min
  completed_date: '2026-03-16'
  tasks_completed: 2
  files_changed: 11
---

# Phase 04 Plan 04: Credit Cards Frontend Summary

Credit cards frontend complete: two-panel page with card list + bill detail tabs, CRUD modal with all required fields and validation, expense modal with installment preview, bill closure confirmation modal, useCreditCards hook, sidebar entry, and route registration.

## Tasks Completed

| Task | Description                                                                     | Commit  | Status |
| ---- | ------------------------------------------------------------------------------- | ------- | ------ |
| 1    | useCreditCards hook + CreditCardModal + CreditCardExpenseModal + CloseBillModal | a31d71e | Done   |
| 2    | CreditCardsPage + CreditCardsPage.css + App.tsx + Sidebar.tsx                   | d079994 | Done   |

## What Was Built

### useCreditCards hook

- Full CRUD: `fetchCards`, `createCard`, `updateCard`, `deleteCard`
- Detail loading: `fetchCard(id)` — calls GET /org/credit-cards/:id and GET /org/credit-cards/:id/bills in parallel
- Expense: `addExpense(cardId, input)` — POST /org/credit-cards/:cardId/expenses
- Bill management: `fetchBills(cardId)`, `closeBill(billId)` — POST /org/credit-cards/bills/:billId/close
- Full type exports: `CreditCardOutput`, `BillOutput`, `ExpenseOutput`, `CreateCreditCardInput`, `AddExpenseInput`

### CreditCardModal

- Fields: name (max 60), brand select (6 options), lastFourDigits (optional, 4 numeric), creditLimit (currency), closingDay (1-28), dueDay (1-28), debitAccountId (bank accounts select), farmId (farms select), holder (max 80), notes
- Validation: inline onBlur per field, required markers, error messages with icons
- Edit mode: loads existing card via GET /org/credit-cards/:id on open
- Accessibility: role=dialog, aria-modal, aria-labelledby, aria-required, role=alert errors, Escape closes

### CreditCardExpenseModal

- Fields: description (max 200), amount (currency), totalInstallments (1-24), expenseDate (max today), category (free text), notes
- Installment preview: shows `formatBRL(total/n)` when totalInstallments > 1 and amount > 0
- Accessibility: role=dialog, aria-modal, aria-labelledby, aria-required, Escape closes

### CloseBillModal

- Period summary: periodStart → periodEnd, expense count, dueDate
- Total amount in large JetBrains Mono (1.75rem)
- Warning: "Após fechar, não é possível adicionar gastos a esta fatura."
- Disabled state: button disabled + role=alert message when expenses.length === 0
- Confirm button label: "Fechar fatura e gerar CP de R$ X,XX"

### CreditCardsPage

- Two-panel layout: 280px card list + flexible detail panel (grid)
- Responsive: horizontal scroll accordion on tablet (<1024px), stacked on mobile (<640px)
- Card list: brand, lastFourDigits, limit (mono font), closingDay/dueDay, usage bar (bill.totalAmount/creditLimit %), ABERTA badge
- Bill tabs: up to 3 tabs (current + last 2), tab label "Fatura atual" / "Fatura {Mon}/{Year}"
- Bill detail: period dates, expenses table (Data/Descrição/Parcela n de N/Valor), total footer, OPEN actions (Novo Gasto + Fechar Fatura), CLOSED badge + CP link
- Empty state: CreditCard icon (56px) + "Nenhum cartão cadastrado" + description + CTA
- Delete: typing confirmation dialog (type card name to enable button)
- Auto-selects first card on load
- Sidebar: CreditCard icon imported from lucide-react, item `{ to: '/credit-cards', icon: CreditCard, label: 'Cartões' }` added after Transferências

## Deviations from Plan

None — plan executed exactly as written.

## Verification

TypeScript compilation: PASS (0 errors)
All acceptance criteria: PASS

## Self-Check: PASSED

All created files exist on disk. Both commits (a31d71e, d079994) found in git log. TypeScript: 0 errors.
