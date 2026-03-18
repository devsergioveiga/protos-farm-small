# US-095 CA11 + CA12 — Conversões por produto (UI) e alerta de validação

**Data:** 2026-03-13

## CA11 — Tela de conversões por produto (tabela editável)

### O que foi feito

Modal acessível a partir da listagem de produtos (botão ArrowRightLeft na coluna de ações), com duas abas:

**Aba "Unidades":**

- Configura unidades de compra, estoque e aplicação do produto (ProductUnitConfig)
- Campo de densidade g/mL para conversões peso↔volume
- Cria ou atualiza configuração com feedback visual

**Aba "Conversões":**

- Lista conversões específicas do produto (ProductConversion)
- Adicionar nova conversão: seleciona unidades de/para, fator, descrição
- Excluir conversão (com conversão reversa automática pelo backend)
- Empty state quando não há configuração ou conversões
- Mostra contagem de conversões

### Arquivos criados

- `apps/frontend/src/components/products/ProductConversionsModal.tsx`
- `apps/frontend/src/components/products/ProductConversionsModal.css`

### Arquivos modificados

- `apps/frontend/src/pages/ProductsPage.tsx` — botão ArrowRightLeft + modal integration

## CA12 — Alerta inline quando conversão não está configurada

### O que foi feito

O ConversionPreviewCard agora aceita `productId` opcional. Quando um produto está vinculado, valida a conversão via `GET /org/unit-conversions/validate` e exibe:

- Alerta com ícone AlertTriangle (warning) e mensagem do backend
- Link "Configurar conversão" que navega para `/measurement-units`
- Estilo visual warning (borda amarela, fundo warm)
- O alerta aparece mesmo quando a quantidade total ainda não foi calculada

### Arquivos modificados

- `apps/frontend/src/components/shared/ConversionPreviewCard.tsx` — prop `productId`, useEffect de validação, render condicional do warning
- `apps/frontend/src/components/shared/ConversionPreviewCard.css` — estilos `--warning`
- `apps/frontend/src/components/pesticide-applications/PesticideApplicationModal.tsx` — passa `productId`
- `apps/frontend/src/components/fertilizer-applications/FertilizerApplicationModal.tsx` — passa `productId`
- `apps/frontend/src/components/soil-prep/SoilPrepModal.tsx` — passa `productId`

## Testes

- Frontend: 883 testes (89 suites) — todos passando
- Backend: 1373 testes (62 suites) — todos passando
