# Phase 40: DFC, Dashboard Executivo — Research

**Researched:** 2026-03-28
**Domain:** Financial Statements — DFC (CPC 03 R2), Cross-Validation, Executive Dashboard
**Confidence:** HIGH (codebase fully read; decisions locked in CONTEXT.md)

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Página /dfc com tabs Direto/Indireto. Cada tab mostra 3 seções (Operacional, Investimento, Financiamento) + saldo inicial/final + variação líquida.
- **D-02:** Fonte de dados direto: transações liquidadas (CP/CR pagos no período). Reusar PAYABLE_DFC_MAP e RECEIVABLE_DFC_MAP de `modules/cashflow/cashflow.types.ts`. Não usar JournalEntry.
- **D-03:** Período e comparativo: mesmo padrão DRE — seletor exercício fiscal + mês. 3 colunas: Mês atual | Acumulado exercício | Mesmo período ano anterior.
- **D-04:** Ajustes padrão CPC 03 R2: Lucro Líquido (DRE) + Depreciação + Provisões (férias/13º) + Variação Valor Justo CPC 29 + Delta Capital de Giro (ΔCR, ΔEstoques, ΔCP, ΔObrig. Trabalhistas/Tributárias). Seções Investimento e Financiamento idênticas ao direto.
- **D-05:** Layout Cards + Gráficos: topo 4 cards (Resultado Acumulado, Receita Total, Despesa Total, Margem Operacional com delta % vs período anterior). Meio: gráfico linha receita vs despesa 12 meses + donut composição custos por natureza. Baixo: indicadores BP + alertas.
- **D-06:** Página nova separada em /accounting-dashboard. FinancialDashboardPage existente continua focado no operacional financeiro.
- **D-07:** 3 alertas contábeis clicáveis: períodos não fechados (→ FiscalYearsPage), lançamentos pendentes na fila auto-posting (→ JournalEntriesPage), contas sem mapeamento SPED (→ ChartOfAccountsPage).
- **D-08:** 4 indicadores BP no dashboard: Liquidez Corrente, Endividamento Geral, ROE, PL/ha.
- **D-09:** Ativar invariante #2 na cross-validation com tolerância ±0.01. Compara: variação líquida de caixa DFC vs (saldo final - saldo inicial) contas caixa/bancos (1.1.01.xx) no BP.
- **D-10:** DFC e Dashboard Contábil no grupo CONTABILIDADE do sidebar: ... DFC, Validação Cruzada, Dashboard Contábil.
- **D-11:** Rotas: /dfc e /accounting-dashboard.

### Claude's Discretion

- Estrutura interna do DfcCalculatorService (classe pura vs funções)
- Queries para buscar CP/CR liquidados no período (Prisma vs raw SQL)
- Cálculo dos deltas de capital de giro (quais contas incluir em cada grupo)
- Detalhes visuais: biblioteca de gráficos (recharts já usado no projeto), cores, tooltips
- Ordem e agrupamento das linhas dentro de cada seção DFC
- Layout responsivo do dashboard (grid breakpoints)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                                                                | Research Support                                                                                                                                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DFC-01  | Contador pode gerar DFC pelo método direto com 3 seções (Atividades Operacionais, Investimento, Financiamento), reaproveitando classificação de fluxo de caixa v1.0, com reconciliação saldo inicial/final | DfcCalculatorService (puro) lê CP/CR liquidados via Prisma; reutiliza PAYABLE_DFC_MAP + RECEIVABLE_DFC_MAP existentes; saldo inicial/final de caixa vem de AccountBalance contas 1.1.01.xx                                                |
| DFC-02  | Contador pode gerar DFC pelo método indireto partindo do Lucro Líquido (DRE), com ajustes não-caixa (depreciação, provisões, variação valor justo CPC 29), variação capital de giro                        | Lucro líquido de DreCalculatorService; depreciação de AccountBalance contas 5.2.03.xx; provisões de PayrollProvision; CPC29 via isFairValueAdj=true; deltas de capital de giro de AccountBalance closingBalance mês atual vs mês anterior |
| DFC-03  | Sistema valida cruzamento DFC↔BP (variação caixa DFC = variação caixa/bancos BP) com alerta automático de divergência                                                                                      | Ativar invariant #2 em cross-validation.calculator.ts; wire DFC netCashFlow + BP cashAccountsDelta; tolerância ±0.01 já estabelecida                                                                                                      |
| DASH-01 | Gerente pode visualizar dashboard contábil executivo com resultado acumulado, evolução mensal receita/despesa, composição custos, indicadores BP, alertas                                                  | AccountingDashboardService orquestra getDre + getBalanceSheet; gráfico recharts já disponível; alertas consultam FiscalPeriod + PendingJournalPosting + ChartOfAccount                                                                    |

</phase_requirements>

---

## Summary

Phase 40 é principalmente uma fase de **orquestração e wiring** — o projeto já possui todos os blocos fundamentais. O `DfcCalculatorService` (novo) precisa ser uma função pura que recebe dados pré-carregados, seguindo o mesmo padrão de `calculateDre` e `calculateBp`. A única query nova de substância é buscar `Payable` e `Receivable` liquidados no período fiscal filtrado por `paidAt`/`receivedAt` dentro do intervalo de datas do exercício. O método indireto consome saídas de serviços já existentes (DRE e AccountBalance).

O `cross-validation.calculator.ts` tem o invariante #2 explicitamente marcado como `PENDING` aguardando esta fase. Ativá-lo requer adicionar `dfcNetCashFlow` e `bpCashDelta` ao `CrossValidationInput` e passar esses valores do `getCrossValidation` orchestrator. A `financial-statements.service.ts` já contém o padrão exato de como buscar deltas de AccountBalance.

O `AccountingDashboardPage` segue o padrão visual do `FinancialDashboardPage` existente (cards + lazy charts + alerts), mas com dados contábeis em vez de operacionais. O recharts já está instalado e em uso em `CashflowChart` e `FinancialDashboardPage`.

**Primary recommendation:** Usar funções puras para DFC direto e indireto (não classes), orquestradas por `financial-statements.service.ts`, adicionando dois novos endpoints ao router existente. O dashboard contábil recebe um serviço e endpoint próprios.

---

## Standard Stack

### Core (todos já instalados no projeto)

| Library          | Version | Purpose                                     | Why Standard                                       |
| ---------------- | ------- | ------------------------------------------- | -------------------------------------------------- |
| decimal.js       | in use  | Cálculo monetário sem floating-point errors | Padrão do projeto em todo módulo financeiro        |
| Prisma 7         | in use  | Queries Payable/Receivable/AccountBalance   | ORM do projeto                                     |
| recharts         | in use  | Gráficos linha e donut no dashboard         | Já usado em CashflowChart e FinancialDashboardPage |
| lucide-react     | in use  | Ícones nas páginas                          | Padrão do design system                            |
| react-router-dom | in use  | Rotas /dfc e /accounting-dashboard          | Roteador do projeto                                |

### Sem novas dependências

Nenhuma instalação necessária. Todo stack está disponível.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/financial-statements/
├── dfc.calculator.ts          (NOVO — puro, sem Prisma)
├── dfc.types.ts               (NOVO — DfcInput, DfcOutput, DfcFilters)
├── financial-statements.service.ts   (EXISTENTE — add getDfc + getDashboard)
├── financial-statements.types.ts     (EXISTENTE — add DfcFilters, DashFilters, etc.)
├── financial-statements.routes.ts    (EXISTENTE — add 3 endpoints)
├── financial-statements.routes.spec.ts (EXISTENTE — add tests)
├── cross-validation.calculator.ts    (EXISTENTE — activate invariant #2)
├── dre.calculator.ts          (EXISTENTE — not touched)
└── bp.calculator.ts           (EXISTENTE — not touched)

apps/frontend/src/
├── pages/DfcPage.tsx          (NOVO)
├── pages/DfcPage.css          (NOVO)
├── pages/AccountingDashboardPage.tsx  (NOVO)
├── pages/AccountingDashboardPage.css  (NOVO)
├── hooks/useDfc.ts            (NOVO)
├── hooks/useAccountingDashboard.ts    (NOVO)
├── types/financial-statements.ts     (EXISTENTE — extend with DFC + Dashboard types)
├── components/financial-statements/DfcTable.tsx  (NOVO)
└── App.tsx                    (EXISTENTE — add routes)
```

### Pattern 1: Pure Calculator Function (DFC direto)

O padrão estabelecido é: função pura que recebe `DfcInput` (dados pré-carregados) e retorna `DfcOutput`. Sem Prisma, sem side-effects, totalmente testável com Jest.

```typescript
// dfc.calculator.ts
import Decimal from 'decimal.js';
import type { DfcInput, DfcOutput } from './dfc.types';
import { PAYABLE_DFC_MAP, RECEIVABLE_DFC_MAP } from '../cashflow/cashflow.types';

export function calculateDfcDireto(input: DfcDiretoInput): DfcDiretoOutput {
  // Group liquidated CP/CR by DFC section
  // Returns sections: operacional, investimento, financiamento
  // + saldoInicial, saldoFinal, variacaoLiquida
}
```

### Pattern 2: Service Orchestration (getDfc)

O serviço carrega dados do Prisma e chama a função pura. Seguir exatamente o padrão de `getDre` em `financial-statements.service.ts`.

```typescript
// financial-statements.service.ts (adição)
export async function getDfc(organizationId: string, filters: DfcFilters): Promise<DfcOutput> {
  // 1. Verify fiscal year exists
  // 2. Load liquidated Payables: where paidAt BETWEEN startDate AND endDate
  // 3. Load liquidated Receivables: where receivedAt BETWEEN startDate AND endDate
  // 4. Load AccountBalance for cash accounts (1.1.01.xx) for saldo inicial/final
  // 5. For YTD: load all months 1..filters.month, aggregate
  // 6. For prior year: load same month from prior fiscal year
  // 7. Call calculateDfcDireto(input)
  // 8. Call calculateDfcIndireto(input) — needs DRE result + AccountBalance deltas
}
```

### Pattern 3: Cross-Validation Activation (invariante #2)

O `cross-validation.calculator.ts` já tem o slot do invariante #2. A ativação requer:

1. Adicionar campos ao `CrossValidationInput`:

```typescript
// financial-statements.types.ts
export interface CrossValidationInput {
  // ... existing fields ...
  dfcNetCashFlow: string; // variação líquida total DFC (direto ou indireto)
  bpCashDelta: string; // closingBalance 1.1.01.xx atual - closingBalance prior
}
```

2. Substituir o stub PENDING pelo `buildInvariant` real em `calculateCrossValidation`.

3. O `getCrossValidation` em `financial-statements.service.ts` precisa:
   - Chamar `getDfc` para obter `dfcNetCashFlow`
   - Calcular `bpCashDelta` das AccountBalance contas com código `1.1.01`

4. Adicionar `investigateUrl: '/dfc'` quando status = FAILED.

### Pattern 4: Dashboard Service

Novo serviço `getAccountingDashboard` em `financial-statements.service.ts`:

```typescript
export async function getAccountingDashboard(
  organizationId: string,
  filters: { fiscalYearId: string; month: number },
): Promise<AccountingDashboardOutput> {
  // Cards: reusa getDre (resultadoLiquido YTD, receita total, despesa total, margem)
  // Gráfico 12m: busca AccountBalance meses 1..12 para receita/despesa (sem chamar getDre 12x)
  //   → raw query ou groupBy AccountBalance, aggregate RECEITA/DESPESA codes by month
  // Donut composição custos: AccountBalance por grupo de despesa (CPV, admin, pessoal, deprec, financeira)
  // Indicadores BP: reusa getBalanceSheet (subset dos 6 indicadores)
  // Alertas: 3 queries específicas abaixo
}
```

**Alertas — queries concretas:**

- Períodos não fechados: `prisma.fiscalPeriod.count({ where: { organizationId, status: 'OPEN' } })`
- Lançamentos pendentes: `prisma.pendingJournalPosting.count({ where: { organizationId, status: 'PENDING' } })`
- Contas sem SPED: `prisma.chartOfAccount.count({ where: { organizationId, isActive: true, isSynthetic: false, spedRefCode: null } })`

### Pattern 5: DFC Indireto — Cálculo dos Ajustes (Claude's Discretion)

O CPC 03 R2 define os ajustes ao lucro líquido na ordem:

1. **Lucro Líquido** — de `DreOutput.resultadoLiquido.ytd`
2. **Depreciação** — AccountBalance YTD para contas `5.2.03.xx` (despesas-depreciacao), soma de debit - credit
3. **Provisões de Férias** — AccountBalance para conta `2.1.xx` com nome contendo "Férias" ou prefix `2.1.03.xx`, delta = closingBalance atual - closingBalance mês anterior
4. **Provisões 13º** — idem para `2.1.04.xx`
5. **Variação Valor Justo CPC 29** — AccountBalance YTD para contas com `isFairValueAdj = true`
6. **Variação Capital de Giro (ΔCapital de Giro)**:
   - ΔContas a Receber: delta AccountBalance `1.1.03.xx` (ou similar) — se CR aumentou, é uso de caixa (negativo)
   - ΔEstoques: delta AccountBalance `1.1.02.xx` — se estoques aumentaram, uso de caixa (negativo)
   - ΔContas a Pagar: delta AccountBalance `2.1.01.xx` — se CP aumentou, fonte de caixa (positivo)
   - ΔObrigações Trabalhistas/Tributárias: delta AccountBalance `2.1.02.xx` + `2.1.03.xx` + `2.1.04.xx`

**Recomendação:** Usar prefixo de código do COA para identificar grupos, não nomes de conta — o template rural segue códigos padronizados (CFC/Embrapa) definidos em Phase 35.

**Importante:** O método indireto usa `closingBalance` do AccountBalance para calcular deltas (diferença entre mês atual e mês anterior), não movimentos de débito/crédito. Seções Investimento e Financiamento do indireto são idênticas ao direto (mesmas queries Payable/Receivable).

### Pattern 6: DfcPage — Tabs Direto/Indireto

Seguir padrão de `TrialBalancePage` (tabs pattern) e `DrePage` (fiscal year/month selector):

```typescript
// DfcPage.tsx
const [activeTab, setActiveTab] = useState<'direto' | 'indireto'>('direto');
```

Ambas as tabs compartilham o mesmo seletor de exercício/mês. O endpoint `/financial-statements/dfc` retorna ambos (`direto` e `indireto`) em um único request para evitar dupla fetch.

### Pattern 7: Gráfico 12 Meses (Dashboard) — Otimização

Em vez de chamar `getDre` 12 vezes (pesado), usar uma query direta em AccountBalance:

```sql
SELECT month, SUM(CASE WHEN coa.accountType = 'RECEITA' THEN ab.creditTotal - ab.debitTotal ELSE 0 END) as receita,
       SUM(CASE WHEN coa.accountType = 'DESPESA' THEN ab.debitTotal - ab.creditTotal ELSE 0 END) as despesa
FROM account_balances ab
JOIN chart_of_accounts coa ON coa.id = ab."accountId"
WHERE ab."organizationId" = $1 AND ab."fiscalYearId" = $2
  AND coa."accountType" IN ('RECEITA', 'DESPESA') AND coa."isSynthetic" = false
GROUP BY month
ORDER BY month
```

Isso retorna os 12 meses com uma única query — padrão já usado em `computeMarginRanking` (raw SQL via `prisma.$queryRaw`).

### Anti-Patterns to Avoid

- **Chamar getDre/getBalanceSheet N vezes** para montar gráfico de tendência — usar query agregada direta
- **Importar Prisma em calculators** — calculators são puros, sem dependências de DB
- **Tipagem `string` para enums Prisma** — usar `as const` em mocks; importar tipo do Prisma
- **Desestruturar `req.params`** sem cast — usar `req.params.id as string`
- **Usar `window.confirm()`** — usar ConfirmModal de `@/components/ui/ConfirmModal`
- **Reutilizar DfcSummary de cashflow.types** diretamente — aquele tipo é orientado a projeção futura (12 arrays mensais), não a demonstrativo de período (3 colunas: mês/ytd/prior)

---

## Don't Hand-Roll

| Problem                          | Don't Build                     | Use Instead                                                     | Why                                                                |
| -------------------------------- | ------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Aritmética decimal               | `Math.round`, `Number.toFixed`  | `Decimal.js`                                                    | Já em uso; evita erros de ponto flutuante em valores monetários    |
| Classificação DFC por categoria  | Nova lógica de mapeamento       | `PAYABLE_DFC_MAP` + `RECEIVABLE_DFC_MAP` de `cashflow.types.ts` | Já testado e validado em v1.0; D-02 locked                         |
| Indicadores BP                   | Recalcular LC, EG, ROE          | `BpOutput.indicators` de `getBalanceSheet`                      | Service já retorna todos os 4 indicadores necessários              |
| Resultado líquido para dashboard | Novo cálculo de receita/despesa | `DreOutput.resultadoLiquido` de `getDre`                        | Já implementado e testado                                          |
| Gráficos                         | Construir do zero               | recharts `LineChart` + `PieChart`                               | Já instalado; padrão do `CashflowChart` e `FinancialDashboardPage` |
| Lazy loading de páginas          | Import estático                 | `React.lazy()` + `Suspense`                                     | Padrão do projeto em App.tsx                                       |

---

## Common Pitfalls

### Pitfall 1: Campo `settledAt` vs `receivedAt` no schema

**What goes wrong:** O CONTEXT.md menciona `settledAt` para Receivable, mas o schema usa `receivedAt`.
**Why it happens:** Divergência entre nome no contexto de discussão e nome real do campo Prisma.
**How to avoid:** Usar `receivedAt` para Receivable e `paidAt` para Payable. Verificar `schema.prisma` antes de escrever queries.
**Warning signs:** `Property 'settledAt' does not exist on type 'Receivable'` no TypeScript.

### Pitfall 2: `ASSET_SALE` ausente do RECEIVABLE_DFC_MAP

**What goes wrong:** `ReceivableCategory` inclui `ASSET_SALE` (venda de ativo = seção Investimento), mas `RECEIVABLE_DFC_MAP` no `cashflow.types.ts` não mapeou essa categoria.
**Why it happens:** O mapa foi criado antes de `ASSET_SALE` ser adicionado ao enum ou simplesmente foi omitido.
**How to avoid:** Adicionar `ASSET_SALE: 'INVESTIMENTO'` ao `RECEIVABLE_DFC_MAP` como parte desta fase.
**Warning signs:** Vendas de ativos aparecem sem classificação ou somem silenciosamente da DFC.

### Pitfall 3: Double-counting no DFC indireto — seções Investimento/Financiamento

**What goes wrong:** Seções Investimento e Financiamento do indireto somam os mesmos CPs/CRs do direto, mas o capital de giro da seção Operacional também captura variação de CP. Pode resultar em double-count.
**Why it happens:** Confusão entre o que é ajuste de capital de giro (variação de saldo contábil) e o que é fluxo real de caixa (transação liquidada).
**How to avoid:** No indireto, as seções Investimento e Financiamento são apuradas por transações liquidadas (igual ao direto). Os ajustes de capital de giro na seção Operacional são baseados em `closingBalance` delta — representam a diferença entre o lucro contábil e o caixa gerado, não pagamentos reais.

### Pitfall 4: DFC por exercício fiscal vs ano calendário

**What goes wrong:** `paidAt`/`receivedAt` são timestamps em UTC; o exercício fiscal pode ser jul-dez. A query de período deve usar `fiscalYear.startDate` e `fiscalYear.endDate`, não `year-01-01`/`year-12-31`.
**Why it happens:** Hardcodar `new Date(year, 0, 1)` em vez de usar as datas do FiscalYear.
**How to avoid:** Sempre usar `fiscalYear.startDate`/`fiscalYear.endDate` para delimitar o exercício; para mês específico, derivar `startDate` e `endDate` do mês dentro do intervalo do exercício.
**Warning signs:** DFC não bate com DRE quando exercício é safra (jul-jun).

### Pitfall 5: Invariante #2 — `getCrossValidation` chama `getDfc` recursivamente pesado

**What goes wrong:** Se `getCrossValidation` chama `getDfc` que por sua vez chama `getDre` e `getBalanceSheet`, a página de validação cruzada se torna muito lenta (4 dados financeiros em sequência).
**Why it happens:** Não planejar o fluxo de dependências antes de implementar.
**How to avoid:** Em `getCrossValidation`, calcular `bpCashDelta` diretamente (2 queries AccountBalance para contas 1.1.01.xx), e obter `dfcNetCashFlow` de uma query leve de CP/CR liquidados — ou melhor, extrair a net cash flow da DFC direto que já está sendo calculada na mesma sessão. Alternativa: passar o resultado da DFC como parâmetro opcional para evitar recalcular.

### Pitfall 6: `DfcSummary` do cashflow.types.ts não é o tipo certo para DFC contábil

**What goes wrong:** Tentativa de reusar `DfcSummary` (orientado a projeção futura com `monthlyAmounts: number[12]`) para a DFC demonstrativo (3 colunas: mês atual/YTD/ano anterior).
**Why it happens:** Confundir os dois módulos que fazem DFC.
**How to avoid:** Criar tipos novos em `financial-statements.types.ts`: `DfcSectionRow` (análogo a `DreSectionRow`) com campos `currentMonth`, `ytd`, `priorYear`. Reusar apenas `PAYABLE_DFC_MAP`/`RECEIVABLE_DFC_MAP` (as constantes), não os tipos.

### Pitfall 7: Dashboard — chamar getDre 12 vezes para gráfico mensal

**What goes wrong:** Loop de 12 meses chamando `getDre` para cada mês = 12 × N queries ao banco.
**Why it happens:** Copiar o padrão de endpoint único sem adaptar para série temporal.
**How to avoid:** Uma query `prisma.$queryRaw` agregada por mês, conforme Pattern 7 acima.

---

## Code Examples

### Query: CP liquidados no período (DFC direto)

```typescript
// Source: pattern derivado de cashflow.service.ts + financial-statements.service.ts
const startDate = new Date(fiscalYear.year, filters.month - 1, 1);
const endDate = new Date(fiscalYear.year, filters.month, 0, 23, 59, 59, 999);

const paidPayables = await prisma.payable.findMany({
  where: {
    organizationId,
    paidAt: { gte: startDate, lte: endDate },
  },
  select: {
    category: true,
    amountPaid: true,
    paidAt: true,
  },
});
```

### Query: CR liquidados no período (DFC direto)

```typescript
// Receivable usa receivedAt (não settledAt — ver Pitfall 1)
const settledReceivables = await prisma.receivable.findMany({
  where: {
    organizationId,
    receivedAt: { gte: startDate, lte: endDate },
  },
  select: {
    category: true,
    amountReceived: true,
    receivedAt: true,
  },
});
```

### Query: Saldo inicial/final caixa/bancos para DFC

```typescript
// Contas 1.1.01.xx = caixa e bancos no plano de contas rural CFC/Embrapa
const cashAccounts = await prisma.chartOfAccount.findMany({
  where: {
    organizationId,
    isActive: true,
    isSynthetic: false,
    code: { startsWith: '1.1.01' },
  },
  select: { id: true },
});
const cashAccountIds = cashAccounts.map((a) => a.id);

const currentBalances = await prisma.accountBalance.findMany({
  where: {
    organizationId,
    fiscalYearId: filters.fiscalYearId,
    month: filters.month,
    accountId: { in: cashAccountIds },
  },
  select: { closingBalance: true, openingBalance: true },
});
```

### Ativar invariante #2 em cross-validation.calculator.ts

```typescript
// Source: cross-validation.calculator.ts (Phase 40 activation)
// Replace the PENDING stub with:
const dfcNetCashFlow = new Decimal(input.dfcNetCashFlow);
const bpCashDelta = new Decimal(input.bpCashDelta);

const invariant2 = buildInvariant(
  'dfc-caixa-bp',
  'Variacao Caixa DFC = Variacao Caixa/Bancos BP',
  bpCashDelta, // expected: delta caixa/bancos no BP
  dfcNetCashFlow, // found: variação líquida total da DFC
  '/dfc',
);
```

### Sidebar — adicionar DFC e Dashboard Contábil

```typescript
// Source: apps/frontend/src/components/layout/Sidebar.tsx — grupo CONTABILIDADE
// Adicionar após 'cross-validation':
{ to: '/dfc', icon: ArrowLeftRight, label: 'DFC' },
{ to: '/accounting-dashboard', icon: LayoutDashboard, label: 'Dashboard Contabil' },
```

### Hook useDfc

```typescript
// Source: padrão de useDre.ts
export function useDfc(orgId: string | undefined, filters: DfcFilters | null) {
  // Mesmo padrão: useState data/loading/error + useEffect + useCallback
  // GET /org/:orgId/financial-statements/dfc?fiscalYearId=...&month=...
}
```

---

## State of the Art

| Old Approach                              | Current Approach                                               | When Changed | Impact                                                 |
| ----------------------------------------- | -------------------------------------------------------------- | ------------ | ------------------------------------------------------ |
| DFC em cashflow.service (projeção futura) | DFC contábil em financial-statements (demonstrativo histórico) | Phase 40     | Separação de responsabilidades; dados fonte diferentes |
| Invariante #2 PENDING                     | Invariante #2 ativo com DFC net cash flow                      | Phase 40     | Cross-validation página mostra 4/4 invariantes         |

**Deprecated/outdated:**

- `DfcSummary` de `cashflow.types.ts`: adequado apenas para projeção futura, não para demonstrativo contábil com 3 colunas (mês/YTD/ano anterior). Não reutilizar para o novo DFC contábil.

---

## Open Questions

1. **Contas 1.1.01.xx para caixa/bancos — todos existem no template CFC/Embrapa?**
   - What we know: `bp.calculator.ts` usa `1.1.` para Ativo Circulante; `financial-statements.service.ts` usa `1.1.02` para estoques
   - What's unclear: Confirmação que as contas bancárias do plano rural template estão sob `1.1.01.xx` especificamente
   - Recommendation: Verificar `coa-rural-template.ts` (Phase 35) ou realizar query no banco durante implementação; fallback = buscar contas com nome contendo "Caixa" ou "Banco" se código não bater

2. **Instalar `PayrollProvision` para ajuste de provisões no indireto — qual é a conta contábil?**
   - What we know: `PayrollProvision` usa `provisionType VACATION/THIRTEENTH` (STATE.md); contas de provisão ficam no passivo circulante (`2.1.03.xx` e `2.1.04.xx` no template)
   - What's unclear: Se o saldo do PayrollProvision está refletido no AccountBalance (via journal entries de Phase 37) ou se precisa ser lido diretamente da tabela `PayrollProvision`
   - Recommendation: Se o auto-posting de Phase 37 lança as provisões em `2.1.03.xx`/`2.1.04.xx`, usar delta AccountBalance. Verificar na implementação se os account balances têm valores — se não, fazer fallback para `prisma.payrollProvision.findMany`

3. **`RECEIVABLE_DFC_MAP` missing `ASSET_SALE`**
   - What we know: Enum `ReceivableCategory` tem `ASSET_SALE`; RECEIVABLE_DFC_MAP não a mapeia
   - What's unclear: Se já existem registros com `category = ASSET_SALE` no banco de produção
   - Recommendation: Adicionar `ASSET_SALE: 'INVESTIMENTO'` ao mapa como parte da implementação; é trivial e semanticamente correto (venda de ativo = seção Investimento)

---

## Environment Availability

Step 2.6: SKIPPED (sem novas dependências externas — fase usa stack 100% existente)

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| Framework          | Jest (backend) + Vitest (frontend)                                           |
| Config file        | `apps/backend/jest.config.js`                                                |
| Quick run command  | `cd apps/backend && npx jest src/modules/financial-statements --no-coverage` |
| Full suite command | `cd apps/backend && npx jest --no-coverage`                                  |

### Phase Requirements → Test Map

| Req ID  | Behavior                                          | Test Type            | Automated Command                                    | File Exists?                     |
| ------- | ------------------------------------------------- | -------------------- | ---------------------------------------------------- | -------------------------------- |
| DFC-01  | `calculateDfcDireto` classifica CP/CR por seção   | unit                 | `npx jest dfc.calculator --no-coverage`              | ❌ Wave 0                        |
| DFC-01  | `getDfc` endpoint retorna direto com 3 seções     | integration (routes) | `npx jest financial-statements.routes --no-coverage` | ✅ (extend)                      |
| DFC-02  | `calculateDfcIndireto` aplica ajustes CPC 03 R2   | unit                 | `npx jest dfc.calculator --no-coverage`              | ❌ Wave 0                        |
| DFC-03  | invariante #2 PASSED quando valores coincidem     | unit                 | `npx jest cross-validation.calculator --no-coverage` | ❌ Wave 0 (extend existing spec) |
| DFC-03  | invariante #2 FAILED com `investigateUrl: '/dfc'` | unit                 | `npx jest cross-validation.calculator --no-coverage` | ❌ Wave 0                        |
| DASH-01 | `getAccountingDashboard` retorna cards + alertas  | integration (routes) | `npx jest financial-statements.routes --no-coverage` | ✅ (extend)                      |

### Sampling Rate

- **Por task commit:** `cd apps/backend && npx jest src/modules/financial-statements --no-coverage`
- **Por wave merge:** `cd apps/backend && npx jest --no-coverage`
- **Phase gate:** Full suite green antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/financial-statements/dfc.calculator.spec.ts` — cobre DFC-01 (direto, 3 seções, saldo inicial/final) e DFC-02 (indireto, ajustes CPC 03 R2)
- [ ] Estender `cross-validation.calculator.ts` spec (arquivo existe implicitamente) para cobrir DFC-03 (invariante #2 PASSED/FAILED)

_(Os arquivos `financial-statements.routes.spec.ts` e `dre.calculator.ts`/`bp.calculator.ts` já existem — apenas adicionar casos de teste novos)_

---

## Project Constraints (from CLAUDE.md)

| Directive                                                       | Impact on Phase 40                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Express 5: `req.params.id as string`                            | Todos os novos endpoints devem usar `req.params.orgId as string` — nunca desestruturar                             |
| Prisma enums: usar `as const` ou importar tipo                  | Em mocks de teste dos calculators, `category: 'OPERACIONAL' as const`                                              |
| Decimal.js: `Decimal.max(a,b)` estático — `a.max(b)` não existe | Usar apenas métodos de instância: `.plus()`, `.minus()`, `.div()`, `.times()`, `.abs()`                            |
| Frontend: tipos espelham backend                                | `DfcOutput` e `AccountingDashboardOutput` precisam de tipos correspondentes em `src/types/financial-statements.ts` |
| Formulários em modal, nunca página dedicada                     | N/A — DFC e Dashboard são páginas de consulta, não formulários                                                     |
| `ConfirmModal` nunca `window.confirm()`                         | N/A — sem ações destrutivas nesta fase                                                                             |
| Cores: `#C62828` apenas para erros, nunca decorativo            | Card do invariante #2 FAILED usa `var(--color-error-500)` — correto                                                |
| Touch targets mínimo 48x48px                                    | Botões nas páginas DFC e Dashboard devem ter min-height 48px                                                       |
| Tabs pattern — `hidden` attribute para preservar estado         | Se DfcPage usar tabs, considerar `hidden` vs conditional render                                                    |
| Módulos colocalizados: `controller+service+routes+types`        | DFC pertence ao módulo `financial-statements`, não a um módulo separado                                            |

---

## Sources

### Primary (HIGH confidence)

- Código-fonte lido diretamente: `cashflow.types.ts`, `cross-validation.calculator.ts`, `financial-statements.service.ts`, `financial-statements.types.ts`, `bp.calculator.ts`, `dre.calculator.ts`, `financial-statements.routes.ts`, `Sidebar.tsx`, `DrePage.tsx`, `FinancialDashboardPage.tsx`, `schema.prisma` (modelos Payable, Receivable, AccountBalance, ChartOfAccount)
- `40-CONTEXT.md` — decisões do usuário (fonte autoritativa para locked decisions)
- `REQUIREMENTS.md` — requisitos DFC-01 a DFC-03, DASH-01
- `STATE.md` — decisões acumuladas de phases anteriores

### Secondary (MEDIUM confidence)

- CPC 03 R2 (NBC TG 03 R2) — conhecimento de treinamento sobre estrutura da DFC indireta (Lucro Líquido + ajustes não-caixa + variação capital de giro + seções Investimento/Financiamento)

### Tertiary (LOW confidence)

- Nenhum item de baixa confiança — toda pesquisa baseada em código-fonte existente e decisões locked.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — todo stack já instalado e em uso ativo
- Architecture: HIGH — padrões idênticos existem em DRE/BP, código lido diretamente
- Pitfalls: HIGH — identificados a partir de discrepâncias reais entre CONTEXT.md e schema.prisma (settledAt vs receivedAt, ASSET_SALE missing from map)
- DFC indireto (ajuste de capital de giro): MEDIUM — prefixos de conta assumidos do template CFC/Embrapa (Phase 35); devem ser verificados durante implementação

**Research date:** 2026-03-28
**Valid until:** 2026-05-28 (stack estável, sem dependências externas voláteis)
