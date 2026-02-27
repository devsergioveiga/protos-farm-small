# Tokens de Implementação

## CSS Custom Properties (Web)

Arquivo base: `apps/frontend/src/styles/tokens.css`

```css
:root {
  /* ═══════════════════════════════════════════
     CORES — Brand
     ═══════════════════════════════════════════ */
  --color-primary-50: #e8f5e9;
  --color-primary-100: #c8e6c9;
  --color-primary-200: #a5d6a7;
  --color-primary-300: #81c784;
  --color-primary-400: #66bb6a;
  --color-primary-500: #388e3c;
  --color-primary-600: #2e7d32;
  --color-primary-700: #1b5e20;
  --color-primary-800: #145218;
  --color-primary-900: #0d3b10;

  /* ═══════════════════════════════════════════
     CORES — Neutral (Terra)
     ═══════════════════════════════════════════ */
  --color-neutral-0: #ffffff;
  --color-neutral-50: #fafaf8;
  --color-neutral-100: #f5f3ef;
  --color-neutral-200: #e8e4dd;
  --color-neutral-300: #d4cec4;
  --color-neutral-400: #a8a196;
  --color-neutral-500: #7a7267;
  --color-neutral-600: #5c554c;
  --color-neutral-700: #3e3833;
  --color-neutral-800: #2a2520;
  --color-neutral-900: #1a1613;

  /* ═══════════════════════════════════════════
     CORES — Accent
     ═══════════════════════════════════════════ */
  --color-sky-100: #b3e5fc;
  --color-sky-500: #0288d1;
  --color-earth-100: #d7ccc8;
  --color-earth-500: #8d6e63;
  --color-sun-100: #fff9c4;
  --color-sun-500: #f9a825;

  /* ═══════════════════════════════════════════
     CORES — Semânticas
     ═══════════════════════════════════════════ */
  --color-success-100: #e8f5e9;
  --color-success-500: #2e7d32;
  --color-warning-100: #fff8e1;
  --color-warning-500: #f57f17;
  --color-error-100: #ffebee;
  --color-error-500: #c62828;
  --color-info-100: #e1f5fe;
  --color-info-500: #0277bd;

  /* ═══════════════════════════════════════════
     CORES — Estado Offline/Sync
     ═══════════════════════════════════════════ */
  --color-offline: #78909c;
  --color-syncing: #ffb300;
  --color-synced: #43a047;

  /* ═══════════════════════════════════════════
     TIPOGRAFIA
     ═══════════════════════════════════════════ */
  --font-display: 'DM Sans', system-ui, sans-serif;
  --font-body: 'Source Sans 3', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --text-xs: 0.75rem; /* 12px */
  --text-sm: 0.875rem; /* 14px */
  --text-base: 1rem; /* 16px */
  --text-md: 1.125rem; /* 18px */
  --text-lg: 1.25rem; /* 20px */
  --text-xl: 1.5rem; /* 24px */
  --text-2xl: 1.875rem; /* 30px */
  --text-3xl: 2.25rem; /* 36px */
  --text-4xl: 3rem; /* 48px */

  --leading-tight: 1.2;
  --leading-snug: 1.3;
  --leading-normal: 1.5;

  --font-regular: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* ═══════════════════════════════════════════
     ESPAÇAMENTO
     ═══════════════════════════════════════════ */
  --space-0: 0;
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem; /* 8px */
  --space-3: 0.75rem; /* 12px */
  --space-4: 1rem; /* 16px */
  --space-5: 1.25rem; /* 20px */
  --space-6: 1.5rem; /* 24px */
  --space-8: 2rem; /* 32px */
  --space-10: 2.5rem; /* 40px */
  --space-12: 3rem; /* 48px */
  --space-16: 4rem; /* 64px */
  --space-20: 5rem; /* 80px */
  --space-24: 6rem; /* 96px */

  /* ═══════════════════════════════════════════
     BORDAS & SOMBRAS
     ═══════════════════════════════════════════ */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 8px 24px rgba(0, 0, 0, 0.12);

  /* ═══════════════════════════════════════════
     ANIMAÇÃO
     ═══════════════════════════════════════════ */
  --ease-out: cubic-bezier(0.33, 1, 0.68, 1);
  --ease-in: cubic-bezier(0.32, 0, 0.67, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  --duration-instant: 100ms;
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;

  /* ═══════════════════════════════════════════
     LAYOUT
     ═══════════════════════════════════════════ */
  --container-max: 1280px;
  --sidebar-width: 240px;
  --sidebar-collapsed: 64px;
  --topbar-height: 64px;
  --bottomnav-height: 56px;
}

/* ═══════════════════════════════════════════
   REDUCED MOTION
   ═══════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Tokens TypeScript (Shared)

Arquivo: `packages/shared/src/constants/design-tokens.ts`

Estes tokens são usados tanto no web (Tailwind config, CSS-in-JS) quanto no mobile (StyleSheet).

```typescript
export const colors = {
  primary: {
    50: '#E8F5E9',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#388E3C',
    600: '#2E7D32',
    700: '#1B5E20',
    800: '#145218',
    900: '#0D3B10',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAF8',
    100: '#F5F3EF',
    200: '#E8E4DD',
    300: '#D4CEC4',
    400: '#A8A196',
    500: '#7A7267',
    600: '#5C554C',
    700: '#3E3833',
    800: '#2A2520',
    900: '#1A1613',
  },
  success: { 100: '#E8F5E9', 500: '#2E7D32' },
  warning: { 100: '#FFF8E1', 500: '#F57F17' },
  error: { 100: '#FFEBEE', 500: '#C62828' },
  info: { 100: '#E1F5FE', 500: '#0277BD' },
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  md: 18,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 36,
  '4xl': 48,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;
```

---

## Uso no React Native

```tsx
import { colors, spacing, fontSize } from '@protos-farm/shared';
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    padding: spacing[4], // 16px
    backgroundColor: colors.neutral[0],
  },
  title: {
    fontSize: fontSize['2xl'], // 30
    color: colors.neutral[800],
    fontFamily: 'DMSans-Bold',
  },
  card: {
    padding: spacing[6], // 24
    borderRadius: 12,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
});
```

---

## Recomendação de Stack CSS (Web)

| Opção                          | Prós                                    | Contras                       |
| ------------------------------ | --------------------------------------- | ----------------------------- |
| **Tailwind CSS** (recomendado) | Rápido, tokens via config, tree-shaking | Classes longas no JSX         |
| CSS Modules                    | Escopo local, CSS puro                  | Mais verboso, sem utilitários |
| Vanilla Extract                | Type-safe, zero runtime                 | Setup complexo                |

**Recomendação: Tailwind CSS** — mapear tokens para `tailwind.config.ts`, usar classes utilitárias com componentes React. Combina velocidade de desenvolvimento com consistência de tokens.
