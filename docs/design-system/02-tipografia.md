# Tipografia

## Fontes

### Display / Headlines — **DM Sans**

- Geométrica, moderna e legível
- Boa em telas pequenas e grandes
- Disponível no Google Fonts (grátis, licença aberta)
- Pesos: 500 (Medium), 700 (Bold)

### Body / UI — **Source Sans 3**

- Humanista, excelente legibilidade em corpo de texto
- Projetada para UI — funciona bem de 12px a 18px
- Disponível no Google Fonts
- Pesos: 400 (Regular), 600 (Semibold)

### Monospace (dados, código) — **JetBrains Mono**

- Para coordenadas GPS, IDs, dados tabulares
- Peso: 400 (Regular)

---

## Escala Tipográfica

Sistema modular ratio 1.25 (Major Third), base 16px:

| Token         | Tamanho         | Line Height | Peso | Uso                    |
| ------------- | --------------- | ----------- | ---- | ---------------------- |
| `--text-xs`   | 12px / 0.75rem  | 1.5 (18px)  | 400  | Captions, timestamps   |
| `--text-sm`   | 14px / 0.875rem | 1.5 (21px)  | 400  | Labels, texto auxiliar |
| `--text-base` | 16px / 1rem     | 1.5 (24px)  | 400  | Corpo de texto padrão  |
| `--text-md`   | 18px / 1.125rem | 1.45 (26px) | 400  | Corpo destaque, leads  |
| `--text-lg`   | 20px / 1.25rem  | 1.4 (28px)  | 500  | Subtítulos de seção    |
| `--text-xl`   | 24px / 1.5rem   | 1.3 (31px)  | 600  | Títulos de card        |
| `--text-2xl`  | 30px / 1.875rem | 1.25 (38px) | 700  | Títulos de página      |
| `--text-3xl`  | 36px / 2.25rem  | 1.2 (43px)  | 700  | Headlines de dashboard |
| `--text-4xl`  | 48px / 3rem     | 1.1 (53px)  | 700  | Números KPI (glance)   |

---

## Regras Tipográficas

### Hierarquia

```
H1 (text-2xl, DM Sans Bold)      → Título da página (1 por tela)
H2 (text-xl, DM Sans Medium)     → Seção principal
H3 (text-lg, DM Sans Medium)     → Sub-seção
Body (text-base, Source Sans 3)   → Texto corrido
Caption (text-sm, Source Sans 3)  → Informação auxiliar
```

### Comprimento de Linha

- **Ideal:** 55–75 caracteres por linha
- **Máximo:** 80 caracteres
- Em mobile, a largura da tela naturalmente limita isso

### Espaçamento entre Parágrafos

- Espaço entre parágrafos = `1em` (equivalente ao tamanho da fonte)
- Espaço após heading = `0.5em`
- Espaço antes de heading = `1.5em`

### Números e Dados

- KPIs e métricas: `text-4xl` ou `text-3xl`, DM Sans Bold
- Dados tabulares: `text-sm`, JetBrains Mono
- Coordenadas GPS: `text-xs`, JetBrains Mono
- Unidades (ha, kg, L): texto normal, não abreviar se houver espaço

### Responsividade Tipográfica

| Breakpoint          | Base | H1   | KPI  |
| ------------------- | ---- | ---- | ---- |
| Mobile (<640px)     | 16px | 24px | 36px |
| Tablet (640–1024px) | 16px | 28px | 42px |
| Desktop (>1024px)   | 16px | 30px | 48px |

---

## Anti-Patterns

- **Nunca** usar mais de 2 pesos por fonte na mesma tela
- **Nunca** usar texto menor que 12px (ilegível ao ar livre)
- **Nunca** centralizar blocos longos de texto (>2 linhas)
- **Nunca** usar ALL CAPS em frases inteiras (dificulta leitura)
- **Permitido** ALL CAPS apenas em labels curtas (ex: "STATUS", "ÁREA")
- **Evitar** itálico — em telas pequenas e ao sol, a legibilidade cai
