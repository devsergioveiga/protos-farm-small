# Phase 16: Cadastro de Ativos - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Gerente pode cadastrar, buscar e visualizar ativos com classificação CPC correta (máquina, veículo, implemento, benfeitoria, terra) — tornando a entidade ativo disponível como raiz de todo o módulo patrimonial. Inclui importação em massa, controle operacional básico (horímetro/odômetro, documentos com alertas de vencimento) e ficha completa com abas.

</domain>

<decisions>
## Implementation Decisions

### Ficha e classificação do ativo

- Modal único com seções colapsáveis para cadastro — campos condicionais aparecem conforme o tipo selecionado (padrão FarmFormModal, StockEntryModal)
- 5 tipos de ativo nesta fase: MAQUINA, VEICULO, IMPLEMENTO, BENFEITORIA, TERRA — biológico só na Phase 24 com CPC 29
- Ficha completa em drawer lateral — painel abre sobre a listagem com abas (Geral, Documentos, Depreciação, Manutenção, etc.)
- Tag patrimônio fixa PAT-NNNNN — sequencial por organização, sem configuração de prefixo

### Listagem e busca de ativos

- Tabela com colunas (Tag, Nome, Tipo, Fazenda, Status, Valor Contábil) + clique na linha abre drawer com ficha
- Cards de resumo no topo: total de ativos, valor total patrimônio, ativos em manutenção, últimas aquisições
- 4 filtros essenciais: tipo de ativo, fazenda, status, período de aquisição + busca texto por nome/tag
- Exportação em CSV + PDF da listagem filtrada

### Import em massa

- Auto-mapping de colunas (detecção pelo header) + ajuste manual antes de confirmar — padrão animal-file-parser e supplier-file-parser
- Importar registros válidos e listar erros com linha + motivo para correção manual (não é tudo-ou-nada)
- Template para download disponível (planilha modelo com colunas e 2-3 linhas de exemplo)
- Formatos aceitos: CSV + Excel (.xlsx)

### Controle operacional básico

- Horímetro/odômetro e documentos nas abas da ficha do ativo (drawer lateral) — não em telas separadas
- Alertas de vencimento (30/15/7 dias): badge visual na tabela de ativos (amarelo/vermelho) + filtro "Documentos vencendo" — sem notificação push/email nesta fase
- Validação de horímetro: nova leitura deve ser >= anterior — impedir retroativa (se precisar corrigir, editar leitura anterior)
- Tipos de documento: lista fixa (CRLV, Seguro, Revisão, CCIR, ITR, Laudo, Garantia) + opção "Outro" com descrição livre

### Claude's Discretion

- Schema Prisma e estrutura de tabelas (campos, tipos, relações)
- Número e nome exato das abas na ficha (pode ajustar conforme complexidade)
- Skeleton loading e estados de erro
- Implementação de paginação na tabela
- Layout responsivo (tabela desktop, cards mobile conforme CLAUDE.md)
- Formato exato do PDF de exportação

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — ATIV-01, ATIV-02, ATIV-04, ATIV-06, OPER-01, OPER-03 (requirements desta fase)
- `.planning/ROADMAP.md` §Phase 16 — Goal, success criteria e depends on

### Design System

- `docs/design-system/04-componentes.md` — Specs de componentes (modal, tabela, empty state, confirmação)
- `docs/design-system/05-padroes-ux.md` — Padrões UX (voz pt-BR, validação inline, breadcrumb)
- `docs/design-system/07-responsividade-mobile.md` — Breakpoints, tabela→cards em mobile

### Key Decisions (STATE.md)

- Asset purchase must NOT route through GoodsReceipt/StockEntry — separate AssetAcquisition module
- CPC 27 vs CPC 29 classification at schema creation — BEARER_PLANT vs BIOLOGICAL_ASSET_ANIMAL
- All depreciation arithmetic uses decimal.js

### Codebase Patterns

- `.planning/codebase/CONVENTIONS.md` — Naming, module structure, error handling patterns
- `.planning/codebase/STRUCTURE.md` — Where to add new modules, pages, components

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **File parsers**: `animal-file-parser.ts`, `supplier-file-parser.ts` — auto-mapping CSV/Excel pattern to reuse for asset import
- **Cost centers module**: `modules/cost-centers/` — already exists, asset links to cost center via rateio
- **Suppliers module**: `modules/suppliers/` — fornecedor dropdown for asset acquisition data
- **ConfirmModal**: `components/ui/ConfirmModal.tsx` — for destructive actions
- **Money type**: `decimal.js` via Money factory — for acquisition values and book value

### Established Patterns

- **Backend modules**: colocalized at `modules/{domain}/` with service + routes + types
- **Frontend pages**: table-based listing with filters (PayablesPage, StockEntriesPage pattern)
- **Modal CRUD**: all create/edit via modal, never dedicated page
- **RLS context**: `(ctx: RlsContext, ...)` first param pattern for multitenancy
- **Error classes**: `DomainError` with statusCode for HTTP mapping
- **Sidebar groups**: existing groups (FINANCEIRO, ESTOQUE, COMPRAS) — new PATRIMÔNIO group

### Integration Points

- **app.ts**: register new `assetsRouter` for `/api/assets/*`
- **App.tsx**: add `AssetsPage` route at `/assets`
- **Sidebar**: add PATRIMÔNIO group with "Ativos" item
- **Prisma schema**: new Asset model with relations to Farm, CostCenter, Organization
- **Farms context**: `FarmContext` already exists for farm selection filtering

</code_context>

<specifics>
## Specific Ideas

- Drawer lateral para ficha do ativo — padrão SAP/TOTVS de gestão patrimonial, permite navegar entre ativos sem perder contexto
- Auto-mapping de colunas na importação inspirado nos parsers existentes (animal, supplier)
- Cards de resumo no topo da listagem como PayablesPage e StockAlertsPage

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 16-cadastro-de-ativos_
_Context gathered: 2026-03-19_
