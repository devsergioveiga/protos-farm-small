# Phase 7: Cadastro de Fornecedores - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Cadastro completo de fornecedores com dados fiscais validados, importacao em massa (CSV/Excel), avaliacao/ranking por criterios, e exportacao (CSV/PDF). Entidade raiz do ciclo P2P — fornecedor sera referenciado por cotacao (Phase 9), pedido de compra (Phase 9), e recebimento (Phase 10). Requisicao de compra, cotacao e demais etapas do ciclo sao fases separadas.

</domain>

<decisions>
## Implementation Decisions

### Formulario e dados

- Modal unico com secoes visiveis: Dados Fiscais, Dados Comerciais, Endereco, Categorias e Produtos, Anexos
- Toggle PF/PJ no topo do formulario — adapta campos automaticamente (PJ: Razao Social/CNPJ/IE; PF: Nome/CPF)
- Campos obrigatorios: Tipo (PF/PJ), Nome/Razao Social, CNPJ/CPF, pelo menos 1 categoria
- Campos opcionais: IE, endereco completo, contato (nome, telefone, email), condicao de pagamento, frete CIF/FOB, observacoes
- CNPJ/CPF unico por organizacao — duplicata mostra "Fornecedor ja cadastrado" com link para o existente
- Fornecedor pertence a organizacao (nao a fazenda) — qualquer fazenda da org pode usa-lo
- Categorias como multi-select de opcoes fixas (Insumo Agricola, Pecuario, Pecas, Combustivel, EPI, Servicos etc.) — mesmas categorias da requisicao de compra (Phase 8)
- Condicao de pagamento padrao como campo texto com autocomplete de sugestoes (30 dias, 30/60/90, A vista, 7 dias)
- Upload de documentacao: secao simples de anexos com nome, tipo (Contrato, Certidao, Alvara, Outro) e data upload, drag & drop
- Campo de observacoes/notas como textarea simples no final do formulario
- Status com 3 estados: ativo, inativo, bloqueado

### Status e comportamento

- Fornecedor bloqueado NAO aparece na lista de selecao ao criar cotacao (Phase 9)
- Fornecedor inativo aparece na lista com aviso visual

### Importacao em massa

- Aceita CSV (.csv) e Excel (.xlsx)
- Template para download com colunas esperadas
- Ao importar, fornecedores com CNPJ/CPF ja existente sao pulados (nao importados) e aparecem no relatorio final como "ja cadastrado"
- Tabela de preview apos upload: linhas validas em verde, invalidas em vermelho com motivo do erro. Botao "Importar X de Y" para confirmar

### Busca e filtros

- Campo de busca full-text (nome, CNPJ, nome fantasia)
- Filtros dropdown: categoria, status (ativo/inativo/bloqueado), cidade/UF

### Avaliacao e ranking

- Avaliacao manual a qualquer momento — botao "Avaliar" na ficha do fornecedor (Phase 10 podera sugerir avaliacao apos entrega)
- 4 criterios com pesos iguais (25% cada): prazo, qualidade, preco, atendimento
- Escala de 1 a 5 estrelas por criterio
- Media simples dos 4 criterios = nota final
- Top 3 fornecedores por categoria exibidos na pagina de listagem (cards com nome, estrelas, nota media, numero de avaliacoes)
- Alerta de rating baixo (< 3): badge amarelo/vermelho ao lado do nome durante selecao de fornecedor em cotacao (Phase 9), com tooltip mostrando nota media e numero de avaliacoes. Nao bloqueia, so avisa
- Historico de avaliacoes na ficha do fornecedor (lista com data, notas por criterio, comentario). Relatorio de performance completo (graficos, periodo) postergado para Phase 12

### Exportacao

- CSV: exporta listagem filtrada com BOM UTF-8 (padrao existente do codebase)
- PDF: listagem formatada com cabecalho da org, tabela com dados principais (nome, CNPJ, categorias, status, rating, cidade), filtros aplicados no titulo. Usa PDFKit (padrao do receituario)

### Pagina e navegacao

- Tabela de fornecedores com colunas: Nome/Razao Social, CNPJ/CPF, Categorias (badges), Status (badge colorido), Rating (estrelas), Acoes
- Secao "Top Fornecedores" acima da tabela com select de categoria e 3 cards
- Em mobile: tabela transforma em cards empilhados (design system)
- Sidebar: novo grupo "COMPRAS" com item "Fornecedores" — fases 8-12 adicionam itens ao mesmo grupo

### Claude's Discretion

- Design exato do skeleton loading
- Espacamento e tipografia (seguindo design system)
- Empty state da listagem (ilustracao + CTA)
- Formato exato do template de importacao
- Tratamento de erros de upload
- Ordem dos campos no formulario dentro de cada secao

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — FORN-01 (cadastro), FORN-02 (importacao/busca), FORN-03 (avaliacao/ranking)

### Design system

- `docs/design-system/04-componentes.md` — Specs de modal, botoes, tabela, badges, empty state, formularios
- `docs/design-system/05-padroes-ux.md` — Voz pt-BR, validacao inline, breadcrumb
- `docs/design-system/06-acessibilidade.md` — WCAG AA, focus visible, aria-labels

### Existing patterns

- `apps/backend/src/shared/utils/document-validator.ts` — isValidCPF(), isValidCNPJ() ja implementados
- `apps/backend/src/modules/producers/producers.types.ts` — Modelo similar de entidade com dados fiscais (PF/PJ, IE, endereco)
- `apps/backend/src/modules/pesticide-prescriptions/pesticide-prescriptions.service.ts` — Padrao de export PDF com PDFKit

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `document-validator.ts`: isValidCPF(), isValidCNPJ(), cleanDocument() — reutilizar diretamente para validacao fiscal
- PDFKit: ja instalado e usado no modulo pesticide-prescriptions — reutilizar padrao de geracao PDF
- Padrao CSV export com BOM UTF-8: usado em mastitis, pesticide-applications, composite-products
- Padrao CSV/XLSX import com multer: usado em animals, bulls, mating-plans, feed-ingredients
- ConfirmModal: componente existente para acoes destrutivas (excluir fornecedor)

### Established Patterns

- Backend module: `modules/{domain}/` com service.ts + routes.ts + types.ts + routes.spec.ts
- Frontend: Page + Modal + hook (ex: FarmsPage + FarmFormModal + useFarmForm)
- RLS context: todas as queries via ctx (organizationId) — fornecedor segue mesmo padrao
- Sidebar com grupos: ESTOQUE, FINANCEIRO ja existem — COMPRAS segue mesmo padrao
- Producers module: modelo analogo para entidade com dados fiscais, PF/PJ, endereco

### Integration Points

- `app.ts`: registrar router de suppliers
- `App.tsx`: registrar rota /suppliers com lazy load + ProtectedRoute
- Sidebar: adicionar grupo COMPRAS com item Fornecedores
- Prisma schema: novo modelo Supplier + SupplierCategory + SupplierRating + SupplierDocument
- RBAC: nova permission `purchases:manage` e `purchases:read`

</code_context>

<specifics>
## Specific Ideas

- Categorias de fornecedor devem ser as mesmas usadas como tipo de requisicao de compra na Phase 8 (Insumo Agricola, Pecuario, Pecas, Combustivel, EPI, Servicos) — manter enum compartilhado
- Top 3 fornecedores por categoria inspirado em ranking visual (cards com posicao, estrelas, nota)
- Condicao de pagamento como texto livre com sugestoes permite flexibilidade para condicoes nao-padrao comuns no agro (ex: "pagamento na colheita", "troca por producao")

</specifics>

<deferred>
## Deferred Ideas

- Consulta automatica de CNPJ na Receita Federal para auto-preenchimento — listado em v1.2 (FORN-04)
- Relatorio de performance completo com graficos e filtro por periodo — Phase 12 (Dashboard)
- Vinculacao de avaliacao a entrega especifica — Phase 10 (Recebimento) pode adicionar trigger

</deferred>

---

_Phase: 07-cadastro-de-fornecedores_
_Context gathered: 2026-03-17_
