# Espaçamento & Grid

## Escala de Espaçamento

Base de 4px (múltiplos consistentes):

| Token        | Valor | Uso Típico                          |
| ------------ | ----- | ----------------------------------- |
| `--space-0`  | 0px   | Reset                               |
| `--space-1`  | 4px   | Gap mínimo entre ícone e texto      |
| `--space-2`  | 8px   | Padding interno de badges, chips    |
| `--space-3`  | 12px  | Gap entre itens em lista compacta   |
| `--space-4`  | 16px  | Padding de inputs, gap padrão       |
| `--space-5`  | 20px  | Margem entre campos de formulário   |
| `--space-6`  | 24px  | Padding de cards                    |
| `--space-8`  | 32px  | Gap entre seções internas           |
| `--space-10` | 40px  | Margem entre componentes            |
| `--space-12` | 48px  | Padding lateral de página (desktop) |
| `--space-16` | 64px  | Espaço entre seções de página       |
| `--space-20` | 80px  | Margem superior de página           |
| `--space-24` | 96px  | Separação de blocos grandes         |

---

## Grid System

### Web (Desktop)

```
Container: max-width 1280px, centered
Colunas: 12
Gutter: 24px (--space-6)
Margem lateral: 48px (--space-12)
```

### Web (Tablet: 640–1024px)

```
Container: fluid, 100%
Colunas: 8
Gutter: 16px (--space-4)
Margem lateral: 24px (--space-6)
```

### Web (Mobile: <640px)

```
Container: fluid, 100%
Colunas: 4
Gutter: 16px (--space-4)
Margem lateral: 16px (--space-4)
```

### Mobile App (React Native)

```
Padding horizontal: 16px (--space-4)
Gap entre cards: 12px (--space-3)
Padding de card: 16px (--space-4)
Safe area: respeitada via SafeAreaView
```

---

## Breakpoints

| Nome  | Largura | Target                            |
| ----- | ------- | --------------------------------- |
| `sm`  | 640px   | Mobile landscape, tablet portrait |
| `md`  | 768px   | Tablet                            |
| `lg`  | 1024px  | Desktop pequeno                   |
| `xl`  | 1280px  | Desktop padrão                    |
| `2xl` | 1536px  | Monitor grande                    |

---

## Layouts Comuns

### Dashboard (Desktop)

```
┌──────────────────────────────────────────┐
│  Topbar (64px height)                    │
├─────────┬────────────────────────────────┤
│ Sidebar │  Content Area                  │
│  (240px)│  ┌────────┐ ┌────────┐        │
│         │  │ KPI    │ │ KPI    │ ...    │
│         │  └────────┘ └────────┘        │
│         │  ┌─────────────────────┐      │
│         │  │ Main Content        │      │
│         │  │                     │      │
│         │  └─────────────────────┘      │
│         │                                │
└─────────┴────────────────────────────────┘
```

### Dashboard (Mobile)

```
┌──────────────────┐
│  Topbar (56px)   │
├──────────────────┤
│  KPI (scroll-x)  │
├──────────────────┤
│                  │
│  Content (stack) │
│                  │
│                  │
├──────────────────┤
│  Bottom Nav      │
│  (64px + safe)   │
└──────────────────┘
```

### Formulário

```
┌──────────────────────────────────────────┐
│  Page Header (título + breadcrumb)       │
├──────────────────────────────────────────┤
│  Seção 1 (label)                         │
│  ┌─────────────────┐ ┌────────────────┐ │
│  │ Campo           │ │ Campo          │ │
│  └─────────────────┘ └────────────────┘ │
│  ┌──────────────────────────────────────┐│
│  │ Campo largo                         ││
│  └──────────────────────────────────────┘│
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  Seção 2 (label)                         │
│  ┌──────────────────────────────────────┐│
│  │ Mapa / Seleção de área              ││
│  └──────────────────────────────────────┘│
├──────────────────────────────────────────┤
│  [Cancelar]              [Salvar] (CTA)  │
└──────────────────────────────────────────┘
```

---

## Regras de Espaçamento

1. **Sempre usar tokens** — nunca valores arbitrários (ex: `margin: 13px`)
2. **Consistência vertical** — espaço entre seções > espaço entre componentes > espaço interno
3. **Touch targets mínimos** — 48x48px em mobile (WCAG 2.5.8)
4. **Padding de input** — mínimo 12px vertical, 16px horizontal
5. **Cards nunca encostam na borda** — sempre respeitar margem lateral
6. **Bottom nav em mobile** — considerar safe area do iPhone (34px extra)
