# US-079 — Produtividade Individual e Bonificação de Equipe

## Resumo

Registro, ranking, metas e bonificação da produtividade individual dos membros de equipe.

## Critérios de Aceite

| CA  | Status     | Descrição                                                                    |
| --- | ---------- | ---------------------------------------------------------------------------- |
| CA1 | OK         | Registro de produtividade por membro (já existia no model, surfaceado no UI) |
| CA2 | OK         | Ranking automático por produtividade (endpoint + tab "Produtividade")        |
| CA3 | OK         | Meta configurável por tipo de atividade (CRUD ProductivityTarget + modal)    |
| CA4 | OK         | Indicador visual verde/amarelo/vermelho (status no ranking baseado em metas) |
| CA5 | OK         | Cálculo de bonificação R$/unidade (endpoint + tab "Bonificação")             |
| CA6 | POSTERGADO | Integração folha de pagamento (depende EPIC-13)                              |
| CA7 | OK         | Relatório por equipe/membro/período (ranking com filtros)                    |
| CA8 | OK         | Histórico individual por período (endpoint + modal de evolução mensal)       |

## Implementação

### Backend

- **Model:** `ProductivityTarget` (farmId, operationType, targetValue, targetUnit, ratePerUnit)
- **Migration:** `20260337100000_add_productivity_targets`
- **Endpoints novos:**
  - `GET /team-operations/productivity-ranking` — ranking com status vs meta
  - `GET /team-operations/productivity-history/:userId` — histórico mensal/semanal
  - `GET /team-operations/bonification` — cálculo de bonificação
  - CRUD `/productivity-targets` — metas de produtividade
- **Campos adicionados ao response:** `totalProductivity`, `productivityUnit` em TeamOperationItem

### Frontend

- **Tabs novas:** "Produtividade" e "Bonificação" em TeamOperationsPage
- **Componentes:**
  - `ProductivityRankingTab` — ranking com filtros e indicadores visuais
  - `BonificationTab` — cálculo de bonificação por período
  - `ProductivityTargetsModal` — CRUD de metas
  - `ProductivityHistoryModal` — evolução mensal ao clicar no nome do colaborador
- **Produtividade nos cards:** total produzido visível nos cards de operação

### Testes

- 24 testes backend (17 team-operations + 7 productivity-targets)
