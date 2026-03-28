# Phase 38: Fechamento Mensal e Conciliação Contábil - Research

**Researched:** 2026-03-28
**Domain:** Monthly accounting close workflow, period locking, multi-module checklist orchestration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Checklist de Fechamento**
- D-01: Stepper vertical em página dedicada (/monthly-closing). Cada etapa mostra status (pendente/ok/erro), resumo de dados, e expand para detalhes. Botão "Fechar Período" só habilita quando todas as 6 etapas passam.
- D-02: Modelo MonthlyClosing persistido no banco com status IN_PROGRESS/COMPLETED/REOPENED. Resultado de cada etapa salvo (tabela filha ou JSON). Histórico de fechamentos preservado.
- D-03: Etapas em ordem obrigatória com dependências sequenciais. Etapa N só pode ser validada após etapa N-1 estar OK.
- D-04: Fechamento parcial suportado. MonthlyClosing criado ao iniciar com status IN_PROGRESS. Etapas já validadas ficam salvas. Contador pode sair e voltar.
- D-05: Quando etapa falha: mostra problema + link direto para o módulo correspondente + botão "Revalidar" na etapa. Contador não precisa sair do fluxo.
- D-06: Critérios de sucesso rígidos (binários) por etapa. Sem tolerância/override.

**Conciliação Contábil**
- D-07: Módulo reconciliation/ existente atende FECH-02. Etapa 5 do checklist consulta se existe conciliação completa para o período. Se não, link para ReconciliationPage.
- D-08: Relatório de conciliação existente (getReconciliationReport) é suficiente. Sem export PDF/CSV adicional nesta phase.

**Bloqueio e Reabertura**
- D-09: Middleware/helper centralizado checkPeriodOpen(date, orgId) que todo endpoint de escrita contábil chama. Retorna 422 se período CLOSED ou BLOCKED. Implementado uma vez, importado em journal-entries, auto-posting, etc.
- D-10: Reabertura exclusiva de usuários com role ADMIN. Sem permissão configurável adicional.
- D-11: Ao reabrir, MonthlyClosing existente ganha status REOPENED + motivo + quem reabriu. Para fechar novamente, novo processo de checklist completo.

**Integração entre Módulos**
- D-12: 6 etapas padrão: (1) Ponto aprovado (attendance), (2) Folha fechada (payroll-runs), (3) Depreciação processada (depreciation), (4) Lançamentos pendentes zerados (auto-posting), (5) Conciliação bancária (reconciliation), (6) Balancete equilibrado (trial-balance).
- D-13: Consultas read-only aos services existentes. Cada etapa chama o service do módulo correspondente para verificar status do período.

**Frontend**
- D-14: Página dedicada MonthlyClosingPage, rota /monthly-closing. Botão "Iniciar Fechamento" na FiscalPeriodsPage abre para o período selecionado.
- D-15: Sidebar no grupo CONTABILIDADE.

### Claude's Discretion
- Estrutura do modelo MonthlyClosing (campos, tabela filha vs JSON para etapas)
- Nome/assinatura exata do middleware checkPeriodOpen
- Quais endpoints específicos recebem o middleware de bloqueio
- Detalhes visuais do stepper (ícones, cores de status, layout do resumo por etapa)
- Queries exatas para cada etapa de validação

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FECH-01 | Contador executa fechamento mensal com checklist estruturado de 6 etapas dependentes, cada etapa consulta automaticamente o módulo correspondente | Services existentes em timesheets, payroll-runs, depreciation-batch, auto-posting, reconciliation, ledger — todos têm funções de consulta de status/contagem disponíveis |
| FECH-02 | Contador executa conciliação bancária contábil comparando razão GL com extratos importados, com relatório exportável | Módulo reconciliation/ completo: getReconciliationReport, getImportLinesWithMatches, scoreMatch; etapa 5 do checklist usa este módulo |
| FECH-03 | Contador fecha período após checklist aprovado, bloqueando novos lançamentos; reabertura controlada (motivo + log + papel admin) | FiscalPeriods service: closePeriod/reopenPeriod já implementados; assertPeriodOpen em @protos-farm/shared já usado em journal-entries; middleware checkPeriodOpen a criar como wrapper HTTP |
</phase_requirements>

---

## Summary

Phase 38 constrói sobre fundações sólidas já implementadas nas Phases 35-37. Não há biblioteca nova a aprender — o trabalho é orquestrar módulos existentes (fiscal-periods, auto-posting, reconciliation, ledger, payroll-runs, depreciation, timesheets) em um workflow de fechamento.

O padrão central é o modelo `MonthlyClosing` com status `IN_PROGRESS → COMPLETED | REOPENED`. Cada etapa de validação é uma query read-only ao módulo correspondente, cujo resultado é armazenado como JSON no campo `stepResults`. O stepper no frontend mostra o progresso e permite retomar de onde parou.

O bloqueio de período é um middleware Express que verifica se `AccountingPeriod.status` é `OPEN` antes de permitir escritas. A função `assertPeriodOpen` já existe em `@protos-farm/shared` — o middleware `checkPeriodOpen` é apenas um wrapper HTTP que a chama, consulta o período por data, e retorna 422. Deve ser injetado nas rotas de `journal-entries` e `auto-posting` que criam/atualizam entradas.

**Primary recommendation:** Criar o módulo `monthly-closing/` com service, routes e types; implementar `checkPeriodOpen` middleware em `src/middleware/`; adicionar middleware nas rotas de escrita contábil.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma 7 | ^7.x | ORM — novo modelo MonthlyClosing + migração | Padrão do projeto |
| Express 5 | ^5.x | Router para módulo monthly-closing | Padrão do projeto |
| @protos-farm/shared | workspace | assertPeriodOpen, Money, tipos | Já usada em todo backend |
| date-fns | ^4.x | Comparação de datas nas queries de etapa | Já usada em fiscal-periods |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pdfkit | ^0.15 | PDF do relatório de conciliação (já existente) | Já usado em reconciliation.service |
| jest | ^29.x | Testes do novo módulo | Padrão backend |

**Installation:** Nenhum pacote novo necessário — todas as dependências já estão instaladas.

---

## Architecture Patterns

### Estrutura do Novo Módulo
```
src/modules/monthly-closing/
├── monthly-closing.service.ts    # lógica de negócio
├── monthly-closing.routes.ts     # Express router
├── monthly-closing.types.ts      # interfaces e error class
└── monthly-closing.routes.spec.ts
```

### Middleware de Bloqueio de Período
```
src/middleware/
└── check-period-open.ts          # novo: wrapper HTTP para assertPeriodOpen
```

### Pattern 1: MonthlyClosing Model (Claude's Discretion — Recomendação)

**Recomendação:** Usar campo JSON `stepResults` em vez de tabela filha. Justificativa: etapas têm estrutura heterogênea (cada step retorna dados diferentes), JSON é adequado para resultados imutáveis de validação, e evita 6 tabelas extras por nada.

```prisma
// Proposta para schema.prisma
model MonthlyClosing {
  id             String               @id @default(uuid())
  organizationId String
  periodId       String               // FK → AccountingPeriod
  status         MonthlyClosingStatus @default(IN_PROGRESS)
  stepResults    Json?                // { step1: {...}, step2: {...} }
  completedAt    DateTime?
  completedBy    String?
  reopenedAt     DateTime?
  reopenedBy     String?
  reopenReason   String?
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  organization Organization     @relation(fields: [organizationId], references: [id])
  period       AccountingPeriod @relation(fields: [periodId], references: [id])

  @@unique([organizationId, periodId]) // um fechamento ativo por período
  @@map("monthly_closings")
}

enum MonthlyClosingStatus {
  IN_PROGRESS
  COMPLETED
  REOPENED

  @@map("monthly_closing_status")
}
```

### Pattern 2: checkPeriodOpen Middleware (D-09)

**Assinatura recomendada:**
```typescript
// src/middleware/check-period-open.ts
// Source: padrão existente em authorize.ts + getPeriodForDate em fiscal-periods.service.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { assertPeriodOpen, PeriodNotOpenError } from '@protos-farm/shared';

/**
 * checkPeriodOpen — Express middleware que verifica se o período contábil
 * referente à data do lançamento está OPEN.
 *
 * Lê req.body.entryDate ou req.body.date (ISO string).
 * Lê req.params.orgId para multitenancy.
 * Retorna 422 se período CLOSED ou BLOCKED.
 */
export function checkPeriodOpen() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const orgId = req.params.orgId as string;
    const dateStr: string | undefined = req.body?.entryDate ?? req.body?.date;

    if (!dateStr) { next(); return; } // sem data = sem verificação (draft sem período)

    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const period = await prisma.accountingPeriod.findFirst({
      where: { organizationId: orgId, month, year, fiscalYear: { isActive: true } },
      select: { month: true, year: true, status: true },
    });

    if (!period) {
      res.status(422).json({ error: `Nenhum período contábil encontrado para ${month}/${year}` });
      return;
    }

    try {
      assertPeriodOpen(period);
      next();
    } catch (err) {
      if (err instanceof PeriodNotOpenError) {
        res.status(422).json({ error: err.message, code: 'PERIOD_NOT_OPEN' });
        return;
      }
      next(err);
    }
  };
}
```

**Endpoints que recebem o middleware (D-09):**
- `POST /org/:orgId/journal-entries` — criar lançamento manual
- `POST /org/:orgId/journal-entries/:id/post` — postar draft
- `POST /org/:orgId/auto-posting/process` — processar postings pendentes (já verifica no service, mas middleware reforça para operações manuais)

### Pattern 3: Queries de Validação por Etapa (D-13)

**Etapa 1 — Ponto aprovado (timesheets):**
```typescript
// Fonte: timesheets.service.ts → listTimesheets (orgId, { status, referenceMonth })
// Critério: nenhum timesheet com status != 'APPROVED' | 'LOCKED' para o referenceMonth
const pendingTimesheets = await prisma.timesheet.count({
  where: {
    organizationId,
    referenceMonth: periodStart, // primeiro dia do mês
    status: { notIn: ['APPROVED', 'LOCKED'] },
  },
});
// passaBool = pendingTimesheets === 0
```

**Etapa 2 — Folha fechada (payroll-runs):**
```typescript
// Fonte: payroll-runs.service.ts → listRuns
// Critério: existe ao menos um PayrollRun COMPLETED para o período, e nenhum em PENDING/PROCESSING/CALCULATED/ERROR
const runs = await prisma.payrollRun.findMany({
  where: { organizationId, referenceMonth: periodStart },
  select: { status: true },
});
// passaBool = runs.length > 0 && runs.every(r => r.status === 'COMPLETED')
```

**Etapa 3 — Depreciação processada (depreciation):**
```typescript
// Fonte: depreciation-batch.service.ts → runDepreciationBatch
// DepreciationRun tem status string (não enum), valores: 'PENDING', 'COMPLETED', 'PARTIAL'
const depRun = await prisma.depreciationRun.findFirst({
  where: { organizationId, periodYear: year, periodMonth: month, status: 'COMPLETED' },
  select: { id: true, totalAssets: true, processedCount: true },
});
// passaBool = depRun !== null
```

**Etapa 4 — Lançamentos pendentes zerados (auto-posting):**
```typescript
// Fonte: auto-posting.service.ts → getPendingCounts
// Importar função existente diretamente
import { getPendingCounts } from '../auto-posting/auto-posting.service';
const counts = await getPendingCounts(organizationId);
// passaBool = counts.pending === 0 && counts.error === 0
```

**Etapa 5 — Conciliação bancária (reconciliation):**
```typescript
// Fonte: reconciliation.service.ts → getReconciliationReport por importId
// Critério: para todas as contas bancárias do org, não existem BankStatementLines PENDING no período
const pendingLines = await prisma.bankStatementLine.count({
  where: {
    organizationId,
    status: 'PENDING',
    date: { gte: periodStart, lte: periodEnd },
  },
});
// passaBool = pendingLines === 0
// (se nenhuma conta bancária → auto-pass, ou exigir ao menos 1 import)
```

**Etapa 6 — Balancete equilibrado (ledger):**
```typescript
// Fonte: ledger.service.ts → getTrialBalance(organizationId, { fiscalYearId, month })
import { getTrialBalance } from '../ledger/ledger.service';
const balance = await getTrialBalance(organizationId, { fiscalYearId, month });
// passaBool = balance.isBalanced === true (campo já retornado pelo service)
```

### Pattern 4: Service de Fechamento

```typescript
// monthly-closing.service.ts — fluxo principal

// ─── startClosing ─────────────────────────────────────────────────────────────
// Cria MonthlyClosing com status IN_PROGRESS se não existe (upsert).
// Retorna existente se já em andamento (D-04).

// ─── validateStep ────────────────────────────────────────────────────────────
// Executa validação da etapa N. Verifica se N-1 está OK (D-03).
// Atualiza stepResults[stepN] com { status, summary, validatedAt }.

// ─── completeClosing ─────────────────────────────────────────────────────────
// Valida que todas as 6 etapas estão OK.
// Chama fiscal-periods.service.closePeriod(prisma, orgId, periodId, { closedBy }).
// Atualiza MonthlyClosing.status = COMPLETED.

// ─── reopenClosing ────────────────────────────────────────────────────────────
// ADMIN-only (verificado na rota com authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN)).
// Chama fiscal-periods.service.reopenPeriod(prisma, orgId, periodId, { reopenedBy, reopenReason }).
// Atualiza MonthlyClosing.status = REOPENED + motivo + auditoria.
// NÃO cria um novo MonthlyClosing — ao fechar novamente, startClosing cria um novo (D-11).
```

### Pattern 5: Frontend MonthlyClosingPage

**Estrutura visual do stepper vertical:**
```
[Período: Janeiro 2026]

Step 1: Ponto Aprovado         [OK]     ▼ (expandido: "42 pontos aprovados")
Step 2: Folha Fechada          [OK]     ▼ (expandido: "1 folha — R$ 45.320,00")
Step 3: Depreciação Processada [PENDENTE] → [Revalidar]
        ↳ "Nenhum processamento encontrado. " [→ Ir para Depreciação]
Step 4: Lançamentos Pendentes  [BLOQUEADO]
Step 5: Conciliação Bancária   [BLOQUEADO]
Step 6: Balancete Equilibrado  [BLOQUEADO]

[Fechar Período] ← disabled até step 6 = OK
```

**Hook pattern:**
```typescript
// hooks/useMonthlyClosing.ts
export function useMonthlyClosing(periodId: string) { ... }
export function useValidateStep() { ... }
export function useCompleteClosing() { ... }
export function useReopenClosing() { ... }  // só para ADMIN
```

### Anti-Patterns to Avoid
- **Criar tabelas filhas para stepResults:** JSON é suficiente para resultados imutáveis de validação.
- **Chamar closePeriod diretamente do frontend:** Sempre via endpoint POST /complete que orquestra no backend.
- **Múltiplos MonthlyClosing ativos por período:** UNIQUE constraint em (organizationId, periodId) previne duplicação.
- **Verificar periodo no middleware para rotas GET:** Middleware deve ser aplicado somente em POST/PUT/PATCH de criação de lançamentos.
- **Import circular entre monthly-closing e outros módulos:** Usar queries Prisma diretas nas etapas, não importar services de outros módulos (exceto getPendingCounts do auto-posting que é uma função pura).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Period state machine | Custom state manager | fiscal-periods.service closePeriod/reopenPeriod | Já implementado com todas as validações |
| Period open check | Nova função duplicada | assertPeriodOpen de @protos-farm/shared + checkPeriodOpen middleware wrapper | assertPeriodOpen já testada; middleware é só wrapper HTTP |
| Conciliação bancária | Nova lógica de matching | reconciliation.service getReconciliationReport | Módulo completo com matching engine, scoreMatch, PDF/CSV export |
| Trial balance check | Consulta SQL manual | ledger.service getTrialBalance | Já agrega sintéticas recursivamente, retorna isBalanced |
| Pending counts | Query manual de pendências | auto-posting.service getPendingCounts | Retorna { pending, error } diretamente |
| Audit trail | Log manual | logAudit service em src/shared/audit/audit.service | Padrão já usado em reconciliation, auto-posting, etc. |
| Role check no reopen | Lógica custom | authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN) middleware já existente | Padrão em authorize.ts |

---

## Common Pitfalls

### Pitfall 1: DepreciationRun usa status como string, não enum Prisma
**What goes wrong:** Tentar usar enum Prisma para filtrar `depreciationRun.status` causa erro de tipo.
**Why it happens:** O modelo `DepreciationRun` no schema tem `status String @default("PENDING")`, não um enum tipado.
**How to avoid:** Usar string literal: `where: { status: 'COMPLETED' }`. Não criar enum nem importar de @prisma/client para DepreciationRunStatus.
**Warning signs:** TypeScript error "Type 'string' is not assignable to type 'X'".

### Pitfall 2: MonthlyClosing UNIQUE constraint — múltiplos fechamentos por período
**What goes wrong:** Usuário tenta iniciar fechamento para período que já tem um MonthlyClosing COMPLETED. Constraint falha.
**Why it happens:** D-11 diz que ao reabrir, MonthlyClosing ganha status REOPENED — ao fechar novamente, cria-se UM NOVO MonthlyClosing.
**How to avoid:** Em `startClosing`, verificar se já existe MonthlyClosing COMPLETED e retornar erro informativo ("Período já fechado — reabra antes de iniciar novo fechamento"). A constraint UNIQUE deve ser em (organizationId, periodId) com DEFERRABLE, ou criar um índice parcial: `UNIQUE WHERE status IN ('IN_PROGRESS', 'COMPLETED')`.
**Warning signs:** Prisma UniqueConstraintError em startClosing.

**Recomendação:** Usar índice parcial ou simplesmente permitir múltiplos registros (COMPLETED histórico + novo IN_PROGRESS), removendo o UNIQUE e usando lógica de negócio: `findFirst({ where: { ..., status: { in: ['IN_PROGRESS'] } } })`.

### Pitfall 3: Etapa 5 (conciliação) pode ser auto-pass se não há contas bancárias
**What goes wrong:** Org sem conta bancária configurada → etapa 5 sempre passa (0 linhas PENDING) → fechamento pode ser feito sem dados bancários reais.
**Why it happens:** Query por bankStatementLines PENDING no período retorna 0 se não há importações.
**How to avoid:** Decidir política: (a) auto-pass se não há BankStatementImport para o período, ou (b) exigir ao menos 1 import reconciliado. Recomendação: **auto-pass com aviso** ("Nenhum extrato importado para este período — etapa marcada como N/A").
**Warning signs:** Etapa 5 sempre verde sem que o contador tenha importado extratos.

### Pitfall 4: checkPeriodOpen middleware e rotas de draft
**What goes wrong:** Middleware aplicado em `POST /journal-entries` bloqueia criação de drafts para períodos fechados — mas drafts não têm impacto contábil.
**Why it happens:** Draft não tem periodId até que o usuário escolha um período no formulário.
**How to avoid:** O service `createJournalEntryDraft` já verifica `assertPeriodOpen` internamente. O middleware em `POST /journal-entries` é duplicação — aplicar só em `POST .../post` (ação de postar um draft). Ou aplicar o middleware e aceitar o comportamento: usuário não pode nem criar rascunho para período fechado.
**Warning signs:** Usuários reclamam que não conseguem criar rascunhos históricos.

### Pitfall 5: Reabertura — closePeriod/reopenPeriod do fiscal-periods service rejeita transições inválidas
**What goes wrong:** Chamar reopenPeriod em período BLOCKED lança FiscalPeriodError (INVALID_TRANSITION). O fluxo de reabertura do MonthlyClosing não considera isso.
**Why it happens:** Estado BLOCKED → OPEN não é permitido em fiscal-periods.service.reopenPeriod.
**How to avoid:** O MonthlyClosing.reopenClosing deve verificar o status atual do AccountingPeriod antes de chamar reopenPeriod. Se status é BLOCKED, retornar erro informativo.
**Warning signs:** FiscalPeriodError INVALID_TRANSITION em reopenClosing.

### Pitfall 6: Stepper com polling vs on-demand
**What goes wrong:** Fazer polling automático das etapas no frontend consome chamadas desnecessárias e pode gerar estado inconsistente.
**Why it happens:** Tentativa de tornar o checklist "live".
**How to avoid:** Cada etapa valida on-demand (botão "Revalidar"). O estado é persistido no banco — o frontend carrega o MonthlyClosing existente ao abrir a página. Sem polling.

---

## Runtime State Inventory

> Greenfield module — nenhum estado runtime a migrar.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Nenhum — MonthlyClosing é novo modelo | Migração Prisma para criar tabela |
| Live service config | Nenhum | — |
| OS-registered state | Nenhum | — |
| Secrets/env vars | Nenhum | — |
| Build artifacts | Nenhum | — |

---

## Environment Availability

> Dependências externas: apenas PostgreSQL (já disponível) e Node.js (já disponível). Nenhuma ferramenta externa nova.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Migração Prisma + queries | ✓ | 16 | — |
| Node.js | Backend runtime | ✓ | v24.12 | — |
| pdfkit | Relatório conciliação (já em uso) | ✓ | ^0.15 | — |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 |
| Config file | `apps/backend/jest.config.ts` |
| Quick run command | `pnpm --filter @protos-farm/backend test -- --testPathPattern monthly-closing` |
| Full suite command | `pnpm --filter @protos-farm/backend test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FECH-01 | Criar MonthlyClosing IN_PROGRESS ao iniciar | unit | `... --testPathPattern monthly-closing.routes.spec` | ❌ Wave 0 |
| FECH-01 | Validar etapa 1 (ponto): pendingTimesheets = 0 | unit | `... --testPathPattern monthly-closing.routes.spec` | ❌ Wave 0 |
| FECH-01 | Validar etapa 2 (folha): runs.every COMPLETED | unit | `... --testPathPattern monthly-closing.routes.spec` | ❌ Wave 0 |
| FECH-01 | Validar etapa 3 (deprec): depRun COMPLETED existe | unit | `... --testPathPattern monthly-closing.routes.spec` | ❌ Wave 0 |
| FECH-01 | Validar etapa 4 (pendentes): pending + error = 0 | unit | `... --testPathPattern monthly-closing.routes.spec` | ❌ Wave 0 |
| FECH-01 | Etapa N bloqueada se N-1 não passou (D-03) | unit | `... --testPathPattern monthly-closing.routes.spec` | ❌ Wave 0 |
| FECH-02 | Etapa 5 (conciliação): pendingLines = 0 no período | unit | `... --testPathPattern monthly-closing.routes.spec` | ❌ Wave 0 |
| FECH-01 | Etapa 6 (balancete): getTrialBalance.isBalanced = true | unit | `... --testPathPattern monthly-closing.routes.spec` | ❌ Wave 0 |
| FECH-03 | completeClosing transiciona período para CLOSED | unit | `... --testPathPattern monthly-closing.routes.spec` | ❌ Wave 0 |
| FECH-03 | completeClosing rejeita se etapa incompleta | unit | `... --testPathPattern monthly-closing.routes.spec` | ❌ Wave 0 |
| FECH-03 | reopenClosing requer ADMIN, salva motivo + auditoria | unit | `... --testPathPattern monthly-closing.routes.spec` | ❌ Wave 0 |
| FECH-03 | checkPeriodOpen middleware retorna 422 para período CLOSED | unit | `... --testPathPattern check-period-open.spec` | ❌ Wave 0 |
| FECH-03 | checkPeriodOpen middleware retorna 422 para período BLOCKED | unit | `... --testPathPattern check-period-open.spec` | ❌ Wave 0 |
| FECH-03 | checkPeriodOpen middleware passa para período OPEN | unit | `... --testPathPattern check-period-open.spec` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @protos-farm/backend test -- --testPathPattern monthly-closing --passWithNoTests`
- **Per wave merge:** `pnpm --filter @protos-farm/backend test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/backend/src/modules/monthly-closing/monthly-closing.routes.spec.ts` — cobre FECH-01, FECH-02, FECH-03
- [ ] `apps/backend/src/middleware/check-period-open.spec.ts` — cobre FECH-03 middleware
- Padrão de mock: `jest.mock('../../database/prisma', ...)` conforme fiscal-periods.routes.spec.ts

---

## Code Examples

### Criar MonthlyClosing (upsert-like)
```typescript
// Source: padrão service do projeto + Prisma 7 create
export async function startClosing(
  organizationId: string,
  periodId: string,
  initiatedBy: string,
): Promise<MonthlyClosingOutput> {
  // Verificar se já existe um ativo
  const existing = await prisma.monthlyClosing.findFirst({
    where: { organizationId, periodId, status: 'IN_PROGRESS' },
  });
  if (existing) return formatClosing(existing);

  // Verificar se período existe e está OPEN
  const period = await prisma.accountingPeriod.findFirst({
    where: { id: periodId, organizationId },
    select: { id: true, month: true, year: true, status: true },
  });
  if (!period) throw new MonthlyClosingError('Período não encontrado', 'PERIOD_NOT_FOUND', 404);
  if (period.status !== 'OPEN') throw new MonthlyClosingError('Período não está aberto', 'PERIOD_NOT_OPEN', 422);

  const closing = await prisma.monthlyClosing.create({
    data: { organizationId, periodId, status: 'IN_PROGRESS', stepResults: {} },
  });
  return formatClosing(closing);
}
```

### Validar etapa individual
```typescript
// Source: padrão service + queries dos módulos existentes
export async function validateStep(
  organizationId: string,
  closingId: string,
  stepNumber: 1 | 2 | 3 | 4 | 5 | 6,
): Promise<StepValidationResult> {
  const closing = await prisma.monthlyClosing.findFirst({
    where: { id: closingId, organizationId },
    include: { period: { select: { month: true, year: true, fiscalYearId: true } } },
  });
  if (!closing) throw new MonthlyClosingError('Fechamento não encontrado', 'NOT_FOUND', 404);

  // D-03: verificar que etapa anterior está OK
  if (stepNumber > 1) {
    const prevResults = (closing.stepResults as Record<string, StepResult>);
    const prevKey = `step${stepNumber - 1}`;
    if (prevResults[prevKey]?.status !== 'OK') {
      throw new MonthlyClosingError(`Etapa ${stepNumber - 1} deve ser validada primeiro`, 'STEP_DEPENDENCY', 422);
    }
  }

  const result = await runStepValidation(organizationId, closing.period, stepNumber);

  // Salvar resultado
  const currentResults = (closing.stepResults as Record<string, unknown>) ?? {};
  await prisma.monthlyClosing.update({
    where: { id: closingId },
    data: {
      stepResults: {
        ...currentResults,
        [`step${stepNumber}`]: { ...result, validatedAt: new Date().toISOString() },
      },
    },
  });

  return result;
}
```

### Reabertura ADMIN-only
```typescript
// monthly-closing.routes.ts — usando middleware authorize já existente
import { authorize } from '../../middleware/authorize';
import { UserRole } from '@prisma/client';

monthlyClosingRouter.post(
  '/:closingId/reopen',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),  // D-10
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const closingId = req.params.closingId as string;
      const userId = req.user!.id;
      const { reason } = req.body;

      const result = await service.reopenClosing(orgId, closingId, userId, reason);
      await logAudit({ actorId: userId, ..., action: 'MONTHLY_CLOSING_REOPENED', ... });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Period blocking inline no service | Middleware centralizado checkPeriodOpen | Garante enforcement em todos os endpoints de escrita, não só journal-entries |
| assertPeriodOpen só em journal-entries | assertPeriodOpen em @protos-farm/shared + wrapper middleware | Reutilizável em qualquer rota |
| DepreciationRun.status como enum | DepreciationRun.status como String no schema | Filtrar com string literal 'COMPLETED', não importar de @prisma/client |

---

## Open Questions

1. **Política para etapa 5 sem importações bancárias**
   - What we know: Se org não tem BankStatementLines no período, count retorna 0 → auto-pass
   - What's unclear: Se esse comportamento é desejado ou se deve-se exigir ao menos 1 import conciliado
   - Recommendation: Auto-pass com summary "Nenhum extrato importado — etapa não aplicável" para flexibilidade; contador que usa contas bancárias vai naturalmente ter linhas PENDING se não conciliar

2. **MonthlyClosing com histórico — UNIQUE constraint**
   - What we know: D-11 diz que ao reabrir MonthlyClosing ganha status REOPENED, e ao fechar novamente cria novo processo de checklist
   - What's unclear: Se constraint UNIQUE(organizationId, periodId) deve ser removida para permitir múltiplos registros históricos por período
   - Recommendation: Remover UNIQUE, usar lógica de negócio: `findFirst({ where: { status: 'IN_PROGRESS' } })` para encontrar o ativo; múltiplos COMPLETED como histórico são válidos

3. **checkPeriodOpen para drafts vs postagens**
   - What we know: createJournalEntryDraft já verifica assertPeriodOpen internamente; o middleware seria redundante
   - What's unclear: Se o middleware deve ser aplicado no endpoint de criação de draft ou apenas no de post
   - Recommendation: Aplicar só em POST `journal-entries/:id/post` para evitar dupla verificação com mensagens diferentes; ou confiar na verificação interna do service e não adicionar middleware para esse endpoint

---

## Sources

### Primary (HIGH confidence)
- Código-fonte do projeto — fiscal-periods.service.ts, reconciliation.service.ts, auto-posting.service.ts, ledger.service.ts, payroll-runs.service.ts, depreciation-batch.service.ts, timesheets.service.ts
- packages/shared/src/utils/accounting/assert-period-open.ts — PeriodNotOpenError e assertPeriodOpen verificados
- apps/backend/prisma/schema.prisma — modelos AccountingPeriod, DepreciationRun, PayrollRun, Timesheet verificados diretamente
- apps/backend/src/middleware/authorize.ts — padrão de middleware com UserRole verificado
- apps/backend/src/shared/rbac/permissions.ts — hierarquia de papéis e permissões FINANCIAL/ADMIN verificadas

### Secondary (MEDIUM confidence)
- Padrão de testes com jest.mock('../../database/prisma') — verificado em fiscal-periods.routes.spec.ts e auto-posting.service.spec.ts

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma biblioteca nova; tudo verificado no código do projeto
- Architecture: HIGH — modelos, serviços e padrões todos verificados no código-fonte
- Pitfalls: HIGH — identificados diretamente por inspeção do schema e código existente
- Queries de etapa: HIGH — funções exportadas verificadas em cada service correspondente

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (projeto em desenvolvimento ativo — verificar schema antes de planejar)
