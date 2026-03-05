# Dashboard-FE — Dashboard Real da Organização

## Contexto

O `DashboardPage` era um stub ("Bem-vindo, {email}"). Implementamos um dashboard real com métricas agregadas da organização, última peça pendente do plano de complemento frontend (Sprint F7).

## Critérios de Aceite

| CA  | Descrição                                              | Status |
| --- | ------------------------------------------------------ | ------ |
| CA1 | Cards resumo (fazendas, talhões, área total, usuários) | OK     |
| CA2 | Fazendas por UF (gráfico de barras horizontal)         | OK     |
| CA3 | Atividade recente (últimas ações do audit log da org)  | OK     |
| CA4 | Alertas (contratos vencendo, limites próximos)         | OK     |

## Arquivos Criados/Modificados

### Backend

| Arquivo                                                       | Ação       |
| ------------------------------------------------------------- | ---------- |
| `apps/backend/src/modules/dashboard/dashboard.types.ts`       | Criado     |
| `apps/backend/src/modules/dashboard/dashboard.service.ts`     | Criado     |
| `apps/backend/src/modules/dashboard/dashboard.routes.ts`      | Criado     |
| `apps/backend/src/modules/dashboard/dashboard.routes.spec.ts` | Criado     |
| `apps/backend/src/app.ts`                                     | Modificado |

### Frontend

| Arquivo                                          | Ação        |
| ------------------------------------------------ | ----------- |
| `apps/frontend/src/types/dashboard.ts`           | Criado      |
| `apps/frontend/src/hooks/useDashboard.ts`        | Criado      |
| `apps/frontend/src/pages/DashboardPage.tsx`      | Substituído |
| `apps/frontend/src/pages/DashboardPage.css`      | Criado      |
| `apps/frontend/src/pages/DashboardPage.spec.tsx` | Criado      |

## Decisões de Arquitetura

1. **Endpoint único `GET /org/dashboard`**: Agrega todos os dados em uma chamada, evitando múltiplas requisições no frontend.

2. **RLS + bypass combinado**: Summary e farmsByUf usam `withRlsContext` (scoped via RLS). Users, audit logs e org limits usam `withRlsBypass` com filtro explícito por `organizationId` (tabelas com RLS que precisam de acesso cross-tenant).

3. **Permissão `farms:read`**: Qualquer membro da org com leitura de fazendas pode ver o dashboard. Não criamos permissão dedicada.

4. **Contratos vencendo**: Reutiliza `getExpiringContracts` do producers.service, limitado a 5 alertas. Falha silenciosa (try/catch) para não bloquear o dashboard se o módulo de produtores falhar.

5. **CSS BEM `org-dashboard__*`**: Separado do `admin-dashboard__*` para evitar colisão.

6. **Tempo relativo inline**: Helper `timeAgo()` simples no componente, sem dependência externa.

## Testes

- **Backend**: 6 testes (auth 401/403, 200 shape, ctx correto, 500 error, 403 sem org)
- **Frontend**: 9 testes (skeleton, error, 4 cards, barras UF, atividade, alertas, 3 empty states)

## Layout Responsivo

- **Desktop (≥1024px)**: 4 cards em grid, barras UF, 2 colunas bottom (atividade + alertas)
- **Tablet (768-1024px)**: 2 cards por linha
- **Mobile (<768px)**: 1 card por linha, bottom grid empilhado
- **`prefers-reduced-motion`**: Animações desabilitadas
