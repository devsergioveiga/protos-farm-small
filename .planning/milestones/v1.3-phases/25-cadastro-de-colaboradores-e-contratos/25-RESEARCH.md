# Phase 25: Cadastro de Colaboradores e Contratos - Research

**Researched:** 2026-03-23
**Domain:** HR — Employee Entity, Contracts, Positions, Work Schedules, Bulk Import, Employee Detail Page
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Entidade Colaborador**

- **D-01:** Employee é entidade separada de User. Colaborador tem dados trabalhistas (CPF, PIS/PASEP, CTPS, dependentes, dados bancários) como entidade própria. Campo `userId` opcional para os poucos que acessam o sistema.
- **D-02:** FieldTeamMember ganha campo `employeeId` opcional (migration retroativa). Equipes existentes mantêm `userId`, novos membros podem ter `employeeId`. Ponto/folha puxam do Employee.
- **D-03:** State machine explícita para status do colaborador: ATIVO → AFASTADO → ATIVO, ATIVO → FÉRIAS → ATIVO, ATIVO → DESLIGADO (terminal). Transições validadas no service. Histórico em tabela EmployeeStatusHistory.
- **D-04:** Associação multi-fazenda via tabela EmployeeFarm com período (startDate/endDate), status e cargo por fazenda. Contrato vinculado à organização, lotação à fazenda.

**Contratos e Cargos**

- **D-05:** Modelo único EmployeeContract com `contractType` enum (CLT_INDETERMINATE, CLT_DETERMINATE, SEASONAL, INTERMITTENT, TRIAL, APPRENTICE). Campos opcionais conforme tipo (endDate só para determinado/safra/experiência). Aditivos em tabela ContractAmendment.
- **D-06:** Position (cargo, CBO, descrição, adicionais) separado de SalaryBand (níveis: Júnior/Pleno/Sênior com piso/teto). Posição reutilizável entre fazendas, faixa salarial pode variar. Quadro de lotação = agregação de EmployeeFarm por Position.
- **D-07:** WorkSchedule como tabela configurável com nome, tipo (FIXED, SHIFT, CUSTOM), dias da semana, horários entrada/saída, intervalo. Templates pré-configurados (5x2, 6x1, 12x36, ordenha 2x). Vinculada ao contrato. Essencial para Phase 27 (ponto).
- **D-08:** EmployeeMovement com tipo (PROMOTION, SALARY_ADJUSTMENT, TRANSFER, POSITION_CHANGE), data efetiva, valores antes/depois, motivo, aprovador. EmployeeSalaryHistory alimentado automaticamente em cada movimento salarial. Timeline visual na ficha.

**Ficha Completa**

- **D-09:** EmployeeDetailPage com tabs (padrão AnimalDetailPage): Dados Pessoais | Contrato | Evolução | Documentos | Histórico. Cabeçalho fixo com nome, foto, status, cargo atual. Só seções com dados reais nesta phase — tabs de holerites/férias/EPIs adicionadas quando módulos respectivos forem implementados.
- **D-10:** Recharts para gráfico de evolução salarial. Line chart com tooltip mostrando valor, data e motivo do reajuste.

**Import e Documentos**

- **D-11:** Importação segue padrão animal-file-parser: upload → parse → validação (CPF, PIS, duplicatas) → preview com erros → confirmação → criação em batch. Template Excel downloadável. Campos adicionais: saldo inicial férias, banco de horas.
- **D-12:** EmployeeDocument + file system local (uploads/employees/{employeeId}/). Tabela com tipo (RG, CPF, CTPS, ASO, CONTRATO), fileName, filePath, uploadedAt, uploadedBy. Sem cloud storage.
- **D-13:** CPF: validação de dígitos obrigatória (bloqueia cadastro). PIS/PASEP: validação com warning (permite salvar e completar depois).

### Claude's Discretion

- Estrutura exata dos endpoints REST (CRUD patterns, query params de listagem/filtros)
- Schema Prisma detalhado (nomes de campos, índices, constraints)
- Implementação interna da state machine de status
- Detalhes da validação CPF/PIS (algoritmo de dígitos verificadores)
- Estrutura do template Excel para importação
- Organização de componentes frontend (quais componentes extrair)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                                                                                                                          | Research Support                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| COLAB-01 | Cadastrar colaborador com dados pessoais completos (CPF, RG, PIS/PASEP, CTPS), dados bancários, dependentes com CPF, dados de saúde, upload de documentos, associação a fazendas e status                            | D-01, D-03, D-04, D-12, D-13 — Employee entity, state machine, EmployeeDocument, CPF/PIS validation |
| COLAB-02 | Registrar contrato de trabalho com tipo (CLT indeterminado/determinado/safra/intermitente/experiência/aprendiz), dados contratuais, aditivos com histórico, alertas de vencimento, PDF                               | D-05, D-07 — EmployeeContract enum types, ContractAmendment, node-cron alert pattern, pdfkit        |
| COLAB-03 | Cadastrar cargos com CBO, faixas salariais, escalas de trabalho configuráveis, adicionais por cargo, quadro de lotação, histórico de movimentações, reajuste coletivo em lote                                        | D-06, D-07, D-08 — Position/SalaryBand/WorkSchedule models, EmployeeMovement, bulk operations       |
| COLAB-04 | Importar colaboradores via CSV/Excel com template, validação CPF/PIS, preview, relatório pós-importação, saldos iniciais de férias/banco de horas                                                                    | D-11, D-13 — employee-file-parser based on animal-file-parser, ExcelJS, validation                  |
| COLAB-05 | Ficha completa em tela única com dados pessoais, contrato atual e histórico, evolução salarial (gráfico), holerites 12 meses (stub), saldo de férias, histórico afastamentos, EPIs, treinamentos, operações de campo | D-09, D-10 — EmployeeDetailPage pattern from AnimalDetailPage, Recharts LineChart                   |

</phase_requirements>

---

## Summary

Phase 25 funda o módulo RH do Protos Farm. O trabalho principal é modelar o domínio Employee de forma que suporte todos os módulos downstream (ponto, folha, férias, rescisão, eSocial). O maior risco técnico é o schema Prisma — há 9 novos modelos inter-relacionados que precisam estar corretos desde o início, pois migrations de ajuste de FK são caras.

O projeto já possui todos os building blocks necessários: `isValidCPF` e `isValidCNPJ` em `shared/utils/document-validator.ts`, o padrão de importação em massa em `animal-file-parser.ts` + `asset-bulk-import.service.ts`, o padrão de detalhe com tabs em `AnimalDetailPage.tsx`, o padrão de cron para alertas em `maintenance-alerts.cron.ts`, e Recharts já instalado (v3.7.0). Nenhuma nova dependência é necessária para esta fase — tudo reutiliza stack existente.

O único ponto de atenção é a migration retroativa na tabela `field_team_members` (adição de `employeeId` nullable). Ela deve ser feita sem quebrar dados existentes.

**Primary recommendation:** Implementar em 4 ondas — (1) Schema + migrations, (2) Backend módulos employees/positions/work-schedules, (3) Frontend páginas de listagem e formulários, (4) Ficha completa + importação em massa.

---

## Standard Stack

### Core

| Library   | Version | Purpose                           | Why Standard                         |
| --------- | ------- | --------------------------------- | ------------------------------------ |
| Prisma 7  | ^7.4.1  | ORM + migrations                  | Já em uso                            |
| Express 5 | ^5.1.0  | Backend routing                   | Já em uso                            |
| ExcelJS   | ^4.4.0  | Parse Excel nos imports           | Já em uso no animal-file-parser      |
| pdfkit    | ^0.17.2 | Geração PDF contratos             | Já em uso para receituários e outros |
| node-cron | ^4.2.1  | Alertas automáticos de vencimento | Já em uso em maintenance-alerts.cron |
| Recharts  | ^3.7.0  | Gráfico evolução salarial         | Já instalado no frontend             |

### Supporting

| Library      | Version     | Purpose                                             | When to Use                                                |
| ------------ | ----------- | --------------------------------------------------- | ---------------------------------------------------------- |
| date-fns     | ^4.1.0      | Cálculos de datas (período aquisitivo, vencimentos) | Datas de vencimento contratos, cálculo período experiência |
| multer       | ^2.1.0      | Upload de documentos (diskStorage)                  | Upload de RG, CTPS, ASO digitalizado                       |
| lucide-react | (existente) | Ícones na UI                                        | UserRound, FileText, Calendar, TrendingUp                  |

### Alternatives Considered

| Instead of            | Could Use             | Tradeoff                                                              |
| --------------------- | --------------------- | --------------------------------------------------------------------- |
| pdfkit (já em uso)    | Puppeteer PDF         | Puppeteer tem overhead de browser; pdfkit é suficiente para contratos |
| node-cron (já em uso) | BullMQ scheduled jobs | BullMQ é para Phase 31 (eSocial queues); cron simples é adequado aqui |
| Recharts LineChart    | Chart.js              | Recharts já instalado e em uso; sem razão para trocar                 |

**Installation:** Nenhuma nova dependência — tudo já está no projeto.

---

## Architecture Patterns

### Recommended Module Structure

```
apps/backend/src/modules/
├── employees/                    # CRUD principal + status machine + importação
│   ├── employees.routes.ts
│   ├── employees.routes.spec.ts
│   ├── employees.service.ts
│   ├── employees.types.ts
│   ├── employee-file-parser.ts   # baseado em animal-file-parser.ts
│   └── employee-bulk-import.service.ts
├── employee-contracts/           # CRUD contratos + aditivos + alertas
│   ├── employee-contracts.routes.ts
│   ├── employee-contracts.routes.spec.ts
│   ├── employee-contracts.service.ts
│   └── employee-contracts.types.ts
├── positions/                    # Cargos + CBO + faixas salariais
│   ├── positions.routes.ts
│   ├── positions.routes.spec.ts
│   ├── positions.service.ts
│   └── positions.types.ts
├── work-schedules/               # Escalas configuráveis
│   ├── work-schedules.routes.ts
│   ├── work-schedules.routes.spec.ts
│   ├── work-schedules.service.ts
│   └── work-schedules.types.ts
└── employee-movements/           # Histórico movimentações + reajuste em lote
    ├── employee-movements.routes.ts
    ├── employee-movements.routes.spec.ts
    ├── employee-movements.service.ts
    └── employee-movements.types.ts

apps/backend/src/shared/cron/
└── contract-expiry-alerts.cron.ts  # baseado em maintenance-alerts.cron.ts

apps/frontend/src/
├── pages/
│   ├── EmployeesPage.tsx           # Lista + filtros
│   ├── EmployeesPage.css
│   ├── EmployeeDetailPage.tsx      # Ficha completa com tabs
│   ├── EmployeeDetailPage.css
│   ├── PositionsPage.tsx           # Cargos e faixas
│   ├── PositionsPage.css
│   └── WorkSchedulesPage.tsx       # Escalas de trabalho
├── components/
│   ├── employees/
│   │   ├── CreateEmployeeModal.tsx
│   │   ├── EmployeeStatusBadge.tsx
│   │   ├── EmployeeStatusModal.tsx  # Mudar status (afastar, férias, desligar)
│   │   ├── EmployeeFarmAssocModal.tsx
│   │   ├── SalaryEvolutionChart.tsx # Recharts LineChart
│   │   └── tabs/
│   │       ├── PersonalDataTab.tsx
│   │       ├── ContractTab.tsx
│   │       ├── EvolutionTab.tsx
│   │       ├── DocumentsTab.tsx
│   │       └── HistoryTab.tsx
│   ├── employee-contracts/
│   │   ├── CreateContractModal.tsx
│   │   └── ContractAmendmentModal.tsx
│   ├── positions/
│   │   ├── CreatePositionModal.tsx
│   │   └── SalaryBandModal.tsx
│   ├── work-schedules/
│   │   └── CreateWorkScheduleModal.tsx
│   └── employee-bulk-import/
│       ├── EmployeeBulkImportModal.tsx  # baseado em AnimalBulkImportModal.tsx
│       └── EmployeeColumnMappingForm.tsx
└── types/
    ├── employee.ts
    ├── employee-contract.ts
    ├── position.ts
    └── work-schedule.ts
```

### Pattern 1: State Machine de Status (D-03)

**What:** Enum EmployeeStatus com transições explícitas validadas no service.
**When to use:** Toda mudança de status passa pela função `transitionEmployeeStatus`.

```typescript
// apps/backend/src/modules/employees/employees.service.ts

type EmployeeStatus = 'ATIVO' | 'AFASTADO' | 'FERIAS' | 'DESLIGADO';

const VALID_TRANSITIONS: Record<EmployeeStatus, EmployeeStatus[]> = {
  ATIVO: ['AFASTADO', 'FERIAS', 'DESLIGADO'],
  AFASTADO: ['ATIVO'],
  FERIAS: ['ATIVO'],
  DESLIGADO: [], // terminal
};

async function transitionEmployeeStatus(
  tx: PrismaTransaction,
  employeeId: string,
  newStatus: EmployeeStatus,
  reason: string,
  changedBy: string,
): Promise<void> {
  const employee = await tx.employee.findUniqueOrThrow({ where: { id: employeeId } });
  const allowed = VALID_TRANSITIONS[employee.status as EmployeeStatus];
  if (!allowed.includes(newStatus)) {
    throw new EmployeeError(`Transição inválida: ${employee.status} → ${newStatus}`, 400);
  }
  await tx.employee.update({ where: { id: employeeId }, data: { status: newStatus } });
  await tx.employeeStatusHistory.create({
    data: { employeeId, fromStatus: employee.status, toStatus: newStatus, reason, changedBy },
  });
}
```

### Pattern 2: Bulk Import (D-11) — baseado em asset-bulk-import.service.ts

**What:** 3 endpoints — upload+parse, preview, confirm.
**When to use:** Reutilizar estrutura exata de `AssetPreviewRow`, `PreviewResult`, `ConfirmResult`.

Endpoints:

```
POST /org/:orgId/employees/bulk/upload   → parse + return columnHeaders + rows
POST /org/:orgId/employees/bulk/preview  → validate + CPF/PIS check + return PreviewResult
POST /org/:orgId/employees/bulk/confirm  → create employees in batch
GET  /org/:orgId/employees/bulk/template → download Excel template
```

### Pattern 3: Alertas de Vencimento de Contrato

**What:** Cron diário que detecta contratos de experiência/safra com vencimento em ≤30 dias.
**When to use:** Contratos com `contractType IN (TRIAL, SEASONAL)` e `endDate IS NOT NULL`.

```typescript
// apps/backend/src/shared/cron/contract-expiry-alerts.cron.ts
// Padrão de maintenance-alerts.cron.ts:
// - Redis lock key para evitar execução dupla
// - Timezone: 'America/Sao_Paulo'
// - Horário: '0 7 * * *' (07:00 BRT)
// - Notificação via sistema de notifications existente
```

### Pattern 4: Upload de Documentos (D-12) — baseado em assets.routes.ts

**What:** multer.diskStorage com path `uploads/employees/{orgId}/{employeeId}/`.
**When to use:** Upload de documentos digitalizados (RG, CTPS, ASO, etc.).

```typescript
// Segue exatamente o padrão de photoStorage em assets.routes.ts:
const docStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const orgId = req.user?.organizationId ?? 'unknown';
    const employeeId = req.params.id as string;
    const dir = path.join('uploads', 'employees', orgId, employeeId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
// Servido via /api/uploads/employees/... (já configurado no app.ts)
```

### Pattern 5: Gráfico Evolução Salarial (D-10)

**What:** Recharts LineChart com dados de EmployeeSalaryHistory.
**When to use:** Tab "Evolução" na EmployeeDetailPage.

```tsx
// baseado em CashflowChart.tsx (ComposedChart) e MonthlyEvolutionChart.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Dados: GET /org/:orgId/employees/:id/salary-history
// shape: { effectiveDate: string, salary: number, movementType: string, reason: string }

function SalaryEvolutionChart({ data }: { data: SalaryHistoryPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="effectiveDate" tickFormatter={formatMonthYear} />
        <YAxis tickFormatter={formatBRL} />
        <Tooltip content={<SalaryTooltip />} />
        <Line
          type="monotone"
          dataKey="salary"
          stroke="var(--color-primary-600)"
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Pattern 6: Validação CPF/PIS (D-13)

**What:** `isValidCPF` já existe em `shared/utils/document-validator.ts`. PIS/PASEP precisa ser adicionado.
**PIS/PASEP algorithm:** 11 dígitos. Pesos: 3,2,9,8,7,6,5,4,3,2 (posições 0-9). Soma ponderada mod 11 → se resto < 2 então dígito = 0, senão dígito = 11 - resto.

```typescript
// Adicionar em apps/backend/src/shared/utils/document-validator.ts

export function isValidPIS(pis: string): boolean {
  const cleaned = cleanDocument(pis);
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * weights[i];
  }
  const remainder = sum % 11;
  const digit = remainder < 2 ? 0 : 11 - remainder;
  return digit === parseInt(cleaned[10]);
}
```

**Comportamento D-13:**

- CPF inválido → 400 (bloqueia)
- PIS inválido → 200 com `{ warnings: ['PIS/PASEP com formato inválido'] }` (permite salvar)

### Anti-Patterns to Avoid

- **Não criar tabela EmployeeOrgHistory separada:** O campo `organizationId` no Employee é fixo (pertence à org do usuário logado via RLS). O que muda é a fazenda — usar `EmployeeFarm`.
- **Não calcular quadro de lotação como tabela:** É uma view/aggregate — `GROUP BY positionId` sobre `EmployeeFarm WHERE endDate IS NULL`. Nunca persistir como tabela separada (D-06).
- **Não usar `userId` como obrigatório:** Employee.userId é opcional. A maioria dos colaboradores rurais não tem acesso ao sistema (D-01).
- **Não validar PIS na criação com erro bloqueante:** PIS validation é warning, não error (D-13).
- **Não misturar `contrato` e `lotação`:** Contrato → organização. EmployeeFarm → fazenda específica (D-04).

---

## Don't Hand-Roll

| Problem                         | Don't Build         | Use Instead                                                              | Why                                                 |
| ------------------------------- | ------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| Parse CSV/XLSX                  | Custom parser       | `animal-file-parser.ts` como base para `employee-file-parser.ts`         | Trata BOM, latin1, separador auto-detectado         |
| Validação CPF                   | Biblioteca npm      | `shared/utils/document-validator.ts` (já existe `isValidCPF`)            | Já testado, sem deps externas                       |
| Alertas de vencimento           | Polling por request | `node-cron` + Redis lock (padrão `maintenance-alerts.cron.ts`)           | Evita múltiplas instâncias, timezone correto        |
| Geração PDF de contrato         | Template HTML       | `pdfkit` (já em uso para receituários)                                   | Controle preciso do layout, sem deps de browser     |
| Gráfico de salário              | SVG manual          | `recharts` (já instalado v3.7.0)                                         | `ResponsiveContainer` + tooltip pronto              |
| Upload e serve de documentos    | Cloud storage       | `multer.diskStorage` + `express.static` (padrão assets.routes.ts)        | Consistente com demais uploads do projeto           |
| Importação em massa com preview | Ciclo único         | 3 endpoints separados: upload/preview/confirm (padrão asset-bulk-import) | Permite o usuário corrigir erros antes de confirmar |
| Tabs na ficha do colaborador    | Component library   | CSS com `role="tablist"` (padrão AnimalDetailPage.tsx)                   | Já tem CSS acessível, ARIA correto, disabled state  |

**Key insight:** Este módulo reutiliza ~80% dos padrões já estabelecidos no projeto. O principal trabalho é modelagem do schema Prisma e composição dos módulos — não invenção de novos padrões.

---

## Common Pitfalls

### Pitfall 1: Migration retroativa no FieldTeamMember (D-02)

**What goes wrong:** Adicionar `employeeId` como NOT NULL sem valor default quebra todos os registros existentes.
**Why it happens:** `field_team_members` já tem linhas com `userId` preenchido.
**How to avoid:** Adicionar `employeeId String?` (nullable), com `@@index([employeeId])`. **Nunca** fazer `@relation` obrigatório. A FK é opcional — equipes existentes mantêm apenas `userId`.
**Warning signs:** Se a migration falhar com "column cannot have null values" — revisar se o campo foi declarado opcional.

### Pitfall 2: EmployeeSalaryHistory e EmployeeMovement precisam ser dois triggers distintos

**What goes wrong:** Criar EmployeeMovement de SALARY_ADJUSTMENT sem criar o correspondente EmployeeSalaryHistory.
**Why it happens:** O desenvolvedor cria EmployeeMovement mas esquece de inserir em EmployeeSalaryHistory.
**How to avoid:** A função `createSalaryMovement` no service sempre faz as duas inserções dentro da mesma transação. Nunca chamar uma sem a outra.
**Warning signs:** `EmployeeSalaryHistory` com gaps na timeline.

### Pitfall 3: Reajuste coletivo sem transação atômica

**What goes wrong:** Bulk salary adjustment cria EmployeeMovement para alguns colaboradores mas falha no meio — deixa inconsistência.
**Why it happens:** Loop sem `prisma.$transaction`.
**How to avoid:** Usar `prisma.$transaction(async (tx) => { ... })` para todo o batch. Se qualquer inserção falhar, toda a operação faz rollback.
**Warning signs:** Colaboradores com reajuste aplicado e outros sem, na mesma operação.

### Pitfall 4: endDate obrigatório para tipos errados (D-05)

**What goes wrong:** Validar `endDate` como obrigatório para todos os contratos.
**Why it happens:** Falta de condicional por `contractType`.
**How to avoid:**

```
CLT_INDETERMINATE → endDate proibido (deve ser null)
CLT_DETERMINATE   → endDate obrigatório
SEASONAL          → endDate obrigatório
TRIAL             → endDate obrigatório (max 90 dias CLT)
INTERMITTENT      → endDate proibido (jornada variável)
APPRENTICE        → endDate obrigatório (max 2 anos)
```

### Pitfall 5: Alertas de vencimento gerando notificações duplicadas

**What goes wrong:** Cron dispara duas vezes no mesmo dia (reinício de servidor) e gera 2 alertas para o mesmo contrato.
**Why it happens:** Sem controle de idempotência.
**How to avoid:** Redis lock key com data do dia (padrão já estabelecido em `maintenance-alerts.cron.ts`): `cron:contract-expiry:${YYYY-MM-DD}`. Alternativa: tabela `ContractAlert` com `(contractId, alertDate)` único — verificar antes de inserir.

### Pitfall 6: Upload de documentos sem limpeza de arquivo antigo

**What goes wrong:** Ao atualizar documento do mesmo tipo, o arquivo antigo fica no disco mas a referência some do banco.
**Why it happens:** Substituição apenas do registro no banco sem deletar o arquivo físico.
**How to avoid:** No service de update de documento, ler `filePath` antigo, deletar com `fs.unlink`, depois criar novo registro.

### Pitfall 7: Validação de CTPS — série pode ser zerada

**What goes wrong:** Validar série CTPS como `required` quando pode ser série 0 para CTPS antigas ou não preenchida para MEI.
**Why it happens:** CTPS antiga tem formato diferente (número + série + UF). CTPS digital é apenas o CPF.
**How to avoid:** CTPS número é `String?` no schema. CTPS digital = CPF. Ambos são válidos. Não impor formato rígido — apenas armazenar como string.

---

## Schema Prisma — Novos Modelos

### Enums a criar

```prisma
enum EmployeeStatus {
  ATIVO
  AFASTADO
  FERIAS
  DESLIGADO
}

enum ContractType {
  CLT_INDETERMINATE
  CLT_DETERMINATE
  SEASONAL
  INTERMITTENT
  TRIAL
  APPRENTICE
}

enum MovementType {
  PROMOTION
  SALARY_ADJUSTMENT
  TRANSFER
  POSITION_CHANGE
}

enum DocumentType {
  RG
  CPF
  CTPS
  ASO
  CONTRATO
  OUTRO
}

enum WorkScheduleType {
  FIXED
  SHIFT
  CUSTOM
}

enum BankAccountType {
  CORRENTE
  POUPANCA
}

enum SalaryBandLevel {
  JUNIOR
  PLENO
  SENIOR
}
```

### Modelos principais

```prisma
model Employee {
  id              String         @id @default(uuid())
  organizationId  String
  userId          String?        @unique  // opcional — só para quem acessa o sistema
  name            String
  cpf             String         // limpo, 11 dígitos — unique por org
  rg              String?
  rgIssuer        String?        // órgão emissor
  rgUf            String?
  pisPassep       String?        // 11 dígitos
  ctpsNumber      String?
  ctpsSeries      String?
  ctpsUf          String?
  birthDate        DateTime       @db.Date
  motherName      String?
  fatherName      String?
  educationLevel  String?        // enum separado ou string
  maritalStatus   String?
  nationality     String         @default("Brasileiro")
  // Dados de saúde
  bloodType       String?
  hasDisability   Boolean        @default(false)
  disabilityType  String?
  // Contato
  phone           String?
  email           String?
  // Endereço
  zipCode         String?
  street          String?
  number          String?
  complement      String?
  neighborhood    String?
  city            String?
  state           String?
  // Dados bancários
  bankCode        String?        // código do banco (ex: "033" = Santander)
  bankAgency      String?
  bankAccount     String?
  bankAccountType BankAccountType?
  bankAccountDigit String?
  // Saldos iniciais (para importação)
  initialVacationBalance  Decimal? @db.Decimal(5, 2)  // dias
  initialHourBankBalance  Decimal? @db.Decimal(8, 2)  // horas
  // Status
  status          EmployeeStatus @default(ATIVO)
  photoUrl        String?
  notes           String?
  admissionDate   DateTime       @db.Date  // data de admissão na empresa
  terminationDate DateTime?      @db.Date
  createdBy       String
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  organization    Organization   @relation(...)
  user            User?          @relation(...)
  farms           EmployeeFarm[]
  contracts       EmployeeContract[]
  documents       EmployeeDocument[]
  dependents      EmployeeDependent[]
  statusHistory   EmployeeStatusHistory[]
  movements       EmployeeMovement[]
  salaryHistory   EmployeeSalaryHistory[]
  fieldTeamMembers FieldTeamMember[]  // via employeeId

  @@unique([organizationId, cpf])
  @@index([organizationId, status])
  @@map("employees")
}

model EmployeeDependent {
  id           String   @id @default(uuid())
  employeeId   String
  name         String
  cpf          String?  // obrigatório para IRRF/salário-família conforme D-01
  birthDate    DateTime @db.Date
  relationship String   // FILHO, CONJUGE, etc.
  irrf         Boolean  @default(false)
  salaryFamily Boolean  @default(false)  // salário-família
  createdAt    DateTime @default(now())

  employee Employee @relation(...)
  @@map("employee_dependents")
}

model EmployeeFarm {
  id          String   @id @default(uuid())
  employeeId  String
  farmId      String
  positionId  String?  // cargo na fazenda
  startDate   DateTime @db.Date
  endDate     DateTime? @db.Date
  status      String   @default("ATIVO")  // pode divergir do Employee.status (ex: transferido)
  createdAt   DateTime @default(now())

  employee Employee  @relation(...)
  farm     Farm      @relation(...)
  position Position? @relation(...)

  @@index([employeeId])
  @@index([farmId])
  @@index([positionId])
  @@map("employee_farms")
}

model EmployeeStatusHistory {
  id          String         @id @default(uuid())
  employeeId  String
  fromStatus  EmployeeStatus
  toStatus    EmployeeStatus
  reason      String
  changedBy   String
  effectiveAt DateTime       @default(now())
  createdAt   DateTime       @default(now())

  employee Employee @relation(...)
  @@index([employeeId])
  @@map("employee_status_history")
}

model Position {
  id             String   @id @default(uuid())
  organizationId String
  name           String
  cbo            String?  // Classificação Brasileira de Ocupações — 6 dígitos
  description    String?
  additionalTypes String[] // ex: ["INSALUBRIDADE", "PERICULOSIDADE"]
  isActive       Boolean  @default(true)
  createdBy      String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization  @relation(...)
  salaryBands  SalaryBand[]
  contracts    EmployeeContract[]
  employeeFarms EmployeeFarm[]

  @@unique([organizationId, name])
  @@index([organizationId])
  @@map("positions")
}

model SalaryBand {
  id          String          @id @default(uuid())
  positionId  String
  level       SalaryBandLevel
  minSalary   Decimal         @db.Decimal(10, 2)
  maxSalary   Decimal         @db.Decimal(10, 2)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  position Position @relation(...)

  @@unique([positionId, level])
  @@map("salary_bands")
}

model WorkSchedule {
  id             String           @id @default(uuid())
  organizationId String
  name           String           // "5x2 Padrão", "12x36 Ordenha"
  type           WorkScheduleType
  workDays       Int[]            // [1,2,3,4,5] = seg-sex (dia da semana 0=dom)
  startTime      String           // "07:00"
  endTime        String           // "17:00"
  breakMinutes   Int              @default(60)
  isTemplate     Boolean          @default(false)
  notes          String?
  createdBy      String
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  organization Organization @relation(...)
  contracts    EmployeeContract[]

  @@unique([organizationId, name])
  @@index([organizationId])
  @@map("work_schedules")
}

model EmployeeContract {
  id              String       @id @default(uuid())
  employeeId      String
  organizationId  String
  positionId      String
  workScheduleId  String?
  contractType    ContractType
  startDate       DateTime     @db.Date
  endDate         DateTime?    @db.Date
  salary          Decimal      @db.Decimal(10, 2)
  weeklyHours     Int          @default(44)  // CLT padrão rural
  union           String?      // sindicato
  costCenterId    String?
  notes           String?
  isActive        Boolean      @default(true)
  createdBy       String
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  employee     Employee        @relation(...)
  organization Organization    @relation(...)
  position     Position        @relation(...)
  workSchedule WorkSchedule?   @relation(...)
  costCenter   CostCenter?     @relation(...)
  amendments   ContractAmendment[]

  @@index([employeeId])
  @@index([organizationId, contractType])
  @@index([endDate])  // para alertas de vencimento
  @@map("employee_contracts")
}

model ContractAmendment {
  id          String   @id @default(uuid())
  contractId  String
  description String
  effectiveAt DateTime @db.Date
  changes     Json     // { salary?: {from, to}, position?: {from, to}, schedule?: ... }
  createdBy   String
  createdAt   DateTime @default(now())

  contract EmployeeContract @relation(...)
  @@index([contractId])
  @@map("contract_amendments")
}

model EmployeeMovement {
  id            String       @id @default(uuid())
  employeeId    String
  movementType  MovementType
  effectiveAt   DateTime     @db.Date
  fromValue     String?      // JSON serializado (ex: salário anterior, cargo anterior)
  toValue       String?      // JSON serializado (novo valor)
  reason        String
  approvedBy    String?
  createdBy     String
  createdAt     DateTime     @default(now())

  employee Employee @relation(...)
  @@index([employeeId, movementType])
  @@map("employee_movements")
}

model EmployeeSalaryHistory {
  id          String   @id @default(uuid())
  employeeId  String
  salary      Decimal  @db.Decimal(10, 2)
  effectiveAt DateTime @db.Date
  movementType MovementType
  reason      String?
  createdAt   DateTime @default(now())

  employee Employee @relation(...)
  @@index([employeeId, effectiveAt])
  @@map("employee_salary_history")
}

model EmployeeDocument {
  id           String       @id @default(uuid())
  employeeId   String
  documentType DocumentType
  fileName     String
  filePath     String
  uploadedBy   String
  uploadedAt   DateTime     @default(now())

  employee Employee @relation(...)
  @@index([employeeId])
  @@map("employee_documents")
}
```

### Migration FieldTeamMember (retroativa)

```prisma
// Adicionar ao model FieldTeamMember existente:
employeeId String?  // novo campo — nullable, retroativa

employee   Employee? @relation(fields: [employeeId], references: [id])

@@index([employeeId])  // novo índice
```

Migration number: `20260502100000_add_employee_foundation` (principal) e `20260502200000_add_field_team_member_employee_id` (retroativa).

---

## Code Examples

### Employee List Endpoint

```typescript
// GET /org/:orgId/employees
// Query params: status?, farmId?, positionId?, search?, page?, limit?
async function listEmployees(ctx: RlsContext, params: ListEmployeeParams) {
  const { status, farmId, positionId, search, page = 1, limit = 20 } = params;

  const where: Prisma.EmployeeWhereInput = {
    organizationId: ctx.organizationId,
    deletedAt: null,
    ...(status && { status: status as EmployeeStatus }),
    ...(farmId && { farms: { some: { farmId, endDate: null } } }),
    ...(positionId && { farms: { some: { positionId, endDate: null } } }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search.replace(/\D/g, '') } },
      ],
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      select: {
        id: true,
        name: true,
        cpf: true,
        status: true,
        photoUrl: true,
        farms: {
          where: { endDate: null },
          select: { position: { select: { name: true } }, farm: { select: { name: true } } },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.employee.count({ where }),
  ]);

  return { data, total, page, limit };
}
```

### Contract Expiry Alerts Cron

```typescript
// apps/backend/src/shared/cron/contract-expiry-alerts.cron.ts
export function startContractExpiryAlertsCron(): void {
  cron.schedule(
    '0 7 * * *',
    async () => {
      const today = new Date().toISOString().slice(0, 10);
      const lockKey = `cron:contract-expiry:${today}`;
      const locked = await redis.set(lockKey, '1', 'EX', 3600, 'NX');
      if (!locked) return;
      try {
        const thirtyDaysLater = addDays(new Date(), 30);
        const expiring = await prisma.employeeContract.findMany({
          where: {
            isActive: true,
            endDate: { gte: new Date(), lte: thirtyDaysLater },
            contractType: { in: ['TRIAL', 'SEASONAL'] },
          },
          include: { employee: { select: { name: true, organizationId: true } } },
        });
        // Para cada contrato: criar notificação via sistema existente
        for (const contract of expiring) {
          await createContractExpiryNotification(contract);
        }
      } finally {
        await redis.del(lockKey);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );
}
```

### Frontend — SalaryEvolutionChart (D-10)

```tsx
// apps/frontend/src/components/employees/SalaryEvolutionChart.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface SalaryPoint {
  effectiveAt: string; // ISO date
  salary: number;
  movementType: string;
  reason?: string;
}

// Tooltip customizado em pt-BR com reason do reajuste
function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as SalaryPoint;
  return (
    <div className="salary-tooltip">
      <p className="salary-tooltip__value">
        {p.salary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
      <p className="salary-tooltip__date">{new Date(p.effectiveAt).toLocaleDateString('pt-BR')}</p>
      {p.reason && <p className="salary-tooltip__reason">{p.reason}</p>}
    </div>
  );
}
```

### Reajuste Coletivo em Lote

```typescript
// POST /org/:orgId/employees/bulk-salary-adjustment
// Body: { positionId?, farmId?, percentage?, fixedAmount?, reason, effectiveAt }
async function bulkSalaryAdjustment(
  ctx: RlsContext,
  input: BulkSalaryInput,
): Promise<{ updated: number; errors: string[] }> {
  const employees = await prisma.employee.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: 'ATIVO',
      ...(input.farmId && { farms: { some: { farmId: input.farmId, endDate: null } } }),
      ...(input.positionId && { farms: { some: { positionId: input.positionId, endDate: null } } }),
    },
    include: { contracts: { where: { isActive: true }, take: 1 } },
  });

  await prisma.$transaction(async (tx) => {
    for (const emp of employees) {
      const contract = emp.contracts[0];
      if (!contract) continue;
      const oldSalary = contract.salary;
      const newSalary = input.percentage
        ? oldSalary.mul(1 + input.percentage / 100)
        : oldSalary.add(input.fixedAmount ?? 0);

      await tx.employeeContract.update({
        where: { id: contract.id },
        data: { salary: newSalary },
      });
      await tx.employeeMovement.create({
        data: {
          employeeId: emp.id,
          movementType: 'SALARY_ADJUSTMENT',
          effectiveAt: new Date(input.effectiveAt),
          fromValue: oldSalary.toString(),
          toValue: newSalary.toString(),
          reason: input.reason,
          createdBy: ctx.userId,
        },
      });
      await tx.employeeSalaryHistory.create({
        data: {
          employeeId: emp.id,
          salary: newSalary,
          effectiveAt: new Date(input.effectiveAt),
          movementType: 'SALARY_ADJUSTMENT',
          reason: input.reason,
        },
      });
    }
  });

  return { updated: employees.length, errors: [] };
}
```

---

## Validation Architecture

### Test Framework

| Property           | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| Framework          | Jest 29 + Supertest 7                                         |
| Config file        | `apps/backend/jest.config.js`                                 |
| Quick run command  | `cd apps/backend && pnpm test -- --testPathPattern=employees` |
| Full suite command | `cd apps/backend && pnpm test`                                |

### Phase Requirements → Test Map

| Req ID   | Behavior                                                   | Test Type          | Automated Command                               | File Exists? |
| -------- | ---------------------------------------------------------- | ------------------ | ----------------------------------------------- | ------------ |
| COLAB-01 | CRUD employee + status transitions + CPF unique            | unit + integration | `pnpm test -- employees.routes.spec`            | ❌ Wave 0    |
| COLAB-01 | PIS validation warning (não bloqueia)                      | unit               | `pnpm test -- employees.routes.spec`            | ❌ Wave 0    |
| COLAB-01 | FieldTeamMember.employeeId migration não quebra existentes | integration        | `pnpm test -- field-teams.routes.spec`          | ✅ existente |
| COLAB-01 | Upload documento (RG, CTPS, ASO)                           | integration        | `pnpm test -- employee-documents.routes.spec`   | ❌ Wave 0    |
| COLAB-02 | CRUD contrato com endDate condicional por tipo             | unit + integration | `pnpm test -- employee-contracts.routes.spec`   | ❌ Wave 0    |
| COLAB-02 | ContractAmendment criação e histórico                      | unit               | `pnpm test -- employee-contracts.routes.spec`   | ❌ Wave 0    |
| COLAB-02 | Alerta vencimento contrato (30 dias antes)                 | unit               | `pnpm test -- contract-expiry-alerts.cron.spec` | ❌ Wave 0    |
| COLAB-03 | CRUD Position + SalaryBand                                 | unit + integration | `pnpm test -- positions.routes.spec`            | ❌ Wave 0    |
| COLAB-03 | CRUD WorkSchedule com templates                            | unit + integration | `pnpm test -- work-schedules.routes.spec`       | ❌ Wave 0    |
| COLAB-03 | EmployeeMovement cria EmployeeSalaryHistory                | unit               | `pnpm test -- employee-movements.routes.spec`   | ❌ Wave 0    |
| COLAB-03 | Bulk salary adjustment transação atômica                   | unit               | `pnpm test -- employees.routes.spec`            | ❌ Wave 0    |
| COLAB-04 | employee-file-parser CSV/XLSX                              | unit               | `pnpm test -- employee-file-parser.spec`        | ❌ Wave 0    |
| COLAB-04 | Preview upload valida CPF + detecta duplicatas             | integration        | `pnpm test -- employees.routes.spec`            | ❌ Wave 0    |
| COLAB-04 | Confirm import cria employees em batch                     | integration        | `pnpm test -- employees.routes.spec`            | ❌ Wave 0    |
| COLAB-05 | GET employee detail inclui salary history                  | integration        | `pnpm test -- employees.routes.spec`            | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `cd apps/backend && pnpm test -- --testPathPattern="employees|positions|work-schedules|employee-contracts|employee-movements" --passWithNoTests`
- **Per wave merge:** `cd apps/backend && pnpm test`
- **Phase gate:** Full suite green antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/employees/employees.routes.spec.ts`
- [ ] `apps/backend/src/modules/employee-contracts/employee-contracts.routes.spec.ts`
- [ ] `apps/backend/src/modules/positions/positions.routes.spec.ts`
- [ ] `apps/backend/src/modules/work-schedules/work-schedules.routes.spec.ts`
- [ ] `apps/backend/src/modules/employee-movements/employee-movements.routes.spec.ts`
- [ ] `apps/backend/src/modules/employees/employee-file-parser.spec.ts`
- [ ] `apps/backend/src/shared/cron/contract-expiry-alerts.cron.spec.ts`
- [ ] `apps/backend/src/shared/utils/document-validator.spec.ts` — adicionar testes para `isValidPIS`

---

## Project Constraints (from CLAUDE.md)

| Directive                                      | Impact on This Phase                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `req.params.id as string` (Express 5)          | Todo acesso a `req.params.employeeId`, `req.params.id`, etc. deve usar `as string` |
| Prisma enums com `as const`                    | EmployeeStatus, ContractType, MovementType — usar `as const` em retornos literais  |
| Campos do schema Prisma — verificar nome exato | Antes de `select: { field: true }`, confirmar nome no schema                       |
| `Decimal.max(a,b)` é estático                  | Não usar `a.max(b)` em cálculos salariais                                          |
| Frontend tipos espelham backend                | Criar `src/types/employee.ts`, `src/types/employee-contract.ts`, etc.              |
| `null` vs `undefined` em interfaces            | Prisma usa `null`; interfaces de input do frontend usam `?:` (undefined)           |
| Formulários de criação/edição sempre em modal  | CreateEmployeeModal, CreateContractModal, etc. — nunca página dedicada             |
| `ConfirmModal` para ações destrutivas          | Desligar colaborador = `ConfirmModal` com `variant="danger"`                       |
| `window.confirm()` proibido                    | Usar `ConfirmModal` de `@/components/ui/ConfirmModal`                              |
| `app.ts` separado de `main.ts`                 | Registrar rotas em `app.ts`, iniciar crons em `main.ts`                            |
| Módulos colocalizados                          | `modules/{domínio}/controller+service+routes+types`                                |

---

## Environment Availability

Step 2.6: SKIPPED — fase é puramente código/config. Todas as dependências (Node, pnpm, PostgreSQL, Redis) são as mesmas usadas desde a Phase 01.

---

## Open Questions

1. **Campos opcionais vs obrigatórios em dependentes**
   - O que sabemos: D-01 diz "CPF obrigatório" para dependentes (IRRF e salário-família)
   - O que está ambíguo: Se CPF é obrigatório para **todo** dependente ou apenas para os marcados como `irrf: true` ou `salaryFamily: true`
   - Recomendação: Tornar CPF obrigatório apenas quando `irrf: true OR salaryFamily: true`. Para dependente sem benefício ativo, CPF é `String?`.

2. **Número máximo de colaboradores por importação**
   - O que sabemos: animal-file-parser tem `MAX_BULK_ANIMAL_ROWS = 500`
   - O que está ambíguo: Employee tem mais campos — processamento pode ser mais lento
   - Recomendação: Manter 500 como limite. Se houver problemas de timeout, reduzir para 200.

3. **Geração de PDF de contrato (COLAB-02)**
   - O que sabemos: pdfkit já está em uso para receituários agronômicos
   - O que está ambíguo: Qual template legal de contrato de trabalho rural usar (NR-31, CLT rural)
   - Recomendação: Criar PDF com dados estruturados (nome, cargo, salário, tipo, datas). Não tentar reproduzir formulário CTPS — o PDF é um comprovante interno, não documento oficial.

4. **CBO (Classificação Brasileira de Ocupações)**
   - O que sabemos: CBO tem 6 dígitos, é um campo obrigatório na RAIS/eSocial
   - O que está ambíguo: Se Phase 25 deve incluir uma tabela de lookup de CBOs ou apenas armazenar o código como string
   - Recomendação: Armazenar como `String?` em Position. Lookup de CBOs pode ser feito pelo gerente consultando tabela CBO do MTE. A validação de formato (6 dígitos numéricos) é suficiente para esta fase.

---

## State of the Art

| Old Approach                           | Current Approach                                 | When Changed                 | Impact                                                                                                                      |
| -------------------------------------- | ------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| CTPS física obrigatória                | CTPS digital (igual ao CPF) desde 2019           | Portaria SEPRT nº 1.065/2019 | Campo CTPS é `String?` — não forçar formato                                                                                 |
| Homologação sindical rescisão          | Dispensada desde Reforma Trabalhista 2017        | Lei 13.467/2017              | Out of scope confirmado em REQUIREMENTS.md                                                                                  |
| DIRF (declaração IR retido)            | Abolida — dados vão via eSocial/EFD-Reinf        | 2025                         | Não modelar DIRF — out of scope confirmado                                                                                  |
| Folha baseada em hora trabalhada bruta | Hora reduzida 52m30s para noturno rural (21h-5h) | CLT art. 73 + NR-31          | Relevante para Phase 27 (ponto) — não para esta fase, mas WorkSchedule.startTime/endTime precisa suportar períodos noturnos |

---

## Sources

### Primary (HIGH confidence)

- Codebase direto — `apps/backend/src/modules/animals/animal-file-parser.ts` — padrão de importação
- Codebase direto — `apps/backend/src/modules/assets/asset-bulk-import.service.ts` — padrão preview/confirm
- Codebase direto — `apps/frontend/src/pages/AnimalDetailPage.tsx` — padrão de detalhe com tabs
- Codebase direto — `apps/backend/src/shared/utils/document-validator.ts` — `isValidCPF` existente
- Codebase direto — `apps/backend/src/shared/cron/maintenance-alerts.cron.ts` — padrão de cron
- Codebase direto — `apps/backend/src/modules/assets/assets.routes.ts` — padrão diskStorage multer
- Codebase direto — `apps/frontend/src/components/layout/Sidebar.tsx` — estrutura de grupos de navegação
- Codebase direto — `apps/frontend/src/components/cashflow/CashflowChart.tsx` — padrão Recharts
- `.planning/phases/25-cadastro-de-colaboradores-e-contratos/25-CONTEXT.md` — decisões travadas
- `.planning/REQUIREMENTS.md` — COLAB-01 a COLAB-05

### Secondary (MEDIUM confidence)

- Knowledge base sobre CLT rural (art. 73 hora noturna, NR-31, Portaria SEPRT 1.065/2019 CTPS digital)
- Knowledge base sobre PIS/PASEP algorithm (11 dígitos, pesos 3-2-9-8-7-6-5-4-3-2)
- Knowledge base sobre CBO — Classificação Brasileira de Ocupações (6 dígitos, tabela MTE)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — tudo já está instalado e em uso no projeto
- Architecture: HIGH — padrões extraídos diretamente do codebase existente
- Schema Prisma: HIGH — modelagem baseada nas decisões D-01 a D-13 do CONTEXT.md
- Pitfalls: HIGH — baseados em padrões do projeto e regras CLT conhecidas
- Validação CPF/PIS: HIGH — CPF já implementado; PIS algorithm é estável

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (30 dias — stack estável, sem dependências externas novas)
