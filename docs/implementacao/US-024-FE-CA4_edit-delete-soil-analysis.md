# US-024-FE CA4: Editar/excluir análise de solo

## O quê

Funcionalidade de edição e exclusão de análises de solo na aba "Solo" do painel de histórico do talhão. Inline edit via modal e exclusão com confirmação inline.

## Por quê

Permitir que o usuário corrija dados de análises inseridas com erro ou remova análises duplicadas/inválidas, completando o CRUD de análises de solo no frontend.

## Arquivos criados

| Arquivo                          | Descrição                                           |
| -------------------------------- | --------------------------------------------------- |
| `EditSoilAnalysisModal.tsx`      | Modal de edição com form pré-preenchido (15 campos) |
| `EditSoilAnalysisModal.css`      | Estilos BEM (mesmo padrão do AddSoilAnalysisModal)  |
| `EditSoilAnalysisModal.spec.tsx` | 11 testes unitários                                 |

## Arquivos modificados

| Arquivo                | Alteração                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `types/farm.ts`        | +`UpdateSoilAnalysisPayload` interface (campos nullable para clear)                                                                 |
| `PlotSoilTable.tsx`    | +props `onEdit`/`onDelete`, botões Pencil/Trash2 por linha (desktop+mobile)                                                         |
| `PlotSoilTable.css`    | +estilos `.soil-table__actions`, `.soil-table__action-btn`, `.soil-card__actions`                                                   |
| `PlotHistoryPanel.tsx` | +lazy import EditSoilAnalysisModal, +state editingAnalysis/deletingAnalysis, +handleDeleteAnalysis, +confirmação inline no tab Solo |

## Endpoints consumidos

| Método | Endpoint                                                     | Uso     |
| ------ | ------------------------------------------------------------ | ------- |
| PATCH  | `/org/farms/:farmId/plots/:plotId/soil-analyses/:analysisId` | Editar  |
| DELETE | `/org/farms/:farmId/plots/:plotId/soil-analyses/:analysisId` | Excluir |

## Componentes

### EditSoilAnalysisModal

- Mesmo layout do AddSoilAnalysisModal (overlay + header + body scrollable + footer)
- Pré-preenche todos os 15 campos com dados da análise existente
- Campos nullable: ao limpar um campo numérico, envia `null` no payload
- Validação idêntica ao Add: data obrigatória, pH 0-14, MO/V%/Argila 0-100%
- Submit: `PATCH /org/farms/:farmId/plots/:plotId/soil-analyses/:analysisId`
- Fecha com Escape ou click no overlay

### PlotSoilTable (atualizado)

- Props opcionais `onEdit` e `onDelete` (backwards-compatible)
- Coluna "Ações" visível apenas quando callbacks presentes
- Desktop: botões 32x32px (Pencil + Trash2) na última coluna
- Mobile: botões no header do card, ao lado do lab name
- Hover: Pencil→neutral-700, Trash2→error-500

### PlotHistoryPanel (atualizado)

- `editingAnalysis` state → abre EditSoilAnalysisModal (lazy)
- `deletingAnalysis` state → confirmação inline (mesmo padrão das safras)
- `handleDeleteAnalysis` → DELETE endpoint + refetch

## Testes

- 11 novos testes em EditSoilAnalysisModal.spec.tsx
- Total frontend: 568 testes passando (62 arquivos)
