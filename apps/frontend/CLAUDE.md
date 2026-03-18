# Frontend — Instruções para o Claude

## Stack

- React 19 + TypeScript + Vite 6
- Styling: Tailwind CSS (quando instalado), CSS custom properties em `src/styles/tokens.css`
- Testes: Vitest + @testing-library/react + jsdom (`**/*.spec.tsx`)
- Path alias: `@/*` → `src/*`
- Dev server: http://localhost:5173, proxy `/api/*` → backend :3000

## Estrutura de Arquivos

```
src/
  assets/          → Imagens, fontes
  components/ui/   → Componentes reutilizáveis (Button, Input, Card, etc.)
  hooks/           → Custom hooks
  pages/           → Componentes de página (1 por rota)
  services/        → API client, chamadas HTTP
  stores/          → Estado global
  styles/          → tokens.css, global.css
  types/           → Tipos locais do frontend
  utils/           → Utilitários
```

## Regras de Código

- Componentes: function components com arrow function, export default
- Um componente por arquivo, nome do arquivo = nome do componente
- Colocar componente + spec + index no mesmo diretório
- Importar tokens de `@protos-farm/shared` quando disponível, senão usar CSS vars
- Nunca usar `any` — tipar tudo explicitamente

## Regras de UI — OBRIGATÓRIO

### HTML Semântico

- `<button>` para ações, `<a>` para navegação — **nunca** `<div onClick>`
- `<nav>`, `<main>`, `<section>`, `<header>`, `<footer>` — usar landmarks corretos
- `<label htmlFor>` em todo input — **nunca** placeholder como substituto de label
- `<table>` com `<th scope>` e `<caption>` — **nunca** divs simulando tabela
- Listas: `<ul>`/`<ol>` + `<li>` — **nunca** divs empilhadas

### Fontes (Google Fonts)

```html
<!-- Carregar no index.html -->
<link
  href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono&display=swap"
  rel="stylesheet"
/>
```

- Headlines: `font-family: 'DM Sans', system-ui, sans-serif`
- Body/UI: `font-family: 'Source Sans 3', system-ui, sans-serif`
- Dados/Mono: `font-family: 'JetBrains Mono', monospace`
- **Proibido:** Inter, Roboto, Arial, sans-serif genérico como escolha primária

### Cores — Usar CSS Custom Properties

```css
var(--color-primary-600)   /* Botão primário */
var(--color-neutral-700)   /* Texto corpo */
var(--color-neutral-800)   /* Headlines */
var(--color-error-500)     /* Erros apenas */
var(--color-neutral-0)     /* Background */
var(--color-neutral-50)    /* Background secundário */
```

- **Nunca** hardcodar hex — sempre usar `var(--color-*)`
- **Nunca** usar cor sozinha para comunicar estado — ícone + texto obrigatório

### Layout

- **Mobile-first:** estilos base para <640px, media queries para cima
- **Container:** max-width 1280px, centralizado
- **Sidebar:** hidden <1024, colapsada ≥1024, expandida ≥1280
- **Formulários:** max-width 800px, campos full-width em mobile
- **Tabelas <768px:** transformar em cards empilhados

### Formulários de Criação e Edição — SEMPRE em Modal

- **Nunca** criar página dedicada para formulários de criação ou edição
- Formulários devem abrir em **modal** dentro da página que lista os recursos
- Padrão: botão na página → `useState(showModal)` → componente `<XxxModal isOpen onClose onSuccess />`
- Modal fica em `components/{domínio}/{NomeModal}.tsx` + `.css`
- Hook de form fica em `hooks/useCreateXxx.ts` (sem `useNavigate`, recebe `onSuccess` callback)
- Sucesso: `onSuccess` callback fecha modal + toast na página pai + refetch da lista
- Exemplos existentes: `CreateFarmModal`, `BulkImportModal`, modais em `OrgUsersPage`, `RolesPage`
- Para multi-step: usar padrão header/body(scrollable)/footer com stepper no header

### Componentes

- **Botão primário:** máximo 1 por tela
- **Loading:** `<Skeleton />` — **nunca** spinner full-page
- **Empty state:** ícone + título + descrição + CTA — **nunca** tela vazia
- **Toast:** top-right, auto-dismiss 5s (sucesso/info), persistente (erro)
- **Modal destrutivo:** exigir digitação do nome para confirmar exclusão
- **Confirmações destrutivas:** **nunca usar `window.confirm()`** — sempre usar `ConfirmModal` de `@/components/ui/ConfirmModal`. Para exclusão de alta criticidade (fazendas): `ConfirmDeleteModal` com digitação do nome. Para ações de risco médio/baixo (remover registro, desvincular): `ConfirmModal` com `variant="danger"` ou `variant="warning"`

### Acessibilidade

```tsx
// ✓ Focus visible — nunca remover
// O CSS global deve ter:
// :focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 2px; }

// ✓ Skip to content
<a href="#main-content" className="sr-only focus:not-sr-only">
  Pular para conteúdo
</a>

// ✓ Ícone sem texto
<button aria-label="Excluir fazenda">
  <Trash2 aria-hidden="true" />
</button>

// ✓ Erros de formulário
<span role="alert" aria-live="polite">{error}</span>
```

- Tab order lógico, Escape fecha modals/dropdowns
- `prefers-reduced-motion: reduce` — respeitar sempre
- Contraste mínimo 4.5:1 texto normal, 3:1 texto grande

### Animações

```css
/* Durações padrão */
transition: all 200ms cubic-bezier(0.33, 1, 0.68, 1); /* ease-out, default */

/* Hover de card */
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Entrada de página */
.page-enter {
  opacity: 0;
  transform: translateY(8px);
}
```

- **Nunca** animar scroll, layout shifts, ou conteúdo de texto
- **Skeleton pulse:** opacity 0.4→0.7, 1.5s, infinite

### Textos da Interface

```
✓ "Fazenda cadastrada com sucesso"
✗ "Recurso criado no sistema"

✓ "Não foi possível salvar. Verifique sua conexão e tente novamente."
✗ "Error 500: Internal Server Error"

✓ "Nenhuma fazenda ainda. Cadastre a primeira."
✗ "0 results"
```

- Sempre pt-BR, tom direto e acolhedor
- Erros: o que aconteceu + o que fazer
- Empty states: mensagem amigável + CTA

### Ícones — Lucide React

```tsx
import { MapPin, Trash2, Plus } from 'lucide-react';

// Tamanhos: 16 inline, 20 botão, 24 nav, 48-64 empty state
<MapPin size={20} />

// Decorativo (acompanha texto)
<MapPin aria-hidden="true" size={16} /> Localização

// Funcional (sozinho)
<button aria-label="Adicionar fazenda"><Plus size={20} /></button>
```

### Performance

- `React.lazy` + `Suspense` para rotas — code splitting obrigatório
- Componentes pesados (mapa, gráficos) carregados sob demanda
- Imagens: WebP com fallback JPEG, lazy loading, aspect-ratio preservado
- Listas longas (>50 itens): virtualização obrigatória
