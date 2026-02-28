# Acessibilidade

## Meta: WCAG 2.1 Nível AA

---

## Contraste de Cores

| Contexto                  | Ratio Mínimo | Nota                         |
| ------------------------- | ------------ | ---------------------------- |
| Texto normal (<18px)      | 4.5:1        | Crítico para uso ao ar livre |
| Texto grande (≥18px bold) | 3:1          | Headers, botões              |
| Ícones informativos       | 3:1          | Ícones de status, ação       |
| Bordas de input (focus)   | 3:1          | Indicador de foco            |
| Elementos decorativos     | Sem mínimo   | Não carregam informação      |

**Ferramentas de verificação:**

- Chrome DevTools → Lighthouse
- axe DevTools extension
- WebAIM Contrast Checker

---

## Semântica HTML (Web)

```html
<!-- ✓ Correto -->
<nav aria-label="Menu principal">
  <main>
    <section aria-labelledby="farms-heading">
      <h2 id="farms-heading">Fazendas</h2>
    </section>
    <button type="submit">Salvar</button>

    <!-- ✗ Errado -->
    <div class="nav">
      <div class="main">
        <div class="section">
          <div class="heading">Fazendas</div>
        </div>
        <div class="button" onclick="save()">Salvar</div>
      </div>
    </div>
  </main>
</nav>
```

### Landmarks Obrigatórios

- `<header>` com `<nav>` — navegação principal
- `<main>` — conteúdo principal (1 por página)
- `<aside>` — sidebar
- `<footer>` — rodapé

---

## React Native (Mobile)

### Props de Acessibilidade

```tsx
// ✓ Correto
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Abrir detalhes da Fazenda São João"
  accessibilityRole="button"
  accessibilityHint="Navega para a página de detalhes"
>
  <Text>Fazenda São João</Text>
</TouchableOpacity>

// ✓ Status badge acessível
<View
  accessibilityLabel="Status: Ativo"
  accessibilityRole="text"
>
  <Badge variant="success">Ativo</Badge>
</View>

// ✓ Imagens informativas
<Image
  source={farmPhoto}
  accessibilityLabel="Vista aérea da Fazenda São João, 150 hectares"
/>

// ✓ Imagens decorativas
<Image
  source={decorativeBg}
  accessibilityElementsHidden={true}
/>
```

---

## Teclado (Web)

### Requisitos

1. **Tab order lógico** — segue o fluxo visual, de cima para baixo, esquerda para direita
2. **Focus visible** — outline de 2px em `primary-500`, offset 2px (nunca remover `outline`)
3. **Skip to content** — link oculto que aparece no primeiro Tab
4. **Escape fecha** modals, dropdowns, tooltips
5. **Enter/Space ativa** botões e links
6. **Arrow keys** navegam em listas, tabs, menus

### Focus Style

```css
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Não remover outline em click, apenas customizar */
:focus:not(:focus-visible) {
  outline: none;
}
```

---

## Formulários Acessíveis

```html
<!-- Label associado ao input -->
<label for="farm-name">Nome da fazenda *</label>
<input
  id="farm-name"
  type="text"
  required
  aria-required="true"
  aria-describedby="farm-name-help farm-name-error"
/>
<span id="farm-name-help">Nome que identifica a propriedade</span>
<span id="farm-name-error" role="alert" aria-live="polite">
  <!-- Mensagem de erro aparece aqui -->
</span>
```

### Regras

- Todo input tem `<label>` associado
- Campos obrigatórios: `aria-required="true"` + asterisco visual
- Erros: `role="alert"` + `aria-live="polite"` para anúncio por screen reader
- Grupos de radio/checkbox: `<fieldset>` + `<legend>`
- Autocomplete attributes (`autocomplete="name"`, `"email"`, etc.)

---

## Cores e Informação

**Nunca comunicar apenas por cor:**

```
✓ Status: 🟢 Ativo (verde + ícone + texto)
✗ Status: ● (apenas bolinha verde)

✓ Erro: borda vermelha + ícone ⚠ + mensagem de texto
✗ Erro: apenas borda vermelha

✓ Gráfico: cores + padrões (listras, pontos) + legenda
✗ Gráfico: apenas cores diferentes
```

---

## Motion & Animação

1. **`prefers-reduced-motion: reduce`** — respeitar sempre
2. Nenhuma animação deve ser necessária para entender a interface
3. Animações de loading devem ter alternativa textual
4. Nenhum flash acima de 3 por segundo

```css
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

## Texto e Leitura

1. **Idioma definido** — `<html lang="pt-BR">`
2. **Texto redimensionável** — UI funciona até 200% zoom sem perda
3. **Não usar texto em imagens** — exceto logos
4. **Links descritivos** — "Ver detalhes da Fazenda São João" não "Clique aqui"
5. **Abreviações** — usar `<abbr title="hectares">ha</abbr>` na primeira ocorrência

---

## Checklist por Componente

| Componente | Verificar                                                        |
| ---------- | ---------------------------------------------------------------- |
| Button     | `aria-label` se só ícone, estados disabled anunciados            |
| Input      | Label associado, erro em `aria-live`, hint em `aria-describedby` |
| Modal      | Focus trap, Escape fecha, foco retorna ao trigger                |
| Toast      | `role="status"` para info, `role="alert"` para erros             |
| Table      | `<th scope="col/row">`, `<caption>` descritivo                   |
| Tab        | `role="tablist/tab/tabpanel"`, arrow key navigation              |
| Dropdown   | `aria-expanded`, `aria-haspopup`, arrow keys                     |
| Map        | Alternativa textual (lista de coordenadas / endereço)            |
