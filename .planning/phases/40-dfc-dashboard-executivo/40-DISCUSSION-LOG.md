# Phase 40: DFC, Dashboard Executivo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 40-dfc-dashboard-executivo
**Areas discussed:** DFC Direto vs Indireto, Dashboard Executivo, Validação DFC↔BP, Navegação e UX

---

## DFC Direto vs Indireto

### Layout DFC

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs Direto/Indireto | Uma página /dfc com duas tabs. Padrão já usado no projeto (TrialBalancePage) | ✓ |
| Toggle inline | Toggle button que alterna entre direto e indireto na mesma tabela | |
| Seções empilhadas | Ambos os métodos visíveis na mesma página, um abaixo do outro | |

**User's choice:** Tabs Direto/Indireto
**Notes:** None

### Fonte de Dados (DFC Direto)

| Option | Description | Selected |
|--------|-------------|----------|
| Transações liquidadas | Reusar lógica v1.0: CP/CR liquidados, classificar via PAYABLE_DFC_MAP/RECEIVABLE_DFC_MAP | ✓ |
| Lançamentos contábeis | Filtrar JournalEntryLine em contas de caixa/banco (1.1.01.xx) | |
| Híbrido | Direto via transações + reconcilia com GL | |

**User's choice:** Transações liquidadas
**Notes:** None

### Ajustes Não-Caixa (DFC Indireto)

| Option | Description | Selected |
|--------|-------------|----------|
| Conjunto padrão CPC 03 R2 | LL + Depreciação + Provisões + CPC 29 + Delta Capital de Giro | ✓ |
| Mínimo viável | Apenas LL + Depreciação + Delta CG (CR/CP) | |
| Completo com notas | CPC 03 R2 + notas explicativas por linha (tooltip) | |

**User's choice:** Conjunto padrão CPC 03 R2
**Notes:** None

### Período e Comparativo

| Option | Description | Selected |
|--------|-------------|----------|
| Mesmo padrão DRE | Seletor exercício fiscal + mês. 3 colunas comparativas | ✓ |
| Range de datas livre | Date picker início/fim | |
| Apenas acumulado exercício | DFC normalmente é apresentado acumulado | |

**User's choice:** Mesmo padrão DRE
**Notes:** None

---

## Dashboard Executivo

### Layout Principal

| Option | Description | Selected |
|--------|-------------|----------|
| Cards + Gráficos | 4 cards topo + gráfico linha 12m + donut custos + indicadores BP + alertas | ✓ |
| Tabs por área | Tabs: Resultado, Custos, Indicadores, Alertas | |
| Single scroll | Página única com scroll vertical | |

**User's choice:** Cards + Gráficos
**Notes:** None

### Relação com FinancialDashboard

| Option | Description | Selected |
|--------|-------------|----------|
| Página nova separada | Nova rota /accounting-dashboard. FinancialDashboard fica focado no operacional | ✓ |
| Ampliar o existente | Adicionar seção contábil ao FinancialDashboardPage existente | |
| Substituir | Novo dashboard unificado substitui o financeiro | |

**User's choice:** Página nova separada
**Notes:** None

### Alertas

| Option | Description | Selected |
|--------|-------------|----------|
| 3 alertas contábeis | Períodos não fechados, lançamentos pendentes, contas sem SPED. Clicáveis | ✓ |
| Alertas + cross-validation | 3 acima + status 4 invariantes | |
| Você decide | Claude escolhe | |

**User's choice:** 3 alertas contábeis
**Notes:** None

### Indicadores BP

| Option | Description | Selected |
|--------|-------------|----------|
| 4 principais | Liquidez Corrente, Endividamento Geral, ROE, PL/ha | ✓ |
| Todos os 6 | Reusar os 6 indicadores do BP com sparkline | |
| Você decide | Claude seleciona | |

**User's choice:** 4 principais
**Notes:** None

---

## Validação DFC↔BP

### Ativação Invariante #2

| Option | Description | Selected |
|--------|-------------|----------|
| Tolerância ±0.01 | Mesma tolerância dos outros invariantes. Card verde/vermelho + Investigar | ✓ |
| Tolerância maior (1.00) | Evita falsos positivos por arredondamento | |
| Você decide | Claude define tolerância adequada | |

**User's choice:** Tolerância ±0.01
**Notes:** None

---

## Navegação e UX

### Sidebar

| Option | Description | Selected |
|--------|-------------|----------|
| Grupo CONTABILIDADE | DFC e Dashboard no grupo existente junto com DRE/BP/balancete | ✓ |
| Dashboard no topo | Dashboard como primeiro item ou link separado no topo | |
| Grupo separado | Novo grupo DEMONSTRAÇÕES | |

**User's choice:** Grupo CONTABILIDADE
**Notes:** None

### Rotas

| Option | Description | Selected |
|--------|-------------|----------|
| /dfc e /accounting-dashboard | Consistente com /dre, /balance-sheet | ✓ |
| /cash-flow-statement e /accounting-dashboard | Nome completo para DFC | |
| Você decide | Claude define rotas | |

**User's choice:** /dfc e /accounting-dashboard
**Notes:** None

---

## Claude's Discretion

- Estrutura interna DfcCalculatorService
- Queries para CP/CR liquidados
- Cálculo deltas capital de giro
- Detalhes visuais gráficos (recharts)
- Layout responsivo dashboard

## Deferred Ideas

None
