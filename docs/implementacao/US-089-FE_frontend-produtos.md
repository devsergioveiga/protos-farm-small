# US-089 FE — Frontend Produtos, Insumos e Serviços

## O que foi implementado

Frontend completo para CRUD de produtos, insumos e serviços (US-089), consumindo a API backend já existente.

## Arquivos criados

| Arquivo                                    | Descrição                                                    |
| ------------------------------------------ | ------------------------------------------------------------ |
| `src/hooks/useProducts.ts`                 | Hook de data fetching com filtros, paginação e busca         |
| `src/pages/ProductsPage.tsx`               | Página principal com tabs Produtos/Serviços, tabela, filtros |
| `src/pages/ProductsPage.css`               | Estilos da página seguindo design system                     |
| `src/components/products/ProductModal.tsx` | Modal de criação/edição com campos condicionais por tipo     |
| `src/components/products/ProductModal.css` | Estilos do modal                                             |

## Arquivos modificados

| Arquivo                             | Alteração                                        |
| ----------------------------------- | ------------------------------------------------ |
| `src/App.tsx`                       | Rota `/products` com lazy loading                |
| `src/components/layout/Sidebar.tsx` | Item "Produtos e serviços" no grupo CONFIGURAÇÃO |

## Funcionalidades

- **Tabs Produtos/Serviços**: alternância de natureza com filtros independentes
- **Busca debounced** (300ms) por nome
- **Filtros**: tipo, status
- **Tabela responsiva**: cards empilhados em mobile
- **Modal adaptativo**: campos condicionais baseados em natureza e tipo
  - Produto: nome comercial, fabricante, unidade de medida, código de barras
  - Serviço: unidade de cobrança, custo, frequência, agendamento
  - Composição: lista dinâmica de ingredientes ativos (CA7)
  - Defensivos: registro MAPA, toxicidade, classe ambiental, carência (CA8)
  - Fertilizantes: NPK, forma, solubilidade (CA9)
  - Sementes: peneira, tratamento, germinação, pureza (CA12)
  - Medicamentos vet.: classe terapêutica, via, carências, receituário (CA11)
- **Paginação** com controles anterior/próxima
- **Empty states** com ícone e mensagem contextual
- **Skeleton loading** durante carregamento

## Por quê

A US-089 backend já estava completa (CA1-CA12, 48 testes, PR #171). O frontend permite aos usuários gerenciar o cadastro de produtos e serviços através da interface web, essencial para o EPIC-10 de Estoque de Insumos.
