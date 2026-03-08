# US-037 CA1/CA2/CA5/CA6 — Cadastro de Cultivares

## O que foi feito

### Backend

- **Modelo Prisma `Cultivar`**: nome, cultura, obtentora, ciclo (dias), grupo de maturação, tipo (convencional/transgênico), tecnologia (RR, IPRO, Bt), tolerância a doenças, aptidão regional, população recomendada, janela de plantio, observações do agrônomo
- **Migration**: `20260320200000_add_cultivars`
- **Módulo `cultivars`**: CRUD completo (create, list com paginação/filtros/busca, get, update, delete soft) + endpoint de importação em lote (até 500 registros)
- **Enum `CultivarType`**: CONVENCIONAL, TRANSGENICO
- **Unique constraint**: `(name, crop, organizationId)` para evitar duplicatas
- **Auditoria**: todas as operações logam via `logAudit`

### Frontend

- **Página `CultivarsPage`**: catálogo de cultivares com cards, busca por texto, filtro por cultura, paginação
- **Modal `CultivarModal`**: formulário para criar/editar cultivar com 3 seções (dados básicos, características, observações)
- **Hook `useCultivars`**: data fetching com paginação e filtros
- **Types**: `CultivarItem`, `CreateCultivarInput`, constantes de culturas e tipos
- **Navegação**: link "Cultivares" adicionado ao topbar (ícone Sprout)
- **Rota**: `/cultivars`

## CAs Atendidos

- **CA1**: Cadastro completo de cultivares com todos os campos especificados
- **CA2**: Características técnicas (tolerância, aptidão, população, janela de plantio)
- **CA5**: Endpoint de importação em lote (`POST /org/cultivars/import`)
- **CA6**: Campo de observações e avaliações do agrônomo

## CAs Pendentes

- **CA3**: Vinculação a talhões (histórico de performance) — requer link com `PlotCropSeason`
- **CA4**: Comparativo de produtividade por cultivar
- **CA7**: Tela de catálogo com filtros avançados (parcialmente atendido)
- **CA8**: Gráfico comparativo de produtividade
- **CA9**: Histórico de performance por talhão
