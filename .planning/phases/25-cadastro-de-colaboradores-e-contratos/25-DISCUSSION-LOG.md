# Phase 25: Cadastro de Colaboradores e Contratos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 25-cadastro-de-colaboradores-e-contratos
**Areas discussed:** Entidade Colaborador vs User, Modelagem de Contratos e Cargos, Ficha Completa do Colaborador, Import em Massa e Documentos

---

## Entidade Colaborador vs User

### Q1: Colaborador deve ser entidade separada de User?

| Option | Description | Selected |
|--------|-------------|----------|
| Entidade separada (Recomendado) | Employee é entidade própria com dados trabalhistas, CPF, PIS, dependentes. Pode ter userId opcional. Separação limpa entre identidade no sistema vs vínculo trabalhista. | ✓ |
| Extensão de User | Todo colaborador é um User com role específico. Dados trabalhistas em tabela auxiliar. Simplifica queries mas polui User. | |
| Você decide | Claude escolhe a melhor abordagem. | |

**User's choice:** Entidade separada (Recomendado)
**Notes:** —

### Q2: Como vincular Employee a FieldTeamMember?

| Option | Description | Selected |
|--------|-------------|----------|
| employeeId no FieldTeamMember (Recomendado) | Adicionar campo employeeId opcional. Migration retroativa. Ponto/folha puxam do Employee. | ✓ |
| Tabela ponte Employee↔User | Tabela separada mapeando Employee a User. FieldTeamMember não muda. Mais JOINs. | |
| Você decide | Claude escolhe a abordagem. | |

**User's choice:** employeeId no FieldTeamMember (Recomendado)
**Notes:** —

### Q3: Status do colaborador e transições?

| Option | Description | Selected |
|--------|-------------|----------|
| State machine explícita (Recomendado) | ATIVO→AFASTADO→ATIVO, ATIVO→FÉRIAS→ATIVO, ATIVO→DESLIGADO. Histórico em EmployeeStatusHistory. | ✓ |
| Campo simples com audit log | Campo enum sem validação de transição. Audit log geral rastreia mudanças. | |
| Você decide | Claude implementa da forma mais robusta. | |

**User's choice:** State machine explícita (Recomendado)
**Notes:** —

### Q4: Associação com múltiplas fazendas?

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, tabela EmployeeFarm (Recomendado) | Tabela ponte com período, status e cargo por fazenda. Contrato vinculado à org, lotação à fazenda. | ✓ |
| Não, farmId direto no Employee | Cada colaborador pertence a uma fazenda. Transferência = desligamento + novo cadastro. | |
| Você decide | Claude avalia impacto em fases futuras. | |

**User's choice:** Sim, tabela EmployeeFarm (Recomendado)
**Notes:** —

---

## Modelagem de Contratos e Cargos

### Q1: Como modelar os diferentes tipos de contrato?

| Option | Description | Selected |
|--------|-------------|----------|
| Modelo único com tipo enum (Recomendado) | Uma tabela EmployeeContract com contractType enum. Campos opcionais conforme tipo. Aditivos em ContractAmendment. | ✓ |
| Herança com tabelas por tipo | Tabela base + tabelas específicas por tipo. Mais normalizado mas mais complexo. | |
| Você decide | Claude escolhe o modelo. | |

**User's choice:** Modelo único com tipo enum (Recomendado)
**Notes:** —

### Q2: Cargos e faixas salariais?

| Option | Description | Selected |
|--------|-------------|----------|
| Position + SalaryBand separados (Recomendado) | Position com CBO e SalaryBand com níveis/piso/teto. Posição reutilizável, faixa variável. | ✓ |
| Position com faixas embutidas | Uma tabela com campos min/max direto. Menos tabelas mas sem níveis granulares. | |
| Você decide | Claude avalia para reajuste coletivo. | |

**User's choice:** Position + SalaryBand separados (Recomendado)
**Notes:** —

### Q3: Escalas de trabalho?

| Option | Description | Selected |
|--------|-------------|----------|
| WorkSchedule configurável (Recomendado) | Tabela com nome, tipo, dias, horários, intervalo. Templates pré-configurados. | ✓ |
| Escala inline no contrato | Campos de horário direto no contrato. Simples mas não reutilizável. | |
| Você decide | Claude estrutura para controle de ponto. | |

**User's choice:** WorkSchedule configurável (Recomendado)
**Notes:** —

### Q4: Histórico de movimentações?

| Option | Description | Selected |
|--------|-------------|----------|
| EmployeeMovement com timeline (Recomendado) | Tabela com tipo, data efetiva, valores antes/depois, motivo, aprovador. Alimenta SalaryHistory. | ✓ |
| Audit log genérico | Reutilizar audit log existente. Sem tabela dedicada. Timeline menos rica. | |
| Você decide | Claude decide baseado na necessidade de SalaryHistory. | |

**User's choice:** EmployeeMovement com timeline (Recomendado)
**Notes:** —

---

## Ficha Completa do Colaborador

### Q1: Layout da ficha?

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs com seções (Recomendado) | Página com tabs padrão AnimalDetailPage. Cabeçalho fixo com nome, foto, status, cargo. | ✓ |
| Scroll único com seções | Página longa com accordion colapsável. Tudo em scroll. | |
| Você decide | Claude escolhe o layout. | |

**User's choice:** Tabs com seções (Recomendado)
**Notes:** —

### Q2: Seções de módulos futuros como placeholders?

| Option | Description | Selected |
|--------|-------------|----------|
| Só seções com dados reais (Recomendado) | Nesta phase apenas dados que existem. Tabs adicionadas quando módulos forem implementados. | ✓ |
| Todas as tabs com empty state | Mostrar todas as tabs previstas com empty states. | |
| Você decide | Claude avalia UX e manutenção. | |

**User's choice:** Só seções com dados reais (Recomendado)
**Notes:** —

### Q3: Biblioteca de charts?

| Option | Description | Selected |
|--------|-------------|----------|
| Recharts (Recomendado) | Dependência comum React, declarativo, boa tipagem TS, responsivo. | ✓ |
| Chart.js via react-chartjs-2 | Mais leve, canvas-based. Menos flexível para customização React. | |
| Você decide | Claude escolhe integração com frontend. | |

**User's choice:** Recharts (Recomendado)
**Notes:** —

---

## Import em Massa e Documentos

### Q1: Padrão de importação?

| Option | Description | Selected |
|--------|-------------|----------|
| Mesmo padrão com adaptações (Recomendado) | Reutilizar animal-file-parser pattern. Template Excel, preview, validação CPF/PIS. | ✓ |
| Import simplificado | Apenas CSV sem preview. Relatório pós-import. | |
| Você decide | Claude avalia esforço vs valor. | |

**User's choice:** Mesmo padrão com adaptações (Recomendado)
**Notes:** —

### Q2: Armazenamento de documentos?

| Option | Description | Selected |
|--------|-------------|----------|
| EmployeeDocument + file system local (Recomendado) | Tabela com tipo, fileName, filePath. Arquivos em uploads/employees/{id}/. | ✓ |
| Base64 no banco | Documento como blob no PostgreSQL. Incha o banco. | |
| Você decide | Claude escolhe baseado no sistema. | |

**User's choice:** EmployeeDocument + file system local (Recomendado)
**Notes:** —

### Q3: Validação CPF/PIS?

| Option | Description | Selected |
|--------|-------------|----------|
| Bloquear CPF inválido, avisar PIS (Recomendado) | CPF obrigatório e válido. PIS com warning, permite salvar incompleto. | ✓ |
| Bloquear ambos | CPF e PIS devem ser válidos. Pode travar cadastro. | |
| Você decide | Claude avalia contexto rural. | |

**User's choice:** Bloquear CPF inválido, avisar PIS (Recomendado)
**Notes:** —

---

## Claude's Discretion

- Estrutura exata dos endpoints REST
- Schema Prisma detalhado
- Implementação interna da state machine
- Detalhes de validação CPF/PIS
- Estrutura do template Excel
- Organização de componentes frontend

## Deferred Ideas

None — discussion stayed within phase scope
