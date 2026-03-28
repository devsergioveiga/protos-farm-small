# Phase 41: SPED ECD e Relatório Integrado - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

SpedEcdWriter custom (pipe-delimited, UTF-8, CRLF) gerando arquivo ECD com Blocos 0 (abertura), I (lançamentos e saldos — I050, I100, I150/I155, I200/I250), J (demonstrações — J005, J100, J150, J210), 9 (encerramento), usando plano referencial L300R rural (spedRefCode já mapeado no COA template). Livro tipo G (Diário Geral). Pré-validação com erros bloqueantes e avisos informativos, apresentados inline na página. Relatório integrado PDF profissional (capa + índice + DRE + BP + DFC + notas explicativas) para crédito rural. Geração síncrona. Frontend com página única /sped-ecd com tabs SPED ECD e Relatório Integrado.

</domain>

<decisions>
## Implementation Decisions

### Formato SPED ECD
- **D-01:** Geração **síncrona** — resposta HTTP direta com download do arquivo. Sem BullMQ/fila async. Arquivo texto puro pipe-delimited gera em segundos.
- **D-02:** **Todos os blocos fixos**: Bloco 0 (abertura) + I (lançamentos/saldos) + J (demonstrações) + 9 (encerramento). Sem seleção de blocos.
- **D-03:** Período: **exercício fiscal completo** (FiscalYear). Seletor de exercício fiscal, gera todos os meses do ano.
- **D-04:** Bloco J: **J100 (BP) + J150 (DRE) + J210 (DLPA)**. Sem J215 (fato relevante) — raramente usado em rural.
- **D-05:** Registro I050: **todas as contas ativas** (sintéticas + analíticas). PVA valida hierarquia completa — omitir sintéticas gera erro. Filtra isActive=false.
- **D-06:** Dados do contador: **campos na Organization** — accountantName, accountantCrc, accountantCpf. Preenchido uma vez, usado em SPED e relatório PDF. Requer migration.
- **D-07:** Registros I200/I250 (lançamentos): **ambos I150/I155 + I200/I250**. Saldos mensais + lançamentos individuais. PVA valida consistência entre os dois.
- **D-08:** Livro contábil: **tipo G — Diário Geral**. Padrão para PJ rural, mais simples de implementar.
- **D-09:** Encoding: **UTF-8**. PVA 10.x aceita. Mais compatível com Node.js.
- **D-10:** Quebra de linha: **CRLF (\r\n)** conforme manual SPED.
- **D-11:** Assinatura: **sem hash interno** — PVA da RFB assina com certificado digital A1/A3. Sistema só gera o conteúdo.
- **D-12:** Nome do arquivo: **SPED_ECD_{CNPJ}_{ANO}.txt** — padrão fixo. CNPJ da Organization.
- **D-13:** Registros I350/I355 (saldos diários): **omitidos**. Rurais usam I150/I155 (mensal). Simplifica geração.

### Pré-validação PVA
- **D-14:** Severidade: **ERRO bloqueia download + AVISO informativo permite**. ERRO: contas sem spedRefCode, períodos não fechados, balancete desequilibrado, I050 duplicatas. AVISO: contas sem movimento, contas inativas.
- **D-15:** Apresentação: **lista inline na página** com ícones vermelho (erro) / amarelo (aviso). Botão "Gerar SPED" desabilitado se houver erros. Links diretos para corrigir (ex: link para conta sem mapeamento).
- **D-16:** Trigger: **automático ao selecionar exercício fiscal**. Usuário seleciona FiscalYear → validação roda automaticamente. Se tudo OK, botão "Gerar SPED" habilitado.
- **D-17:** Consistência I155: **verificar** que soma dos débitos/créditos I250 bate com total de movimentação I155. Previne erros que o PVA pegaria.

### Relatório Integrado PDF
- **D-18:** Estrutura: **6 seções** — (1) Capa com dados fazenda/empresa, (2) Índice, (3) DRE, (4) BP, (5) DFC método direto, (6) Notas explicativas. pdfkit (padrão do projeto).
- **D-19:** Notas explicativas: **template automático + texto livre**. Notas geradas automaticamente (contexto operacional, políticas contábeis, CPC 29 se tem ativo biológico) + campo para notas adicionais do contador.
- **D-20:** Dados da capa: **Organization + Farm selecionada**. Razão social e CNPJ da Organization. Se relatório por fazenda (filtro CC), mostra nome/endereço da fazenda. Logo: campo opcional na Organization.
- **D-21:** Período: **exercício fiscal** — mesmo seletor de FiscalYear. Consistente com SPED e DRE/BP.
- **D-22:** Formato numérico: **padrão BR** — separador milhar ponto, decimal vírgula, prefixo R$.

### Frontend e Navegação
- **D-23:** **Página única /sped-ecd** com tabs: "SPED ECD" (geração + validação) e "Relatório Integrado" (PDF). Ambos usam mesmo seletor de exercício fiscal.
- **D-24:** Sidebar: no **grupo CONTABILIDADE** existente, como último item. Label: "SPED / Relatórios".
- **D-25:** Notas explicativas: **textarea na própria página** (tab Relatório Integrado). Salva como rascunho automático. Contador edita e depois gera PDF.

### Claude's Discretion
- Estrutura interna do SpedEcdWriter (classe pura vs funções, streaming vs buffer completo)
- Queries para buscar lançamentos do período (Prisma vs raw SQL)
- Formato exato dos registros SPED (campos, padding, delimitadores internos)
- Geração do DLPA no J210 (saldo anterior + resultado líquido + distribuições = saldo final)
- Template das notas explicativas automáticas (quais políticas contábeis incluir)
- Modelo de dados para rascunho de notas (campo na Organization vs tabela separada)
- Layout visual do PDF (fontes, margens, cabeçalhos de página)
- Detalhes do textarea de notas (rich text ou plain text, autosave interval)
- Campos adicionais na Organization para dados do contador (migration design)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — VINC-02 (relatório integrado PDF), SPED-01 (arquivo ECD blocos 0/I/J/9), SPED-02 (pré-validação PVA)

### Prior Phase Context
- `.planning/phases/39-dre-balan-o-patrimonial-e-valida-o-cruzada/39-CONTEXT.md` — DRE/BP calculator decisions, layout rural, indicadores
- `.planning/phases/40-dfc-dashboard-executivo/40-CONTEXT.md` — DFC calculator, dashboard contábil, cross-validation
- `.planning/phases/37-regras-e-lan-amentos-autom-ticos/37-CONTEXT.md` — auto-posting, JournalEntry model, AccountingRule
- `.planning/phases/38-fechamento-mensal-e-concilia-o-cont-bil/38-CONTEXT.md` — fechamento mensal, period status, MonthlyClosing

### Existing Modules (Backend)
- `apps/backend/src/modules/chart-of-accounts/coa-rural-template.ts` — Template COA rural com spedRefCode L300R mapeado em cada conta
- `apps/backend/src/modules/chart-of-accounts/chart-of-accounts.service.ts` — getUnmappedSped(), getTree(), seed COA template
- `apps/backend/src/modules/financial-statements/dre.calculator.ts` — calculateDre (dados para Bloco J150 e PDF)
- `apps/backend/src/modules/financial-statements/bp.calculator.ts` — calculateBp (dados para Bloco J100 e PDF)
- `apps/backend/src/modules/financial-statements/dfc.calculator.ts` — calculateDfc (dados para PDF)
- `apps/backend/src/modules/financial-statements/financial-statements.service.ts` — orchestrator getDre/getBp/getCrossValidation
- `apps/backend/src/modules/ledger/ledger.service.ts` — getTrialBalance, getLedger, JournalEntry queries
- `apps/backend/src/modules/fiscal-periods/` — FiscalYear, AccountingPeriod, period status
- `apps/backend/src/modules/financial-statements/accounting-dashboard.service.ts` — spedRefCode null check pattern (reuse for validation)

### Schema
- `apps/backend/prisma/schema.prisma` — ChartOfAccount (spedRefCode, accountType, isSynthetic, isActive, level, code), AccountBalance, JournalEntry, FiscalYear, AccountingPeriod, Organization

### Existing Frontend Pages
- `apps/frontend/src/pages/DrePage.tsx` — fiscal year/month selector pattern
- `apps/frontend/src/pages/TrialBalancePage.tsx` — tabs pattern
- `apps/frontend/src/pages/FinancialDashboardPage.tsx` — alerts with links pattern

### Design System
- `docs/design-system/04-componentes.md` — Cards, tabelas, toggles, badges, tabs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `spedRefCode` field on ChartOfAccount: already populated by COA rural template with L300R codes — no mapping needed
- `getUnmappedSped()` in chart-of-accounts.service: returns accounts without spedRefCode — reusable for pre-validation
- `calculateDre()`, `calculateBp()`, `calculateDfc()`: pure calculators providing data for both SPED blocks and PDF
- `getTrialBalance()`: AccountBalance aggregation — basis for I155 saldo data
- `getLedger()`: JournalEntry queries — basis for I200/I250 lançamento data
- pdfkit: used in 19+ files (holerite, NF, receituário, ledger export) — mature pattern
- Fiscal year selector: reusable from DrePage/BalanceSheetPage

### Established Patterns
- Pure calculator functions (no Prisma) — DRE/BP/DFC follow this
- Service layer orchestrates: load DB data → call pure calculator → return
- pdfkit for PDF generation with buffer response
- Tabs pattern (TrialBalancePage) for multiple views
- Inline alerts with navigation links (AccountingDashboardPage)
- Express 5: `req.params.id as string`, `req.query.x as string | undefined`

### Integration Points
- `financial-statements.service.ts` — add generateSpedEcd() and generateIntegratedReport() methods
- Organization model — add accountantName, accountantCrc, accountantCpf fields (migration)
- App.tsx routes — add /sped-ecd
- Sidebar config — add "SPED / Relatórios" to CONTABILIDADE group

</code_context>

<specifics>
## Specific Ideas

- SpedEcdWriter deve ser classe/módulo puro que recebe dados tipados e gera linhas pipe-delimited — testável sem DB
- Pré-validação automática ao selecionar exercício fiscal — UX imediata sem clique extra
- Erros de validação com links diretos para corrigir (conta sem mapeamento → /chart-of-accounts, período aberto → /fiscal-periods)
- Notas explicativas com template automático que inclui políticas contábeis relevantes (CPC 29 se tem ativo biológico)
- PDF profissional com formatação compatível com exigências de PRONAF/Funcafé
- Rascunho de notas salvo automaticamente para não perder trabalho do contador

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 41-sped-ecd-e-relat-rio-integrado*
*Context gathered: 2026-03-28*
