# Animações & Micro-interações

## Princípio: Propósito > Decoração

Toda animação deve servir a pelo menos um propósito:

1. **Orientar** — mostrar de onde algo veio e para onde vai
2. **Informar** — comunicar estado (loading, sucesso, erro)
3. **Conectar** — criar continuidade entre estados da UI

---

## Curvas de Timing

| Token           | Valor                               | Uso                             |
| --------------- | ----------------------------------- | ------------------------------- |
| `--ease-out`    | `cubic-bezier(0.33, 1, 0.68, 1)`    | Entradas (elementos aparecendo) |
| `--ease-in`     | `cubic-bezier(0.32, 0, 0.67, 0)`    | Saídas (elementos saindo)       |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)`    | Movimentos contínuos            |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Micro-interações (bounce sutil) |

## Durações

| Token                | Valor | Uso                                    |
| -------------------- | ----- | -------------------------------------- |
| `--duration-instant` | 100ms | Hover, focus, toggle                   |
| `--duration-fast`    | 200ms | Tooltips, dropdowns                    |
| `--duration-normal`  | 300ms | Modals, sidebars, transições de página |
| `--duration-slow`    | 500ms | Animações complexas, stagger           |

---

## Animações Padrão

### Page Transition (Web)

```css
.page-enter {
  opacity: 0;
  transform: translateY(8px);
}
.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all var(--duration-normal) var(--ease-out);
}
```

### Card Hover

```css
.card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all var(--duration-fast) var(--ease-out);
}
```

### Button Press

```css
.button:active {
  transform: scale(0.97);
  transition: transform var(--duration-instant) var(--ease-in);
}
```

### Toast Enter

```css
.toast-enter {
  opacity: 0;
  transform: translateX(100%);
}
.toast-enter-active {
  opacity: 1;
  transform: translateX(0);
  transition: all var(--duration-normal) var(--ease-spring);
}
```

### Skeleton Pulse

```css
@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.7;
  }
}

.skeleton {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  background: var(--color-neutral-200);
  border-radius: 4px;
}
```

---

## Mobile (React Native)

### Transições de Tela

```tsx
// Stack Navigator — slide horizontal (padrão)
// Modal — slide vertical de baixo

// Shared element transition para card → detalhe (futuro)
```

### Press Feedback

```tsx
// Todos os Touchable usam feedback
<Pressable
  style={({ pressed }) => [styles.card, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
/>
```

### Pull to Refresh

Usar o componente nativo `RefreshControl` — não customizar a animação.

---

## O que NÃO animar

- Texto mudando de conteúdo (números podem contar, texto não)
- Scroll (usar scroll nativo, nunca hijack)
- Layout shifts após carregamento (CLS = 0)
- Elementos que o usuário não pediu para interagir
- Decorações que não adicionam informação

---

## Reduced Motion

Sempre respeitar a preferência do sistema:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Em React Native:

```tsx
import { AccessibilityInfo } from 'react-native';

// Verificar preferência
const isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
```
