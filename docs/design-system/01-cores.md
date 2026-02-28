# Paleta de Cores

## Conceito

Inspirada na paisagem agrícola brasileira: tons terrosos como base, verde vivo como destaque primário, céu e água como acentos. Contraste alto para uso ao ar livre.

---

## Tokens de Cor

### Brand Colors

| Token                 | Hex       | Uso                               |
| --------------------- | --------- | --------------------------------- |
| `--color-primary-50`  | `#E8F5E9` | Background de badges, hover sutil |
| `--color-primary-100` | `#C8E6C9` | Background de cards destacados    |
| `--color-primary-200` | `#A5D6A7` | Bordas ativas                     |
| `--color-primary-300` | `#81C784` | Ícones secundários                |
| `--color-primary-400` | `#66BB6A` | Hover de botão primário           |
| `--color-primary-500` | `#388E3C` | **Cor primária — verde campo**    |
| `--color-primary-600` | `#2E7D32` | Botão primário default            |
| `--color-primary-700` | `#1B5E20` | Botão primário pressed            |
| `--color-primary-800` | `#145218` | Textos sobre fundo claro          |
| `--color-primary-900` | `#0D3B10` | Headers fortes                    |

### Neutral Colors (Terra)

| Token                 | Hex       | Uso                                |
| --------------------- | --------- | ---------------------------------- |
| `--color-neutral-0`   | `#FFFFFF` | Background principal               |
| `--color-neutral-50`  | `#FAFAF8` | Background secundário (tom quente) |
| `--color-neutral-100` | `#F5F3EF` | Background de cards                |
| `--color-neutral-200` | `#E8E4DD` | Bordas leves, dividers             |
| `--color-neutral-300` | `#D4CEC4` | Bordas, placeholder                |
| `--color-neutral-400` | `#A8A196` | Texto desabilitado                 |
| `--color-neutral-500` | `#7A7267` | Texto secundário                   |
| `--color-neutral-600` | `#5C554C` | Texto de apoio                     |
| `--color-neutral-700` | `#3E3833` | Texto principal                    |
| `--color-neutral-800` | `#2A2520` | Headlines                          |
| `--color-neutral-900` | `#1A1613` | Texto máximo contraste             |

### Accent Colors

| Token               | Hex       | Uso                       |
| ------------------- | --------- | ------------------------- |
| `--color-sky-500`   | `#0288D1` | Links, ações informativas |
| `--color-sky-100`   | `#B3E5FC` | Background de info        |
| `--color-earth-500` | `#8D6E63` | Badges, categorias terra  |
| `--color-earth-100` | `#D7CCC8` | Background de tags        |
| `--color-sun-500`   | `#F9A825` | Warnings, atenção         |
| `--color-sun-100`   | `#FFF9C4` | Background de warnings    |

### Semantic Colors

| Token                 | Hex       | Uso                      |
| --------------------- | --------- | ------------------------ |
| `--color-success-500` | `#2E7D32` | Confirmação, status ok   |
| `--color-success-100` | `#E8F5E9` | Background de sucesso    |
| `--color-warning-500` | `#F57F17` | Alerta, ação recomendada |
| `--color-warning-100` | `#FFF8E1` | Background de warning    |
| `--color-error-500`   | `#C62828` | Erro, ação destrutiva    |
| `--color-error-100`   | `#FFEBEE` | Background de erro       |
| `--color-info-500`    | `#0277BD` | Informativo, dica        |
| `--color-info-100`    | `#E1F5FE` | Background de info       |

### Estado Offline/Sync

| Token             | Hex       | Uso               |
| ----------------- | --------- | ----------------- |
| `--color-offline` | `#78909C` | Indicador offline |
| `--color-syncing` | `#FFB300` | Sincronizando     |
| `--color-synced`  | `#43A047` | Sincronizado      |

---

## Dark Mode (Futuro)

Previsto mas não implementado na v1. Tokens já permitem inversão:

| Light                | Dark                |
| -------------------- | ------------------- |
| `neutral-0` (bg)     | `neutral-900` (bg)  |
| `neutral-900` (text) | `neutral-50` (text) |
| `primary-600` (btn)  | `primary-400` (btn) |

---

## Regras de Uso

1. **Nunca usar cor como único indicador** — sempre acompanhar com ícone ou texto (acessibilidade)
2. **Contraste mínimo WCAG AA**: 4.5:1 para texto normal, 3:1 para texto grande (>18px bold)
3. **Fundo de formulário sempre `neutral-0`** para máxima legibilidade de inputs
4. **Cor primária (verde) reservada para CTAs** — não usar em texto corrido
5. **Vermelho (`error-500`) apenas para erros e ações destrutivas** — nunca decorativo
