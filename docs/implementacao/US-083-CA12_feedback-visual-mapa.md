# US-083 CA12 — Feedback visual: talhão muda cor no mapa após plantio

## O que foi feito

Implementação do feedback visual em tempo real no mapa quando um plantio é registrado.

## Alterações

### 1. Fix GeoJSON key para re-render (`FarmMap.tsx`)

O `react-leaflet` GeoJSON é imutável — precisa de nova key para re-renderizar. A key agora inclui `currentCrop` e `status`, garantindo que o mapa atualize visualmente após refetch:

```tsx
key={`plot-boundary-${pb.plotId}-${pb.plot.currentCrop ?? 'none'}-${pb.plot.status}-...`}
```

### 2. Status no tooltip do mapa (`FarmMap.tsx`)

O tooltip de cada talhão agora mostra "🌱 Plantado" ou "Disponível".

### 3. Badge de status no painel de detalhes (`PlotDetailsPanel.tsx`)

Quando o talhão tem status `PLANTADO`, exibe badge verde com ícone de planta e nome da cultura.

### 4. Botão "Registrar Plantio" no painel de detalhes (`PlotDetailsPanel.tsx`)

Nova prop `onRegisterPlanting` permite abrir o modal de plantio direto do painel de detalhes do talhão no mapa.

### 5. Integração no mapa (`FarmMapPage.tsx`)

- `PlantingModal` carregado lazy no mapa
- Ao clicar "Registrar Plantio", abre modal com talhão pré-selecionado
- Após sucesso, `refetch()` atualiza dados → GeoJSON re-renderiza com nova cor
- Toast verde confirma "Plantio registrado! O talhão foi atualizado no mapa."

### 6. PlantingModal aceita `farmId` e `preSelectedPlotId` props

- `farmId` prop sobrescreve o FarmContext (necessário pois FarmMapPage usa URL params)
- `preSelectedPlotId` pré-seleciona o talhão no dropdown

## Fluxo do usuário

1. Abre mapa da fazenda → clica no talhão
2. Painel de detalhes abre → clica "Registrar Plantio"
3. Modal abre com talhão pré-selecionado → preenche dados → salva
4. Backend atualiza `status=PLANTADO` e `currentCrop` no talhão
5. Frontend faz refetch → talhão muda de cor instantaneamente
6. Toast confirma a operação

## Arquivos modificados

- `apps/frontend/src/components/map/FarmMap.tsx` — key com currentCrop, status no tooltip
- `apps/frontend/src/components/map/PlotDetailsPanel.tsx` — badge status, botão plantio
- `apps/frontend/src/components/map/PlotDetailsPanel.css` — estilos badge e ações
- `apps/frontend/src/components/planting/PlantingModal.tsx` — props farmId, preSelectedPlotId
- `apps/frontend/src/pages/FarmMapPage.tsx` — integração PlantingModal, toast
- `apps/frontend/src/pages/FarmMapPage.css` — estilo toast
