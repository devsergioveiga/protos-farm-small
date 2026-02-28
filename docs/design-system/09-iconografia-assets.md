# Iconografia & Assets

## Ícones

### Biblioteca: Lucide Icons

- Open source, MIT license
- Estilo: outlined, 24px grid, stroke 2px
- Consistente entre web (`lucide-react`) e mobile (`lucide-react-native`)
- +1000 ícones, cobrindo todos os casos de uso agrícola

### Mapeamento de Ícones por Domínio

| Conceito      | Ícone | Nome Lucide           |
| ------------- | ----- | --------------------- |
| Fazenda       | 🏠    | `Home` ou `Warehouse` |
| Área/Talhão   | 📐    | `Square` ou `Map`     |
| Mapa          | 🗺    | `MapPin`              |
| Usuário       | 👤    | `User`                |
| Organização   | 🏢    | `Building2`           |
| Dashboard     | 📊    | `LayoutDashboard`     |
| Configurações | ⚙     | `Settings`            |
| Busca         | 🔍    | `Search`              |
| Filtro        | 🔽    | `Filter`              |
| Adicionar     | ➕    | `Plus`                |
| Editar        | ✏     | `Pencil`              |
| Excluir       | 🗑    | `Trash2`              |
| Salvar        | 💾    | `Save`                |
| Upload        | 📤    | `Upload`              |
| Download      | 📥    | `Download`            |
| Offline       | 📡    | `WifiOff`             |
| Sincronizar   | 🔄    | `RefreshCw`           |
| Notificação   | 🔔    | `Bell`                |
| Sucesso       | ✅    | `CheckCircle`         |
| Erro          | ❌    | `XCircle`             |
| Warning       | ⚠     | `AlertTriangle`       |
| Info          | ℹ     | `Info`                |

### Regras de Uso

1. **Tamanhos consistentes:**
   - Inline (com texto): 16px
   - Botão/Ação: 20px
   - Navegação: 24px
   - Empty state: 48–64px
   - Ilustração: 96px

2. **Cor:** herda do texto pai (currentColor), exceto quando semântico (sucesso=verde, erro=vermelho)

3. **Acessibilidade:**
   - Ícone decorativo (acompanha texto): `aria-hidden="true"`
   - Ícone funcional (sozinho): `aria-label="Descrição da ação"`

4. **Consistência:** uma vez escolhido o ícone para um conceito, usar o mesmo em toda a aplicação

---

## Logo

### Variações

| Variante                      | Uso                                  |
| ----------------------------- | ------------------------------------ |
| Logo completo (ícone + texto) | Header, login, onboarding            |
| Ícone isolado                 | Favicon, app icon, sidebar colapsada |
| Monocromático                 | Sobre fundos coloridos, footer       |

### Espaçamento

- Área de proteção: mínimo 1x a altura do ícone ao redor
- Tamanho mínimo: 32px de altura (ícone), 120px (logo completo)

---

## Ilustrações

### Estilo

- Flat, geométrico, com paleta limitada à brand
- Tons de `primary-200` a `primary-600` + `neutral-200`
- Traço fino (`neutral-400`) para detalhes
- Proporção: ilustrações horizontais para web, quadradas para mobile

### Uso

| Contexto               | Ilustração                       |
| ---------------------- | -------------------------------- |
| Empty state (fazendas) | Paisagem rural simplificada      |
| Empty state (usuários) | Silhuetas de pessoas             |
| Onboarding             | Sequência de 3-4 cenas do fluxo  |
| Erro 404               | Cerca quebrada / porteira aberta |
| Erro 500               | Trator quebrado                  |
| Manutenção             | Ferramenta agrícola              |

---

## Favicon & App Icon

### Web (Favicon)

- `favicon.ico` — 32x32, ícone do logo
- `apple-touch-icon.png` — 180x180
- `favicon-16x16.png`, `favicon-32x32.png`
- Meta tags Open Graph (og:image) — 1200x630

### Mobile (App Icon)

- iOS: 1024x1024 (sem transparência, cantos arredondados pelo sistema)
- Android: 1024x1024 (adaptive icon com foreground + background layers)
- Fundo: `primary-600`
- Ícone: branco, centrado, ~60% da área

---

## Imagens

### Formatos

| Contexto       | Formato              | Qualidade |
| -------------- | -------------------- | --------- |
| Foto (web)     | WebP (fallback JPEG) | 80%       |
| Foto (mobile)  | JPEG                 | 80%       |
| Ícone/Logo     | SVG                  | —         |
| Screenshot/Doc | PNG                  | Lossless  |

### Otimização

- Thumbnails: max 400px lado maior
- Listagens: max 800px
- Detalhe/Galeria: max 1600px
- Lazy loading em todas as imagens fora do viewport
- Placeholder com aspect ratio preservado (evitar layout shift)
