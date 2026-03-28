# Phase 38: Fechamento Mensal e Conciliacao Contabil - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 38-fechamento-mensal-e-conciliacao-contabil
**Areas discussed:** Checklist de fechamento, Conciliacao contabil, Bloqueio e reabertura, Integracao entre modulos

---

## Checklist de Fechamento

### UX do Checklist

| Option | Description | Selected |
|--------|-------------|----------|
| Stepper vertical | Pagina dedicada com stepper vertical, cada etapa com status, expand para detalhes, botao fechar so habilita quando todas passam | X |
| Cards lado a lado | Grid de cards 2-3 colunas, sem ordem rigida, contador executa na ordem que preferir | |
| Checklist simples | Lista de checkbox com validacao automatica simultanea ao abrir | |

**User's choice:** Stepper vertical
**Notes:** Preview com stepper mostrando etapas com status iconografico foi decisivo.

### Persistencia

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, entidade MonthlyClosing | Modelo com periodo, status, resultado de cada etapa, quem fechou, quando. Historico e auditoria. | X |
| Nao, efemero | Calculado on-the-fly, AccountingPeriod ja e o registro | |

**User's choice:** Sim, entidade MonthlyClosing

### Ordem das Etapas

| Option | Description | Selected |
|--------|-------------|----------|
| Ordem obrigatoria | Sequenciais com dependencias. Garante consistencia contabil. | X |
| Ordem livre | Qualquer ordem, todas devem estar OK para fechar | |
| Parcialmente ordenado | Algumas com dependencia, outras livres | |

**User's choice:** Ordem obrigatoria

### Etapa Falha

| Option | Description | Selected |
|--------|-------------|----------|
| Link direto + retry | Mostra problema + link para modulo + botao Revalidar | X |
| Apenas bloqueia | Mostra erro e bloqueia avanco | |
| Acao inline | Botao executar para algumas etapas, link para outras | |

**User's choice:** Link direto + retry

### Fechamento Parcial

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, com status IN_PROGRESS | MonthlyClosing criado ao iniciar, etapas salvas, pode sair e voltar | X |
| Nao, tudo de uma vez | Efemero ate o momento do fechamento | |

**User's choice:** Sim, com status IN_PROGRESS

---

## Conciliacao Contabil

### Escopo

| Option | Description | Selected |
|--------|-------------|----------|
| Wiring no checklist | reconciliation/ ja faz tudo. Etapa 5 consulta conciliacao completa para o periodo. | X |
| Melhorias no reconciliation/ | Adicionar relatorio exportavel PDF/CSV, status por periodo, % conciliado | |
| Modulo novo separado | Conciliacao contabil como modulo separado | |

**User's choice:** Wiring no checklist

### Relatorio

| Option | Description | Selected |
|--------|-------------|----------|
| Relatorio existente basta | getReconciliationReport ja retorna dados | X |
| Adicionar export CSV/PDF | Implementar export nesta phase | |

**User's choice:** Relatorio existente basta

---

## Bloqueio e Reabertura

### Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Middleware centralizado | Helper checkPeriodOpen(date, orgId) chamado por todo endpoint contabil. 422 se fechado. | X |
| Validacao por service | Cada service valida individualmente | |
| Trigger no banco | Constraint PostgreSQL impedindo INSERT em periodo fechado | |

**User's choice:** Middleware centralizado

### Reabertura

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-only fixo | Somente ADMIN pode reabrir. Simples e seguro. | X |
| Permissao especifica | Permissao 'reopen_period' atribuivel a qualquer role | |

**User's choice:** Admin-only fixo

### Reopen Flow

| Option | Description | Selected |
|--------|-------------|----------|
| MonthlyClosing marcado REOPENED | Status REOPENED + motivo + quem reabriu. Novo checklist para fechar novamente. | X |
| MonthlyClosing deletado | Remove registro, perde historico | |
| Novo MonthlyClosing criado | Mantem antigo como historico, cria novo IN_PROGRESS | |

**User's choice:** MonthlyClosing marcado REOPENED

---

## Integracao entre Modulos

### Etapas

| Option | Description | Selected |
|--------|-------------|----------|
| 6 etapas padrao | Ponto, Folha, Depreciacao, Lancamentos pendentes, Conciliacao, Balancete | X |
| 6 etapas + extras | As 6 + provisoes folha + CP/CR em aberto (8 total) | |
| Voce decide | Claude escolhe baseado nos modulos existentes | |

**User's choice:** 6 etapas padrao

### Criterios de Sucesso

| Option | Description | Selected |
|--------|-------------|----------|
| Rigido | Criterio binario por etapa. Sem tolerancia. | X |
| Com tolerancia/override | Etapa pode ser OK com ressalva + justificativa | |
| Configuravel por etapa | Algumas rigidas, outras com override | |

**User's choice:** Rigido

### Navegacao

| Option | Description | Selected |
|--------|-------------|----------|
| Pagina dedicada | Nova rota /monthly-closing. Botao na FiscalPeriodsPage. Sidebar CONTABILIDADE. | X |
| Tab na FiscalPeriodsPage | Tab adicional na pagina existente | |
| Modal/drawer | Stepper em drawer lateral | |

**User's choice:** Pagina dedicada

---

## Claude's Discretion

- Estrutura do modelo MonthlyClosing (campos, tabela filha vs JSON)
- Nome/assinatura do middleware checkPeriodOpen
- Quais endpoints recebem o middleware
- Detalhes visuais do stepper
- Queries exatas para cada etapa de validacao

## Deferred Ideas

None -- discussion stayed within phase scope.
