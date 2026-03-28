# Phase 28: Processamento da Folha Mensal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 28-processamento-da-folha-mensal
**Areas discussed:** Fluxo de processamento em lote, Holerite PDF e distribuição, Adiantamento salarial, 13º salário

---

## Fluxo de Processamento em Lote

| Option               | Description                                           | Selected |
| -------------------- | ----------------------------------------------------- | -------- |
| Wizard multi-step    | Step 1-4: mês/ano+tipo, preview, confirmar, processar | ✓        |
| Botão direto + modal | Modal simples, confirma e processa tudo               |          |
| Página dedicada      | Tela /payroll-runs com tabela de runs                 |          |

**User's choice:** Wizard multi-step
**Notes:** None

| Option                            | Description                            | Selected |
| --------------------------------- | -------------------------------------- | -------- |
| Bloqueia colaborador, não a folha | Pendentes ficam fora, demais processam | ✓        |
| Bloqueia folha inteira            | 100% espelhos aprovados obrigatório    |          |
| Warning mas permite               | Alerta amarelo, processa com zeros     |          |

**User's choice:** Bloqueia o colaborador, não a folha toda
**Notes:** None

| Option                          | Description                                        | Selected |
| ------------------------------- | -------------------------------------------------- | -------- |
| Estorno completo + rollback CPs | COMPLETED→REVERTED, cancela CPs, destrói holerites | ✓        |
| Estorno parcial por colaborador | Estorna um colaborador específico                  |          |
| Sem estorno, folha complementar | Folha fechada é definitiva                         |          |

**User's choice:** Estorno completo com rollback de CPs
**Notes:** None

---

## Holerite PDF e Distribuição

| Option                     | Description                                    | Selected |
| -------------------------- | ---------------------------------------------- | -------- |
| Modelo clássico tabular    | Cabeçalho, proventos, descontos, totais, bases | ✓        |
| Layout moderno com cards   | Cards coloridos por seção                      |          |
| Duplo (impressa + digital) | PDF tabular + versão rica no app               |          |

**User's choice:** Modelo clássico tabular
**Notes:** None

| Option                    | Description                                      | Selected |
| ------------------------- | ------------------------------------------------ | -------- |
| Email em lote + app       | Envia PDF por email + disponibiliza na ficha/app | ✓        |
| Apenas ficha/app          | Sem email, acesso sob demanda                    |          |
| Download em lote contador | ZIP para distribuição manual                     |          |

**User's choice:** Email em lote + acesso no app
**Notes:** None

| Option                   | Description                   | Selected |
| ------------------------ | ----------------------------- | -------- |
| ZIP com PDFs individuais | Um PDF por colaborador em ZIP | ✓        |
| PDF único com page break | Todos em um PDF grande        |          |
| Ambos                    | ZIP + consolidado             |          |

**User's choice:** ZIP com PDFs individuais
**Notes:** None

---

## Adiantamento Salarial

| Option                        | Description                       | Selected |
| ----------------------------- | --------------------------------- | -------- |
| Registro direto pelo contador | Individual ou lote, sem aprovação | ✓        |
| Solicitação + aprovação       | Colaborador pede, gerente aprova  |          |
| Automático no dia 15          | Cron job + revisão                |          |

**User's choice:** Registro direto pelo contador
**Notes:** None

| Option                        | Description                                      | Selected |
| ----------------------------- | ------------------------------------------------ | -------- |
| CP individual por colaborador | originType='SALARY_ADVANCE', desconto automático | ✓        |
| CP única consolidada          | Valor total por lote                             |          |
| Sem CP, só desconto na folha  | Registro interno apenas                          |          |

**User's choice:** Sim, CP individual por colaborador
**Notes:** None

---

## 13º Salário

| Option                               | Description                     | Selected |
| ------------------------------------ | ------------------------------- | -------- |
| Tipo de run separado no mesmo módulo | runType THIRTEENTH_FIRST/SECOND | ✓        |
| Módulo separado                      | thirteenth-salary próprio       |          |
| Rubrica na folha normal              | Sem run separado                |          |

**User's choice:** Tipo de run separado no mesmo módulo
**Notes:** None

| Option                             | Description                    | Selected |
| ---------------------------------- | ------------------------------ | -------- |
| Média dos meses trabalhados no ano | total/meses, CLT art. 7º       | ✓        |
| Média dos últimos 12 meses         | Sempre 12, zeros se necessário |          |
| Claude decide                      | Conforme legislação vigente    |          |

**User's choice:** Média dos meses trabalhados no ano
**Notes:** None

---

## Claude's Discretion

- Estrutura dos models Prisma, endpoints REST, wizard frontend, recibo PDF adiantamento, envio email, componentes frontend, DSR sobre HE

## Deferred Ideas

None
