# Mobile — Instruções para o Claude

## Stack

- React Native 0.76 + Expo SDK 52 + Expo Router 4
- Navegação: file-based routing (`app/` directory)
- Styling: StyleSheet + tokens de `@protos-farm/shared`
- Testes: Jest 29 (`**/*.spec.ts`, `**/*.spec.tsx`)
- Entry point: `expo-router/entry`

## Estrutura de Arquivos

```
app/                → Rotas (Expo Router file-based)
  _layout.tsx       → Layout raiz (Stack)
  (tabs)/           → Tab navigator
    _layout.tsx     → Layout das tabs
    index.tsx       → Início/Dashboard
    farms.tsx       → Fazendas
    map.tsx         → Mapa
    profile.tsx     → Perfil
  farm/[id].tsx     → Detalhe da fazenda
components/ui/      → Componentes reutilizáveis
hooks/              → Custom hooks
services/           → API client
stores/             → Estado global
types/              → Tipos locais
utils/              → Utilitários
assets/             → Imagens, fontes
```

## Regras de Código

- Componentes: function components com arrow function, export default
- StyleSheet.create no final do arquivo, nunca inline styles em produção
- Importar tokens de `@protos-farm/shared` para cores, espaçamento, fontSize
- Nunca usar `any`

## Regras de UI — OBRIGATÓRIO

### Fontes (Expo Google Fonts)

```tsx
// Carregar no _layout.tsx raiz
import { useFonts } from 'expo-font';
import { DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { SourceSans3_400Regular, SourceSans3_600SemiBold } from '@expo-google-fonts/source-sans-3';
```

- Headlines: `fontFamily: 'DMSans_700Bold'`
- Body: `fontFamily: 'SourceSans3_400Regular'`
- **Proibido:** usar font padrão do sistema sem definir fontFamily

### Cores — Usar Tokens

```tsx
import { colors } from '@protos-farm/shared';

// ✓ Correto
backgroundColor: colors.primary[600];
color: colors.neutral[700];

// ✗ Errado — nunca hardcodar
backgroundColor: '#2E7D32';
```

### Layout & Espaçamento

```tsx
import { spacing } from '@protos-farm/shared';

// Espaçamento base: escala de 4px
padding: spacing[4],     // 16
gap: spacing[3],         // 12
marginBottom: spacing[6], // 24
```

- **SafeAreaView obrigatório** — usar `react-native-safe-area-context`
- **KeyboardAvoidingView** em toda tela com formulário
- **Padding horizontal da tela:** `spacing[4]` (16px)
- **Nunca valores arbitrários** (ex: `padding: 13`)

### Touch Targets

```tsx
// ✓ Mínimo 48x48px em toda área tocável
<Pressable style={{ minHeight: 48, minWidth: 48 }}>

// ✓ hitSlop para elementos pequenos
<Pressable hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
```

- **Mínimo 48x48px** — sempre, sem exceção
- Botões: height mínimo 44px + padding
- Inputs: height mínimo 48px
- Itens de lista: height mínimo 56px

### Componentes

- **Pressable** em vez de TouchableOpacity — API mais moderna
- **FlatList** para listas — **nunca** ScrollView com .map() para listas dinâmicas
- **Loading:** Skeleton — **nunca** ActivityIndicator full-screen
- **Pull-to-refresh:** `RefreshControl` nativo — não customizar
- **Empty state:** ícone (48-64px) + título + descrição + CTA

### Feedback Tátil

```tsx
import * as Haptics from 'expo-haptics';

// Pressão de botão
<Pressable
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handlePress();
  }}
  style={({ pressed }) => [
    styles.button,
    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
  ]}
/>;

// Ação destrutiva — vibração de aviso
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

// Sucesso
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
```

### Acessibilidade — OBRIGATÓRIO

```tsx
// ✓ Todo componente interativo
<Pressable
  accessible={true}
  accessibilityLabel="Abrir detalhes da Fazenda São João"
  accessibilityRole="button"
  accessibilityHint="Navega para a página de detalhes"
>

// ✓ Status/Badge
<View accessibilityLabel="Status: Ativo" accessibilityRole="text">
  <Badge variant="success">Ativo</Badge>
</View>

// ✓ Imagem informativa
<Image
  source={farmPhoto}
  accessibilityLabel="Vista aérea da Fazenda São João"
/>

// ✓ Imagem decorativa
<Image source={bg} accessibilityElementsHidden={true} />

// ✓ Verificar reduced motion
import { AccessibilityInfo } from 'react-native';
const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
```

- **accessibilityLabel** em todo Pressable, Image informativa e Badge
- **accessibilityRole** correto: `"button"`, `"link"`, `"header"`, `"text"`, `"image"`
- **accessibilityElementsHidden** para decorativos
- **Nunca** depender apenas de cor — sempre ícone + texto

### Navegação

- **Bottom Tabs:** máximo 5 itens (Início, Fazendas, Mapa, Notificações, Perfil)
- **Tab ativo:** cor `primary-500`, inativo `neutral-400`
- **Stack headers:** usar título claro, botão back nativo
- **Deep linking:** toda rota deve ser acessível por URL
- **Orientação:** portrait only (bloquear landscape), exceto mapa fullscreen

### Gestos

| Gesto      | Uso                                      |
| ---------- | ---------------------------------------- |
| Tap        | Ação principal                           |
| Long press | Menu contextual                          |
| Swipe left | Ações em item de lista (editar, excluir) |
| Swipe down | Pull-to-refresh                          |
| Pinch      | Zoom em mapas                            |

### Offline

```tsx
// ✓ Verificar conectividade
import NetInfo from '@react-native-community/netinfo';

// ✓ Banner quando offline
{
  !isConnected && (
    <View style={styles.offlineBanner}>
      <WifiOff size={16} color={colors.neutral[0]} />
      <Text>Sem conexão. Alterações serão enviadas quando reconectar.</Text>
    </View>
  );
}
```

- Dados lidos ficam em cache local
- Ações de escrita enfileiradas com indicador "pendente"
- Sync automático ao reconectar
- **Nunca perder dados** do usuário

### Textos da Interface

Mesmo padrão do web — pt-BR, tom direto e acolhedor:

```
✓ "Fazenda cadastrada com sucesso"
✗ "Recurso criado"

✓ "Sem conexão. Seus dados serão enviados quando voltar online."
✗ "Network error"
```

### Ícones — Lucide React Native

```tsx
import { MapPin, Trash2, Plus } from 'lucide-react-native';

// Tamanhos: 16 inline, 20 botão, 24 nav/tab, 48-64 empty state
<MapPin size={24} color={colors.primary[500]} />;
```

### Performance

- **FlatList** com `getItemLayout` para listas de tamanho fixo
- **Imagens:** cache com `expo-image`, placeholder com blur
- **Navegação:** lazy loading de tabs com `lazy: true`
- **Memoização:** `React.memo` em itens de lista, `useMemo`/`useCallback` onde necessário
