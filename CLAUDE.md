# Protos Farm — Instruções para o Claude

## Projeto

Sistema de gestão agrícola. Monorepo pnpm com:

- `apps/backend` — Express 5 + TypeScript + Prisma 7
- `apps/frontend` — Vite + React 19 + TypeScript
- `apps/mobile` — React Native 0.76 + Expo 52 + Expo Router
- `packages/shared` — Tipos, tokens e utils compartilhados

## Fluxo de Trabalho

- Branch: `feature/*` → `develop` (PR) → `main` (PR + 1 approval)
- Implementar 1 critério de aceite por vez
- Documentar em `docs/implementacao/` o que e por quê
- Testes: `**/*.spec.ts` (backend/shared = Jest, frontend = Vitest)
- Prisma 7 requer `prisma generate` antes de `tsc` em CI

## Padrões de Código

- Backend: módulos colocalizados (`modules/{domínio}/controller+service+routes+types`)
- ESLint 9 flat config, Prettier, Husky pre-commit
- `app.ts` separado de `main.ts` no backend (testabilidade)

---

# REGRAS DE UI/UX — OBRIGATÓRIO

Ao criar ou modificar qualquer componente de interface (web ou mobile), seguir **todas** as regras abaixo. O design system completo está em `docs/design-system/`.

## Cores

- **Primária:** `#2E7D32` (verde campo) — apenas para CTAs e ações principais
- **Neutrals com tom quente:** `#FAFAF8` (bg), `#3E3833` (texto), `#2A2520` (heading)
- **Erro:** `#C62828` — apenas para erros e ações destrutivas, nunca decorativo
- **Nunca usar cor como único indicador** — sempre acompanhar com ícone ou texto
- **Contraste WCAG AA:** 4.5:1 texto normal, 3:1 texto grande
- Tokens completos: `docs/design-system/01-cores.md`

## Tipografia

- **Headlines:** DM Sans (500, 700) — nunca usar Inter, Roboto, Arial
- **Body/UI:** Source Sans 3 (400, 600)
- **Dados/Coords:** JetBrains Mono (400)
- **Mínimo 12px** — nada menor (legibilidade ao ar livre)
- **Nunca centralizar** blocos de texto >2 linhas
- **ALL CAPS** apenas em labels curtas ("STATUS", "ÁREA"), nunca em frases
- Escala completa: `docs/design-system/02-tipografia.md`

## Espaçamento

- **Escala de 4px** — usar apenas múltiplos: 4, 8, 12, 16, 20, 24, 32, 40, 48
- **Nunca valores arbitrários** (ex: margin: 13px)
- **Touch targets mínimos 48x48px** — sempre, web e mobile
- **Padding de input:** mínimo 12px vertical, 16px horizontal
- Layout e grid: `docs/design-system/03-espacamento-grid.md`

## Componentes

- **Botão primário:** máximo 1 por tela, sempre com label textual
- **Loading:** skeleton screens, nunca spinner full-page
- **Input:** label sempre visível (nunca apenas placeholder), erro com ícone + mensagem
- **Tabela em mobile:** transformar em cards empilhados
- **Empty state:** ilustração + título + descrição + CTA
- **Modal destrutivo:** exigir confirmação proporcional ao risco
- Specs completas: `docs/design-system/04-componentes.md`

## UX

- **Voz em pt-BR coloquial:** "Fazenda cadastrada com sucesso" não "Recurso criado"
- **Erros humanos:** "Não foi possível salvar. Verifique sua conexão." não "Error 500"
- **Formulários:** validação inline onBlur, campos obrigatórios com \*, salvar rascunho auto
- **Offline:** banner claro "Sem conexão", dados em cache, sync automático ao reconectar
- **Breadcrumb** em toda página web, back button nativo no mobile
- **Máximo 3 níveis** de profundidade na navegação
- Padrões completos: `docs/design-system/05-padroes-ux.md`

## Acessibilidade (WCAG 2.1 AA)

- HTML semântico: `<nav>`, `<main>`, `<section>`, `<button>` — nunca `<div>` com onClick
- **Focus visible:** outline 2px `primary-500`, nunca remover outline
- **Formulários:** label associado, `aria-required`, erros com `role="alert"`
- **Ícone sem texto:** obrigatório `aria-label`
- **React Native:** sempre `accessibilityLabel` e `accessibilityRole`
- **`prefers-reduced-motion`:** respeitar sempre
- Checklist: `docs/design-system/06-acessibilidade.md`

## Responsividade

- **Mobile-first:** estilos base para mobile, aprimorar para desktop
- **Breakpoints:** sm=640 md=768 lg=1024 xl=1280
- **Sidebar web:** drawer <1024, colapsada ≥1024, expandida ≥1280
- **Bottom tab mobile:** máx 5 itens, ativo em `primary-500`
- **SafeAreaView** obrigatório no React Native
- Detalhes: `docs/design-system/07-responsividade-mobile.md`

## Ícones

- **Lucide Icons** — `lucide-react` (web) e `lucide-react-native` (mobile)
- Tamanhos: 16px inline, 20px botão, 24px nav, 48-64px empty state
- Decorativo: `aria-hidden="true"` — Funcional sozinho: `aria-label`

## Animações

- **Durações:** 100ms hover, 200ms dropdown, 300ms modal, 500ms complexa
- **Curva padrão:** `ease-out` para entradas, `ease-in` para saídas
- **Nunca animar** scroll, texto mudando, layout shifts
- Timing: `docs/design-system/08-animacoes-micro-interacoes.md`

## Tokens Compartilhados

- CSS: `apps/frontend/src/styles/tokens.css` (custom properties)
- TS: `packages/shared/src/constants/design-tokens.ts` (objetos tipados)
- Mobile consome tokens TS via StyleSheet
- Implementação: `docs/design-system/10-tokens-implementacao.md`

## Stack de Styling Recomendada

| Plataforma | Styling                         | Ícones              | Animação        |
| ---------- | ------------------------------- | ------------------- | --------------- |
| Web        | Tailwind CSS (tokens no config) | lucide-react        | CSS transitions |
| Mobile     | StyleSheet + tokens TS          | lucide-react-native | RN Animated     |
