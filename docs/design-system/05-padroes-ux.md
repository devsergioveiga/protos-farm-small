# Padrões de UX

## Navegação

### Hierarquia de Navegação

```
Web:
  Sidebar (sempre visível)
    ├── Dashboard
    ├── Fazendas
    │     ├── Lista
    │     ├── Detalhe
    │     └── Formulário
    ├── Usuários
    ├── Organização
    └── Configurações

Mobile:
  Bottom Tab
    ├── Início (Dashboard)
    ├── Fazendas
    ├── Mapa
    ├── Notificações
    └── Perfil
```

### Regras de Navegação

1. **Breadcrumb em toda página** (web) — nunca perder o contexto
2. **Back button nativo** (mobile) — não reinventar
3. **Deep linking funcional** — URLs compartilháveis (web), universal links (mobile)
4. **Máximo 3 níveis de profundidade** — se precisar de mais, repensar a arquitetura
5. **Manter scroll position** ao voltar de um detalhe

---

## Formulários

### Princípios

1. **Uma ação por tela** — formulários longos divididos em steps ou seções colapsáveis
2. **Salvar rascunho automático** — especialmente em formulários longos (conexão pode cair)
3. **Validação inline** — ao sair do campo (onBlur), não apenas no submit
4. **Mensagens de erro específicas** — "Informe um email válido" não "Campo inválido"
5. **Campos obrigatórios marcados** — asterisco (\*) no label + legenda no topo

### Ordem dos Campos

```
1. Dados mais importantes primeiro (nome, identificador)
2. Dados descritivos (tipo, categoria, descrição)
3. Dados geográficos (localização, área)
4. Dados de acesso/permissão (roles, vínculos)
5. Dados opcionais por último
```

### Ações de Formulário

- **Primária** (Salvar/Criar): sempre à direita, botão `primary`
- **Secundária** (Cancelar): à esquerda, botão `ghost`
- **Sticky bottom** em mobile — botões sempre visíveis
- **Confirmar descarte** se houver alterações não salvas

---

## Feedback ao Usuário

### Hierarquia de Feedback

| Severidade      | Componente          | Duração                  | Ação do Usuário           |
| --------------- | ------------------- | ------------------------ | ------------------------- |
| Sucesso         | Toast               | 5s auto                  | Nenhuma                   |
| Info            | Toast ou Inline     | 5s ou persistente        | Opcional                  |
| Warning         | Banner inline       | Persistente              | Dismiss ou resolver       |
| Erro de campo   | Inline no campo     | Persistente até corrigir | Corrigir o campo          |
| Erro de sistema | Dialog modal        | Persistente              | Retry ou contatar suporte |
| Ação destrutiva | Confirmation dialog | Até decidir              | Confirmar ou cancelar     |

### Mensagens de Erro

**Estrutura:** O que aconteceu + O que fazer

```
✓ "Não foi possível salvar. Verifique sua conexão e tente novamente."
✗ "Error 500: Internal Server Error"

✓ "Este email já está cadastrado. Deseja fazer login?"
✗ "Duplicate entry violation"

✓ "A área deve ser maior que 0 hectares."
✗ "Valor inválido"
```

### Confirmação de Ações Destrutivas

Nível proporcional ao risco:

| Risco                             | Confirmação                      |
| --------------------------------- | -------------------------------- |
| Baixo (remover filtro)            | Nenhuma                          |
| Médio (remover vínculo de acesso) | Dialog "Tem certeza?"            |
| Alto (excluir fazenda)            | Dialog + digitar nome da fazenda |
| Crítico (excluir organização)     | Dialog + digitar + esperar 5s    |

---

## Padrões de Interação

### Listas e Busca

1. **Busca sempre visível** no topo de listas
2. **Filtros** como chips horizontais (web) ou bottom sheet (mobile)
3. **Ordenação** via dropdown no header da lista
4. **Pull-to-refresh** em mobile
5. **Infinite scroll** preferível a paginação em mobile
6. **Paginação** preferível em web (URLs bookmarkáveis)
7. **Resultado zero** → empty state com sugestão

### Mapas

1. **Zoom para a área selecionada** ao abrir
2. **Clusters para muitos pontos** (>20 markers)
3. **Popup de preview** ao tocar em marker (nome + área + CTA "Ver detalhes")
4. **Localização atual** como referência (pedir permissão com contexto)
5. **Modo satélite toggle** — fazendas fazem mais sentido em vista satélite
6. **Desenho de polígono** para delimitar área da fazenda
7. **Offline tiles** — cache de tiles do mapa para uso offline (futuro)

### Dashboard

1. **KPIs no topo** — números grandes, glanceáveis
2. **Máximo 4 KPIs visíveis** sem scroll
3. **Período selecionável** (7d, 30d, 90d, 12m)
4. **Gráficos simples** — barras e linhas, evitar pizza (difícil comparar fatias)
5. **Links diretos** dos KPIs para as listas detalhadas
6. **"Bom dia, [Nome]"** — personalização sutil

---

## Offline & Sincronização

### Indicadores de Estado

```
┌──────────────────────────────┐
│ 🟢 Conectado                 │  (sutil, corner)
│ 🟡 Sincronizando (3 itens)  │  (visível, progress)
│ 🔴 Sem conexão              │  (banner fixo topo)
└──────────────────────────────┘
```

### Regras de Offline

1. **Dados lidos são cacheados** — última versão disponível offline
2. **Ações de escrita enfileiradas** — com indicador visual de "pendente"
3. **Conflitos resolvidos por timestamp** — último escrita ganha, com opção de merge manual
4. **Nunca perder dados do usuário** — se não pode enviar, armazenar local
5. **Banner claro quando offline** — "Sem conexão. Alterações serão enviadas quando reconectar."
6. **Sync automático ao reconectar** — sem ação do usuário
7. **Indicador de "dados podem estar desatualizados"** quando em cache antigo (>1h)

---

## Onboarding

### Primeiro Uso

1. **Wizard de setup** — 3-4 steps máximo
   - Step 1: Dados da organização
   - Step 2: Primeira fazenda
   - Step 3: Convite de usuários (opcional, pode pular)
   - Step 4: Pronto! → Dashboard

2. **Progress indicator** — "Passo 2 de 4"
3. **Skip disponível** — nunca forçar completar tudo
4. **Tooltip contextual** em features novas (1 por tela, dismiss permanente)

### Regras

- Nunca mostrar dashboard vazio sem guia
- Empty states com CTAs claros substituem tutoriais
- Coach marks no máximo 3 na primeira sessão
- Respeitar "Não mostrar novamente"
