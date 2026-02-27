# Componentes UI

## Anatomia de Componentes

Cada componente deve seguir a estrutura:

```
components/ui/
  Button/
    Button.tsx          → Componente
    Button.spec.tsx     → Testes
    Button.stories.tsx  → Storybook (opcional, futuro)
    index.ts            → Re-export
```

---

## Componentes Core

### 1. Button

**Variantes:**

| Variante    | Uso                        | Visual                                  |
| ----------- | -------------------------- | --------------------------------------- |
| `primary`   | CTA principal (1 por tela) | Fundo `primary-600`, texto branco       |
| `secondary` | Ação secundária            | Borda `primary-600`, fundo transparente |
| `ghost`     | Ação terciária, links      | Sem borda, texto `primary-600`          |
| `danger`    | Ação destrutiva            | Fundo `error-500`, texto branco         |

**Tamanhos:**

| Tamanho | Height | Padding H | Font      |
| ------- | ------ | --------- | --------- |
| `sm`    | 36px   | 12px      | text-sm   |
| `md`    | 44px   | 16px      | text-base |
| `lg`    | 52px   | 24px      | text-md   |

**Estados:** default → hover → active → focus → disabled → loading

**Regras:**

- Sempre ter label textual (ícone sozinho apenas em toolbar)
- Loading state: spinner + texto "Salvando..." (nunca desabilitar silenciosamente)
- Touch target mínimo 48px em mobile (usar padding se botão for menor)
- Ícone à esquerda do texto (padrão LTR)

---

### 2. Input / TextField

**Anatomia:**

```
[Label]                    (obrigatório)
[Placeholder text      ]   (input)
[Texto de ajuda]           (opcional)
[Mensagem de erro]         (condicional)
```

**Variantes:**

- `text` — Texto simples
- `number` — Numérico (ha, kg, L)
- `currency` — BRL com máscara
- `search` — Com ícone de lupa
- `textarea` — Múltiplas linhas

**Estados:** default → focus → filled → error → disabled → readonly

**Regras:**

- Label sempre visível (nunca usar apenas placeholder como label)
- Placeholder = exemplo do formato esperado (ex: "Ex: Fazenda São João")
- Erro: borda `error-500` + mensagem abaixo em `text-sm` + ícone ⚠
- Height mínimo do input: 44px
- Border radius: 8px
- Borda default: `neutral-300`, focus: `primary-500`
- Unidades (ha, kg) como sufixo inline dentro do input

---

### 3. Card

**Variantes:**

| Variante      | Uso                                     |
| ------------- | --------------------------------------- |
| `default`     | Container padrão de conteúdo            |
| `interactive` | Clicável (ex: card de fazenda na lista) |
| `stat`        | KPI / métrica com número grande         |
| `alert`       | Notificação inline                      |

**Especificações:**

- Padding: `--space-6` (24px)
- Border radius: 12px
- Sombra: `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)`
- Background: `neutral-0`
- Borda: `1px solid neutral-200` (sutil)
- Interactive: hover eleva sombra + `translateY(-1px)`

---

### 4. Table / DataGrid

Para listagens de fazendas, usuários, acessos.

**Regras:**

- Header fixo no scroll
- Linhas alternadas: fundo `neutral-50` / `neutral-0`
- Hover na linha: fundo `primary-50`
- Ações por linha: dropdown no final (não múltiplos botões)
- Em mobile: transformar em cards empilhados (não tabela horizontal)
- Paginação: "Mostrando 1-10 de 47 fazendas" + navegação
- Colunas numéricas: alinhamento à direita
- Ordenação: ícone de seta no header clicável

---

### 5. Badge / Tag

Para status, roles, categorias.

| Tipo      | Background    | Texto         | Exemplo        |
| --------- | ------------- | ------------- | -------------- |
| `success` | `success-100` | `success-500` | "Ativo"        |
| `warning` | `warning-100` | `warning-500` | "Pendente"     |
| `error`   | `error-100`   | `error-500`   | "Bloqueado"    |
| `info`    | `info-100`    | `info-500`    | "Admin"        |
| `neutral` | `neutral-200` | `neutral-700` | "Visualizador" |

**Especificações:**

- Height: 24px
- Padding: 4px 8px
- Border radius: 6px
- Font: text-xs, Semibold
- Dot indicator opcional à esquerda (8px circle)

---

### 6. Navigation

**Web — Sidebar:**

- Largura: 240px (colapsável para 64px com ícones)
- Background: `neutral-900`
- Links: texto `neutral-300`, ativo `neutral-0` com fundo `primary-700`
- Ícones: 20px, à esquerda do texto
- Grupos separados por divider com label em ALL CAPS `text-xs`

**Mobile — Bottom Tab:**

- 4–5 itens máximo
- Ícone (24px) + label (text-xs)
- Ativo: `primary-500`
- Inativo: `neutral-400`
- Height: 56px + safe area bottom

---

### 7. Modal / Dialog

- Overlay: `rgba(26, 22, 19, 0.5)` com backdrop-blur 4px
- Card: max-width 480px, padding 32px
- Título + descrição + ações
- Ação primária à direita, cancelar à esquerda
- Fechar com X, ESC, ou click no overlay
- Para ações destrutivas: exigir digitação do nome (ex: "Digite o nome da fazenda para excluir")

---

### 8. Toast / Notification

- Posição: top-right (web), top-center (mobile)
- Auto-dismiss: 5s (info/success), persistente (error)
- Cores semânticas (faixa lateral ou ícone)
- Ação opcional (ex: "Desfazer")
- Máximo 3 toasts visíveis simultaneamente

---

### 9. Empty State

Quando não há dados para mostrar:

```
┌──────────────────────────────────┐
│                                  │
│        [Ilustração/Ícone]        │
│                                  │
│     "Nenhuma fazenda ainda"      │
│  "Cadastre sua primeira fazenda  │
│   para começar a gerenciar."     │
│                                  │
│     [+ Nova Fazenda] (CTA)       │
│                                  │
└──────────────────────────────────┘
```

**Regras:**

- Ilustração/ícone grande (64–96px) em `neutral-300`
- Título em `text-lg`, `neutral-700`
- Descrição em `text-base`, `neutral-500`
- CTA claro e proeminente

---

### 10. Loading States

| Contexto                 | Padrão                                    |
| ------------------------ | ----------------------------------------- |
| Página inteira           | Skeleton screen (nunca spinner full-page) |
| Lista carregando         | Skeleton de 3-5 linhas                    |
| Botão processando        | Spinner inline + texto "Salvando..."      |
| Pull-to-refresh (mobile) | Indicador nativo                          |
| Dados parciais           | Mostrar o que tem + skeleton para o resto |

**Regras:**

- Skeleton é sempre preferível a spinner
- Skeleton deve refletir a forma do conteúdo real
- Animação de pulse suave (opacity 0.4 → 0.7, 1.5s)
- Nunca bloquear toda a UI para um loading parcial

---

## Composição de Componentes

### Formulário de Fazenda (exemplo)

```
PageHeader
  title="Nova Fazenda"
  breadcrumb=["Fazendas", "Nova"]

Card
  Section title="Dados Gerais"
    Input label="Nome da fazenda" required
    Input label="Área total" suffix="ha" type="number"
    Select label="Estado" options={estados}

  Divider

  Section title="Localização"
    MapPicker label="Selecione a área no mapa"
    Input label="Latitude" readonly type="coords"
    Input label="Longitude" readonly type="coords"

ActionBar
  Button variant="ghost" label="Cancelar"
  Button variant="primary" label="Cadastrar Fazenda"
```
