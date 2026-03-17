# Phase 1: Fundação Financeira - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Cadastro de contas bancárias vinculadas a fazendas e produtores rurais, com saldo real-time (apenas saldo inicial nesta fase — sem lançamentos manuais), extrato com filtros básicos e export (PDF/Excel/CSV), e dashboard de contas com cards e totalização. Fundação técnica: tipo Money (decimal.js) para aritmética monetária e producerId opcional nas contas.

</domain>

<decisions>
## Implementation Decisions

### Vinculação Conta × Produtor × Fazenda

- producerId é **opcional** na conta bancária — contas da organização (ex: conta do escritório) não têm produtor vinculado
- Relação conta × fazenda é **N:N** — uma conta pode atender múltiplas fazendas (tabela intermediária BankAccountFarm)
- Contas de crédito rural são um **tipo de conta** (enum no campo `type`), não entidade separada

### Convênio CNAB

- Campos de convênio CNAB (código, carteira, variação) **adiados para Phase 2** — migration separada quando CNAB for implementado
- Phase 1 foca apenas no cadastro base da conta

### Saldo e Extrato

- Phase 1 mostra **apenas saldo atual** (saldo inicial). Sem projeção — projeção virá quando CP/CR existir (Phase 2+)
- **Sem lançamentos manuais** nesta fase — saldo vem apenas do saldo de abertura. Movimentações virão de CP/CR/transferências
- Filtros de extrato **básicos**: período + tipo (entrada/saída). Filtros avançados quando houver CP/CR
- Export em **todos os formatos**: PDF (pdfkit) + Excel (exceljs) + CSV

### Dashboard de Contas

- Layout: **cards por conta + barra de totalização** (saldo total, total por tipo: corrente/investimento/crédito rural)
- Agrupamento: **lista flat com filtros** laterais por fazenda/tipo/banco. Sem agrupamento fixo por seção

### Lista de Bancos FEBRABAN

- Incluir **todos os bancos incluindo fintechs** (Nubank, C6, Inter, PagBank, etc.) — produtores rurais usam cada vez mais

### Claude's Discretion

- Implementação da lista de bancos FEBRABAN: JSON hardcoded vs seed no banco — Claude decide a melhor abordagem para o projeto
- Design exato dos cards de conta (quais informações mostrar, layout interno)
- Skeleton loading pattern
- Validação de dados bancários (dígito verificador de agência/conta)

</decisions>

<specifics>
## Specific Ideas

- Saldo projetado será adicionado nas próximas phases quando CP/CR existirem — interface deve ser preparada para receber esse dado
- Contas de crédito rural (PRONAF, custeio, investimento, comercialização) são tipos no enum, com campos extras opcionais (linha, garantias) que serão preenchidos na Phase 6

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `pdfkit`: já usado em `modules/pesticide-prescriptions/` para geração de PDF — reutilizar padrão
- `exceljs`: já usado em `modules/stock-outputs/` para export Excel — reutilizar padrão
- `StockBalance` aggregate pattern: saldo atualizado atomicamente em Prisma transaction — modelo para `BankAccountBalance`
- Sidebar com grupos: padrão existente para adicionar grupo "FINANCEIRO"
- Modal pattern: CRUD em modal, não em página dedicada (conforme CLAUDE.md)

### Established Patterns

- Módulos backend colocalizados: `modules/bank-accounts/` com `routes.ts`, `service.ts`, `types.ts`, `routes.spec.ts`
- Frontend: Page com tabs + Modal para CRUD (ex: StockEntriesPage, StockEntryModal)
- RLS por organização: todas as queries filtradas por orgId via Prisma middleware
- Decimal fields no Prisma: já usados em StockBalance, ProductConversion — mesmo pattern para valores monetários

### Integration Points

- `apps/backend/src/app.ts`: registrar `bankAccountsRouter`
- `apps/frontend/src/App.tsx`: adicionar rota `/bank-accounts`
- `apps/frontend/src/components/layout/Sidebar.tsx`: adicionar grupo FINANCEIRO
- `apps/backend/prisma/schema.prisma`: novos modelos BankAccount, BankAccountFarm, FinancialTransaction

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 01-funda-o-financeira_
_Context gathered: 2026-03-15_
