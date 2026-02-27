# Protos Farm — Design System

Guia completo de UI/UX para o sistema de gestão agrícola Protos Farm.

## Índice

| #   | Documento                                                | Conteúdo                                                                   |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| 00  | [Fundamentos](./00-fundamentos.md)                       | Filosofia, princípios, tom e voz da interface                              |
| 01  | [Cores](./01-cores.md)                                   | Paleta brand, neutrals, semânticas, regras de contraste                    |
| 02  | [Tipografia](./02-tipografia.md)                         | Fontes, escala tipográfica, hierarquia, regras                             |
| 03  | [Espaçamento & Grid](./03-espacamento-grid.md)           | Escala 4px, grid 12col, breakpoints, layouts                               |
| 04  | [Componentes](./04-componentes.md)                       | Button, Input, Card, Table, Badge, Nav, Modal, Toast, Empty State, Loading |
| 05  | [Padrões de UX](./05-padroes-ux.md)                      | Navegação, formulários, feedback, offline, onboarding                      |
| 06  | [Acessibilidade](./06-acessibilidade.md)                 | WCAG AA, semântica, teclado, screen reader, reduced motion                 |
| 07  | [Responsividade & Mobile](./07-responsividade-mobile.md) | Mobile-first, breakpoints, web vs native, touch, safe areas                |
| 08  | [Animações](./08-animacoes-micro-interacoes.md)          | Timing, curvas, padrões, reduced motion                                    |
| 09  | [Iconografia & Assets](./09-iconografia-assets.md)       | Lucide Icons, logo, ilustrações, formatos de imagem                        |
| 10  | [Tokens de Implementação](./10-tokens-implementacao.md)  | CSS variables, TypeScript tokens, uso no React Native                      |

## Quick Reference

### Cores Principais

- **Primária:** `#2E7D32` (verde campo)
- **Background:** `#FFFFFF` / `#FAFAF8`
- **Texto:** `#3E3833` (corpo) / `#2A2520` (heading)
- **Erro:** `#C62828` | **Sucesso:** `#2E7D32` | **Warning:** `#F57F17`

### Fontes

- **Headlines:** DM Sans (500, 700)
- **Body/UI:** Source Sans 3 (400, 600)
- **Dados:** JetBrains Mono (400)

### Espaçamento Base

- Escala de 4px: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48`

### Touch Targets

- Mínimo: **48x48px** (mobile e web)

### Acessibilidade

- Meta: **WCAG 2.1 AA**
- Contraste texto: **4.5:1** mínimo

## Stack Recomendada

| Plataforma | Styling             | Ícones              | Animação                        |
| ---------- | ------------------- | ------------------- | ------------------------------- |
| Web        | Tailwind CSS        | lucide-react        | CSS transitions / Framer Motion |
| Mobile     | StyleSheet + tokens | lucide-react-native | RN Animated / Reanimated        |
| Shared     | TypeScript tokens   | —                   | —                               |
