# Phase 26: Parâmetros de Folha e Motor de Cálculo - Research

**Researched:** 2026-03-24
**Domain:** Payroll configuration (rubricas), Brazilian tax law (INSS/IRRF/FUNRURAL), rural labor rules (CLT rural), configurable legal tables, calculation engine
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOLHA-01 | Configurar rubricas (proventos e descontos) com fórmulas customizáveis, manter tabelas legais vigentes (INSS/IRRF/salário-família), motor de cálculo INSS progressivo, IRRF com dependentes, FGTS 8%, FUNRURAL configurável, regras rurais específicas (noturno 21h-5h 25%, moradia/alimentação) | Todos os achados abaixo |
</phase_requirements>

---

## Summary

Phase 26 cria a infraestrutura de configuração e cálculo que alimentará todos os módulos de folha downstream (FOLHA-02 processamento, FOLHA-05 13º, FERIAS-01 férias, FERIAS-03 rescisão). O trabalho divide-se em dois eixos: (1) modelos de dados para rubricas personalizáveis e tabelas legais com vigência, e (2) um motor de cálculo puro — sem acesso a banco — que implementa as regras tributárias brasileiras para 2026.

O padrão de referência interno é o `depreciation-engine.service.ts`: funções puras, Decimal.js para toda aritmética, cobertura de testes com valores reais extraídos das tabelas oficiais. A diferença para o motor de folha é que as entradas são mais ricas (salário, dependentes, tabela INSS vigente, tabela IRRF vigente, horas trabalhadas, etc.) e há múltiplos impostos interdependentes (INSS reduz base do IRRF).

O ponto de atenção mais crítico em 2026 é a reforma do IRRF: a isenção de R$ 5.000 e o redutor complementar `978,62 - (0,133145 × renda)` para faixas entre R$ 5.000,01 e R$ 7.350,00 são obrigatórios. O cálculo não é mais "tabela + dedução" — é um processo de duas etapas que todos os sistemas precisam implementar corretamente.

**Recomendação principal:** Implementar em 3 ondas — (1) Schema + migrations para rubricas e tabelas legais, (2) Motor de cálculo puro (engine) com testes unitários exaustivos contra os valores 2026, (3) Backend REST endpoints + frontend páginas de configuração.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| decimal.js | ^10.6.0 | Aritmética financeira precisa | Já instalado no projeto — mesmo padrão da depreciação |
| Prisma | 7.x | ORM — modelos de rubricas e tabelas | Stack padrão do projeto |
| Express 5 | já instalado | REST endpoints de configuração | Stack padrão do projeto |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expr-eval | ^2.0.2 | Avaliador seguro de fórmulas matemáticas | Apenas se rubricas customizáveis precisarem de expressões com variáveis (ex: `SALARIO_BASE * 0.05`). Alternativa segura que não executa código arbitrário. |
| date-fns | ^4.x | Manipulação de datas para vigência de tabelas | Já pode estar no projeto — verificar antes de instalar |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| expr-eval | math.js | math.js é muito maior (bundle 500 KB vs 35 KB); expr-eval é suficiente para fórmulas escalares |
| expr-eval | execução dinâmica de código | Inseguro — não usar em ambiente servidor |
| Decimal.js | number (float) | Floats causam erros de arredondamento em folha. R$ 7.777,77 × 14% com float difere de Decimal. Nunca usar float. |

**Installation (se expr-eval for necessário):**
```bash
pnpm add expr-eval
pnpm add -D @types/expr-eval
```

**Version verification:**
```bash
npm view expr-eval version   # 2.0.2 verificado em 2026-03-24
npm view decimal.js version  # 10.6.0 já instalado
```

---

## Architecture Patterns

### Recommended Project Structure
```
apps/backend/src/modules/
├── payroll-rubricas/           # CRUD de rubricas (proventos/descontos)
│   ├── payroll-rubricas.routes.ts
│   ├── payroll-rubricas.routes.spec.ts
│   ├── payroll-rubricas.service.ts
│   └── payroll-rubricas.types.ts
├── payroll-tables/             # Tabelas legais com vigência (INSS/IRRF/salário-família)
│   ├── payroll-tables.routes.ts
│   ├── payroll-tables.routes.spec.ts
│   ├── payroll-tables.service.ts
│   └── payroll-tables.types.ts
└── payroll-engine/             # Motor de cálculo puro — sem acesso a BD
    ├── payroll-engine.service.ts    # calculateINSS, calculateIRRF, calculateRubricas, etc.
    ├── payroll-engine.spec.ts       # Testes com valores reais 2026
    └── payroll-engine.types.ts      # EngineInput, EngineOutput, etc.
```

### Pattern 1: Engine Puro (sem I/O)
**O que é:** Funções puras que recebem todos os dados necessários como parâmetros e retornam resultados — sem consulta ao banco dentro do engine.
**Quando usar:** Motor de cálculo de folha. O caller (batch service) é responsável por buscar tabelas INSS/IRRF vigentes e passá-las ao engine.
**Referência interna:** `depreciation-engine.service.ts` — mesmo padrão.

```typescript
// Source: padrão interno depreciation-engine.service.ts
import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export function calculateINSS(
  grossSalary: Decimal,
  brackets: INSSBracket[],  // tabela vigente passada pelo caller
): INSSResult {
  let contribution = new Decimal(0);
  let remaining = grossSalary;

  for (const bracket of brackets) {
    const bracketMax = bracket.upTo ? new Decimal(bracket.upTo) : null;
    const bracketMin = new Decimal(bracket.from);
    const applicable = bracketMax
      ? Decimal.min(remaining, bracketMax.minus(bracketMin))
      : remaining;
    contribution = contribution.plus(applicable.mul(bracket.rate));
    remaining = remaining.minus(applicable);
    if (remaining.lessThanOrEqualTo(0)) break;
  }

  return {
    contribution: contribution.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    cappedAt: grossSalary.greaterThan(INSS_CEILING_2026)
      ? INSS_CEILING_2026
      : null,
  };
}
```

### Pattern 2: Tabelas Legais com Vigência
**O que é:** Cada tabela tem um campo `effectiveFrom: Date`. A busca da tabela vigente filtra `effectiveFrom <= competence_month` e ordena decrescente, pegando a primeira.
**Quando usar:** Toda vez que o sistema precisar dos valores INSS, IRRF, salário-família ou salário-mínimo para um período competência específico.

```typescript
// Busca tabela INSS vigente para competência 2026-03
const table = await prisma.payrollLegalTable.findFirst({
  where: {
    tableType: 'INSS',
    effectiveFrom: { lte: new Date('2026-03-01') },
  },
  orderBy: { effectiveFrom: 'desc' },
  include: { brackets: { orderBy: { order: 'asc' } } },
});
```

### Pattern 3: Rubrica com Fórmula Customizável
**O que é:** Uma rubrica armazena `baseFormula` (string) e `rate` (Decimal opcional). O engine resolve a fórmula substituindo variáveis (`SALARIO_BASE`, `HORA_NORMAL`, `HORAS_EXTRAS_50`) antes de avaliar com `expr-eval`.
**Quando usar:** Rubricas não-legais configuradas pelo cliente (comissão, bônus, VR específico).

```typescript
// Variáveis disponíveis no contexto de cálculo
interface RubricaContext {
  SALARIO_BASE: number;
  HORA_NORMAL: number;
  HORAS_EXTRAS_50: number;
  HORAS_EXTRAS_100: number;
  SALARIO_MINIMO: number;
  PISO_REGIONAL: number;
  DIAS_TRABALHADOS: number;
  DIAS_UTEIS_MES: number;
}
```

### Pattern 4: Rubricas de Sistema (não editáveis)
**O que é:** Rubricas legais obrigatórias (INSS, IRRF, FGTS) têm `isSystem: true` e `formulaType: 'SYSTEM_INSS' | 'SYSTEM_IRRF' | 'SYSTEM_FGTS'`. O engine usa código específico para elas — não avalia string de fórmula.
**Quando usar:** Sempre para INSS/IRRF/FGTS. Garante que a legislação seja respeitada mesmo se o usuário tentar editar.

### Anti-Patterns to Avoid
- **Cálculo de IRRF com tabela plana (flat-rate):** A tabela progressiva é obrigatória desde 2009. Jamais aplicar uma alíquota única sobre o total.
- **Ignorar o redutor 2026:** A reforma do IR obriga o cálculo em duas etapas a partir de janeiro/2026. Sistemas que apenas aplicam a tabela + dedução estarão errados para rendas entre R$ 5k e R$ 7.35k.
- **Base do IRRF sem abater INSS:** A base de cálculo do IRRF é `salário bruto - INSS - (N dependentes × 189,59) - pensão alimentícia`. Calcular IRRF sobre o bruto é erro grave.
- **FGTS sobre base errada:** FGTS incide sobre remuneração bruta (incluindo HE, adicional noturno, insalubridade, periculosidade). Base = salário base + todos os adicionais.
- **Aritmética com float:** Todos os cálculos de folha DEVEM usar `Decimal.js`. `1621 * 0.075` em float = `121.57499999999999`.

---

## Brazilian Payroll Tax Rules — Reference Tables 2026

### INSS Progressivo 2026 (Portaria Interministerial MPS/MF nº 13/2026)

Base legal: Portaria Interministerial MPS/MF nº 13, de 09/01/2026.
Teto contributivo: R$ 8.475,55.
Salário mínimo: R$ 1.621,00.

| Faixa Salarial (De) | Faixa Salarial (Até) | Alíquota | Parcela a Deduzir |
|---------------------|---------------------|----------|-------------------|
| R$ 0,00 | R$ 1.621,00 | 7,5% | — |
| R$ 1.621,01 | R$ 2.902,84 | 9,0% | R$ 24,32 |
| R$ 2.902,85 | R$ 4.354,27 | 12,0% | R$ 111,40 |
| R$ 4.354,28 | R$ 8.475,55 | 14,0% | R$ 198,49 |

**Contribuição máxima:** R$ 988,09 (teto × 14% − dedução = 8.475,55 × 0,14 − 198,49).

**Método de cálculo (progressive bracket, NOT flat-rate):**
- Cada faixa é tributada separadamente pela sua alíquota
- Equivalência do método "parcela a deduzir": `INSS = salário × alíquota_faixa − parcela_deduzir`
- Exemplo: salário R$ 3.500,00 → 3.500 × 12% − 111,40 = 308,60

### IRRF 2026 — Duas Etapas Obrigatórias

Base legal: Tabela da Receita Federal, em vigor a partir de 01/01/2026 (inclui reforma IR, Lei 15.079/2024).

**Etapa 1 — Cálculo pela tabela progressiva:**

| Base de Cálculo (R$) | Alíquota | Parcela a Deduzir |
|----------------------|----------|-------------------|
| Até 2.428,80 | — (isento) | — |
| 2.428,81 a 2.826,65 | 7,5% | R$ 182,16 |
| 2.826,66 a 3.751,05 | 15,0% | R$ 394,16 |
| 3.751,06 a 4.664,68 | 22,5% | R$ 675,49 |
| Acima de 4.664,68 | 27,5% | R$ 908,73 |

**Etapa 2 — Redutor complementar 2026:**
- Se base tributável ≤ R$ 5.000,00: IRRF = R$ 0,00 (isenção total)
- Se base tributável entre R$ 5.000,01 e R$ 7.350,00: Redutor = `978,62 − (0,133145 × base_tributavel)`, IRRF_final = MAX(0, IRRF_etapa1 − redutor)
- Se base tributável > R$ 7.350,00: IRRF_final = IRRF_etapa1 (sem redutor)

**Base tributável do IRRF:** `salário bruto − INSS − (N_dependentes × 189,59) − pensão_alimentícia`

**Dedução por dependente:** R$ 189,59/mês (2026).

**Exemplo completo (salário R$ 5.000,00 bruto, 2 dependentes, sem pensão):**
1. INSS: 5.000 × 14% − 198,49 = 501,51
2. Base IRRF: 5.000 − 501,51 − (2 × 189,59) = 4.130,32
3. IRRF tabela: 4.130,32 × 22,5% − 675,49 = 253,81
4. Redutor: N/A (base < 5.000) → IRRF = R$ 0,00 (base tributável 4.130,32 ≤ 5.000,00)

### FGTS

- Alíquota: 8% sobre remuneração bruta (empregado CLT)
- Base: salário base + todos adicionais (HE, adicional noturno, insalubridade, periculosidade)
- Não há teto — incide sobre o total
- Recolhimento: até dia 7 do mês seguinte

### FUNRURAL 2026

Base legal: Lei Complementar nº 224/2025 (vigência 01/04/2026). As alíquotas abaixo são pós-abril/2026.

**Modo 1 — Pessoa Física / Segurado Especial (% receita bruta):**
- Social Security: 1,32%
- RAT: 0,11%
- SENAR: 0,20%
- **Total: 1,63%** sobre receita bruta da comercialização

**Modo 2 — Pessoa Jurídica (% receita bruta):**
- FUNRURAL: 1,98%
- SENAR: 0,25%
- **Total: 2,23%** sobre receita bruta da comercialização

**Antes de abril/2026:** PF = 1,50%, PJ = 2,05% (manter tabela histórica para retroativos)

**Importante:** FUNRURAL é contribuição do **empregador** (fazenda), não do empregado. Aparece no relatório de encargos patronais, não no holerite do trabalhador. O modo (PF vs PJ) é configurável por fazenda e registrado no schema (campo `funruralMode` na fazenda ou organização).

### Salário-Família 2026

- Valor da cota: R$ 67,54 por filho/dependente elegível (até 14 anos ou inválido)
- Limite de renda para direito: R$ 1.980,38/mês (remuneração bruta)
- Base legal: Portaria Interministerial MPS/MF nº 13/2026

### Insalubridade e Periculosidade

- Insalubridade: calculada sobre salário mínimo nacional (R$ 1.621,00)
  - Grau mínimo: 10% = R$ 162,10
  - Grau médio: 20% = R$ 324,20
  - Grau máximo: 40% = R$ 648,40
- Periculosidade: 30% sobre o salário-base do empregado
- Vedação de acúmulo: empregado escolhe um ou outro

### Regras Específicas do Trabalhador Rural

**Adicional noturno:**
- Agricultura: período 21h-5h (não 22h-5h do CLT urbano)
- Pecuária: período 20h-4h
- Percentual: 25% (não 20% do CLT urbano)
- Hora noturna: 60 minutos (não reduzida a 52m30s — isso é regra do CLT urbano)
- Base legal: Lei 5.889/1973, art. 7º; Decreto 73.626/1974

**Moradia (salário-utilidade):**
- Desconto máximo: até 20% do salário-mínimo regional (não do salário bruto)
- Exige contrato escrito com testemunhas e notificação ao sindicato
- Não integra salário se corretamente formalizada

**Alimentação (salário-utilidade):**
- Desconto máximo: até 25% do salário-mínimo regional (não do salário bruto)
- Mesmas formalidades da moradia
- Importante: os limites são sobre o **piso regional** (não sobre o salário do empregado)

**Limite de descontos in natura:**
- Máximo 70% da remuneração pode ser em salário in natura
- Mínimo 30% SEMPRE em dinheiro (art. 82 CLT)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Avaliação de fórmulas string | Execução dinâmica de código | `expr-eval` ou context map com variáveis nomeadas | Execução dinâmica é vetor de injeção de código; em ambiente servidor é crítico |
| Aritmética financeira | Operações com `number` | `Decimal.js` (já instalado) | Ponto flutuante gera erros centesimais que acumulam em folha |
| Cálculo de INSS flat | `salary * 0.14` | Lógica progressiva por faixa | CLT exige método progressivo — flat-rate gera passivo trabalhista |
| Datas e competências | Aritmética manual de datas | `date-fns` ou `new Date()` nativo com UTC care | Meses têm dias diferentes, timezone pode inverter dia de competência |

**Key insight:** Cálculo de folha brasileiro tem mais exceções do que regras. O redutor IRRF 2026, a hora rural de 60min (não 52m30s), o teto do INSS que limita a base, a ordem obrigatória (INSS primeiro, depois IRRF sobre base reduzida) — cada um destes é edge case que custom code erra.

---

## Common Pitfalls

### Pitfall 1: Ordem de Cálculo (INSS antes do IRRF)
**O que acontece:** Sistema calcula IRRF sobre salário bruto, esquecendo de subtrair INSS primeiro.
**Por que acontece:** Nomenclatura confusa de "base de cálculo" — cada tributo tem sua própria base.
**Como evitar:** O engine deve sempre seguir sequência: (1) calcular INSS → (2) calcular base IRRF = bruto − INSS − dependentes − pensão → (3) calcular IRRF → (4) calcular FGTS = bruto × 8%.
**Sinais de alerta:** IRRF calculado igual ao INSS ou maior do que deveria para rendas na faixa de isenção.

### Pitfall 2: Ignorar Redutor IRRF 2026
**O que acontece:** Trabalhador com base tributável de R$ 5.200 paga IRRF incorreto (positivo) quando deveria ser zero ou quase zero.
**Por que acontece:** Sistema implementado antes de 2026 sem atualização para a reforma.
**Como evitar:** Sempre aplicar as duas etapas. Verificar a base tributável (pós-INSS) — se ≤ R$ 5.000 → zero. Se entre R$ 5.001 e R$ 7.350 → aplicar redutor `978,62 − 0,133145 × base`.
**Sinais de alerta:** Testes com base tributável R$ 4.999 retornando qualquer IRRF positivo.

### Pitfall 3: Vigência de Tabelas — Data de Referência
**O que acontece:** Reprocessamento retroativo usa a tabela INSS de março/2026 para calcular competência jan/2025.
**Por que acontece:** Busca sempre a tabela mais recente em vez de filtrar por `effectiveFrom <= competência`.
**Como evitar:** Sempre passar o mês de competência como parâmetro e filtrar `effectiveFrom <= competência`. Guardar registros históricos das tabelas no banco.
**Sinais de alerta:** Valor de INSS diferente quando recalcula retroativamente.

### Pitfall 4: Moradia/Alimentação Rural — Base Errada
**O que acontece:** Sistema desconta moradia como "até 20% do salário do empregado" em vez de "até 20% do salário-mínimo regional".
**Por que acontece:** Confusão entre CLT urbano e Lei 5.889/1973 (rural).
**Como evitar:** Calcular `moradia_maxima = piso_regional * 0.20` e `alimentacao_maxima = piso_regional * 0.25`. O piso regional deve ser configurável por estado.
**Sinais de alerta:** Empregado com salário R$ 8.000 tendo desconto de moradia de R$ 2.000 (25% do bruto — errado).

### Pitfall 5: FUNRURAL Mode — Timing das Alíquotas
**O que acontece:** Sistema aplica 1,63% (nova alíquota pós-abril/2026) para competências de jan-mar/2026.
**Por que acontece:** Tabela de FUNRURAL não guarda histórico com datas.
**Como evitar:** Tratar FUNRURAL como qualquer outra tabela legal — armazenar com `effectiveFrom`. A alíquota anterior (1,50% PF, 2,05% PJ) deve existir como registro histórico até 31/03/2026.

### Pitfall 6: Adicional Noturno Rural vs Urbano
**O que acontece:** Sistema usa horário 22h-5h e percentual 20% (urbano) para trabalhadores rurais.
**Por que acontece:** Implementação genérica que não distingue tipo de contrato/atividade.
**Como evitar:** O cálculo do adicional noturno deve verificar se o contrato é rural. Para rural-agricultura: 21h-5h, 25%. Para rural-pecuária: 20h-4h, 25%. A hora noturna rural tem 60 minutos (não 52m30s).

---

## Code Examples

### Cálculo INSS Progressivo 2026

```typescript
// Source: Portaria Interministerial MPS/MF nº 13/2026
import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export interface INSSBracket {
  from: Decimal;
  upTo: Decimal | null; // null = sem limite (última faixa até o teto)
  rate: Decimal;
}

export interface INSSResult {
  grossBase: Decimal;
  effectiveBase: Decimal; // min(grossSalary, ceiling)
  contribution: Decimal;
  effectiveRate: Decimal; // contribution / grossBase
}

// Tabela 2026 hard-coded para seed (também armazenada no banco com vigência)
export const INSS_TABLE_2026: INSSBracket[] = [
  { from: new Decimal('0'), upTo: new Decimal('1621.00'), rate: new Decimal('0.075') },
  { from: new Decimal('1621.01'), upTo: new Decimal('2902.84'), rate: new Decimal('0.09') },
  { from: new Decimal('2902.85'), upTo: new Decimal('4354.27'), rate: new Decimal('0.12') },
  { from: new Decimal('4354.28'), upTo: new Decimal('8475.55'), rate: new Decimal('0.14') },
];

export const INSS_CEILING_2026 = new Decimal('8475.55');

export function calculateINSS(
  grossSalary: Decimal,
  brackets: INSSBracket[],
  ceiling: Decimal,
): INSSResult {
  const effectiveBase = Decimal.min(grossSalary, ceiling);
  let contribution = new Decimal(0);
  let remaining = effectiveBase;

  for (const bracket of brackets) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const bracketWidth = bracket.upTo
      ? bracket.upTo.minus(bracket.from).plus('0.01')
      : remaining; // última faixa absorve o restante até o teto
    const applicable = Decimal.min(remaining, bracketWidth);
    contribution = contribution.plus(applicable.mul(bracket.rate));
    remaining = remaining.minus(applicable);
  }

  return {
    grossBase: grossSalary,
    effectiveBase,
    contribution: contribution.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    effectiveRate: contribution.div(effectiveBase).toDecimalPlaces(4),
  };
}
```

### Cálculo IRRF 2026 — Duas Etapas

```typescript
// Source: Receita Federal tabela 2026 + Lei 15.079/2024 (redutor)
import Decimal from 'decimal.js';

export interface IRRFBracket {
  upTo: Decimal | null;
  rate: Decimal;
  deduction: Decimal;
}

export interface IRRFInput {
  grossSalary: Decimal;
  inssContribution: Decimal;
  dependents: number;
  alimony: Decimal; // pensão alimentícia
  brackets: IRRFBracket[];
  dependentDeduction: Decimal; // R$ 189,59 em 2026
}

export interface IRRFResult {
  taxableBase: Decimal;
  grossTax: Decimal;   // após tabela progressiva
  redutor: Decimal;    // redutor 2026 (zero se fora da faixa)
  finalTax: Decimal;   // max(0, grossTax - redutor)
}

const IRRF_EXEMPTION_LIMIT = new Decimal('5000.00');
const IRRF_REDUTOR_UPPER = new Decimal('7350.00');
const REDUTOR_A = new Decimal('978.62');
const REDUTOR_B = new Decimal('0.133145');

export function calculateIRRF(input: IRRFInput): IRRFResult {
  const { grossSalary, inssContribution, dependents, alimony, brackets, dependentDeduction } = input;

  const taxableBase = grossSalary
    .minus(inssContribution)
    .minus(dependentDeduction.mul(dependents))
    .minus(alimony);

  if (taxableBase.lessThanOrEqualTo(0)) {
    const zero = new Decimal(0);
    return { taxableBase: zero, grossTax: zero, redutor: zero, finalTax: zero };
  }

  // Etapa 1: tabela progressiva
  let grossTax = new Decimal(0);
  for (const bracket of brackets) {
    if (bracket.upTo === null || taxableBase.lessThanOrEqualTo(bracket.upTo)) {
      grossTax = taxableBase.mul(bracket.rate).minus(bracket.deduction);
      grossTax = Decimal.max(grossTax, new Decimal(0));
      break;
    }
  }

  // Etapa 2: redutor 2026
  let redutor = new Decimal(0);
  if (taxableBase.lessThanOrEqualTo(IRRF_EXEMPTION_LIMIT)) {
    // Isenção total — redutor absorve o imposto inteiro
    return { taxableBase, grossTax, redutor: grossTax, finalTax: new Decimal(0) };
  } else if (taxableBase.lessThanOrEqualTo(IRRF_REDUTOR_UPPER)) {
    redutor = REDUTOR_A.minus(REDUTOR_B.mul(taxableBase));
    redutor = Decimal.max(redutor, new Decimal(0));
  }

  const finalTax = Decimal.max(new Decimal(0), grossTax.minus(redutor));

  return {
    taxableBase,
    grossTax: grossTax.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    redutor: redutor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    finalTax: finalTax.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  };
}
```

### Cálculo Moradia/Alimentação Rural

```typescript
// Source: Lei 5.889/1973, art. 9º e Decreto 73.626/1974
import Decimal from 'decimal.js';

const HOUSING_MAX_RATE = new Decimal('0.20');   // 20% do piso regional
const FOOD_MAX_RATE = new Decimal('0.25');       // 25% do piso regional

export function calculateRuralUtility(
  requestedHousing: Decimal,
  requestedFood: Decimal,
  regionalMinWage: Decimal,  // piso regional do estado (default: salário mínimo federal)
): { housing: Decimal; food: Decimal } {
  return {
    housing: Decimal.min(requestedHousing, regionalMinWage.mul(HOUSING_MAX_RATE))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    food: Decimal.min(requestedFood, regionalMinWage.mul(FOOD_MAX_RATE))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  };
}
```

---

## Runtime State Inventory

Step 2.5: SKIPPED (fase não é rename/refactor/migration).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|---------|
| Node.js | Runtime | ✓ | v24.12.0 | — |
| PostgreSQL | Prisma/BD | ✓ | via Docker | — |
| decimal.js | Engine aritmético | ✓ | 10.6.0 (já instalado) | — |
| expr-eval | Fórmulas customizáveis | ✗ | — | Instalar via pnpm add se necessário |

**Missing dependencies with fallback:**
- `expr-eval`: não instalado — adicionar como dependência nova se o escopo exigir avaliação de fórmulas em runtime. Alternativa: limitar fórmulas a constantes e percentuais fixos (mais simples, sem dependência nova).

---

## Schema Design — Novos Modelos Phase 26

Esta fase cria os seguintes modelos Prisma (migration `20260503100000_add_payroll_rubricas_tables`):

### PayrollRubrica
Rubrica de provento ou desconto configurável por organização.

```prisma
model PayrollRubrica {
  id             String        @id @default(uuid())
  organizationId String
  code           String        // ex: "HE_50", "INSS", "VT"
  name           String        // ex: "Hora Extra 50%"
  rubricaType    RubricaType   // PROVENTO | DESCONTO | INFORMATIVO
  calculationType CalculationType // FIXED_VALUE | PERCENTAGE | FORMULA | SYSTEM
  formulaType    SystemFormulaType? // SYSTEM_INSS | SYSTEM_IRRF | SYSTEM_FGTS | null
  baseFormula    String?       // ex: "SALARIO_BASE * 0.5 * HORAS / 220"
  rate           Decimal?      @db.Decimal(8, 6)   // ex: 0.5 para 50%
  fixedValue     Decimal?      @db.Decimal(10, 2)
  incideINSS     Boolean       @default(false)
  incideFGTS     Boolean       @default(false)
  incideIRRF     Boolean       @default(false)
  isSystem       Boolean       @default(false)   // true = não pode ser excluída
  isActive       Boolean       @default(true)
  eSocialCode    String?       // código rubrica eSocial (futuro)
  createdBy      String
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  organization   Organization  @relation(...)

  @@unique([organizationId, code])
  @@index([organizationId, rubricaType])
  @@map("payroll_rubricas")
}
```

### PayrollLegalTable (tabela-mãe com vigência)
```prisma
model PayrollLegalTable {
  id             String        @id @default(uuid())
  organizationId String?       // null = tabela global (seed); não-null = override da org
  tableType      LegalTableType // INSS | IRRF | SALARY_FAMILY | MINIMUM_WAGE | FUNRURAL
  stateCode      String?       // para MINIMUM_WAGE estadual (ex: "SP")
  effectiveFrom  DateTime      @db.Date
  notes          String?
  createdBy      String
  createdAt      DateTime      @default(now())

  brackets       PayrollTableBracket[]
  scalarValues   PayrollTableScalar[]

  @@index([tableType, effectiveFrom])
  @@index([organizationId, tableType, effectiveFrom])
  @@map("payroll_legal_tables")
}
```

### PayrollTableBracket (faixas progressivas)
```prisma
model PayrollTableBracket {
  id        String          @id @default(uuid())
  tableId   String
  fromValue Decimal         @db.Decimal(12, 2)
  upTo      Decimal?        @db.Decimal(12, 2)   // null = sem limite
  rate      Decimal         @db.Decimal(8, 6)
  deduction Decimal?        @db.Decimal(10, 2)   // parcela a deduzir (IRRF)
  order     Int

  table     PayrollLegalTable @relation(...)

  @@index([tableId, order])
  @@map("payroll_table_brackets")
}
```

### PayrollTableScalar (valores escalares)
```prisma
model PayrollTableScalar {
  id        String          @id @default(uuid())
  tableId   String
  key       String          // ex: "DEPENDENT_DEDUCTION", "CEILING", "VALUE_PER_CHILD"
  value     Decimal         @db.Decimal(12, 2)

  table     PayrollLegalTable @relation(...)

  @@map("payroll_table_scalars")
}
```

### Enums necessários
```prisma
enum RubricaType {
  PROVENTO
  DESCONTO
  INFORMATIVO
}

enum CalculationType {
  FIXED_VALUE
  PERCENTAGE
  FORMULA
  SYSTEM
}

enum SystemFormulaType {
  SYSTEM_INSS
  SYSTEM_IRRF
  SYSTEM_FGTS
  SYSTEM_SALARY_FAMILY
  SYSTEM_FUNRURAL
}

enum LegalTableType {
  INSS
  IRRF
  SALARY_FAMILY
  MINIMUM_WAGE
  FUNRURAL
}
```

### Seed obrigatório para tabelas 2026
A migration deve incluir (via `prisma/seed.ts` ou SQL de dados) as tabelas legais 2026 com `organizationId = null` (globais). O serviço deve buscar primeiro a tabela customizada da organização (`organizationId = orgId`), com fallback para a tabela global. Isso garante que toda organização nova funcione de imediato sem configuração.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IRRF tabela simples (alíquota + dedução) | IRRF em duas etapas com redutor progressivo | Janeiro/2026 (Lei 15.079/2024) | Qualquer sistema não atualizado retornará IRRF errado para rendas entre R$5k-R$7.35k |
| FUNRURAL PF = 1,50% | FUNRURAL PF = 1,63% | Abril/2026 (LC 224/2025) | Alíquota aumenta a partir de 01/04/2026 |
| INSS teto R$ 8.157,41 | INSS teto R$ 8.475,55 | Janeiro/2026 (Portaria 13/2026) | Contribuição máxima aumenta para R$ 988,09 |
| Salário mínimo R$ 1.518 | Salário mínimo R$ 1.621 | Janeiro/2026 | Base de insalubridade e salário-família mudam |

**Deprecated/outdated:**
- Tabela IRRF sem redutor: obrigatoriamente substituída pela versão com duas etapas desde 01/01/2026
- FUNRURAL com alíquotas pré-LC 224/2025: válida apenas para competências até março/2026

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (backend) |
| Config file | `apps/backend/jest.config.js` |
| Quick run command | `cd apps/backend && npx jest --testPathPattern="payroll-engine" --no-coverage` |
| Full suite command | `cd apps/backend && npx jest --no-coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOLHA-01 CA1 | Rubricas de provento criadas e listadas | unit (routes mock) | `jest --testPathPattern="payroll-rubricas.routes.spec"` | ❌ Wave 0 |
| FOLHA-01 CA2 | Tabela INSS 2026 seed + busca por vigência | unit (service) | `jest --testPathPattern="payroll-tables.routes.spec"` | ❌ Wave 0 |
| FOLHA-01 CA3 | INSS progressivo correto (4 faixas, teto) | unit (engine) | `jest --testPathPattern="payroll-engine.spec"` | ❌ Wave 0 |
| FOLHA-01 CA3 | IRRF etapa 1 + redutor (casos ≤5k, 5k-7.35k, >7.35k) | unit (engine) | `jest --testPathPattern="payroll-engine.spec"` | ❌ Wave 0 |
| FOLHA-01 CA3 | FGTS 8% sobre base correta | unit (engine) | `jest --testPathPattern="payroll-engine.spec"` | ❌ Wave 0 |
| FOLHA-01 CA3 | FUNRURAL modo PF e PJ (alíquotas pré e pós-abril) | unit (engine) | `jest --testPathPattern="payroll-engine.spec"` | ❌ Wave 0 |
| FOLHA-01 CA4 | Adicional noturno rural 21h-5h × 25% | unit (engine) | `jest --testPathPattern="payroll-engine.spec"` | ❌ Wave 0 |
| FOLHA-01 CA4 | Moradia: max 20% piso regional | unit (engine) | `jest --testPathPattern="payroll-engine.spec"` | ❌ Wave 0 |
| FOLHA-01 CA4 | Alimentação: max 25% piso regional | unit (engine) | `jest --testPathPattern="payroll-engine.spec"` | ❌ Wave 0 |

### Sampling Rate
- **Por commit de task:** `cd apps/backend && npx jest --testPathPattern="payroll" --no-coverage`
- **Por merge de wave:** `cd apps/backend && npx jest --no-coverage`
- **Phase gate:** Full suite verde antes do `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/backend/src/modules/payroll-engine/payroll-engine.spec.ts` — cobre cálculo INSS/IRRF/FGTS/rural
- [ ] `apps/backend/src/modules/payroll-rubricas/payroll-rubricas.routes.spec.ts`
- [ ] `apps/backend/src/modules/payroll-tables/payroll-tables.routes.spec.ts`

---

## Open Questions

1. **Fórmulas customizáveis — escopo real**
   - O que sabemos: FOLHA-01 menciona "fórmulas customizáveis" para rubricas
   - O que está impreciso: se o cliente precisa de expressões com variáveis ou apenas percentuais/valores fixos
   - Recomendação: Implementar `CalculationType.PERCENTAGE` e `CalculationType.FIXED_VALUE` em Wave 1; adiar `CalculationType.FORMULA` (com expr-eval) para Wave 3 se o tempo permitir. Os casos de uso reais são >95% percentual ou fixo.

2. **Salário mínimo regional — granularidade**
   - O que sabemos: STATE.md lista como pending "regional minimum wage table per state"
   - O que está impreciso: cliente precisa de tabela por estado ou basta federal?
   - Recomendação: Implementar `LegalTableType.MINIMUM_WAGE` com campo `stateCode: String?` (null = federal). Seeds incluem apenas o federal (R$ 1.621,00). Frontend permite adicionar estaduais. Bloqueia cálculo incorreto de moradia/alimentação para SP (piso R$ 1.804,00).

3. **FUNRURAL — associação com fazenda**
   - O que sabemos: FUNRURAL é eleição anual por fazenda/produtor
   - O que está impreciso: onde armazenar `funruralMode` — no `Organization`, no `Farm`, ou tabela de config separada
   - Recomendação: Campo `funruralMode` e `funruralElectionYear` no modelo `Farm`. Verificar schema Phase 25 — não foi adicionado, precisa de migration junto com Phase 26.

4. **Seed das tabelas legais 2026**
   - O que sabemos: tabelas precisam existir antes da primeira folha ser processada
   - O que está impreciso: estratégia de seed para múltiplas organizações
   - Recomendação: Tabelas com `organizationId = null` são "globais" (fallback). Organização pode sobrescrever criando tabela própria. Isso elimina a necessidade de seed por organização.

---

## Project Constraints (from CLAUDE.md)

- `req.params.id as string` obrigatório em todos os routes
- Nunca desestruturar params sem cast
- Enums Prisma devem usar `as const` ou importar tipo — nunca tipar como `: string`
- `Decimal.max(a, b)` é estático — nunca `a.max(b)`
- Frontend: tipos em `src/types/` devem espelhar backend
- Frontend: formulários de criação/edição SEMPRE em modal, nunca página dedicada
- Frontend: `window.confirm()` proibido — usar `ConfirmModal`
- ESLint 9 flat config, Prettier, Husky pre-commit ativo
- Nomes exatos de campos do schema.prisma devem ser verificados antes de usar em `select`

---

## Sources

### Primary (HIGH confidence)
- [Portaria Interministerial MPS/MF nº 13/2026 (gov.br)](https://www.gov.br/previdencia/pt-br/assuntos/rpps/destaques/publicada-a-portaria-interministerial-mps-mf-no-13-de-9-01-2026-que-dispoe-sobre-o-reajuste-dos-beneficios-pagos-pelo-inss-e-demais-valores) — tabelas INSS e salário-família 2026
- [Receita Federal — Tributação 2026](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026) — tabela IRRF mensal e anual 2026, dedução por dependente
- [Gov.br SECOM — isenção R$ 5.000](https://www.gov.br/secom/pt-br/acompanhe-a-secom/noticias/2026/01/nova-tabela-do-ir-veja-faixas-e-aliquotas-e-saiba-mais-sobre-medida-que-isenta-o-pagamento-para-quem-ganha-ate-r-5-mil) — redutor 2026
- [Lei 5.889/1973 (planalto.gov.br)](https://www.planalto.gov.br/ccivil_03/leis/l5889.htm) — regras do trabalhador rural
- Padrão interno `apps/backend/src/modules/depreciation/depreciation-engine.service.ts`

### Secondary (MEDIUM confidence)
- [Contabilizei — INSS 2026](https://www.contabilizei.com.br/contabilidade-online/tabela-inss/) — confirmação das faixas INSS 2026
- [Agência Brasil — IRRF 2026](https://agenciabrasil.ebc.com.br/economia/noticia/2026-01/veja-faixas-e-aliquotas-das-novas-tabelas-do-imposto-de-renda-2026) — tabela IRRF confirmada
- [FarmPlus — FUNRURAL 2026](https://www.farmplus.com.br/aprenda/funrural-2026-o-que-e-quem-paga-aliquotas-como-calcular) — novas alíquotas LC 224/2025
- [Costa & Macedo — Adicional Noturno Rural](https://costaemacedo.adv.br/adicional-noturno-regras-para-trabalhadores-urbanos-rurais-e-diferenciados/) — regras 21h-5h e 25%
- [Martins Romanni — Moradia/Alimentação Rural](https://www.martinsromanni.com.br/descontos-no-salario-do-empregado-rural-destinados-a-moradia-e-alimentacao/) — limites 20%/25% sobre piso regional
- [Bene — Salário-Família 2026](https://bene.com.vc/salario-familia-2026-tabela-atualizada-novos-valores/) — R$ 67,54 por filho até R$ 1.980,38
- [Blog Fortes Tecnologia — Redutor 2026](https://blog.fortestecnologia.com.br/post/calculo-do-imposto-de-renda-2026-como-funciona-o-novo-redutor) — fórmula redutor detalhada

### Tertiary (LOW confidence)
- Informação sobre hora noturna rural = 60 min (não 52m30s): múltiplas fontes secundárias consistentes, mas sem verificação direta no texto da Lei 5.889/1973. Confirmar antes de implementar — a lei não menciona hora reduzida, o que é consistente com a afirmação.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — decimal.js já instalado, padrão de engine existente no projeto
- Tabelas fiscais 2026: HIGH — obtidas do gov.br (fonte primária) e confirmadas em múltiplas fontes
- Regras rurais: MEDIUM-HIGH — múltiplas fontes consistentes, base na Lei 5.889/1973
- Architecture patterns: HIGH — derivados dos padrões internos existentes (depreciation-engine)
- Schema design: MEDIUM — design proposto, sem conflitos detectados com schema atual

**Research date:** 2026-03-24
**Valid until:** 2026-07-01 (estável até próxima portaria ministerial; FUNRURAL muda em 01/04/2026 — já documentado)
