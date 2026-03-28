# Phase 25: Cadastro de Colaboradores e Contratos - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Fundação do módulo RH: criar a entidade Employee com todos os dados trabalhistas, documentais e pessoais exigidos pela legislação e eSocial. Registrar contratos por tipo (CLT, safra, intermitente, experiência, aprendiz), gerenciar cargos com CBO e escalas, importar em massa, e disponibilizar ficha completa do colaborador. Esta entidade é a base de todo o módulo RH (ponto, folha, férias, rescisão).

</domain>

<decisions>
## Implementation Decisions

### Entidade Colaborador

- **D-01:** Employee é entidade separada de User. Colaborador tem dados trabalhistas (CPF, PIS/PASEP, CTPS, dependentes, dados bancários) como entidade própria. Campo `userId` opcional para os poucos que acessam o sistema.
- **D-02:** FieldTeamMember ganha campo `employeeId` opcional (migration retroativa). Equipes existentes mantêm `userId`, novos membros podem ter `employeeId`. Ponto/folha puxam do Employee.
- **D-03:** State machine explícita para status do colaborador: ATIVO → AFASTADO → ATIVO, ATIVO → FÉRIAS → ATIVO, ATIVO → DESLIGADO (terminal). Transições validadas no service. Histórico em tabela EmployeeStatusHistory.
- **D-04:** Associação multi-fazenda via tabela EmployeeFarm com período (startDate/endDate), status e cargo por fazenda. Contrato vinculado à organização, lotação à fazenda.

### Contratos e Cargos

- **D-05:** Modelo único EmployeeContract com `contractType` enum (CLT_INDETERMINATE, CLT_DETERMINATE, SEASONAL, INTERMITTENT, TRIAL, APPRENTICE). Campos opcionais conforme tipo (endDate só para determinado/safra/experiência). Aditivos em tabela ContractAmendment.
- **D-06:** Position (cargo, CBO, descrição, adicionais) separado de SalaryBand (níveis: Júnior/Pleno/Sênior com piso/teto). Posição reutilizável entre fazendas, faixa salarial pode variar. Quadro de lotação = agregação de EmployeeFarm por Position.
- **D-07:** WorkSchedule como tabela configurável com nome, tipo (FIXED, SHIFT, CUSTOM), dias da semana, horários entrada/saída, intervalo. Templates pré-configurados (5x2, 6x1, 12x36, ordenha 2x). Vinculada ao contrato. Essencial para Phase 27 (ponto).
- **D-08:** EmployeeMovement com tipo (PROMOTION, SALARY_ADJUSTMENT, TRANSFER, POSITION_CHANGE), data efetiva, valores antes/depois, motivo, aprovador. EmployeeSalaryHistory alimentado automaticamente em cada movimento salarial. Timeline visual na ficha.

### Ficha Completa

- **D-09:** EmployeeDetailPage com tabs (padrão AnimalDetailPage): Dados Pessoais | Contrato | Evolução | Documentos | Histórico. Cabeçalho fixo com nome, foto, status, cargo atual. Só seções com dados reais nesta phase — tabs de holerites/férias/EPIs adicionadas quando módulos respectivos forem implementados.
- **D-10:** Recharts para gráfico de evolução salarial. Line chart com tooltip mostrando valor, data e motivo do reajuste.

### Import e Documentos

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

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Roadmap

- `.planning/REQUIREMENTS.md` — COLAB-01 a COLAB-05 (critérios de aceite detalhados)
- `.planning/ROADMAP.md` §Phase 25 — Goal, success criteria, dependencies

### Documentação de Domínio

- `protos-farm-documentation-small/ProtosFarm_Fase3_RH_Folha_UserStories.docx` — User stories originais de RH e Folha de Pagamento

### Decisões Anteriores (STATE.md)

- `.planning/STATE.md` — PayrollRun state machine (PENDING→PROCESSING→COMPLETED|ERROR), EmployeeSalaryHistory mandatório, Payroll→Payables upsert pattern

### Padrões de Código Existentes

- `apps/backend/src/modules/animals/animal-file-parser.ts` — Padrão de importação CSV/Excel a reutilizar
- `apps/frontend/src/pages/AnimalDetailPage.tsx` — Padrão de página de detalhe com tabs a seguir
- `apps/backend/src/modules/field-teams/` — FieldTeam/FieldTeamMember (integração com employeeId)
- `apps/backend/src/modules/cost-centers/` — CostCenter existente (vinculação com cargos e operações)

### Design System

- `docs/design-system/04-componentes.md` — Specs de componentes (modals para formulários, tabs, empty states)
- `docs/design-system/05-padroes-ux.md` — Padrões UX (voz pt-BR, validação inline, formulários)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **animal-file-parser.ts**: Parser CSV/Excel com validação e preview — reutilizável como base para employee-file-parser
- **AnimalDetailPage.tsx**: Página de detalhe com tabs — padrão a seguir para EmployeeDetailPage
- **FieldTeam/FieldTeamMember**: Modelo de equipes de campo — precisa de migration para adicionar employeeId
- **CostCenter module**: CRUD completo — vinculável a posições e operações de colaboradores

### Established Patterns

- **Module colocation**: controller + service + routes + types em `modules/{domínio}/`
- **State machines**: DepreciationRun (PENDING→PROCESSING→COMPLETED|ERROR) — padrão para EmployeeStatus
- **Prisma enums**: Usar `as const` nos retornos literais, importar tipos do @prisma/client
- **Frontend modals**: Formulários de criação/edição sempre em modal (CLAUDE.md)
- **Frontend pages**: PascalCase com "Page" suffix, tabs pattern com CSS modules

### Integration Points

- **FieldTeamMember.employeeId**: Migration adicionando campo opcional, sem quebrar equipes existentes
- **EmployeeSalaryHistory**: Alimentado automaticamente por EmployeeMovement — base para folha (Phase 26+)
- **WorkSchedule**: Referenciado pelo contrato, consumido por controle de ponto (Phase 27)
- **Sidebar frontend**: Novo grupo "RH" com sub-items (Colaboradores, Cargos, Escalas)

</code_context>

<specifics>
## Specific Ideas

- Reajuste coletivo em lote: ação bulk que cria EmployeeMovement do tipo SALARY_ADJUSTMENT para múltiplos colaboradores de uma vez
- Templates pré-configurados de escalas rurais (5x2, 6x1, 12x36, turno ordenha 2x dia)
- Alertas automáticos de vencimento para contratos de experiência (90 dias) e safra
- Quadro de lotação como visão agregada (não tabela separada)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 25-cadastro-de-colaboradores-e-contratos_
_Context gathered: 2026-03-23_
