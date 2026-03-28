# Phase 34: Wire Absence Impact to Payroll Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 34-wire-absence-impact-payroll-engine
**Areas discussed:** Prorateio salarial, Discriminação no holerite, FGTS em afastamento, Dias suspensão

---

## Prorateio Salarial

| Option                                    | Description                                                                          | Selected |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| Deduzir dias INSS do salário              | Salário base integral, rubrica de desconto INSS. Padrão CLT.                         | ✓        |
| Salário proporcional aos dias trabalhados | Salário base já reduzido, sem rubrica separada. Mais simples mas menos transparente. |          |

**User's choice:** Deduzir dias INSS do salário
**Notes:** Padrão CLT preferido. Salário aparece integral nos proventos, desconto como rubrica.

### Combinação admissão + afastamento

| Option      | Description                                                        | Selected |
| ----------- | ------------------------------------------------------------------ | -------- |
| Cumulativo  | Ambos prorateios aplicados sequencialmente. Juridicamente correto. | ✓        |
| Você decide | Claude decide a lógica.                                            |          |

**User's choice:** Cumulativo

### Dias empresa no holerite

| Option               | Description                                                         | Selected |
| -------------------- | ------------------------------------------------------------------- | -------- |
| Implícito no salário | Empresa paga integral menos INSS. Sem rubrica de provento separada. | ✓        |
| Rubrica separada     | Rubrica 'Auxílio-doença empresa (15d)' como provento. Incomum.      |          |

**User's choice:** Implícito no salário

### Base de cálculo INSS/IRRF

| Option                        | Description                                             | Selected |
| ----------------------------- | ------------------------------------------------------- | -------- |
| Incide sobre salário reduzido | Base = salário − desconto INSS − suspensão. Padrão CLT. | ✓        |
| Você decide                   | Claude segue regra legal.                               |          |

**User's choice:** Incide sobre salário reduzido

---

## Discriminação no Holerite

| Option              | Description                                                                  | Selected |
| ------------------- | ---------------------------------------------------------------------------- | -------- |
| Rubrica de desconto | Na seção Descontos: código + descrição + ref dias + valor. Padrão lineItems. | ✓        |
| Seção separada      | Bloco dedicado 'Afastamentos' entre Proventos e Descontos.                   |          |
| Ambos               | Rubrica + nota informativa no rodapé.                                        |          |

**User's choice:** Rubrica de desconto
**Notes:** Segue padrão existente de lineItems. Contador reconhece.

### Indicação dias empresa

| Option                     | Description                                                               | Selected |
| -------------------------- | ------------------------------------------------------------------------- | -------- |
| Só desconto INSS           | Apenas rubrica de desconto INSS. Dias empresa implícitos. Padrão mercado. | ✓        |
| Nota informativa no rodapé | Linha no rodapé com dias empresa vs INSS.                                 |          |
| Você decide                | Claude escolhe.                                                           |          |

**User's choice:** Só desconto INSS

---

## FGTS em Afastamento

| Option           | Description                                          | Selected |
| ---------------- | ---------------------------------------------------- | -------- |
| Salário integral | FGTS = 8% do salário cheio. Lei 8.036/90 art. 15 §5. | ✓        |
| Salário reduzido | FGTS = 8% do prorateado. Mais simples mas incorreto. |          |
| Você decide      | Claude segue regra legal.                            |          |

**User's choice:** Salário integral
**Notes:** Obrigação legal para acidente/doença/maternidade.

### Apresentação no holerite

| Option              | Description                                                 | Selected |
| ------------------- | ----------------------------------------------------------- | -------- |
| Base FGTS no rodapé | Rodapé mostra Base FGTS = salário cheio. Sem rubrica extra. | ✓        |
| Nota explicativa    | Nota referenciando Lei 8.036/90.                            |          |
| Você decide         | Claude decide.                                              |          |

**User's choice:** Base FGTS no rodapé

---

## Dias Suspensão

| Option         | Description                                                                          | Selected |
| -------------- | ------------------------------------------------------------------------------------ | -------- |
| Desconto total | Rubrica de desconto 'Suspensão disciplinar'. Sem FGTS, sem 13º/férias. CLT art. 474. | ✓        |
| Você decide    | Claude implementa seguindo regra legal.                                              |          |

**User's choice:** Desconto total

### Impacto DSR

| Option                  | Description                                                               | Selected |
| ----------------------- | ------------------------------------------------------------------------- | -------- |
| Sim, perde DSR          | Suspensão = falta injustificada para efeito DSR. Desconto adicional. CLT. | ✓        |
| Não, só desconto direto | Desconta dias sem impactar DSR. Mais simples.                             |          |
| Você decide             | Claude segue regra legal.                                                 |          |

**User's choice:** Sim, perde DSR

---

## Claude's Discretion

- Códigos de rubrica (900, 910 ou similar)
- Estrutura dos novos campos no input/result
- Lógica de cálculo DSR por suspensão
- Organização dos testes
- Passagem de AbsencePayrollImpact (campo no input vs busca interna)

## Deferred Ideas

None — discussion stayed within phase scope
