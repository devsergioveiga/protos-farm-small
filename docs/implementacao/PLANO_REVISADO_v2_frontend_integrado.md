# Plano Revisado v2 — Frontend Integrado

**Data:** 2026-03-02
**Versão:** 2.0
**Motivação:** Auditoria identificou que 8 USs da Fase 1 foram implementadas apenas no backend, sem interface frontend. Este plano corrige as lacunas e reorganiza a implementação para garantir que toda US entregue valor end-to-end.

---

## 1. Diagnóstico de Lacunas

### 1.1 USs com backend completo e ZERO frontend

| US     | Título                      | Endpoints prontos               | Frontend existente |
| ------ | --------------------------- | ------------------------------- | ------------------ |
| US-006 | Painel Super Admin          | 10 endpoints `/admin/*`         | Nenhuma tela       |
| US-009 | Gestão de usuários da org   | 9 endpoints `/org/users/*`      | Nenhuma tela       |
| US-013 | Cadastro de produtor rural  | 21 endpoints `/org/producers/*` | Nenhuma tela       |
| US-014 | Vinculação produtor-fazenda | 4 endpoints adicionais          | Nenhuma tela       |

### 1.2 USs com frontend parcial (funcionalidade incompleta)

| US     | Título              | O que existe                         | O que falta                                               |
| ------ | ------------------- | ------------------------------------ | --------------------------------------------------------- |
| US-007 | Login e sessão      | Tela de login (email/senha + Google) | Esqueci senha, redefinir senha, aceitar convite/1º acesso |
| US-010 | RBAC papéis         | Criar role + matrix de permissões    | Editar/excluir roles customizados                         |
| US-012 | Cadastro de fazenda | Lista + delete + mapa                | Formulário criar, formulário editar, CRUD matrículas      |
| US-015 | Upload perímetro    | Backend com multer                   | UI de upload para fazenda e matrículas                    |
| US-019 | Cadastro de talhão  | Mapa + import bulk + edit geometria  | Criar individual, editar atributos, excluir               |
| US-024 | Histórico do talhão | Visualização (read-only)             | Cadastro de safras e análises de solo (write)             |

### 1.3 Página esqueleto

| Página       | Estado atual               | Estado esperado                                                            |
| ------------ | -------------------------- | -------------------------------------------------------------------------- |
| `/dashboard` | Apenas "Bem-vindo" + email | Dashboard org com métricas: fazendas, talhões, usuários, atividade recente |

### 1.4 Endpoints backend sem consumo no frontend

**Total: ~65 endpoints implementados no backend sem nenhuma chamada do frontend.**

Detalhamento por módulo:

- **auth:** `forgot-password`, `reset-password`, `accept-invite` (3 endpoints)
- **admin/organizations:** todos os 10 endpoints (CRUD orgs, criar admin, reset senha, unlock)
- **admin/dashboard:** `GET /admin/dashboard`, `GET /admin/audit-logs` (2 endpoints)
- **org/users:** todos os 9 endpoints (CRUD users, convites, limites)
- **org/roles:** `PATCH`, `DELETE` (2 endpoints — create e matrix já consumidos)
- **org/farms:** `POST` criar, `PATCH` editar, `PATCH` status (3 endpoints)
- **org/farms/registrations:** `POST`, `PATCH`, `DELETE` (3 endpoints)
- **org/farms/boundary:** `POST` upload, `DELETE`, versions (4 endpoints)
- **org/farms/registrations/boundary:** `POST`, `DELETE`, versions (4 endpoints)
- **org/farms/plots:** `POST` criar individual, `PATCH` editar, `DELETE`, `PUT` boundary upload, versions (5 endpoints)
- **plot-history:** `POST/PATCH/DELETE` crop-seasons e soil-analyses (6 endpoints)
- **producers:** todos os 21 endpoints

---

## 2. Plano Revisado — Fase 1 Complementar (Frontend)

### Princípio: Toda US deve entregar valor end-to-end

A partir desta revisão, nenhuma US será considerada "completa" sem sua interface frontend funcional. As USs abaixo representam o trabalho de frontend pendente para completar a Fase 1.

---

### Sprint F1 — Fluxos de Autenticação (pré-requisito para tudo)

**US-007-FE: Telas de autenticação complementares** | 3 pts

Endpoints backend já prontos: `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/accept-invite`

| CA  | Descrição                                | Telas                                                                                                                      |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| FE1 | Tela "Esqueci minha senha"               | Formulário email → mensagem de confirmação                                                                                 |
| FE2 | Tela "Redefinir senha"                   | Validação de token na URL, formulário nova senha com indicador de força, validação (8+ chars, maiúscula, número, especial) |
| FE3 | Tela "Aceitar convite / Primeiro acesso" | Validação de token, formulário definir senha, redirecionamento para login                                                  |

**Componentes reutilizáveis a criar:**

- `PasswordStrengthIndicator` — barra visual de força da senha
- `TokenValidationPage` — layout base para páginas com validação de token na URL

**Rotas novas:** `/forgot-password`, `/reset-password?token=`, `/accept-invite?token=`

---

### Sprint F2 — Painel Super Admin

**US-006-FE: Interface completa do painel Super Admin** | 8 pts

Endpoints backend já prontos: 10 endpoints em `/admin/organizations/*`, `GET /admin/dashboard`, `GET /admin/audit-logs`

| CA   | Descrição                     | Telas                                                                                                                |
| ---- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| FE1  | Layout admin separado         | AppLayout com sidebar/nav específico para `/admin/*`, guard de rota `SUPER_ADMIN`                                    |
| FE2  | Dashboard admin               | Cards: total orgs ativas, usuários totais, fazendas totais, orgs por plano (gráfico). Consume `GET /admin/dashboard` |
| FE3  | Listar organizações           | Tabela paginada com filtros (status, plano, busca por nome/CNPJ). Consume `GET /admin/organizations`                 |
| FE4  | Criar/editar organização      | Formulário: nome, tipo pessoa (PF/PJ), CPF/CNPJ (validação), plano, limites. Consume `POST /admin/organizations`     |
| FE5  | Ativar/suspender/cancelar org | Botões de ação com modal destrutivo (suspender/cancelar). Consume `PATCH /admin/organizations/:id/status`            |
| FE6  | Alterar plano                 | Modal com campos de plano e limites. Consume `PATCH /admin/organizations/:id/plan`                                   |
| FE7  | Criar admin da org            | Formulário: nome, email, telefone. Consume `POST /admin/organizations/:id/users`                                     |
| FE8  | Reset senha / unlock admin    | Botões com confirmação. Consume `POST .../reset-password`, `PATCH .../unlock`                                        |
| FE9  | Log de auditoria              | Tabela paginada com filtros (ação, data, IP). Consume `GET /admin/audit-logs`                                        |
| FE10 | Configurações da org          | Toggle social login, política de sessão. Consume `PATCH .../session-policy`, `PATCH .../social-login-policy`         |

**Rotas novas:** `/admin`, `/admin/organizations`, `/admin/organizations/:id`, `/admin/audit-logs`

---

### Sprint F3 — Gestão de Usuários da Org

**US-009-FE: Interface de gestão de usuários** | 5 pts

Endpoints backend já prontos: 9 endpoints em `/org/users/*`

| CA  | Descrição                       | Telas                                                                                                                                  |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| FE1 | Listar usuários                 | Tabela paginada: nome, email, papel, fazendas, status, último acesso. Filtros: busca, papel, fazenda, status. Consume `GET /org/users` |
| FE2 | Criar usuário                   | Formulário: nome, email, telefone, papel (select), fazendas (multi-select). Consume `POST /org/users`                                  |
| FE3 | Editar usuário                  | Formulário pré-preenchido, troca de papel e fazendas. Consume `PATCH /org/users/:userId`                                               |
| FE4 | Ativar/desativar usuário        | Toggle de status com confirmação. Consume `PATCH /org/users/:userId/status`                                                            |
| FE5 | Reset senha e reenviar convite  | Botões de ação com confirmação. Consume `POST .../reset-password`, `POST .../resend-invite`                                            |
| FE6 | Indicador de limite de usuários | Barra de progresso com alerta em 80%. Consume `GET /org/users/limit`                                                                   |
| FE7 | Link de convite WhatsApp        | Botão gerar link. Consume `POST .../invite-link`                                                                                       |

**Rotas novas:** `/users`, `/users/new`, `/users/:userId/edit`

**US-010-FE: Completar gestão de papéis** | 2 pts

| CA  | Descrição                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------- |
| FE1 | Editar role customizado — modal com matrix de permissões editável. Consume `PATCH /org/roles/:roleId` |
| FE2 | Excluir role customizado — modal destrutivo com confirmação. Consume `DELETE /org/roles/:roleId`      |

---

### Sprint F4 — Cadastro Completo de Fazendas

**US-012-FE: Formulários de fazenda e matrículas** | 5 pts

Endpoints backend já prontos: `POST /org/farms`, `PATCH /org/farms/:farmId`, CRUD matrículas, `PATCH .../status`

| CA  | Descrição                       | Telas                                                                                                                                                                                                                                |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FE1 | Criar fazenda                   | Formulário multi-step: dados básicos (nome, apelido, endereço, município, UF, CEP, área) → identificadores (CIB, INCRA, CCIR, CAR) → dados ambientais (APP, reserva legal, área tributável) → confirmação. Consume `POST /org/farms` |
| FE2 | Editar fazenda                  | Mesmo formulário pré-preenchido. Consume `PATCH /org/farms/:farmId`                                                                                                                                                                  |
| FE3 | CRUD matrículas                 | Seção dentro do detalhe da fazenda: listar, adicionar, editar, remover matrículas. Alerta de divergência de área >5%. Consume `POST/PATCH/DELETE .../registrations`                                                                  |
| FE4 | Indicador de limite de fazendas | Badge no header com progresso. Consume `GET /org/farms/limit`                                                                                                                                                                        |

**Rotas novas:** `/farms/new`, `/farms/:farmId/edit`

**US-015-FE: Upload de perímetro no frontend** | 3 pts

Endpoints backend já prontos: `POST .../boundary` (fazenda e matrícula), `DELETE .../boundary`, `GET .../boundary/versions`

| CA  | Descrição                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FE1 | Upload de perímetro da fazenda — dropzone na página de detalhe/mapa (aceita .shp+.dbf+.shx+.prj, .kml, .kmz, .geojson), preview no mapa antes de confirmar. Consume `POST /org/farms/:farmId/boundary` |
| FE2 | Upload de perímetro da matrícula — mesmo padrão, dentro da seção de matrículas. Consume `POST .../registrations/:regId/boundary`                                                                       |
| FE3 | Histórico de versões de perímetro — lista de versões com data e área, opção de visualizar versão anterior no mapa. Consume `GET .../boundary/versions`                                                 |

---

### Sprint F5 — Cadastro de Produtores

**US-013-FE: Interface CRUD de produtores** | 5 pts

Endpoints backend já prontos: 21 endpoints em `/org/producers/*`

| CA  | Descrição                        | Telas                                                                                                                                           |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| FE1 | Listar produtores                | Tabela paginada: nome/razão, CPF/CNPJ, tipo, status, fazendas vinculadas. Filtros: busca, tipo (PF/PJ/SC), status. Consume `GET /org/producers` |
| FE2 | Criar produtor PF                | Formulário: nome, CPF, endereço fiscal, nascimento, CPF cônjuge, registro INCRA. Consume `POST /org/producers`                                  |
| FE3 | Criar produtor PJ                | Formulário: razão social, nome fantasia, CNPJ, endereço, representante legal. Consume `POST /org/producers`                                     |
| FE4 | Criar sociedade em comum         | Formulário com lista dinâmica de participantes (CPF + nome + percentual). Consume `POST /org/producers` + `POST .../participants`               |
| FE5 | Editar/ativar/desativar produtor | Formulário pré-preenchido + toggle status. Consume `PATCH /org/producers/:id`, `PATCH .../status`                                               |
| FE6 | Inscrições Estaduais             | Sub-seção no detalhe: listar, adicionar, editar, remover IEs. Marcar IE padrão. Consume CRUD `.../ies/*`                                        |
| FE7 | Detalhe do produtor              | Página com tabs: dados, IEs, fazendas vinculadas, documentos                                                                                    |

**Rotas novas:** `/producers`, `/producers/new`, `/producers/:producerId`, `/producers/:producerId/edit`

**US-014-FE: Interface de vinculação produtor-fazenda** | 3 pts

| CA  | Descrição                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE1 | Vincular produtor a fazenda — select de fazenda + matrícula, tipo de vínculo, percentual, datas. Consume `POST .../farms`                             |
| FE2 | Visão por fazenda — tab na página da fazenda: produtores vinculados com tipo, percentual, IEs ativas. Consume `GET /org/farms/:farmId/producers`      |
| FE3 | Indicador ITR e contratos vencendo — badge no produtor, alerta de contratos expirando. Consume `GET .../itr-declarant`, `GET /org/contracts/expiring` |

---

### Sprint F6 — Completar Talhões e Histórico

**US-019-FE: CRUD completo de talhões** | 3 pts

Endpoints backend já prontos: `POST .../plots`, `PATCH .../plots/:plotId`, `DELETE .../plots/:plotId`

| CA  | Descrição                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE1 | Criar talhão individual — formulário: nome, código, tipo de solo, cultura, notas + upload/desenho de perímetro. Botão "Adicionar talhão" no mapa. Consume `POST /org/farms/:farmId/plots` |
| FE2 | Editar atributos do talhão — formulário no painel lateral (PlotDetailsPanel): renomear, mudar cultura, solo, notas. Consume `PATCH .../plots/:plotId`                                     |
| FE3 | Excluir talhão — botão com modal destrutivo (confirmação por nome). Consume `DELETE .../plots/:plotId`                                                                                    |
| FE4 | Resumo de totalização — card com soma de áreas vs área total da fazenda. Consume `GET .../plots/summary`                                                                                  |

**US-024-FE: Cadastro de safras e análises (write)** | 3 pts

Endpoints backend já prontos: `POST/PATCH/DELETE .../crop-seasons`, `POST/PATCH/DELETE .../soil-analyses`

| CA  | Descrição                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- |
| FE1 | Adicionar safra — formulário: ano, cultura, tipo (verão/inverno/safrinha), produtividade, datas. Consume `POST .../crop-seasons`   |
| FE2 | Editar/excluir safra — inline edit na timeline. Consume `PATCH/DELETE .../crop-seasons/:id`                                        |
| FE3 | Adicionar análise de solo — formulário: data, profundidade, pH, P, K, Ca, Mg, MO, etc. Consume `POST .../soil-analyses`            |
| FE4 | Editar/excluir análise — inline edit na tabela de solo. Consume `PATCH/DELETE .../soil-analyses/:id`                               |
| FE5 | Histórico de versões do perímetro do talhão — lista de versões com visualização. Consume `GET .../plots/:plotId/boundary/versions` |

---

### Sprint F7 — Dashboard da Org

**Dashboard-FE: Dashboard real da organização** | 3 pts

| CA  | Descrição                                                              |
| --- | ---------------------------------------------------------------------- |
| FE1 | Cards resumo — total de fazendas, talhões, área total, usuários ativos |
| FE2 | Fazendas por UF — gráfico de barras ou mapa coroplético                |
| FE3 | Atividade recente — últimas ações do audit log da org                  |
| FE4 | Alertas — contratos vencendo, limites de usuários/fazendas próximos    |

**Rota:** `/dashboard` (substitui o esqueleto atual)

---

## 3. Resumo por Sprint

| Sprint    | USs                  | Pontos | Dependências | Foco                                         |
| --------- | -------------------- | ------ | ------------ | -------------------------------------------- |
| **F1**    | US-007-FE            | 3      | —            | Autenticação (desbloqueio de fluxo completo) |
| **F2**    | US-006-FE            | 8      | F1           | Painel Super Admin                           |
| **F3**    | US-009-FE, US-010-FE | 7      | F1           | Gestão de usuários e papéis                  |
| **F4**    | US-012-FE, US-015-FE | 8      | —            | Cadastro completo de fazendas                |
| **F5**    | US-013-FE, US-014-FE | 8      | F4           | Produtores e vinculações                     |
| **F6**    | US-019-FE, US-024-FE | 6      | F4           | Talhões CRUD + histórico write               |
| **F7**    | Dashboard-FE         | 3      | F3, F4       | Dashboard org                                |
| **Total** |                      | **43** |              |                                              |

**Nota:** F1 é pré-requisito para F2 e F3. F4 é pré-requisito para F5 e F6. F7 depende de F3 e F4. Sprints sem dependência entre si podem ser executados em paralelo (ex: F2 e F4 podem rodar simultaneamente).

```
        F1 (Auth)
       /         \
      F2 (Admin)  F3 (Users)
      |            |
      |            F7 (Dashboard) ← também depende de F4
      |           /
      F4 (Fazendas)
     /     \
    F5      F6
 (Produtores) (Talhões)
```

---

## 4. Fase 1 — USs Restantes (Full-Stack desde o início)

Após completar as lacunas de frontend, as USs restantes da Fase 1 devem ser implementadas como **full-stack**:

### EPIC-05: Cadastro e Gestão de Rebanho (7 USs, 38 pts)

| US     | Título                           | Pts | Prioridade | Escopo                                                                     |
| ------ | -------------------------------- | --- | ---------- | -------------------------------------------------------------------------- |
| US-025 | Cadastro individual de animal    | 5   | Alta       | Backend: CRUD animais, ficha individual. Frontend: formulário + listagem   |
| US-026 | Importação em massa de animais   | 8   | Alta       | Backend: parser CSV/Excel. Frontend: wizard upload + mapping + preview     |
| US-027 | Gestão de lotes e categorias     | 5   | Alta       | Backend: CRUD lotes. Frontend: tela de lotes com drag-n-drop               |
| US-028 | Cadastro de pastos e instalações | 5   | Alta       | Backend: CRUD pastos + layer mapa. Frontend: desenho no mapa + formulário  |
| US-029 | Ficha individual do animal       | 5   | Alta       | Frontend: página detalhe com tabs (dados, sanitário, reprodutivo, pesagem) |
| US-030 | Busca e filtros avançados        | 5   | Média      | Backend: query builder. Frontend: filtros combinados + export              |
| US-031 | Registro de pesagem              | 5   | Alta       | Backend: CRUD pesagens + GMD. Frontend: formulário + gráfico de evolução   |

### EPIC-06: App Mobile Shell (5 USs, 39 pts)

| US     | Título                       | Pts | Prioridade | Escopo                                            |
| ------ | ---------------------------- | --- | ---------- | ------------------------------------------------- |
| US-032 | Autenticação no mobile       | 5   | Alta       | React Native: login, biometria, secure storage    |
| US-033 | Navegação principal          | 5   | Alta       | Expo Router: bottom tabs, drawer, stack           |
| US-034 | Sincronização offline        | 13  | Alta       | SQLite, fila de operações, resolução de conflitos |
| US-035 | Mapa offline                 | 8   | Média      | Tiles cache, renderização offline de perímetros   |
| US-036 | Registro rápido de operações | 8   | Alta       | Formulários otimizados para campo                 |

---

## 5. Visão Geral da Fase 1 Atualizada

### Status atual

| Categoria                          | Completo | Pendente           |
| ---------------------------------- | -------- | ------------------ |
| USs backend-only (lacuna frontend) | 8 USs    | 43 pts de frontend |
| USs full-stack restantes (EPIC-05) | 0 de 7   | 38 pts             |
| USs mobile (EPIC-06)               | 0 de 5   | 39 pts             |
| **Total Fase 1 pendente**          |          | **120 pts**        |

### Ordem de execução recomendada

```
FASE 1 — COMPLEMENTO FRONTEND (43 pts)
├── Sprint F1: US-007-FE (auth) ........................ 3 pts
├── Sprint F2: US-006-FE (admin) ....................... 8 pts
├── Sprint F3: US-009-FE + US-010-FE (users/roles) .... 7 pts
├── Sprint F4: US-012-FE + US-015-FE (fazendas) ....... 8 pts
├── Sprint F5: US-013-FE + US-014-FE (produtores) ..... 8 pts
├── Sprint F6: US-019-FE + US-024-FE (talhões) ........ 6 pts
└── Sprint F7: Dashboard-FE ............................ 3 pts

FASE 1 — REBANHO (38 pts)
├── US-025: Cadastro individual de animal .............. 5 pts
├── US-026: Importação em massa de animais ............. 8 pts
├── US-027: Gestão de lotes e categorias ............... 5 pts
├── US-028: Cadastro de pastos e instalações ........... 5 pts
├── US-029: Ficha individual do animal ................. 5 pts
├── US-030: Busca e filtros avançados .................. 5 pts
└── US-031: Registro de pesagem ........................ 5 pts

FASE 1 — MOBILE (39 pts)
├── US-032: Autenticação no mobile ..................... 5 pts
├── US-033: Navegação principal ........................ 5 pts
├── US-034: Sincronização offline ...................... 13 pts
├── US-035: Mapa offline ............................... 8 pts
└── US-036: Registro rápido de operações ............... 8 pts
```

---

## 6. Critérios de "Done" Atualizados

A partir desta revisão, uma US só é considerada **COMPLETA** quando:

1. **Backend:** Endpoints implementados, testados e documentados
2. **Frontend:** Interface funcional consumindo todos os endpoints da US
3. **Testes:** Backend (`*.spec.ts` com Jest) + Frontend (`*.spec.tsx` com Vitest)
4. **Acessibilidade:** WCAG 2.1 AA (conforme design system)
5. **Responsividade:** Funcional em mobile e desktop (conforme design system)
6. **Documentação:** Arquivo em `docs/implementacao/` com decisões técnicas e arquivos criados/modificados

---

## 7. Auditoria de Frontend nas Fases 2–5

Auditoria dos documentos de requisitos das Fases 2-5 para verificar se os critérios de aceite incluem especificações de interface frontend.

### 7.1 Resumo Geral

| Fase      | Total USs | Pontos    | FE explícito (YES) | FE implícito (PARTIAL) | Sem FE (NO) |
| --------- | --------- | --------- | ------------------ | ---------------------- | ----------- |
| Fase 2    | 57        | 371       | 47 (82%)           | 5 (9%)                 | 5 (9%)      |
| Fase 3    | 126       | 865       | ~115 (91%)         | ~10 (8%)               | 0 (0%)      |
| Fase 4    | 19        | 194       | 10 (53%)           | 9 (47%)                | 0 (0%)      |
| Fase 5    | 17        | 168       | 5 (29%)            | 12 (71%)               | 0 (0%)      |
| **Total** | **219**   | **1.598** | **~177 (81%)**     | **~36 (16%)**          | **5 (2%)**  |

**Conclusão:** A maioria das USs tem alguma menção de UI, mas **41 USs (36 PARTIAL + 5 NO)** precisam de critérios de aceite de frontend adicionados antes da implementação.

---

### 7.2 Fase 2 — Operações Core (57 USs, 371 pts)

**Nota:** O documento possui IDs duplicados entre épicos (US-076 a US-080 se repetem). Os IDs precisam ser corrigidos antes da implementação.

#### USs sem nenhum critério de frontend (NO) — 5 USs, 31 pts

| Épico   | ID (doc) | Pts | Título                                     | Lacuna                                                                                                                  |
| ------- | -------- | --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| EPIC-07 | US-035   | 8   | Registro de operação de plantio            | Nenhuma menção de formulário mobile/web. Status "Plantado" no talhão não descreve feedback visual.                      |
| EPIC-08 | US-039   | 5   | Registro de adubação de cobertura/foliar   | Operação de campo sem tela mobile descrita. "Acumulado de nutrientes por talhão" implica visualização não especificada. |
| EPIC-09 | US-078   | 5   | Registro de colheita de café               | Campos de dados sem formulário mobile. US de alta prioridade para uso no campo.                                         |
| EPIC-09 | US-079   | 5   | Registro de colheita de laranja            | Idem — campos sem tela. Vinculação a contrato implica select nunca descrito.                                            |
| EPIC-10 | US-077   | 8   | Cadastro de unidades de medida e conversão | Tela de administração/configuração completamente ausente.                                                               |

**Critérios de frontend a adicionar:**

- Formulário mobile de registro (para as 3 operações de campo)
- Feedback visual de status no mapa/lista
- Tela de configuração admin (para unidades de medida)

#### USs com frontend parcial (PARTIAL) — 5 USs

| Épico   | ID (doc) | Pts | Título                                   | Lacuna                                                                    |
| ------- | -------- | --- | ---------------------------------------- | ------------------------------------------------------------------------- |
| EPIC-07 | US-037   | 5   | Gestão de cultivares e sementes          | "Histórico de performance" e "comparativo" sem descrever tela/gráfico     |
| EPIC-10 | US-078   | 5   | Saída de insumos (consumo/transferência) | "Saldo insuficiente" sem descrever como é exibido (inline, toast, modal?) |
| EPIC-10 | US-078   | 8   | Conversão automática em operações        | "Preview antes de confirmar" sem descrever componente UI                  |
| EPIC-11 | US-079   | 5   | Registro de vermifugação                 | "Alertas de próxima vermifugação" sem canal/tela                          |
| EPIC-12 | US-077   | 5   | Cadastro de touros e sêmen               | "Catálogo com ranking" e "histórico de uso" sem tela de listagem          |

#### Épicos com 100% de cobertura frontend

- **EPIC-13** (Produção de Leite) — 6 USs, todas YES
- **EPIC-15** (Nutrição Animal) — 3 USs, todas YES
- **EPIC-14** (Sync Offline) — 4 USs, todas YES

---

### 7.3 Fase 3 — Financeiro, Contábil, Patrimônio, RH, Compras (126 USs, 865 pts)

#### Por documento

| Documento       | USs | YES | PARTIAL | NO  |
| --------------- | --- | --- | ------- | --- |
| Compras         | 18  | 17  | 1       | 0   |
| Contabilidade   | 22  | 18  | 3       | 0   |
| Financeiro Base | 15  | 15  | 0       | 0   |
| Patrimônio      | 44  | ~40 | ~4      | 0   |
| RH e Folha      | 27  | 25  | 2       | 0   |

**Financeiro Base é o mais bem especificado** — todas as 15 USs têm telas explícitas (dashboards, formulários, conciliação lado-a-lado).

#### USs com lacuna de frontend (PARTIAL) — ~10 USs de alta importância

**Compras:**

| ID      | Pts | Título                               | Lacuna                                                                                    |
| ------- | --- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| US-CP13 | 8   | Geração automática de contas a pagar | Sem tela de revisão de CPs gerados, sem navegação drill-down CP↔pedido↔cotação↔requisição |

**Contabilidade:**

| ID     | Pts | Título                            | Lacuna                                                                                     |
| ------ | --- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| US-C05 | 13  | Lançamentos contábeis automáticos | Sem tela de revisão da fila de lançamentos automáticos antes do fechamento                 |
| US-C12 | 5   | Fechamento e bloqueio de período  | Sem UI para ação de fechamento, reabertura com motivo, indicador visual de período fechado |
| US-C21 | 8   | Exportação SPED Contábil (ECD)    | Sem tela de mapeamento contas → plano referencial RFB, sem progresso de geração            |

**Patrimônio:**

| ID     | Pts | Título                                   | Lacuna                                                                            |
| ------ | --- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| US-P12 | 8   | Cálculo automático de depreciação mensal | Sem UI para trigger manual, progresso de processamento, revisão de resultados     |
| US-P19 | 8   | Vinculação de ativo a centro de custo    | Sem lista de ativos sem CC atribuído, sem bulk assignment UI                      |
| US-P28 | 8   | Compra de ativo à vista                  | Sem modal de confirmação "gerar lançamento?", sem tela de CPs vinculados ao ativo |

**RH e Folha:**

| ID      | Pts | Título                                          | Lacuna                                                               |
| ------- | --- | ----------------------------------------------- | -------------------------------------------------------------------- |
| US-RH25 | 8   | Lançamento automático da folha no financeiro    | Sem tela de revisão antes da confirmação, sem UI de estorno/rollback |
| US-RH26 | 8   | Lançamento automático da folha na contabilidade | Idem — sem revisão, sem resolução de divergências                    |

#### Padrão sistemático identificado na Fase 3

Toda US que envolve **automação com geração de registros** (CPs, lançamentos contábeis, depreciação) descreve apenas a lógica de negócio. Falta em todas:

1. **Tela de revisão/confirmação** antes da ação
2. **Indicador de progresso** durante processamento batch
3. **Tela de exceções/erros** quando processamento falha parcialmente
4. **UI de estorno/rollback** quando necessário desfazer

---

### 7.4 Fase 4 — Inteligência, IoT e Analytics (19 USs, 194 pts)

| ID      | Pts | Título                                 | FE      | Lacuna                                                                           |
| ------- | --- | -------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| US-F401 | 13  | Dashboard consolidado multi-fazenda    | YES     | —                                                                                |
| US-F402 | 13  | Dashboard pecuário                     | YES     | —                                                                                |
| US-F403 | 8   | Dashboard agrícola por talhão          | YES     | —                                                                                |
| US-F404 | 13  | Dados climáticos (manual + automático) | PARTIAL | Sem tela web de gestão de estações meteorológicas                                |
| US-F405 | 8   | Visualização climática e alertas       | YES     | —                                                                                |
| US-F406 | 13  | Sentinel-2 / NDVI / NDRE               | YES     | —                                                                                |
| US-F407 | 13  | Análise de solo e mapas de fertilidade | YES     | —                                                                                |
| US-F408 | 13  | Integração leitores RFID               | PARTIAL | Sem tela web de cadastro/gestão de leitores                                      |
| US-F409 | 8   | Integração balanças eletrônicas        | PARTIAL | Sem tela web de cadastro de balanças                                             |
| US-F410 | 8   | Estoque de sêmen com baixa automática  | PARTIAL | Nenhuma tela/formulário/tabela descrita — toda UI é implícita                    |
| US-F411 | 8   | Abastecimento e combustível            | PARTIAL | Sem tela web de cadastro de tanques e alertas                                    |
| US-F412 | 13  | Portal de fornecedores (cotações)      | YES     | —                                                                                |
| US-F413 | 8   | Notificações push e central de alertas | YES     | —                                                                                |
| US-F414 | 13  | MIP georreferenciado / mapas de calor  | YES     | —                                                                                |
| US-F415 | 8   | Calendário visual de tarefas           | YES     | —                                                                                |
| US-F416 | 8   | Estimativa de produtividade agrícola   | PARTIAL | Sem definir onde os gráficos aparecem (dashboard? detalhe talhão?)               |
| US-F417 | 5   | Previsão de produção de leite          | PARTIAL | Sem definir tela/localização da visualização                                     |
| US-F418 | 8   | Relatórios automáticos para bancos     | PARTIAL | Sem descrever wizard de geração, editor de template, tela de agendamento         |
| US-F419 | 13  | Motor de workflow de aprovações        | PARTIAL | Sem tela web de configuração de alçadas/regras (apenas mobile approval descrita) |

**Padrão:** As 10 USs YES são todas de **dashboard/visualização** (exatamente o tipo de US que é 100% frontend). As 9 PARTIAL são de **integração IoT e automação**, onde a lógica backend domina e as telas de administração/configuração são omitidas.

---

### 7.5 Fase 5 — Compliance, Fiscal e Integrações Gov (17 USs, 168 pts)

**A fase com maior proporção de lacunas (71% PARTIAL).**

| ID      | Pts | Título                                 | FE      | Lacuna                                                                |
| ------- | --- | -------------------------------------- | ------- | --------------------------------------------------------------------- |
| US-F501 | 21  | Emissão de NF-e de saída               | YES     | —                                                                     |
| US-F502 | 8   | Importação de NF-e (XML)               | PARTIAL | Sem tela step-by-step de importação, tela de divergências NF×pedido   |
| US-F503 | 8   | Emissão de MDF-e                       | PARTIAL | Sem formulário de emissão, sem tela de gestão/lista de MDF-es         |
| US-F504 | 13  | Geração automática do LCDPR            | PARTIAL | Sem tela principal de revisão do LCDPR, classificação de lançamentos  |
| US-F505 | 8   | Gestão de ITR e imóveis rurais         | PARTIAL | Toda UI implícita — nenhuma tela, form ou tabela explícita            |
| US-F506 | 8   | Gestão do CAR (sobreposição no mapa)   | YES     | —                                                                     |
| US-F507 | 5   | Licenças ambientais e outorgas         | PARTIAL | Sem formulário de cadastro de licença, apenas dashboard nomeado       |
| US-F508 | 13  | Emissão e gestão de GTA                | PARTIAL | Sem formulário de emissão de GTA, sem tela de lista/gestão            |
| US-F509 | 8   | Rastreabilidade SISBOV                 | PARTIAL | Sem tela de inventário SISBOV, ficha descrita como "relatório" sem UI |
| US-F510 | 8   | Workflows de certificação e auditorias | YES     | —                                                                     |
| US-F511 | 8   | Emissões de GEE e pegada de carbono    | PARTIAL | Dashboard de emissões implícito (gráfico pizza citado mas sem tela)   |
| US-F512 | 5   | Logística reversa de embalagens        | PARTIAL | Nenhuma tela explícita em nenhum critério                             |
| US-F513 | 13  | Rastreamento GPS e telemetria          | YES     | —                                                                     |
| US-F514 | 13  | Irrigação com sensores                 | PARTIAL | Sem tela de cadastro de sistemas de irrigação e sensores              |
| US-F515 | 8   | Exportação para ERPs contábeis         | PARTIAL | Apenas "tela de mapeamento de-para" nomeada, resto funcional          |
| US-F516 | 13  | Book de vendas e fixação de preço      | YES     | —                                                                     |
| US-F517 | 8   | Expedição e entrega                    | PARTIAL | Sem tela de conferência no destino, romaneio descrito como conceito   |

**Padrão:** As USs fiscais/regulatórias (NF-e, MDF-e, GTA, LCDPR, ITR, SISBOV) foram escritas com foco no compliance técnico e integração com sistemas governamentais. Os formulários de emissão e telas de gestão — que são a interface principal do usuário — foram omitidos dos critérios.

---

### 7.6 Padrões Transversais de Lacuna (todas as fases)

| Padrão                       | Descrição                                                                                                            | Fases afetadas |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------- |
| **Automação sem revisão**    | Toda US com geração automática de registros (CPs, lançamentos, depreciação, folha) omite tela de revisão/confirmação | Fase 3, 4      |
| **Cadastro de dispositivos** | USs de integração IoT (RFID, balanças, estações, sensores) descrevem protocolo mas não tela admin de gestão          | Fase 4, 5      |
| **Formulário fiscal**        | USs de documentos fiscais (NF-e entrada, MDF-e, GTA) descrevem campos de dados mas não o formulário de emissão       | Fase 5         |
| **Relatórios como conceito** | "Relatório X com dados Y" citado sem descrever tela, filtros, export ou localização na navegação                     | Fase 2, 4, 5   |
| **Erros de batch**           | Nenhuma US em nenhuma fase descreve UI para quando processamento batch falha parcialmente                            | Todas          |
| **Progresso de jobs**        | USs com jobs longos (depreciação, SPED, sync) não descrevem indicador de progresso                                   | Fase 3, 4, 5   |

---

## 8. Recomendações

### 8.1 Antes de implementar cada fase

1. **Revisar USs PARTIAL e NO** — adicionar critérios de aceite explícitos de frontend:
   - Nome da tela/componente
   - Campos do formulário e validações
   - Localização na navegação (rota)
   - Comportamento mobile vs desktop

2. **Corrigir IDs duplicados na Fase 2** — o documento repete US-076 a US-080 entre épicos

3. **Adicionar critério padrão para automações:**
   - CA de revisão: "Antes de confirmar, o usuário vê preview dos registros a serem criados"
   - CA de progresso: "Durante processamento, barra de progresso com estimativa de conclusão"
   - CA de erros: "Se processamento falha parcialmente, lista de erros com opção de retry"

### 8.2 Template de US atualizado

Toda US futura deve incluir obrigatoriamente:

```markdown
## Telas e Componentes Frontend

| Tela   | Rota  | Tipo             | Descrição                  |
| ------ | ----- | ---------------- | -------------------------- |
| [Nome] | /path | Page/Modal/Panel | [O que o usuário vê e faz] |

### Formulários

- [Nome do formulário]: campos, validações, comportamento onBlur/onSubmit

### Componentes reutilizáveis

- [Se criar componente genérico, listar aqui]

### Responsividade

- Mobile: [comportamento específico]
- Desktop: [comportamento específico]
```

### 8.3 Prioridade de correção dos documentos

| Prioridade           | Fase     | Motivo                                                               |
| -------------------- | -------- | -------------------------------------------------------------------- |
| 1 (agora)            | Fase 1   | Lacunas de implementação real — precisa de código                    |
| 2 (antes de começar) | Fase 2   | Próxima a ser implementada, 5 USs sem FE + IDs duplicados            |
| 3 (pode esperar)     | Fase 3   | 10 USs PARTIAL, padrão claro de automação sem revisão                |
| 4 (pode esperar)     | Fase 4-5 | 21 USs PARTIAL, maioria em IoT/fiscal — corrigir quando chegar a vez |
