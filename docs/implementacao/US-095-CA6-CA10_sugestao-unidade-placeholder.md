# US-095 CA6 + CA10 — Sugestão de Unidade por Tipo de Produto e Placeholder Dinâmico

## O que foi feito

### CA6 — Sugestão automática de unidade de dose por tipo de produto

Quando o usuário busca e seleciona um produto do estoque nos formulários de operação, o sistema
automaticamente sugere a unidade de dose mais adequada com base no tipo do produto:

| Tipo do Produto                                          | Unidade Sugerida |
| -------------------------------------------------------- | ---------------- |
| Defensivos (herbicida, inseticida, fungicida, acaricida) | L/ha             |
| Adjuvante                                                | L/ha             |
| Fertilizante granulado                                   | kg/ha            |
| Fertilizante líquido / fertirrigação                     | L/ha             |
| Fertilizante foliar                                      | mL/ha            |
| Calcário                                                 | t/ha             |
| Gesso                                                    | kg/ha            |
| Semente, inoculante, biológico                           | kg/ha            |

**Implementação:** `suggestDoseUnit(productType, nutrientForm?)` em `apps/frontend/src/utils/dose-conversion.ts`

### CA10 — Placeholder dinâmico no campo de dose

O placeholder do campo de dose muda conforme a unidade selecionada e o tipo do produto:

- L/ha (defensivo): "Ex: 2,5"
- kg/ha (fertilizante): "Ex: 200"
- kg/ha (semente): "Ex: 60"
- mL/ha: "Ex: 150"
- t/ha: "Ex: 2,0"
- g/planta: "Ex: 50"

**Implementação:** `getDosePlaceholder(doseUnit, productType?)` em `apps/frontend/src/utils/dose-conversion.ts`

### ProductSearchInput — Componente compartilhado de busca de produto

Novo componente de autocomplete que busca produtos cadastrados no estoque via API
(`GET /org/products?search=X&nature=PRODUCT&status=ACTIVE`).

**Funcionalidades:**

- Busca com debounce de 300ms (mínimo 2 caracteres)
- Dropdown com tipo do produto e forma do nutriente
- Vinculação visual ao estoque (borda verde + badge "Vinculado ao estoque")
- Navegação por teclado (setas + Enter + Escape)
- O usuário pode digitar livremente sem vincular (retrocompatível)
- Ao selecionar produto: auto-preenche nome, seta productId, sugere doseUnit

**Arquivos:**

- `apps/frontend/src/components/shared/ProductSearchInput.tsx`
- `apps/frontend/src/components/shared/ProductSearchInput.css`

### Integração nos modais

1. **PesticideApplicationModal** — productName substituído por ProductSearchInput
2. **FertilizerApplicationModal** — productName substituído por ProductSearchInput
3. **SoilPrepModal** — cada input de insumo agora tem ProductSearchInput

Em todos os casos, o productId é enviado no payload quando vinculado.

## Por que

- **CA6:** Reduz erro do operador ao preencher unidade de dose — a sugestão automática evita
  confusão entre L/ha e kg/ha, especialmente para produtos líquidos vs sólidos.
- **CA10:** O placeholder contextual dá referência visual do valor esperado, agilizando o
  preenchimento e reduzindo erros de magnitude (ex: digitar 200 quando deveria ser 2,0).
- **ProductSearchInput:** Vincula operações ao cadastro de estoque, permitindo rastreabilidade
  e futura baixa automática mais precisa.
