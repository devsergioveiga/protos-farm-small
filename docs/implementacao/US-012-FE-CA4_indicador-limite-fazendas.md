# US-012-FE CA4 — Indicador de Limite de Fazendas

## O que foi feito

Badge compacto no header (topbar) mostrando o consumo de fazendas da organização, com estados visuais para OK, aviso (80%+) e bloqueado (100%).

## Por que

Permite que o usuário acompanhe visualmente quantas fazendas já foram cadastradas em relação ao limite da organização, recebendo alertas visuais quando se aproxima do limite.

## Arquivos criados

| Arquivo                                                   | Descrição                               |
| --------------------------------------------------------- | --------------------------------------- |
| `src/types/farm.ts`                                       | Tipo `FarmLimitInfo` adicionado         |
| `src/hooks/useFarmLimit.ts`                               | Hook que consome `GET /org/farms/limit` |
| `src/hooks/useFarmLimit.spec.ts`                          | 4 testes do hook                        |
| `src/components/farm-limit-badge/FarmLimitBadge.tsx`      | Componente badge com 3 estados          |
| `src/components/farm-limit-badge/FarmLimitBadge.css`      | Estilos (pill badge, progress track)    |
| `src/components/farm-limit-badge/FarmLimitBadge.spec.tsx` | 7 testes do componente                  |

## Arquivos modificados

| Arquivo                               | Mudança                                                      |
| ------------------------------------- | ------------------------------------------------------------ |
| `src/components/layout/AppLayout.tsx` | Import e renderização do `FarmLimitBadge` antes do separator |

## Decisões técnicas

- **Badge pill** (não barra larga) — ocupa pouco espaço no topbar, não compete com navegação
- **Posição:** entre os nav links e o separator do usuário — visível sem ser intrusivo
- **Formato compacto:** `3/10` em vez de `3 de 10 fazendas` — econômico em espaço
- **Progress track:** barra fina de 4px × 48px, escondida em mobile (<768px)
- **aria-label descritivo:** inclui contagem e estado ("próximo do limite" / "limite atingido")
- **Padrão seguido:** mesmo que `useUserLimit` de US-009-FE

## Estados visuais

| Estado    | Condição | Cor fundo          | Cor texto           | Ícone         |
| --------- | -------- | ------------------ | ------------------- | ------------- |
| OK        | < 80%    | primary-50         | primary-700         | —             |
| Aviso     | >= 80%   | amber-50 (#fef3c7) | amber-900 (#92400e) | —             |
| Bloqueado | >= 100%  | error-50           | error-700           | AlertTriangle |

## Testes

- 266 testes frontend passando (11 novos: 4 hook + 7 componente)
