# Phase 27: Controle de Ponto e Jornada — Research

**Researched:** 2026-03-24
**Domain:** Time tracking (time punch / attendance), Brazilian rural labor law (CLT rural / NR-31), overtime calculation, hour bank (banco de horas), PostGIS geofencing, offline mobile sync, monthly timesheet approval workflow, PDF generation, cost-center integration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PONTO-01 | Registro de ponto (entrada, intervalos, saída) via mobile com geolocalização validada por perímetro da fazenda (PostGIS), funcionamento offline com sync, e apontamento manual pelo gerente com justificativa auditável | Stack offline já estabelecida (expo-location + expo-sqlite + offline-queue), padrão PostGIS ST_Contains já usado no projeto, tolerância configurável via WorkSchedule |
| PONTO-02 | Vincular horas trabalhadas a atividades/operações (plantio, colheita, trato, manutenção) por talhão ou pasto, modo rápido por equipe, custo/hora automático lançado no centro de custo da atividade | Módulos FieldOperation/CostCenter/FieldTeam existentes são pontos de integração; padrão de lançamento por centro de custo já existe no projeto |
| PONTO-03 | Cálculo automático de horas extras (50%/100%), banco de horas com alerta de vencimento (6 meses), adicional noturno rural (21h-5h, 25%, hora reduzida 52m30s), alerta de interjornada <11h e DSR sobre extras | payroll-engine já tem RuralNightInput/Result; date-holidays@^3.26.11 citado no STATE.md como nova dependência v1.3 |
| PONTO-04 | Espelho de ponto mensal: revisão com visual de inconsistências, correção com justificativa, fluxo de aprovação (gerente → RH), aceite do colaborador, exportação PDF e prazo de fechamento configurável | Padrão pdfkit já estabelecido; fluxo de aprovação similar ao PayrollRun state machine |
</phase_requirements>

---

## Summary

Phase 27 implementa o módulo de controle de ponto que alimenta diretamente o processamento de folha da Phase 28 (FOLHA-02). A decisão do STATE.md é clara: **time entries são imutáveis quando bloqueadas por `payrollRunId`** — o mobile offline sync deve verificar o lock antes de aplicar edits.

O trabalho divide-se em quatro eixos técnicos: (1) modelos de banco de dados para registros de ponto, banco de horas e espelho mensal; (2) backend REST com cálculos de horas extras, noturno rural e banco de horas usando a engine já existente; (3) mobile — nova tela de ponto que reutiliza o padrão `expo-location + offline-queue + SQLite migration V12`; (4) frontend web — páginas de revisão de espelho com fluxo de aprovação, exportação PDF via pdfkit.

Os pontos de integração críticos são: `WorkSchedule` (jornada contratual para calcular HE), `FieldOperation`/`FieldTeam` (vincular horas a operações e centros de custo), `payroll-engine.service` (lógica de noturno rural já implementada em `RuralNightInput`), e `PostGIS ST_Contains` (geofencing de ponto mobile — padrão já existente em `monitoring-points.service`).

A dependência `date-holidays@^3.26.11` está listada no STATE.md como nova dependência v1.3 mas ainda NÃO está instalada no `package.json`. Deve ser instalada nesta phase para o cálculo de DSR em domingos e feriados.

**Recomendação principal:** Implementar em 4 planos — (1) Schema + migrations para todas as entidades de ponto; (2) Backend engine de cálculo (HE, noturno rural, banco de horas) + endpoints REST; (3) Mobile — tela de clock-in/out com geofencing + offline; (4) Frontend web — apontamento manual, vincular operações, espelho mensal com aprovação + PDF.

---

## Project Constraints (from CLAUDE.md)

- `req.params.id as string` — sempre usar cast; nunca desestruturar sem cast
- Prisma enums: `as const` em retornos literais; nunca tipar como `: string`
- Nomes de campos do schema Prisma: verificar nome exato antes de usar em `select`
- `Decimal.max(a, b)` — estático; `a.max(b)` não existe
- Frontend types devem espelhar backend: se backend tem `TimeEntryOutput`, frontend precisa de `TimeEntry` em `@/types/attendance`
- `null` em campos Prisma; `undefined` em interfaces de input do frontend
- Módulos colocalizados: `modules/{domínio}/controller+service+routes+types`
- `app.ts` separado de `main.ts`
- Testes: `**/*.routes.spec.ts` (Jest), frontend `**/*.spec.tsx` (Vitest)
- `prisma generate` antes de `tsc` em CI
- UI: Lucide Icons, DM Sans headlines, Source Sans 3 body, escala de 4px, touch targets 48x48px
- Confirmações destrutivas: nunca `window.confirm()` — usar `ConfirmModal`
- Formulários de criação/edição: sempre em modal, nunca em página dedicada

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| decimal.js | ^10.6.0 | Aritmética de horas e cálculos financeiros (HE, noturno) | Já instalado — mesmo padrão da depreciação e payroll-engine |
| Prisma | 7.x | ORM — modelos de ponto, banco de horas, espelho | Stack padrão do projeto |
| date-fns | ^4.1.0 | Cálculo de duração entre timestamps, início/fim de período mensal | Já instalado no backend |
| date-holidays | ^3.26.11 | Calendário de feriados nacional/estadual/municipal para DSR 100% | Citado no STATE.md como nova dependência v1.3; ainda não instalado — adicionar nesta phase |
| pdfkit | ^0.17.2 | Geração de PDF do espelho de ponto | Já instalado — padrão do projeto (contratos, receituários) |
| expo-location | ~19.0.8 | Geolocalização no mobile para validação de ponto | Já instalado no app mobile — padrão usado em planting-operation, pesticide-application |
| expo-sqlite | ^55.0.10 | Armazenamento local offline de punches | Já instalado — padrão da offline-queue |
| @turf/boolean-within | ^7.3.4 | Validação local se ponto está dentro do polígono da fazenda | Já instalado no backend; pode ser reutilizado no mobile |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PostGIS ST_Contains | (PostgreSQL extension) | Validação server-side se coordenada GPS está dentro do boundary da fazenda | Já usado em monitoring-points.service.ts — mesmo padrão |
| expr-eval | ^2.0.2 | Avaliação segura de fórmulas matemáticas em rubricas | Já instalado — usado em payroll-engine; alternativa segura a execução de código arbitrário |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| date-holidays | tabela manual de feriados no banco | date-holidays tem suporte a 180+ países, inclui feriados municipais brasileiros — não hand-roll isso |
| PostGIS server-side | @turf/boolean-within client-side | Validação client-side não é autoritativa; usar PostGIS como validação definitiva, turf apenas para UX offline |
| pdfkit para espelho | react-pdf ou puppeteer | pdfkit já é o padrão do projeto — não introduzir nova lib |

**Installation (date-holidays — ainda não instalado):**
```bash
pnpm --filter @protos-farm/backend add date-holidays@^3.26.11
pnpm --filter @protos-farm/backend add -D @types/date-holidays
```

**Version verification (2026-03-24):**
```bash
npm view date-holidays version   # 3.26.11
npm view pdfkit version          # 0.17.2 — já instalado
npm view decimal.js version      # 10.6.0 — já instalado
```

---

## Architecture Patterns

### Recommended Project Structure
```
apps/backend/src/modules/
├── time-entries/               # CRUD de registros de ponto (punch in/out)
│   ├── time-entries.routes.ts
│   ├── time-entries.routes.spec.ts
│   ├── time-entries.service.ts
│   └── time-entries.types.ts
├── time-calculations/          # Engine: cálculo HE, noturno rural, banco de horas
│   ├── time-calculations.service.ts   # funções puras — sem acesso a BD
│   ├── time-calculations.spec.ts      # testes com casos brasileiros reais
│   └── time-calculations.types.ts
├── overtime-bank/              # CRUD banco de horas + alertas de vencimento
│   ├── overtime-bank.routes.ts
│   ├── overtime-bank.routes.spec.ts
│   ├── overtime-bank.service.ts
│   └── overtime-bank.types.ts
└── timesheets/                 # Espelho mensal — revisão, aprovação, PDF
    ├── timesheets.routes.ts
    ├── timesheets.routes.spec.ts
    ├── timesheets.service.ts
    └── timesheets.types.ts

apps/frontend/src/
├── pages/AttendancePage.tsx    # Gerente: apontamento manual, vincular operações
├── pages/TimesheetPage.tsx     # Espelho mensal: revisão, aprovação
├── types/attendance.ts         # Types espelhando backend
└── hooks/
    ├── useTimeEntries.ts
    └── useTimesheet.ts

apps/mobile/app/(app)/
└── time-punch.tsx              # Clock-in/out com geolocalização
apps/mobile/services/db/
└── time-punch-repository.ts    # SQLite offline store para punches
```

### Pattern 1: Geofencing de Ponto via PostGIS
**O que é:** Antes de confirmar o registro de ponto, o backend valida que a coordenada GPS enviada pelo mobile está dentro do boundary da fazenda do colaborador.
**Quando usar:** Em todo POST de time entry via mobile.
**Referência interna:** `monitoring-points.service.ts` linha 298-307.

```typescript
// Source: padrão interno monitoring-points.service.ts
const result = await tx.$queryRaw<Array<{ inside: boolean }>>`
  SELECT ST_Contains(
    boundary::geometry,
    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
  ) as inside
  FROM farms
  WHERE id = ${farmId}
`;
const isInsideFarm = result[0]?.inside ?? false;
// Se false: ponto registrado com flag out_of_range = true (não bloqueia — registra com aviso)
```

### Pattern 2: Offline Punch Queue (Mobile)
**O que é:** O punch é salvo primeiro no SQLite local e enfileirado na offline-queue com entidade `'time_punches'`. Ao reconectar, o flush valida a coordenada GPS e cria o TimeEntry no servidor.
**Quando usar:** Em todo clock-in/out mobile, independente de ter conexão.

```typescript
// Adicionado ao OperationEntity union type (pending-operations-repository.ts)
export type OperationEntity =
  | /* ...entidades existentes... */
  | 'time_punches';  // CRITICAL priority — ponto é imutável quando folha fecha

// SQLite migration V12 — time_punches local table
await db.execAsync(`
  CREATE TABLE IF NOT EXISTS time_punches (
    id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL,
    farm_id TEXT NOT NULL,
    punch_type TEXT NOT NULL,       -- CLOCK_IN | BREAK_START | BREAK_END | CLOCK_OUT
    punched_at TEXT NOT NULL,       -- ISO 8601 timestamp
    latitude REAL,
    longitude REAL,
    out_of_range INTEGER DEFAULT 0, -- 1 se fora do perímetro
    synced INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);
```

### Pattern 3: Time Calculations Engine (funções puras)
**O que é:** Todas as regras de cálculo de horas ficam em funções puras no módulo `time-calculations`, sem acesso ao BD. O caller (service) busca os dados e os passa como parâmetros.
**Quando usar:** Cálculo de HE, noturno rural, banco de horas, DSR — tudo passa pelo engine.
**Referência interna:** `payroll-engine.service.ts` — mesmo padrão.

```typescript
// Source: padrão interno payroll-engine.service.ts
import Decimal from 'decimal.js';
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export interface DailyWorkInput {
  workedMinutes: Decimal;           // minutos trabalhados no dia (descontando intervalos)
  scheduledMinutes: Decimal;        // jornada contratual diária (ex: 528 min = 8h48 para 44h/semana)
  isDayOff: boolean;                // domingo, feriado ou DSR
  nightMinutes: Decimal;            // minutos entre 21h-5h (hora rural)
}

export interface DailyWorkResult {
  regularMinutes: Decimal;
  overtime50Minutes: Decimal;       // HE dias normais: 50%
  overtime100Minutes: Decimal;      // HE domingos/feriados: 100%
  nightPremiumMinutes: Decimal;     // minutos para adicional noturno (hora reduzida: 60 / 52m30s)
  interjornada: Decimal | null;     // gap desde último punch_out (null se primeiro dia)
  interjornadaAlert: boolean;       // true se < 11h
}
```

### Pattern 4: Hora Reduzida Rural (adicional noturno)
**O que é:** Na CLT rural, a hora noturna é reduzida — 52 minutos e 30 segundos equivalem a 1 hora contratual. Isso eleva o número de horas contadas no período noturno.
**Regra:** 60 minutos reais divididos por 52,5 resulta em 1,14286 horas contadas. Adicional de 25% sobre o valor da hora.
**Período:** 21h às 5h (diferente do urbano: 22h-5h).

```typescript
// Conversão de minutos noturnos para horas contratuais rurais
const HORA_REDUZIDA_FATOR = new Decimal(60).div(new Decimal(52.5)); // aprox 1.142857

export function calcRuralNightPremium(
  nightMinutes: Decimal,   // minutos reais entre 21h-5h
  hourlyRate: Decimal,     // salário / horas mensais contratuais
): RuralNightResult {
  // Horas contratuais equivalentes (hora reduzida)
  const contractualHours = nightMinutes.div(60).mul(HORA_REDUZIDA_FATOR);
  // Adicional = 25% do valor hora por hora contratual
  const premium = contractualHours.mul(hourlyRate).mul(new Decimal('0.25'));
  return { premium, nightHours: contractualHours };
}
// Nota: RuralNightInput/Result já existem em payroll-engine.types.ts — reutilizar ou mover para time-calculations
```

### Pattern 5: Timesheet State Machine (espelho mensal)
**O que é:** O espelho mensal segue uma máquina de estados similar ao `PayrollRun` e `DepreciationRun` do projeto.
**Transições:**

```
DRAFT -> PENDING_MANAGER -> MANAGER_APPROVED -> PENDING_RH -> APPROVED -> LOCKED
              |                    |                  |
          REJECTED             REJECTED            REJECTED -> DRAFT (loop)
```

- `LOCKED` = `payrollRunId` foi atribuído — registros de ponto imutáveis (decisão do STATE.md)
- Colaborador pode `ACCEPT` ou `DISPUTE` antes de `APPROVED`
- Prazo de fechamento configurável: campo `closingDay` nos parâmetros da organização

### Anti-Patterns a Evitar
- **Calcular HE em tempo real durante registro de ponto:** Out of Scope explícito em REQUIREMENTS.md — "Cálculo de folha em tempo real durante registro de ponto cria expectativas falsas com dados incompletos; calcular apenas no fechamento."
- **Background location tracking contínuo:** ADV-05 em v2 Requirements — não implementar (requer permissões especiais iOS/Android e EAS custom build).
- **Usar `number` (float) para minutos/horas:** Sempre `Decimal` — erros de arredondamento causam discrepâncias trabalhistas.
- **Bloquear punch offline se fora do perímetro:** Registrar com flag `out_of_range = true`, mas nunca bloquear offline — o colaborador pode estar em área sem sinal dentro da fazenda.
- **Avaliação insegura de fórmulas:** Usar `expr-eval` (já instalado) em vez de mecanismos de execução de código arbitrário.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Calendário de feriados | Tabela manual por estado/município | `date-holidays@^3.26.11` | Inclui feriados municipais, estaduais e nacionais do Brasil com vigência; atualizado automaticamente |
| Validação se coordenada está dentro do polígono | Algoritmo point-in-polygon manual | `ST_Contains` (PostGIS) ou `@turf/boolean-within` (já instalado) | PostGIS é autoritativo; turf já está no projeto para client-side |
| PDF do espelho de ponto | Renderização HTML para impressão | `pdfkit` (já instalado) | Padrão estabelecido no projeto (contratos, receituários, cashflow) |
| Aritmética de horas em float | `Date.getHours()`, somar minutos como `number` | `Decimal.js` para todos os cálculos | Acumulação de minutos em float causa discrepâncias de 1-2 minutos no mês; impacto em holerite |
| Parser de expressões de rubrica | Execução dinâmica de código | `expr-eval` (já instalado) | Segurança — expr-eval é sandbox controlada; já é o padrão do payroll-engine |

**Key insight:** O adicional noturno rural com hora reduzida é deceptivamente simples mas tem edge cases: turno que começa antes das 21h e termina após as 5h (split noturno), turno que cruza meia-noite (dois dias), trabalhador que faz plantão 12h36. A conversão de minutos noturnos para horas contratuais usando o fator 60/52,5 deve ser aplicada sobre os **minutos reais**, não sobre as horas arredondadas.

---

## Common Pitfalls

### Pitfall 1: Lock de Time Entries e Sincronização Mobile
**O que dá errado:** O mobile enfileira um punch offline enquanto o espelho desse mês já foi processado na folha. O flush aplica o punch e corrompe uma folha fechada.
**Por que acontece:** A offline-queue processa em ordem de criação, mas o servidor pode ter avançado o estado do timesheet.
**Como evitar:** O endpoint POST /time-entries verifica se o mês do punch está `LOCKED` (referenciado por `payrollRunId`). Retorna 409 com `locked: true`. A offline-queue trata 409 como conflito e logga sem reprocessar — padrão já existente em `offline-queue.ts` linha 318-337.
**Sinal de alerta:** Punches de meses anteriores aparecendo em fila de sync.

### Pitfall 2: Intervalo Noturno Que Cruza Meia-Noite
**O que dá errado:** Um punch_in às 22h30 e punch_out às 06h00 do dia seguinte. Calcular apenas `punch_out - punch_in` para minutos noturnos resulta em 7h30 noturnos (correto), mas o dia do registro precisa ser contabilizado no dia do punch_in para o espelho correto.
**Como evitar:** A data de referência do dia de trabalho é a data do CLOCK_IN. Minutos noturnos devem ser calculados separando o período antes e depois da meia-noite: `min(5h em minutos, minutos_após_meia_noite) + max(0, minutos_de_21h_até_meia_noite)`.

### Pitfall 3: Jornada Semanal vs Diária para Cálculo de HE
**O que dá errado:** Colaborador com jornada 6x1 (44h/semana = 7h20/dia) — calcular HE por dia isolado sem considerar o banco semanal pode gerar falso positivo de HE.
**Causa raiz:** CLT Art. 59 permite banco de horas quando há acordo coletivo. A regra padrão é: HE = horas acima da jornada diária (ou semanal conforme acordo).
**Como evitar:** Definir `overtimeBase` no WorkSchedule: `'DAILY'` (calcula HE por dia) ou `'WEEKLY'` (acumula semana). Implementar `'DAILY'` como padrão — mais simples e suficiente para v1.3.

### Pitfall 4: Tolerância de Ponto e Minutos Espelho
**O que dá errado:** Gerente configura tolerância de 10 minutos. Colaborador marca 07h52 ao invés de 08h00. O sistema conta como 7h52 trabalhados em vez de 8h00, afetando o espelho.
**Como evitar:** Tolerância deve ser aplicada apenas para **alertas** (não disparar alerta de ponto não registrado), mas não deve ajustar automaticamente o horário no espelho. O gerente corrige manualmente com justificativa — nunca auto-adjust silencioso.

### Pitfall 5: DSR sobre Horas Extras (OJ 394 TST)
**O que dá errado:** Calcular DSR apenas sobre salário base, ignorando HE habituais.
**Causa raiz:** Orientação Jurisprudencial 394 do TST: horas extras habituais integram o DSR. O cálculo correto é: total HE no mês dividido por dias úteis multiplicado por dias de DSR.
**Como evitar:** O cálculo de DSR não é trivial — implementar como rubrica do sistema `SYSTEM_DSR_HE` na Phase 28 (FOLHA-02). Na Phase 27, apenas acumular e expor os totais de HE no espelho; o DSR fica para o processamento da folha.

### Pitfall 6: Geofencing em Fazendas Sem Boundary Cadastrado
**O que dá errado:** Fazenda não tem boundary desenhado (campo `boundary` null). `ST_Contains(null, ...)` retorna null, não false.
**Como evitar:** `result[0]?.inside ?? false` — já é o padrão do projeto. Adicionar: se `boundary` for null, registrar o ponto sem validação geográfica mas com flag `no_boundary = true` no log de auditoria.

---

## Code Examples

Verified patterns from project sources:

### PostGIS ST_Contains (geofencing)
```typescript
// Source: apps/backend/src/modules/monitoring-points/monitoring-points.service.ts
const result = await tx.$queryRaw<Array<{ inside: boolean }>>`
  SELECT ST_Contains(
    boundary::geometry,
    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
  ) as inside
  FROM farms
  WHERE id = ${farmId}
`;
const isInsideFarm = result[0]?.inside ?? false;
```

### expo-location no mobile (padrão do projeto)
```typescript
// Source: apps/mobile/app/(app)/planting-operation.tsx
import * as Location from 'expo-location';

const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== 'granted') { /* tratar negado */ }
const loc = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.High,
});
// loc.coords.latitude, loc.coords.longitude
```

### Offline queue enqueue com prioridade CRITICAL
```typescript
// Source: apps/mobile/services/offline-queue.ts
await queue.enqueue(
  'time_punches',       // entity (adicionar ao OperationEntity type)
  punchId,              // entityId (UUID gerado local)
  'CREATE',
  punchPayload,
  `/api/org/employees/${employeeId}/time-entries`,
  'POST',
  PRIORITY_CRITICAL,    // ponto é crítico — processar antes de operações normais
);
```

### PDFKit — padrão do projeto
```typescript
// Source: apps/backend/src/modules/employee-contracts/employee-contracts.service.ts
const PDFDocument = (await import('pdfkit')).default;
const doc = new PDFDocument({ size: 'A4', margin: 50 });
// doc.pipe(res) para stream direto na response HTTP
```

### withRlsContext — padrão do projeto
```typescript
// Source: apps/backend/src/modules/employees/employees.service.ts
import { withRlsContext, type RlsContext } from '../../database/rls';

export async function createTimeEntry(ctx: RlsContext, input: CreateTimeEntryInput) {
  return withRlsContext(ctx, async (tx) => {
    // validar lock, criar registro
  });
}
```

### date-holidays (a ser instalado)
```typescript
import Holidays from 'date-holidays';
const hd = new Holidays('BR', 'SP', 'SAO PAULO'); // BR + estado + município
const holidayResult = hd.isHoliday(new Date('2026-12-25')); // objeto feriado ou false
const isSunday = new Date('2026-12-27').getDay() === 0;
const isOvertimeAt100Percent = Boolean(holidayResult) || isSunday;
```

---

## Prisma Schema — Novos Modelos Necessários

```prisma
// Phase 27 — migration: 20260504100000_add_time_tracking_models

model TimeEntry {
  id              String          @id @default(uuid())
  organizationId  String
  employeeId      String
  farmId          String
  date            DateTime        @db.Date
  clockIn         DateTime
  breakStart      DateTime?
  breakEnd        DateTime?
  clockOut        DateTime?
  workedMinutes   Int?
  nightMinutes    Int?
  outOfRange      Boolean         @default(false)
  noBoundary      Boolean         @default(false)
  latitude        Decimal?        @db.Decimal(10, 7)
  longitude       Decimal?        @db.Decimal(10, 7)
  source          TimeEntrySource @default(MOBILE)
  managerNote     String?
  timesheetId     String?
  payrollRunId    String?
  createdBy       String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  organization  Organization        @relation(fields: [organizationId], references: [id])
  employee      Employee            @relation(fields: [employeeId], references: [id])
  farm          Farm                @relation(fields: [farmId], references: [id])
  timesheet     Timesheet?          @relation(fields: [timesheetId], references: [id])
  activities    TimeEntryActivity[]

  @@index([employeeId, date])
  @@index([organizationId, date])
  @@index([timesheetId])
  @@map("time_entries")
}

enum TimeEntrySource {
  MOBILE
  WEB
  MANAGER
  @@map("time_entry_source")
}

model TimeEntryActivity {
  id               String  @id @default(uuid())
  timeEntryId      String
  operationType    String
  fieldOperationId String?
  fieldPlotId      String?
  farmLocationId   String?
  costCenterId     String?
  minutes          Int
  hourlyRate       Decimal @db.Decimal(10, 4)
  costAmount       Decimal @db.Decimal(10, 2)
  notes            String?

  timeEntry TimeEntry @relation(fields: [timeEntryId], references: [id], onDelete: Cascade)

  @@index([timeEntryId])
  @@map("time_entry_activities")
}

model OvertimeBankEntry {
  id             String           @id @default(uuid())
  organizationId String
  employeeId     String
  referenceMonth DateTime         @db.Date
  minutes        Int
  balanceType    OvertimeBankType
  description    String?
  expiresAt      DateTime         @db.Date
  timesheetId    String?
  createdBy      String
  createdAt      DateTime         @default(now())

  employee Employee @relation(fields: [employeeId], references: [id])

  @@index([employeeId, referenceMonth])
  @@index([employeeId, expiresAt])
  @@map("overtime_bank_entries")
}

enum OvertimeBankType {
  CREDIT
  COMPENSATION
  EXPIRATION
  @@map("overtime_bank_type")
}

model Timesheet {
  id               String          @id @default(uuid())
  organizationId   String
  employeeId       String
  referenceMonth   DateTime        @db.Date
  status           TimesheetStatus @default(DRAFT)
  totalWorked      Int             @default(0)
  totalOvertime50  Int             @default(0)
  totalOvertime100 Int             @default(0)
  totalNightMinutes Int            @default(0)
  totalAbsences    Int             @default(0)
  closingDeadline  DateTime?
  managerApprovedBy  String?
  managerApprovedAt  DateTime?
  rhApprovedBy       String?
  rhApprovedAt       DateTime?
  employeeAcceptedAt DateTime?
  employeeDisputeNote String?
  payrollRunId       String?
  notes              String?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  employee    Employee               @relation(fields: [employeeId], references: [id])
  timeEntries TimeEntry[]
  corrections TimesheetCorrection[]

  @@unique([employeeId, referenceMonth])
  @@index([organizationId, referenceMonth, status])
  @@map("timesheets")
}

enum TimesheetStatus {
  DRAFT
  PENDING_MANAGER
  MANAGER_APPROVED
  PENDING_RH
  APPROVED
  LOCKED
  REJECTED
  @@map("timesheet_status")
}

model TimesheetCorrection {
  id            String   @id @default(uuid())
  timesheetId   String
  timeEntryId   String?
  correctedBy   String
  justification String
  beforeJson    Json
  afterJson     Json
  createdAt     DateTime @default(now())

  timesheet Timesheet @relation(fields: [timesheetId], references: [id], onDelete: Cascade)

  @@index([timesheetId])
  @@map("timesheet_corrections")
}
```

---

## Runtime State Inventory

> Phase 27 é greenfield — não há rename, rebrand ou migration de dados existentes.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Nenhum — modelos de ponto não existem ainda | Criação via nova migration |
| Live service config | Nenhum | — |
| OS-registered state | Nenhum | — |
| Secrets/env vars | Nenhum | — |
| Build artifacts | Nenhum | — |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL + PostGIS | Geofencing ST_Contains | Assumido ativo (produção) | 16.x | — |
| expo-location | Mobile clock-in GPS | Sim (já no package.json) | ~19.0.8 | Registrar sem GPS (out_of_range=true) |
| date-holidays | DSR 100% em feriados | Nao instalado ainda | — | Instalar nesta phase |
| pdfkit | PDF espelho | Sim (já no package.json) | ^0.17.2 | — |
| expo-sqlite | Offline punch queue | Sim (já no package.json) | ^55.0.10 | — |
| decimal.js | Cálculos de horas | Sim (já no package.json) | ^10.6.0 | — |
| date-fns | Manipulação de datas | Sim (já no package.json) | ^4.1.0 | — |

**Missing dependencies with no fallback:**
- `date-holidays@^3.26.11` — necessário para identificar feriados brasileiros (nacional/estadual/municipal) para DSR 100%; instalar antes de implementar o engine: `pnpm --filter @protos-farm/backend add date-holidays@^3.26.11`.

**Missing dependencies with fallback:**
- Nenhum.

---

## Validation Architecture

nyquist_validation está ativo (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (backend) |
| Config file | `apps/backend/jest.config.ts` |
| Quick run command | `pnpm --filter @protos-farm/backend test --testPathPattern time-calculations` |
| Full suite command | `pnpm --filter @protos-farm/backend test` |

### Phase Requirements — Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PONTO-01 | POST /time-entries cria entrada e valida geofencing | unit (routes mock) | `pnpm --filter @protos-farm/backend test --testPathPattern time-entries.routes.spec` | Wave 0 |
| PONTO-01 | Punch offline enfileira na offline-queue e sincroniza | unit (mobile) | `pnpm --filter @protos-farm/mobile test --testPathPattern time-punch` | Wave 0 |
| PONTO-02 | POST /time-entries/:id/activities cria vínculo com operação e centro de custo | unit (routes mock) | `pnpm --filter @protos-farm/backend test --testPathPattern time-entries.routes.spec` | Wave 0 |
| PONTO-02 | custo/hora calculado corretamente: (minutes/60) * hourlyRate | unit (engine) | `pnpm --filter @protos-farm/backend test --testPathPattern time-calculations.spec` | Wave 0 |
| PONTO-03 | calcDailyWork retorna HE 50% correto para dia normal | unit (engine) | `pnpm --filter @protos-farm/backend test --testPathPattern time-calculations.spec` | Wave 0 |
| PONTO-03 | calcDailyWork retorna HE 100% em domingo/feriado com date-holidays | unit (engine) | `pnpm --filter @protos-farm/backend test --testPathPattern time-calculations.spec` | Wave 0 |
| PONTO-03 | adicional noturno rural 25% com hora reduzida 52m30s | unit (engine) | `pnpm --filter @protos-farm/backend test --testPathPattern time-calculations.spec` | Wave 0 |
| PONTO-03 | alerta banco de horas maior que 6 meses | unit (service) | `pnpm --filter @protos-farm/backend test --testPathPattern overtime-bank.routes.spec` | Wave 0 |
| PONTO-03 | alerta interjornada menor que 11h | unit (engine) | `pnpm --filter @protos-farm/backend test --testPathPattern time-calculations.spec` | Wave 0 |
| PONTO-04 | Fluxo de aprovação: DRAFT para PENDING_MANAGER para MANAGER_APPROVED para APPROVED para LOCKED | unit (routes mock) | `pnpm --filter @protos-farm/backend test --testPathPattern timesheets.routes.spec` | Wave 0 |
| PONTO-04 | PATCH /timesheets/:id/entries/:entryId com justificativa cria TimesheetCorrection | unit (routes mock) | `pnpm --filter @protos-farm/backend test --testPathPattern timesheets.routes.spec` | Wave 0 |
| PONTO-04 | GET /timesheets/:id/pdf retorna PDF buffer | unit (routes mock) | `pnpm --filter @protos-farm/backend test --testPathPattern timesheets.routes.spec` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @protos-farm/backend test --testPathPattern time-calculations.spec`
- **Per wave merge:** `pnpm --filter @protos-farm/backend test`
- **Phase gate:** Full suite green antes do `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/backend/src/modules/time-calculations/time-calculations.spec.ts` — cobre PONTO-03 (engine puro)
- [ ] `apps/backend/src/modules/time-entries/time-entries.routes.spec.ts` — cobre PONTO-01, PONTO-02
- [ ] `apps/backend/src/modules/overtime-bank/overtime-bank.routes.spec.ts` — cobre PONTO-03 (banco de horas)
- [ ] `apps/backend/src/modules/timesheets/timesheets.routes.spec.ts` — cobre PONTO-04
- [ ] `apps/mobile/services/db/time-punch-repository.ts` — repositório SQLite offline para punches

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HE rural = 50% sempre | HE 50% dia normal, 100% domingos/feriados | CLT Art. 73 + Decreto 73.626/74 | Domingos exigem 100%; sem date-holidays o cálculo é incorreto |
| Noturno rural = 22h-5h (mesmo que urbano) | 21h-5h (rural — Decreto 73.626/74) | Decreto 73.626/74 | Início 1h antes; ignorar isso gera déficit de 1h por turno noturno |
| Hora noturna = 60 min | Hora reduzida rural = 52min30s | NR-31 e CLT rural | Fator 60 dividido por 52,5 = 1,142857 — sem isso paga menos adicional do que o legal |
| Banco de horas sem prazo | Vence em 6 meses (acordo coletivo padrão) | Lei 9.601/1998 + MP 2.164/2001 | Alerta obrigatório antes do vencimento |

**Deprecated/outdated:**
- **Homologação sindical para rescisão:** Dispensada desde Reforma Trabalhista (Lei 13.467/2017) — irrelevante para Phase 27, importante para Phase 29.
- **DIRF:** Abolida em 2025; dados fluem via eSocial + EFD-Reinf — não implementar.

---

## Open Questions

1. **Tolerância de ponto: quantos minutos padrão?**
   - O que sabemos: REQUIREMENTS.md cita "tolerância configurável"; WorkSchedule já existe com `startTime`/`endTime`
   - O que não está claro: se a tolerância deve ser campo no WorkSchedule ou em configurações da organização
   - Recomendação: Adicionar campo `toleranceMinutes` ao `WorkSchedule` (padrão: 10 minutos) — co-localizado com a jornada que a define

2. **Custo/hora para lançamento no centro de custo: salário base ou custo total com encargos?**
   - O que sabemos: `EmployeeSalaryHistory` existe; encargos (INSS 20%, RAT, FGTS 8%) são calculados na Phase 28
   - O que não está claro: se o custo real (salário + encargos) deve ser calculado agora ou na Phase 28
   - Recomendação: Phase 27 lança custo com base no salário bruto dividido pelas horas mensais contratuais. Phase 28 pode refinar com encargos no fechamento da folha.

3. **Prazo de fechamento do espelho: campo em qual entidade?**
   - O que sabemos: PONTO-04 cita "prazo de fechamento configurável"
   - O que não está claro: se é por organização, por fazenda, ou por grupo de colaboradores
   - Recomendação: Campo `timesheetClosingDay` (1-28) na configuração da organização — mesmo nível dos parâmetros de folha da Phase 26.

---

## Sources

### Primary (HIGH confidence)
- Projeto interno — `apps/backend/prisma/schema.prisma` — modelos Employee, WorkSchedule, EmployeeContract, FieldOperation, Farm (com boundary)
- Projeto interno — `apps/backend/src/modules/payroll-engine/payroll-engine.types.ts` — tipos RuralNightInput/Result já implementados
- Projeto interno — `apps/mobile/services/offline-queue.ts` — padrão de queue com CRITICAL priority
- Projeto interno — `apps/mobile/services/database.ts` — padrão migration SQLite (V1-V11)
- Projeto interno — `apps/backend/src/modules/monitoring-points/monitoring-points.service.ts` — padrão ST_Contains
- `.planning/STATE.md` — decisão: time entries locked by payrollRunId; date-holidays listado como nova dep v1.3

### Secondary (MEDIUM confidence)
- CLT Art. 59-61 (banco de horas), Art. 73 (adicional noturno), Decreto 73.626/74 (rural: 21h-5h, hora reduzida)
- Lei 9.601/1998 + MP 2.164/2001 (banco de horas — prazo 6 meses por acordo coletivo)
- OJ 394 TST (DSR sobre HE habituais)
- npm registry: `date-holidays@3.26.11` — verificado em 2026-03-24

### Tertiary (LOW confidence)
- Nenhum.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todas as libs já instaladas exceto date-holidays (citada no STATE.md como obrigatória v1.3)
- Architecture: HIGH — segue padrões estabelecidos do projeto (engine puro, offline-queue, PostGIS, state machine)
- Pitfalls: HIGH — baseados em edge cases da CLT rural documentados + código existente do projeto
- Schema proposto: MEDIUM — rascunho bem fundamentado, requer revisão antes de migrar; campos podem ser ajustados

**Research date:** 2026-03-24
**Valid until:** 2026-04-24
