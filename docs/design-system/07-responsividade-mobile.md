# Responsividade & Mobile

## Abordagem: Mobile-First

Estilos base escritos para mobile, progressivamente aprimorados para telas maiores.

---

## Breakpoints de Referência

| Token   | Largura | Alvo                               |
| ------- | ------- | ---------------------------------- |
| default | <640px  | Celulares (320–639px)              |
| `sm`    | ≥640px  | Celular landscape / tablet pequeno |
| `md`    | ≥768px  | Tablet portrait                    |
| `lg`    | ≥1024px | Tablet landscape / desktop         |
| `xl`    | ≥1280px | Desktop                            |
| `2xl`   | ≥1536px | Monitor grande                     |

---

## Adaptações por Breakpoint

### Sidebar

| Breakpoint | Comportamento                       |
| ---------- | ----------------------------------- |
| <1024px    | Escondida, abre como drawer overlay |
| ≥1024px    | Colapsada (64px, ícones)            |
| ≥1280px    | Expandida (240px, ícones + texto)   |

### Tabela → Cards

| Breakpoint | Componente                                   |
| ---------- | -------------------------------------------- |
| <768px     | Cards empilhados verticalmente               |
| ≥768px     | Tabela com scroll horizontal (se necessário) |
| ≥1024px    | Tabela completa                              |

### KPI Grid

| Breakpoint | Layout                     |
| ---------- | -------------------------- |
| <640px     | 2 colunas, scroll vertical |
| 640–1023px | 3 colunas                  |
| ≥1024px    | 4 colunas em linha         |

### Formulários

| Breakpoint | Layout                                            |
| ---------- | ------------------------------------------------- |
| <640px     | Campos full-width, empilhados                     |
| ≥640px     | 2 colunas para campos curtos (nome + sobrenome)   |
| ≥1024px    | 2-3 colunas, largura controlada (max-width 800px) |

---

## Web vs Mobile App

### O que COMPARTILHAM (via @protos-farm/shared)

- Tokens de cor (hex values)
- Escala tipográfica (valores em px/rem)
- Escala de espaçamento
- Regras de validação
- Tipos TypeScript
- Constantes de negócio

### O que DIFERE

| Aspecto    | Web (React)              | Mobile (React Native)     |
| ---------- | ------------------------ | ------------------------- |
| Layout     | CSS Grid/Flex            | Flexbox (default column)  |
| Navegação  | Sidebar + Breadcrumb     | Bottom Tab + Stack        |
| Toque      | Click + hover states     | Touch + press states      |
| Tipografia | CSS `rem`                | RN `fontSize` em `number` |
| Ícones     | SVG inline ou icon font  | `@expo/vector-icons`      |
| Mapas      | Leaflet ou Mapbox GL JS  | `react-native-maps`       |
| Scroll     | Scroll nativo            | FlatList / ScrollView     |
| Animação   | CSS transitions / Framer | Reanimated / RN Animated  |

---

## Padrões Touch (Mobile)

### Gestos

| Gesto      | Ação                                      |
| ---------- | ----------------------------------------- |
| Tap        | Ação principal (equivale a click)         |
| Long press | Menu contextual (ações secundárias)       |
| Swipe left | Revelar ações (editar, excluir) em listas |
| Swipe down | Pull-to-refresh                           |
| Pinch      | Zoom em mapas e imagens                   |

### Áreas de Toque

```
┌──────────────────────┐
│                      │  Zona de alcance fácil (polegar)
│   Difícil (evitar    │  ← Em telas >5.5", canto superior
│    ações aqui)       │     esquerdo é difícil de alcançar
│                      │
│                      │
│  ┌────────────────┐  │
│  │ Zona confortável│  │  ← Ações primárias aqui
│  │                │  │
│  └────────────────┘  │
│  [Tab] [Tab] [Tab]   │  ← Bottom nav: acesso imediato
└──────────────────────┘
```

### Feedback Tátil

- Botões: feedback visual imediato (opacity ou scale no press)
- Ações destrutivas: vibração leve (Haptics) como aviso
- Sucesso de operação: vibração de confirmação

---

## Performance Responsiva

### Imagens

- Formato WebP para web, com fallback JPEG
- `srcset` para servir tamanhos adequados ao viewport
- Lazy loading para imagens fora da viewport
- Placeholder blur-up (LQIP) enquanto carrega

### Dados

- Paginação server-side (nunca trazer todos os registros)
- Infinite scroll com virtualização em listas longas (>50 itens)
- Skeleton screens durante carregamento
- Prefetch de dados da próxima página provável

### Bundle

- Code splitting por rota (React.lazy + Suspense)
- Componentes pesados (mapa, gráficos) carregados sob demanda
- Service worker para cache de assets estáticos (PWA futuro)

---

## Safe Areas (Mobile)

```tsx
import { SafeAreaView } from 'react-native-safe-area-context';

// ✓ Sempre usar SafeAreaProvider no root
<SafeAreaProvider>
  <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
    <App />
  </SafeAreaView>
</SafeAreaProvider>;
```

### Considerações

- **iPhone notch**: 47px top inset
- **iPhone home indicator**: 34px bottom inset
- **Android navigation bar**: variável, usar SafeArea
- **Bottom tabs**: posicionar acima do safe area bottom
- **Teclado**: usar `KeyboardAvoidingView` em formulários

---

## Orientação de Tela

| Plataforma       | Orientação                         |
| ---------------- | ---------------------------------- |
| Mobile (celular) | Portrait only (bloquear landscape) |
| Mobile (tablet)  | Ambas orientações                  |
| Web              | Ambas, responsivo                  |

Exceção: **Mapa fullscreen** pode permitir landscape em celular.
