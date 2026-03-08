# US-036 CA2 — Seleção de talhão via mapa, lista ou auto-detecção GPS

## O que foi feito

Implementação das 3 formas de selecionar talhão/pasto no formulário de registro rápido:

1. **Lista** (CA1) — Modal com FlatList de talhões + pastos + instalações do DB offline
2. **Auto-detecção GPS** (CA1) — pointInPolygon detecta automaticamente o local baseado na posição do usuário
3. **Mapa interativo** (CA2) — Modal fullscreen com mapa da fazenda, polígonos tappable e botão de confirmação

## Por quê

O produtor no campo precisa de formas rápidas e intuitivas de informar onde a operação foi realizada. A auto-detecção GPS é a mais rápida. A lista é a mais simples. O mapa é a mais visual e precisa quando o GPS não detecta automaticamente.

## Arquivos criados/modificados

### Novo componente

- `components/register/LocationMapPicker.tsx` — Mapa fullscreen para seleção de local

### Modificado

- `app/(app)/(tabs)/register.tsx` — Botão "Selecionar no mapa" + Modal do map picker

## Detalhes do LocationMapPicker

- Renderiza boundary da fazenda + polígonos de talhões/pastos/instalações
- Polígonos são tappable — ao tocar, destaca com cor primária e mostra card de seleção
- Card de seleção mostra: nome, tipo (Talhão/Pasto/Instalação), área em ha
- Botão "Confirmar" retorna `{ id, name, type }` para o formulário
- Usa tiles offline quando disponíveis (reuso do tile cache do mapa principal)
- Cores de polígono seguem padrão do mapa principal (crop colors, pasture/facility colors)
- Top bar com título "Selecionar no mapa" e botão fechar
- Acessibilidade completa
