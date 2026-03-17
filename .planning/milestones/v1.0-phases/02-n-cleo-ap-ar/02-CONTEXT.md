# Phase 2: Núcleo AP/AR - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Contas a pagar e contas a receber com ciclo completo: lançamento com parcelamento e rateio por centro de custo, baixa (individual e em lote) com juros/multa/desconto e estorno, geração de CNAB 240/400 (BB + Sicoob), importação de retorno bancário com preview, aging por faixas de vencimento com alertas (badge + lista), e calendário financeiro mensal. Também adiciona campos de convênio CNAB ao cadastro de conta bancária (migration extra).

</domain>

<decisions>
## Implementation Decisions

### CNAB Remessa/Retorno

- Suportar **BB (001) + Sicoob (756)** como bancos iniciais
- Suportar **ambos formatos**: CNAB 240 e CNAB 400
- Interface de adapter por banco (bank-adapter pattern) para permitir outros bancos no futuro
- Import de retorno: **upload + preview** — upload do arquivo, preview dos títulos encontrados, confirmar baixa automática
- Campos de convênio CNAB adicionados à BankAccount via **migration extra** (convenioCode, carteira, variacao — opcionais)

### Rateio por Centro de Custo

- Suportar **ambos modos**: percentual e valor fixo — usuário escolhe por lançamento
- Em modo percentual: sistema calcula valores. Em modo valor fixo: soma deve bater com total
- Centro de custo e fazenda obrigatórios em CP e CR

### Parcelamento

- Geração automática com **personalização** — gera N parcelas com mesmo valor e vencimentos mensais, mas permite editar valor e data de cada parcela antes de salvar
- Diferença de centavos no arredondamento vai para a **primeira parcela** (não a última)
- Todas as parcelas usam Money type (decimal.js) para aritmética

### Recorrência

- **Template mensal** — criar recorrência que gera CP automaticamente todo mês com mesmo valor/fornecedor
- Data de fim opcional (indefinido por padrão)
- Frequências: mensal, quinzenal, semanal

### Aging e Alertas

- Canais: **badge no sidebar** (número de títulos vencidos) + **lista de alertas** na página de CP
- Sem email/push nesta fase
- Visualização aging: **tabela com totais** por faixa (7/15/30/60/90/>90/vencidas) — clicável para ver títulos da faixa
- **Calendário financeiro mensal** com dots nos dias com vencimento — click no dia mostra títulos

### Layout CP/CR

- **Páginas separadas**: PayablesPage (`/payables`) e ReceivablesPage (`/receivables`)
- Baixa de pagamento: **modal** — seleciona título(s) → botão "Baixar" → modal com data, valor, conta, juros/multa/desconto
- Sidebar FINANCEIRO com **3 itens**: Contas bancárias | A Pagar | A Receber (calendário como tab/view dentro de CP)

### Claude's Discretion

- Design exato das tabelas de CP/CR (colunas, ordem, responsividade)
- Implementação do calendário (biblioteca ou custom component)
- Layout do modal de baixa em lote (bordero)
- Formato visual do badge de alertas no sidebar
- Categorias pré-definidas de CP (insumos, manutenção, folha, etc.) e CR (venda grãos, gado, leite, arrendamento)

</decisions>

<specifics>
## Specific Ideas

- Baixa com juros/multa/desconto: valor efetivo = original + juros + multa - desconto. Juros/multa como despesa financeira, desconto como receita financeira
- Baixa em lote (bordero): selecionar múltiplos títulos, baixar todos da mesma conta bancária
- Estorno de baixa: desfazer pagamento por engano (reverte saldo da conta e status do título)
- FUNRURAL: campo específico no CR de venda rural — percentual retido pelo comprador na NF
- Saldo projetado nas contas bancárias: agora que CP/CR existem, atualizar a UI das contas para mostrar projeção real (7/15/30/60/90 dias)

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `Money` type (`packages/shared/src/types/money.ts`): decimal.js wrapper para toda aritmética monetária — reutilizar em CP/CR
- `BankAccountBalance` aggregate pattern: modelo para atualização atômica de saldo após baixa
- `FinancialTransaction` ledger: cada baixa gera uma transaction na conta bancária
- `FEBRABAN_BANKS` / `FEBRABAN_BANK_MAP`: lookup de banco para CNAB adapter
- Export pattern (pdfkit/exceljs): reutilizar para export de CP/CR e borderô
- `BankAccountModal` pattern: modal de CRUD com validação inline — reutilizar para PayableModal/ReceivableModal

### Established Patterns

- Módulos backend colocalizados: `modules/payables/` e `modules/receivables/` com routes/service/types/spec
- Frontend: Page separada + Modal para CRUD (conforme CLAUDE.md)
- RLS por organização em todas as queries
- Alertas existentes: `modules/stock-alerts/` como referência para aging/alertas de CP

### Integration Points

- `apps/backend/src/app.ts`: registrar `payablesRouter` e `receivablesRouter`
- `apps/frontend/src/App.tsx`: rotas `/payables` e `/receivables`
- `apps/frontend/src/components/layout/Sidebar.tsx`: adicionar itens "A Pagar" e "A Receber" ao grupo FINANCEIRO
- Baixa de CP/CR deve atualizar `BankAccountBalance` e criar `FinancialTransaction` na conta selecionada
- Badge de alertas no sidebar: integrar com contagem de títulos vencidos

</code_context>

<deferred>
## Deferred Ideas

- Saldo projetado nas contas bancárias (atualizar UI do Phase 1 com dados reais de CP/CR) — pode ser feito como parte desta phase ou como refinamento posterior
- PDD (Provisão para Devedores Duvidosos) automática — mencionada no FN-12, implementar como cálculo simples por faixa de aging

</deferred>

---

_Phase: 02-n-cleo-ap-ar_
_Context gathered: 2026-03-16_
