# US-104 — Cadastro de Protocolos de Tratamento (CA1–CA9)

## Resumo

Implementação completa do cadastro de protocolos de tratamento padronizados para doenças do rebanho, permitindo ao veterinário definir esquemas de medicamentos com dosagens, vias de administração, duração e carências.

## Critérios de Aceite

| CA  | Descrição                                    | Status    |
| --- | -------------------------------------------- | --------- |
| CA1 | CRUD de protocolos (nome, doenças, autor)    | Completo  |
| CA2 | Etapas do tratamento (dias, dose, via, freq) | Completo  |
| CA3 | Múltiplos medicamentos por protocolo         | Completo  |
| CA4 | Carência calculada automaticamente           | Completo  |
| CA5 | Protocolos pré-carregados (seed)             | Completo  |
| CA6 | Duplicar protocolo                           | Completo  |
| CA7 | Custo estimado do protocolo                  | Parcial\* |
| CA8 | Versionamento e histórico de mudanças        | Completo  |
| CA9 | Status ativo/inativo                         | Completo  |

\*CA7: campo `estimatedCostCents` existe no modelo, cálculo automático via preço médio do estoque será integrado quando tratamentos forem registrados (US-105).

## Modelos de Dados

### Novos Enums

- `AdministrationRoute`: IM, SC, IV, ORAL, INTRAMMARY, TOPICAL
- `DosageUnit`: MG_KG, ML_ANIMAL, FIXED_DOSE
- `ProtocolStatus`: ACTIVE, INACTIVE

### Novos Modelos

- **TreatmentProtocol** — Protocolo principal com versionamento
- **TreatmentProtocolDisease** — Relação N:N com Disease
- **TreatmentProtocolStep** — Etapas/medicamentos do protocolo

### Migration

`20260351100000_add_treatment_protocols`

## Backend

### Módulo: `modules/treatment-protocols/`

Arquivos:

- `treatment-protocols.types.ts` — Tipos, enums, constantes, seed data (8 protocolos)
- `treatment-protocols.service.ts` — CRUD, duplicação, versionamento, carência auto
- `treatment-protocols.routes.ts` — 11 endpoints HTTP
- `treatment-protocols.routes.spec.ts` — 23 testes

### Endpoints

| Método | Rota                                           | Descrição                  |
| ------ | ---------------------------------------------- | -------------------------- |
| GET    | /org/treatment-protocols/administration-routes | Listar vias de admin       |
| GET    | /org/treatment-protocols/dosage-units          | Listar unidades de dosagem |
| GET    | /org/treatment-protocols/statuses              | Listar status              |
| POST   | /org/treatment-protocols/seed                  | Pré-carregar protocolos    |
| POST   | /org/treatment-protocols                       | Criar protocolo            |
| GET    | /org/treatment-protocols                       | Listar (paginado+filtros)  |
| GET    | /org/treatment-protocols/:id                   | Obter protocolo            |
| GET    | /org/treatment-protocols/:id/versions          | Histórico de versões       |
| PATCH  | /org/treatment-protocols/:id                   | Atualizar (versiona steps) |
| POST   | /org/treatment-protocols/:id/duplicate         | Duplicar protocolo         |
| DELETE | /org/treatment-protocols/:id                   | Soft delete                |

### Seed Data (8 protocolos)

1. Mastite clínica grau 1 — cefalosporina
2. Mastite clínica grau 2 — sistêmica
3. Pneumonia — florfenicol
4. Diarreia neonatal — suporte
5. Metrite — ceftiofur
6. Cetose — propileno glicol
7. Hipocalcemia — cálcio IV
8. Laminite — anti-inflamatório + casqueamento

## Frontend

### Arquivos

- `types/treatment-protocol.ts` — Tipos e constantes
- `hooks/useTreatmentProtocols.ts` — Hook de listagem
- `pages/TreatmentProtocolsPage.tsx` + `.css` — Página de listagem (cards)
- `components/treatment-protocols/TreatmentProtocolModal.tsx` + `.css` — Modal criar/editar

### Funcionalidades

- Grid de cards com status, gravidade, versão, doenças, medicamentos e carência
- Busca por nome/descrição/autor com debounce 300ms
- Filtro por status (ativo/inativo)
- Botão duplicar protocolo
- Botão pré-carregar protocolos comuns
- Modal com formulário dinâmico de etapas (adicionar/remover medicamentos)
- Seletor de doenças via chips com checkbox
- Rota: `/treatment-protocols`
- Sidebar: grupo REBANHO, ícone Syringe, label "Protocolos"

## Decisões Técnicas

1. **Versionamento (CA8):** Ao alterar etapas (steps), uma nova versão é criada automaticamente com `originalId` apontando para o protocolo original. Atualizações sem mudança de steps (ex: nome, status) não criam nova versão.

2. **Carência automática (CA4):** Calculada como `Math.max()` dos `withdrawalMeatDays` e `withdrawalMilkDays` de todos os steps, armazenada no protocolo.

3. **Duplicação (CA6):** Cria cópia com nome "(cópia)" e incrementa se já existir.

4. **Seed vinculado a doenças:** O seed busca doenças por nome na organização. Se as doenças não existirem, o protocolo é criado sem vínculo.
