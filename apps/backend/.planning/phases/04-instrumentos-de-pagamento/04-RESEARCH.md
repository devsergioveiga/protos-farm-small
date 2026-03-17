# Phase 4: Instrumentos de Pagamento - Research

**Researched:** 2026-03-16
**Domain:** Finanças — Transferências, Cartões Corporativos, Cheques Pré-datados
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Transferências entre contas

- Tarifa como **campo opcional** na transferência — se preenchida, gera transação extra de débito na conta origem
- Tipo de transferência: enum (INTERNA, TED, APLICACAO, RESGATE) — aplicação/resgate são transferências entre conta corrente e conta investimento
- Transferência é entre **contas bancárias**, não entre fazendas — fazenda vem indiretamente da conta
- Visualização: **página dedicada** `/transfers` com histórico + aparece nos extratos das duas contas (ENTRADA na destino, SAÍDA na origem)

#### Cartão corporativo e fatura

- Despesas parceladas: **registros separados** — despesa de R$1200 em 3x gera 3 registros de R$400, cada um na fatura do mês correspondente
- Fechamento de fatura: **manual com botão** — gerente clica "Fechar fatura" para gerar CP vinculado ao cartão. Permite revisar antes
- Rota e sidebar: item **"Cartões"** no grupo FINANCEIRO, rota `/credit-cards`
- CP gerado pelo fechamento de fatura usa categoria própria **CARTAO_CREDITO** — facilita filtro e relatórios
- Cadastro do cartão: bandeira, limite, dia de fechamento, dia de vencimento, conta de débito vinculada, portador

#### Cheques pré-datados

- **Mesma entidade** com tipo: EMITIDO | RECEBIDO — máquina de estados compartilhada
- Estados: EMITIDO → A_COMPENSAR → COMPENSADO / DEVOLVIDO / CANCELADO
- Saldo real **só muda na compensação** — saldo contábil muda na emissão/recebimento
- Folha de cheques: **campo simples de número** (string livre, sem controle de sequência)
- Alertas: **badge no sidebar** + lista na página de cheques (mesmo padrão dos alertas de CP vencido)
- Rota: `/checks` no grupo FINANCEIRO

#### Dashboard e saldo contábil

- KPI card "Saldo Total" mostra **saldo real (destaque) + saldo contábil abaixo** em cinza com label explícito. Tooltip explica diferença
- Fórmula: **saldo contábil = saldo real - cheques A_COMPENSAR emitidos + cheques A_COMPENSAR recebidos**
- Alertas expandidos: adicionar alertas de **fatura aberta** e **cheques próximos de compensar** no painel de alertas existente do dashboard

### Claude's Discretion

- Design exato da página de transferências (tabela, cards, filtros)
- Layout da página de cartões (lista de cartões + detalhamento de fatura)
- Design da página de cheques (lista com badges de status, filtros)
- Implementação do cálculo de saldo contábil no backend (novo campo ou computed)
- Responsividade das novas páginas em mobile

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID    | Description                                                                                                                                                                            | Research Support                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| FN-04 | Gerente pode registrar transferências entre contas (espelhada), incluindo tarifa, aplicação/resgate de investimento e transferências entre fazendas                                    | Padrão de dupla FinancialTransaction + BankAccountBalance.decrement/increment em única transação Prisma           |
| FN-02 | Gerente pode cadastrar cartões de crédito corporativos com bandeira, limite, dia de fechamento/vencimento, conta de débito vinculada e portador                                        | Novo modelo CreditCard + CreditCardExpense + CreditCardBill; fechamento gera Payable com categoria CARTAO_CREDITO |
| FN-05 | Gerente pode registrar despesas no cartão (com parcelas), visualizar fatura por período de fechamento, e fechamento gera CP automaticamente com pagamento debitando da conta vinculada | Fatura agrupa despesas por período de fechamento; CP criado via createPayable() existente                         |
| FN-09 | Gerente pode controlar cheques emitidos e recebidos com datas de emissão/entrega/compensação, status do cheque, saldo contábil vs bancário, alertas de compensação e folha de cheques  | Novo modelo Check com máquina de estados; saldo contábil como campo computed no endpoint do dashboard             |

</phase_requirements>

---

## Summary

Esta fase adiciona três instrumentos financeiros que o sistema ainda não modela: transferências entre contas, cartões corporativos com controle de fatura, e cheques pré-datados. Todos os três têm dependência na infraestrutura já implementada nas fases 1-3 — especialmente o padrão `BankAccountBalance` + `FinancialTransaction` + `withRlsContext`.

A principal complexidade técnica está na **dupla escrituração** de transferências (débito na origem + crédito no destino em uma única transação Prisma), na **máquina de estados de cheques** (com distinção entre saldo real e contábil), e no **cálculo de fatura de cartão** (agrupamento de despesas por período de fechamento). O padrão de CP gerado automaticamente pelo fechamento de fatura reutiliza `createPayable()` — isso é intencional e evita duplicação de lógica.

O dashboard precisa de uma atualização cirúrgica: o endpoint existente em `financial-dashboard.service.ts` recebe novos campos (`accountingBalance`, `openBillsCount`, `checksNearCompensation`) sem quebrar o contrato anterior. A categoria `CARTAO_CREDITO` precisa ser adicionada ao enum `PayableCategory` no schema Prisma — o único enum migration de toda a fase.

**Primary recommendation:** Implementar os três módulos sequencialmente (transferências → cartões → cheques) pois cheques dependem do saldo contábil calculado após transferências estarem no sistema. O dashboard é atualizado na última etapa após todos os modelos existirem.

---

## Standard Stack

### Core

| Library                     | Version      | Purpose                                 | Why Standard                                               |
| --------------------------- | ------------ | --------------------------------------- | ---------------------------------------------------------- |
| Prisma 7                    | ~7.x         | ORM + migrations                        | Já instalado, padrão do projeto                            |
| Express 5                   | ~5.x         | API routes                              | Padrão do projeto                                          |
| `@protos-farm/shared` Money | local        | Aritmética monetária sem floating-point | Invariante do projeto — nunca usar JS number para dinheiro |
| `withRlsContext`            | local        | RLS por organização                     | Obrigatório em todas as queries financeiras                |
| React 19 + Vite             | ~19/~6       | Frontend                                | Padrão do projeto                                          |
| Lucide React                | latest       | Ícones                                  | `CreditCard`, `ArrowLeftRight`, `CheckSquare` disponíveis  |
| Recharts                    | já instalado | Gráficos dashboard                      | Já em uso no FinancialDashboardPage                        |

### Supporting

| Library                       | Version    | Purpose                       | When to Use                                    |
| ----------------------------- | ---------- | ----------------------------- | ---------------------------------------------- |
| `decimal.js` (via Money)      | via shared | Decimal math                  | Sempre que manipular valores monetários        |
| `date-fns` / UTC Date methods | nativo     | Cálculo de períodos de fatura | Período: dia X do mês N-1 até dia X-1 do mês N |

### Alternatives Considered

| Instead of                          | Could Use                                   | Tradeoff                                                                                                                                     |
| ----------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Computed saldo contábil no endpoint | Campo persistido no BankAccountBalance      | Computed é mais simples (sem migration adicional), mas ligeiramente mais lento. Para o volume esperado, computed é suficiente e preferível   |
| Fatura como entidade separada       | Simples agrupamento de despesas por período | Entidade separada (CreditCardBill) permite rastrear status (ABERTA/FECHADA) e ligar ao CP gerado — necessário para os critérios de aceitação |

**Installation:** Nenhum novo pacote necessário — tudo reutiliza stack existente.

---

## Architecture Patterns

### Recommended Module Structure

```
apps/backend/src/modules/
  transfers/
    transfers.routes.ts
    transfers.service.ts
    transfers.types.ts
    transfers.routes.spec.ts
  credit-cards/
    credit-cards.routes.ts
    credit-cards.service.ts
    credit-cards.types.ts
    credit-cards.routes.spec.ts
  checks/
    checks.routes.ts
    checks.service.ts
    checks.types.ts
    checks.routes.spec.ts

apps/frontend/src/
  pages/
    TransfersPage.tsx + .css
    CreditCardsPage.tsx + .css
    ChecksPage.tsx + .css
  components/
    transfers/TransferModal.tsx + .css
    credit-cards/CreditCardModal.tsx + .css
    credit-cards/CreditCardExpenseModal.tsx + .css
    credit-cards/CloseBillModal.tsx + .css
    checks/CheckModal.tsx + .css
    checks/CompensateCheckModal.tsx + .css
  hooks/
    useTransfers.ts
    useCreditCards.ts
    useChecks.ts
    useCheckAlertCount.ts
```

### Prisma Schema — Novos Modelos

```prisma
// Adicionar ao enum PayableCategory:
enum PayableCategory {
  // ... existentes ...
  CARTAO_CREDITO   // novo
}

enum TransferType {
  INTERNA
  TED
  APLICACAO
  RESGATE
}

model AccountTransfer {
  id                String       @id @default(uuid())
  organizationId    String
  fromAccountId     String
  toAccountId       String
  type              TransferType
  amount            Decimal      @db.Decimal(15, 2)
  feeAmount         Decimal?     @db.Decimal(15, 2)
  description       String
  transferDate      DateTime
  notes             String?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  organization  Organization @relation(...)
  fromAccount   BankAccount  @relation("TransferFrom", ...)
  toAccount     BankAccount  @relation("TransferTo", ...)

  @@index([organizationId, transferDate])
  @@map("account_transfers")
}

enum CardBrand {
  VISA
  MASTERCARD
  ELO
  AMEX
  HIPERCARD
  OTHER
}

enum BillStatus {
  OPEN
  CLOSED
}

model CreditCard {
  id               String    @id @default(uuid())
  organizationId   String
  name             String
  brand            CardBrand
  lastFourDigits   String?
  creditLimit      Decimal   @db.Decimal(15, 2)
  closingDay       Int       // 1-28
  dueDay           Int       // 1-28
  debitAccountId   String    // conta de débito vinculada
  holder           String    // portador
  isActive         Boolean   @default(true)
  notes            String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  organization   Organization         @relation(...)
  debitAccount   BankAccount          @relation(...)
  expenses       CreditCardExpense[]
  bills          CreditCardBill[]

  @@index([organizationId])
  @@map("credit_cards")
}

model CreditCardBill {
  id           String     @id @default(uuid())
  creditCardId String
  organizationId String
  periodStart  DateTime
  periodEnd    DateTime
  dueDate      DateTime
  totalAmount  Decimal    @db.Decimal(15, 2)
  status       BillStatus @default(OPEN)
  payableId    String?    // CP gerado ao fechar
  closedAt     DateTime?
  createdAt    DateTime   @default(now())

  creditCard CreditCard         @relation(...)
  expenses   CreditCardExpense[]
  payable    Payable?           @relation(...)

  @@index([creditCardId, periodStart])
  @@map("credit_card_bills")
}

model CreditCardExpense {
  id             String   @id @default(uuid())
  organizationId String
  creditCardId   String
  billId         String?  // null até fatura ser criada/fechada
  description    String
  amount         Decimal  @db.Decimal(15, 2)
  expenseDate    DateTime
  installmentNumber Int   @default(1)
  totalInstallments Int   @default(1)
  category       String?
  notes          String?
  createdAt      DateTime @default(now())

  creditCard CreditCard     @relation(...)
  bill       CreditCardBill? @relation(...)

  @@index([creditCardId, expenseDate])
  @@map("credit_card_expenses")
}

enum CheckType {
  EMITIDO
  RECEBIDO
}

enum CheckStatus {
  EMITIDO
  A_COMPENSAR
  COMPENSADO
  DEVOLVIDO
  CANCELADO
}

model Check {
  id              String      @id @default(uuid())
  organizationId  String
  type            CheckType
  status          CheckStatus @default(EMITIDO)
  checkNumber     String      // string livre
  amount          Decimal     @db.Decimal(15, 2)
  bankAccountId   String      // conta vinculada
  issueDate       DateTime
  deliveryDate    DateTime?
  compensationDate DateTime?
  payeeName       String      // beneficiário (EMITIDO) ou emitente (RECEBIDO)
  description     String?
  notes           String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  organization Organization @relation(...)
  bankAccount  BankAccount  @relation(...)

  @@index([organizationId, status])
  @@index([organizationId, compensationDate])
  @@map("checks")
}
```

### Pattern 1: Transferência com Dupla FinancialTransaction

**What:** Uma operação gera duas FinancialTransactions (DEBIT na origem, CREDIT no destino) e atualiza dois BankAccountBalances — tudo dentro de uma única transação Prisma. Se tarifa informada, gera terceira FinancialTransaction (DEBIT na origem).

**When to use:** `createTransfer()` service function.

**Example:**

```typescript
// Source: pattern existente em bank-accounts.service.ts (createBankAccount balance update)
export async function createTransfer(ctx: RlsContext, input: CreateTransferInput) {
  return withRlsContext(ctx, async (tx) => {
    const transferAmount = Money(input.amount);
    const feeAmount = input.feeAmount ? Money(input.feeAmount) : null;

    // Verificar que ambas as contas existem e pertencem à organização
    const [fromAccount, toAccount] = await Promise.all([
      (tx as any).bankAccount.findFirst({
        where: { id: input.fromAccountId, organizationId: ctx.organizationId, isActive: true }
      }),
      (tx as any).bankAccount.findFirst({
        where: { id: input.toAccountId, organizationId: ctx.organizationId, isActive: true }
      }),
    ]);
    if (!fromAccount || !toAccount) throw new TransferError('Conta não encontrada', 404);

    // Criar registro da transferência
    const transfer = await (tx as any).accountTransfer.create({ data: { ... } });

    // Lançamentos espelhados
    await (tx as any).financialTransaction.createMany({
      data: [
        {
          organizationId: ctx.organizationId,
          bankAccountId: input.fromAccountId,
          type: 'DEBIT',
          amount: transferAmount.toDecimal(),
          description: `Transferência para ${toAccount.name}`,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          transactionDate: new Date(input.transferDate),
        },
        {
          organizationId: ctx.organizationId,
          bankAccountId: input.toAccountId,
          type: 'CREDIT',
          amount: transferAmount.toDecimal(),
          description: `Transferência de ${fromAccount.name}`,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          transactionDate: new Date(input.transferDate),
        },
      ],
    });

    // Atualizar saldos atomicamente
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId: input.fromAccountId },
      data: { currentBalance: { decrement: transferAmount.toDecimal() } },
    });
    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId: input.toAccountId },
      data: { currentBalance: { increment: transferAmount.toDecimal() } },
    });

    // Tarifa (opcional): DEBIT adicional na conta origem
    if (feeAmount && !feeAmount.isZero()) {
      await (tx as any).financialTransaction.create({
        data: {
          organizationId: ctx.organizationId,
          bankAccountId: input.fromAccountId,
          type: 'DEBIT',
          amount: feeAmount.toDecimal(),
          description: 'Tarifa de transferência',
          referenceType: 'TRANSFER_FEE',
          referenceId: transfer.id,
          transactionDate: new Date(input.transferDate),
        },
      });
      await (tx as any).bankAccountBalance.update({
        where: { bankAccountId: input.fromAccountId },
        data: { currentBalance: { decrement: feeAmount.toDecimal() } },
      });
    }

    return transfer;
  });
}
```

### Pattern 2: Fechamento de Fatura de Cartão

**What:** Agrupa despesas do período, calcula total, gera CP via `createPayable()` existente com `category: 'CARTAO_CREDITO'`, marca fatura como CLOSED e vincula ao payableId.

**When to use:** `closeBill(ctx, billId)` service function.

**Example:**

```typescript
// Source: padrão de createPayable em payables.service.ts
export async function closeBill(ctx: RlsContext, billId: string) {
  return withRlsContext(ctx, async (tx) => {
    const bill = await (tx as any).creditCardBill.findFirst({
      where: { id: billId, organizationId: ctx.organizationId, status: 'OPEN' },
      include: { creditCard: true, expenses: true },
    });
    if (!bill) throw new CreditCardError('Fatura não encontrada ou já fechada', 404);

    const total = bill.expenses.reduce(
      (acc: any, e: any) => acc.add(Money.fromPrismaDecimal(e.amount)),
      Money(0),
    );

    // Gera CP usando a função existente (mesma lógica de parcela, centro de custo, etc.)
    // CP tem farmId da conta de débito, supplierName = nome do cartão
    const payable = await createPayable(ctx, {
      farmId: bill.creditCard.farmId, // derivar da conta de débito
      supplierName: bill.creditCard.name,
      category: 'CARTAO_CREDITO',
      description: `Fatura ${bill.creditCard.name} — venc. ${formatDate(bill.dueDate)}`,
      totalAmount: total.toNumber(),
      dueDate: bill.dueDate.toISOString(),
      bankAccountId: bill.creditCard.debitAccountId,
      installmentCount: 1,
      costCenterItems: [], // simplificado, sem rateio obrigatório
    });

    // Fechar fatura
    await (tx as any).creditCardBill.update({
      where: { id: billId },
      data: { status: 'CLOSED', payableId: payable.id, closedAt: new Date() },
    });

    return payable;
  });
}
```

### Pattern 3: Máquina de Estados de Cheque

**What:** Cheque tem estados bem definidos com transições válidas. Saldo bancário real só é atualizado na transição para COMPENSADO. Saldo contábil é calculado no dashboard (não persistido).

**Transições válidas:**

```
EMITIDO → A_COMPENSAR     (ao registrar entrega / confirmação)
A_COMPENSAR → COMPENSADO  (compensação: atualiza BankAccountBalance)
A_COMPENSAR → DEVOLVIDO   (banco devolveu: gera alerta, volta para A_COMPENSAR possível)
EMITIDO/A_COMPENSAR → CANCELADO
DEVOLVIDO → A_COMPENSAR   (re-apresentação)
```

**Compensação atualiza saldo real:**

```typescript
// Cheque EMITIDO: DEBIT (reduz saldo ao compensar)
// Cheque RECEBIDO: CREDIT (aumenta saldo ao compensar)
async function compensateCheck(ctx: RlsContext, checkId: string) {
  return withRlsContext(ctx, async (tx) => {
    const check = await (tx as any).check.findFirst({
      where: { id: checkId, organizationId: ctx.organizationId },
    });
    if (check.status !== 'A_COMPENSAR') throw new CheckError('Cheque não está A_COMPENSAR', 422);

    const amount = Money.fromPrismaDecimal(check.amount);
    const transactionType = check.type === 'EMITIDO' ? 'DEBIT' : 'CREDIT';
    const balanceOp = check.type === 'EMITIDO' ? 'decrement' : 'increment';

    await (tx as any).financialTransaction.create({
      data: {
        organizationId: ctx.organizationId,
        bankAccountId: check.bankAccountId,
        type: transactionType,
        amount: amount.toDecimal(),
        description: `Compensação cheque ${check.checkNumber}`,
        referenceType: 'CHECK_COMPENSATION',
        referenceId: check.id,
        transactionDate: new Date(),
      },
    });

    await (tx as any).bankAccountBalance.update({
      where: { bankAccountId: check.bankAccountId },
      data: { currentBalance: { [balanceOp]: amount.toDecimal() } },
    });

    await (tx as any).check.update({
      where: { id: checkId },
      data: { status: 'COMPENSADO', compensationDate: new Date() },
    });
  });
}
```

### Pattern 4: Saldo Contábil no Dashboard

**What:** Campo computado no endpoint do financial dashboard. Não persistido.

**Formula:** `accountingBalance = realBalance - sum(A_COMPENSAR EMITIDO amount) + sum(A_COMPENSAR RECEBIDO amount)`

```typescript
// Adicionar ao getFinancialDashboard após totalBankBalance calculation
const pendingChecks = await (tx as any).check.findMany({
  where: {
    organizationId: ctx.organizationId,
    status: 'A_COMPENSAR',
    ...(farmId ? { bankAccount: { farms: { some: { farmId } } } } : {}),
  },
  select: { type: true, amount: true },
});

let pendingEmitidos = Money(0);
let pendingRecebidos = Money(0);
for (const c of pendingChecks) {
  const amt = Money.fromPrismaDecimal(c.amount);
  if (c.type === 'EMITIDO') pendingEmitidos = pendingEmitidos.add(amt);
  else pendingRecebidos = pendingRecebidos.add(amt);
}

const accountingBalance = totalBankBalance
  .subtract(pendingEmitidos)
  .add(pendingRecebidos)
  .toNumber();
```

### Pattern 5: Período de Fatura

**What:** Dado `closingDay` do cartão, calcular `periodStart` e `periodEnd` de uma fatura.

```typescript
// Exemplo: closingDay=15, mês atual março
// periodStart = 15 de fevereiro (00:00:00 UTC)
// periodEnd   = 14 de março (23:59:59 UTC)
function getBillPeriod(closingDay: number, referenceDate: Date): { start: Date; end: Date } {
  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth() + 1; // 1-based

  // periodEnd = dia (closingDay - 1) do mês de referência
  // periodStart = closingDay do mês anterior
  const endDay = closingDay - 1 === 0 ? getLastDayOfMonth(refYear, refMonth - 1) : closingDay - 1;
  const startDate = new Date(Date.UTC(refYear, refMonth - 2, closingDay));
  const endDate = new Date(Date.UTC(refYear, refMonth - 1, endDay, 23, 59, 59, 999));
  return { start: startDate, end: endDate };
}
```

### Anti-Patterns to Avoid

- **Não calcular saldo contábil com JS number** — usar `Money` para todos os cálculos intermediários, converter para `number` apenas no output final.
- **Não criar FinancialTransaction fora de withRlsContext** — sempre dentro da transação Prisma para garantir atomicidade com BankAccountBalance.
- **Não permitir fechamento de fatura sem despesas** — validar `expenses.length > 0` antes de criar CP.
- **Não permitir transferência entre a mesma conta** — `fromAccountId !== toAccountId`.
- **Não usar `increment`/`decrement` sem verificar saldo** — para transferências, pode ser necessário checar saldo mínimo (mas por ora não é requisito).
- **Não usar `farmId` diretamente em CP de fatura** — derivar da conta de débito vinculada ao cartão (via `bankAccount.farms[0]`), ou usar o farmId mais frequente das despesas.

---

## Don't Hand-Roll

| Problem                      | Don't Build                                | Use Instead                                                                         | Why                                                                          |
| ---------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Aritmética de dinheiro       | Operadores JS (`+`, `-`, `*`)              | `Money()` de `@protos-farm/shared`                                                  | Floating-point errors acumulam; `0.1 + 0.2 !== 0.3`                          |
| CP de fatura do cartão       | Nova função de criação de CP               | `createPayable()` existente em `payables.service.ts`                                | Toda a lógica de parcelas, centro de custo, validações já está lá            |
| Atualização de saldo         | `UPDATE SET balance = balance + X` raw SQL | `bankAccountBalance.update({ data: { currentBalance: { increment } } })` via Prisma | Prisma garante atomicidade, type safety e RLS                                |
| Badge de alertas no sidebar  | Polling customizado                        | Mesmo padrão de `useOverdueCount` — fetch simples no mount                          | Padrão já aprovado no projeto (sem global store)                             |
| Cálculo de período de fatura | Biblioteca de datas                        | UTC Date methods nativos (`Date.UTC`, `setUTCMonth`)                                | Projeto usa UTC Date methods (ver Phase 2 decision sobre timezone-shift bug) |

---

## Common Pitfalls

### Pitfall 1: Transferência Parcial por Race Condition

**What goes wrong:** Dois requests simultâneos de transferência da mesma conta podem levar o saldo negativo.
**Why it happens:** `BankAccountBalance.currentBalance` é lido, calculado e escrito em passos separados.
**How to avoid:** Usar `increment`/`decrement` do Prisma (operação atômica no banco), nunca read-modify-write.
**Warning signs:** Saldo inconsistente entre `FinancialTransaction` sum e `BankAccountBalance.currentBalance`.

### Pitfall 2: farmId em CP de Fatura

**What goes wrong:** CP gerado pelo fechamento de fatura precisa de `farmId`, mas cartão não tem farmId direto.
**Why it happens:** `Payable` tem `farmId` obrigatório (schema atual), mas `CreditCard` vincula à conta bancária.
**How to avoid:** Derivar `farmId` da relação `CreditCard.debitAccount.farms[0]`. Se conta não tem fazenda (conta de nível org), usar um campo `farmId` opcional no cartão ou tornar o campo obrigatório no cadastro do cartão.
**Warning signs:** Erro de constraint ao tentar criar CP sem farmId.

### Pitfall 3: Período de Fatura com Dia 31

**What goes wrong:** `closingDay=31` em meses de 28/29/30 dias gera data inválida.
**Why it happens:** `new Date(Date.UTC(year, month, 31))` em fevereiro → transborda para março.
**How to avoid:** Limitar `closingDay` ao intervalo 1-28 no cadastro do cartão (regra de negócio: bancos brasileiros evitam dias >28).
**Warning signs:** Datas de período incorretas para fevereiro.

### Pitfall 4: Re-abertura de Fatura Fechada

**What goes wrong:** Usuário fecha fatura, paga o CP, depois quer adicionar despesa retroativa.
**Why it happens:** Fluxo natural de uso — usuário esqueceu de registrar uma despesa.
**How to avoid:** Bloquear adição de despesa em fatura CLOSED. Orientar usuário a criar nova despesa na próxima fatura. Documentar esse comportamento na UI (tooltip no botão).
**Warning signs:** Despesas sem billId após fechamento.

### Pitfall 5: Cheque Devolvido com Alerta e Re-apresentação

**What goes wrong:** Cheque DEVOLVIDO não é tratado como alerta — usuário não sabe que precisa agir.
**Why it happens:** Estado DEVOLVIDO fica "preso" sem fluxo claro para re-apresentação.
**How to avoid:** Incluir cheques DEVOLVIDOS na contagem de alertas do sidebar junto com A_COMPENSAR. Re-apresentação = transição DEVOLVIDO → A_COMPENSAR (com nova data de compensação esperada).

### Pitfall 6: Saldo Contábil Negativo vs Real Positivo

**What goes wrong:** Dashboard mostra saldo real positivo mas contábil negativo — usuário fica confuso sem explicação.
**Why it happens:** Muitos cheques emitidos a compensar.
**How to avoid:** Tooltip obrigatório no card conforme decidido. Nunca mostrar saldo contábil negativo sem destaque visual diferenciado (cor de erro + ícone).

---

## Code Examples

### Referência: BankAccountBalance update atômico

```typescript
// Source: apps/backend/src/modules/bank-accounts/bank-accounts.service.ts (linha ~134-156)
// Padrão para qualquer operação que mexe em saldo:
await (tx as any).bankAccountBalance.create({
  data: {
    bankAccountId: created.id,
    organizationId: ctx.organizationId,
    initialBalance: initialMoney.toDecimal(),
    currentBalance: initialMoney.toDecimal(),
  },
});
// Para atualizar saldo existente — SEMPRE via increment/decrement:
await (tx as any).bankAccountBalance.update({
  where: { bankAccountId: accountId },
  data: { currentBalance: { increment: amount.toDecimal() } },
});
```

### Referência: FinancialTransaction com referenceType

```typescript
// Source: apps/backend/prisma/schema.prisma (modelo FinancialTransaction)
// referenceType é String livre — convenção do projeto:
// 'OPENING_BALANCE', 'PAYABLE_SETTLEMENT', 'RECEIVABLE_SETTLEMENT'
// Novos tipos Phase 4:
// 'TRANSFER' (DEBIT/CREDIT espelhados)
// 'TRANSFER_FEE' (DEBIT de tarifa)
// 'CHECK_COMPENSATION' (DEBIT/CREDIT na compensação)
```

### Referência: useOverdueCount para badge no sidebar

```typescript
// Source: apps/frontend/src/hooks/usePayables.ts (linha 229-250)
export function useCheckAlertCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ count: number }>('/org/checks/alert-count');
      setCount(result?.count ?? 0);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);
  return { count, loading, refetch: fetchCount };
}
```

### Referência: PayableCategory enum (a expandir)

```typescript
// Source: apps/backend/src/modules/payables/payables.types.ts (linha 18-26)
// Adicionar CARTAO_CREDITO ao enum no schema.prisma e ao PAYABLE_CATEGORY_LABELS:
export const PAYABLE_CATEGORY_LABELS: Record<PayableCategory, string> = {
  // ... existentes ...
  CARTAO_CREDITO: 'Cartão de Crédito', // novo
};
```

---

## State of the Art

| Old Approach                            | Current Approach                                           | When Changed               | Impact                                         |
| --------------------------------------- | ---------------------------------------------------------- | -------------------------- | ---------------------------------------------- |
| Cheque como campo metadata em pagamento | Entidade `Check` de primeira classe com máquina de estados | Phase 4 (Phase 3 decision) | Rastreamento de status, saldo contábil vs real |
| Saldo bancário único                    | Saldo real + saldo contábil no dashboard                   | Phase 4                    | Visibilidade de cheques pendentes              |

**Deprecated/outdated:**

- Nenhum padrão anterior a substituir — esta fase adiciona funcionalidades novas.

---

## Integration Points

### Backend — app.ts

```typescript
// Registrar após payablesRouter:
import { transfersRouter } from './modules/transfers/transfers.routes';
import { creditCardsRouter } from './modules/credit-cards/credit-cards.routes';
import { checksRouter } from './modules/checks/checks.routes';

app.use(transfersRouter);
app.use(creditCardsRouter);
app.use(checksRouter);
```

### Frontend — App.tsx (lazy imports + routes)

```tsx
const TransfersPage = lazy(() => import('@/pages/TransfersPage'));
const CreditCardsPage = lazy(() => import('@/pages/CreditCardsPage'));
const ChecksPage = lazy(() => import('@/pages/ChecksPage'));

// Routes:
<Route path="/transfers" element={<TransfersPage />} />
<Route path="/credit-cards" element={<CreditCardsPage />} />
<Route path="/checks" element={<ChecksPage />} />
```

### Frontend — Sidebar.tsx (grupo FINANCEIRO)

```tsx
// Adicionar ao grupo FINANCEIRO (após Contas a receber):
{ to: '/transfers', icon: ArrowLeftRight, label: 'Transferências' },
{ to: '/credit-cards', icon: CreditCard, label: 'Cartões' },
{ to: '/checks', icon: CheckSquare, label: 'Cheques' },
// Badge nos cheques A_COMPENSAR + DEVOLVIDOS
```

### Schema Migration

Ordem das migrations:

1. `AddCartaoCreditoToPayableCategory` — adicionar enum value
2. `CreateAccountTransfers` — modelo de transferência
3. `CreateCreditCards` — CreditCard + CreditCardBill + CreditCardExpense
4. `CreateChecks` — Check com máquina de estados

---

## Open Questions

1. **farmId em CP de fatura de cartão**
   - What we know: `Payable.farmId` é obrigatório no schema atual; `CreditCard` não tem farmId próprio
   - What's unclear: Conta de débito pode não ter fazenda vinculada (conta de nível org)
   - Recommendation: Adicionar campo `farmId` obrigatório no cadastro do cartão, igual ao padrão de `Payable`. Solução mais simples e consistente.

2. **Alertas de cheque: threshold de "próximo de compensar"**
   - What we know: Decisão é mostrar cheques próximos de compensar no dashboard
   - What's unclear: Qual o período? 7 dias? 15 dias? Usuário pode configurar?
   - Recommendation: Usar 7 dias como padrão fixo (mesmo horizonte dos alertas de CP vencido). Não configurável nesta fase.

3. **Fatura automática vs manual**
   - What we know: Fechamento é manual (decisão locked). Mas as despesas precisam saber em qual fatura caem.
   - What's unclear: Despesas são atribuídas a uma fatura existente ou a fatura é criada ao fechar?
   - Recommendation: Fatura é criada automaticamente ao registrar a primeira despesa do período (lazy creation). Ao clicar "Fechar fatura", a fatura existente é encerrada. Se não existe fatura aberta, criar ao fechar.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Framework          | Jest (backend) + Vitest (frontend)                                                                               |
| Config file        | `apps/backend/jest.config.ts` / `apps/frontend/vitest.config.ts`                                                 |
| Quick run command  | `pnpm --filter @protos-farm/backend test -- --testPathPattern=transfers\|credit-cards\|checks --passWithNoTests` |
| Full suite command | `pnpm --filter @protos-farm/backend test`                                                                        |

### Phase Requirements → Test Map

| Req ID | Behavior                                                                    | Test Type | Automated Command                                                                       | File Exists? |
| ------ | --------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------- | ------------ |
| FN-04  | Transferência cria 2 FinancialTransactions + atualiza 2 saldos atomicamente | unit      | `pnpm --filter @protos-farm/backend test -- --testPathPattern=transfers.routes.spec`    | ❌ Wave 0    |
| FN-04  | Tarifa gera terceira FinancialTransaction DEBIT                             | unit      | idem                                                                                    | ❌ Wave 0    |
| FN-04  | Não permite transferência entre a mesma conta                               | unit      | idem                                                                                    | ❌ Wave 0    |
| FN-02  | CRUD de cartão com validação de closingDay 1-28                             | unit      | `pnpm --filter @protos-farm/backend test -- --testPathPattern=credit-cards.routes.spec` | ❌ Wave 0    |
| FN-05  | Fechamento de fatura gera CP com categoria CARTAO_CREDITO                   | unit      | idem                                                                                    | ❌ Wave 0    |
| FN-05  | Fechamento de fatura sem despesas retorna erro                              | unit      | idem                                                                                    | ❌ Wave 0    |
| FN-09  | Compensação de cheque EMITIDO faz DEBIT no saldo real                       | unit      | `pnpm --filter @protos-farm/backend test -- --testPathPattern=checks.routes.spec`       | ❌ Wave 0    |
| FN-09  | Compensação de cheque RECEBIDO faz CREDIT no saldo real                     | unit      | idem                                                                                    | ❌ Wave 0    |
| FN-09  | Saldo contábil = saldo real - emitidos A_COMPENSAR + recebidos A_COMPENSAR  | unit      | idem                                                                                    | ❌ Wave 0    |
| FN-09  | Transição inválida de estado retorna 422                                    | unit      | idem                                                                                    | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm --filter @protos-farm/backend test -- --testPathPattern=transfers\|credit-cards\|checks --passWithNoTests`
- **Per wave merge:** `pnpm --filter @protos-farm/backend test`
- **Phase gate:** Full suite green antes do `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/transfers/transfers.routes.spec.ts` — cobre FN-04
- [ ] `apps/backend/src/modules/credit-cards/credit-cards.routes.spec.ts` — cobre FN-02, FN-05
- [ ] `apps/backend/src/modules/checks/checks.routes.spec.ts` — cobre FN-09
- [ ] Prisma migration para `CARTAO_CREDITO` enum value (migration resolve como em Phase 1 se necessário)

---

## Sources

### Primary (HIGH confidence)

- `apps/backend/src/modules/bank-accounts/bank-accounts.service.ts` — padrão BankAccountBalance update atômico, FinancialTransaction creation pattern
- `apps/backend/src/modules/bank-accounts/bank-accounts.types.ts` — tipos de conta, interface output pattern
- `apps/backend/src/modules/payables/payables.service.ts` — padrão createPayable, validateCostCenterItems, generateInstallments
- `apps/backend/src/modules/payables/payables.types.ts` — PayableCategory enum existente (referência para CARTAO_CREDITO)
- `apps/backend/src/modules/financial-dashboard/financial-dashboard.service.ts` — getFinancialDashboard a expandir
- `apps/backend/prisma/schema.prisma` — modelos BankAccount, FinancialTransaction, Payable, PayableCategory
- `apps/frontend/src/components/layout/Sidebar.tsx` — estrutura do grupo FINANCEIRO, padrão useOverdueCount
- `apps/frontend/src/hooks/usePayables.ts` — useOverdueCount pattern para badge de alertas
- `apps/frontend/src/App.tsx` — padrão de rotas lazy

### Secondary (MEDIUM confidence)

- `apps/frontend/src/pages/FinancialDashboardPage.tsx` — estrutura do dashboard a adaptar para saldo contábil
- `.planning/STATE.md` decisions — Phase 4 decisions sobre cheques como entidade de primeira classe, Phase 2 decisions sobre UTC Date methods

### Tertiary (LOW confidence)

- Nenhum — toda pesquisa baseada em código existente do projeto.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — inteiramente baseado no código existente do projeto
- Architecture: HIGH — padrões de BankAccountBalance + FinancialTransaction verificados diretamente no código
- Pitfalls: HIGH — identificados a partir de decisões registradas no STATE.md e análise do schema
- Saldo contábil: HIGH — fórmula é trivial e confirmada pelo CONTEXT.md

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (padrões internos estáveis; nenhuma dependência externa em fase de movimento rápido)
