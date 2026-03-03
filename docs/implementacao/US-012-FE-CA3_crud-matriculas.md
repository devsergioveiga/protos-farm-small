# US-012-FE CA3 — CRUD de Matrículas

## O que foi implementado

Gestão completa de matrículas (registrations) dentro do contexto de uma fazenda, acessível via painel lateral na `FarmMapPage`.

## Arquivos criados

| Arquivo                                                       | Descrição                                                                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useRegistrations.ts`                               | Hook para mutações CRUD (add/update/delete) com tracking de `areaDivergence`                                           |
| `src/hooks/useRegistrations.spec.ts`                          | 6 testes do hook                                                                                                       |
| `src/components/registrations/RegistrationsPanel.tsx`         | Painel lateral com lista de matrículas em cards, empty state, skeleton, alerta de divergência, confirmação de exclusão |
| `src/components/registrations/RegistrationsPanel.css`         | Estilos BEM com tokens CSS, slide-in desktop, bottom-sheet mobile                                                      |
| `src/components/registrations/RegistrationsPanel.spec.tsx`    | 13 testes do painel                                                                                                    |
| `src/components/registrations/RegistrationFormModal.tsx`      | Modal para criar/editar matrícula com validação onBlur                                                                 |
| `src/components/registrations/RegistrationFormModal.css`      | Estilos do modal (mesmo padrão do FarmFormModal)                                                                       |
| `src/components/registrations/RegistrationFormModal.spec.tsx` | 12 testes do modal                                                                                                     |

## Arquivos modificados

| Arquivo                     | Mudança                                                                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/farm.ts`         | Adicionados: `CreateRegistrationPayload`, `UpdateRegistrationPayload`, `AreaDivergence`, `RegistrationMutationResponse`, `RegistrationDeleteResponse` |
| `src/pages/FarmMapPage.tsx` | Integração: botão "Matrículas" (FileText) no header, estado para painel e modal, handlers CRUD, lazy imports                                          |

## Endpoints consumidos

- `POST /api/org/farms/:farmId/registrations` — criar matrícula
- `PATCH /api/org/farms/:farmId/registrations/:regId` — editar matrícula
- `DELETE /api/org/farms/:farmId/registrations/:regId` — excluir matrícula
- Todos retornam `areaDivergence: { divergent, percentage }` para alerta de divergência

## Padrões seguidos

- **Modal para formulários** (CLAUDE.md)
- **Painel lateral** slide-in (mesmo padrão PlotDetailsPanel, bottom-sheet no mobile)
- **Cards empilhados** para lista (nunca tabela)
- **PermissionGate** `farms:update` para ações de escrita
- **Validação onBlur** com `aria-required`, `aria-invalid`, `role="alert"`
- **Confirmação de exclusão** com dialog simples (proporcional ao risco)
- **Skeleton** para loading, empty state com ícone + CTA
- **CSS BEM** com tokens (`var(--color-*)`, `var(--space-*)`)
- **Lazy loading** dos componentes via `React.lazy`

## Testes

- 42 arquivos de teste, 255 testes passando
- Build TypeScript sem erros
