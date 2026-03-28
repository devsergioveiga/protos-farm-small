# Phase 41: SPED ECD e Relatório Integrado - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 41-sped-ecd-e-relat-rio-integrado
**Areas discussed:** Formato SPED ECD, Pré-validação PVA, Relatório Integrado PDF, Frontend e navegação

---

## Formato SPED ECD

### Geração síncrona vs assíncrona

| Option                 | Description                                       | Selected |
| ---------------------- | ------------------------------------------------- | -------- |
| Síncrona (Recomendado) | Gera na requisição HTTP e retorna download direto | ✓        |
| Assíncrona com BullMQ  | Job enfileirado, notificação quando pronto        |          |
| Você decide            | Claude escolhe                                    |          |

**User's choice:** Síncrona
**Notes:** Arquivo texto puro pipe-delimited, gera em segundos

### Blocos incluídos

| Option                              | Description              | Selected |
| ----------------------------------- | ------------------------ | -------- |
| Todos os blocos fixos (Recomendado) | Bloco 0 + I + J + 9      | ✓        |
| Blocos selecionáveis                | Checkboxes para escolher |          |

**User's choice:** Todos os blocos fixos

### Período

| Option                                  | Description           | Selected |
| --------------------------------------- | --------------------- | -------- |
| Exercício fiscal completo (Recomendado) | Seletor de FiscalYear | ✓        |
| Período customizável                    | Data início/fim       |          |

**User's choice:** Exercício fiscal completo

### Bloco J — Demonstrações

| Option                           | Description                  | Selected |
| -------------------------------- | ---------------------------- | -------- |
| J100 + J150 + J210 (Recomendado) | BP, DRE e DLPA obrigatórios  | ✓        |
| Incluir J215 também              | Fato relevante (texto livre) |          |

**User's choice:** J100 + J150 + J210

### Registro I050

| Option                      | Description                    | Selected |
| --------------------------- | ------------------------------ | -------- |
| Todas ativas (Recomendado)  | Sintéticas + analíticas ativas | ✓        |
| Só analíticas com movimento | Menos registros                |          |

**User's choice:** Todas ativas

### Dados do contador

| Option                              | Description                                  | Selected |
| ----------------------------------- | -------------------------------------------- | -------- |
| Campo na Organization (Recomendado) | accountantName, accountantCrc, accountantCpf | ✓        |
| Informado na geração                | Formulário a cada geração                    |          |
| Você decide                         | Claude escolhe                               |          |

**User's choice:** Campo na Organization

### Registros I200/I250

| Option                                     | Description                              | Selected |
| ------------------------------------------ | ---------------------------------------- | -------- |
| Ambos: I150/I155 + I200/I250 (Recomendado) | Saldos mensais + lançamentos individuais | ✓        |
| Só I150/I155 (saldos)                      | Apenas balanço mensal                    |          |

**User's choice:** Ambos

### Livro contábil

| Option                              | Description           | Selected |
| ----------------------------------- | --------------------- | -------- |
| Tipo G — Diário Geral (Recomendado) | Livro completo        | ✓        |
| Tipo R — Resumido                   | Escrituração resumida |          |

**User's choice:** Tipo G

### Encoding

| Option              | Description           | Selected |
| ------------------- | --------------------- | -------- |
| UTF-8 (Recomendado) | PVA 10.x aceita       | ✓        |
| ISO-8859-1          | Encoding clássico RFB |          |

**User's choice:** UTF-8

### Quebra de linha

| Option             | Description          | Selected |
| ------------------ | -------------------- | -------- |
| CRLF (Recomendado) | Conforme manual SPED | ✓        |
| Você decide        | Claude escolhe       |          |

**User's choice:** CRLF

### Assinatura digital

| Option                              | Description                      | Selected |
| ----------------------------------- | -------------------------------- | -------- |
| Sem hash — PVA assina (Recomendado) | PVA assina com certificado A1/A3 | ✓        |
| Hash SHA-256 interno                | Calcular hash no arquivo         |          |

**User's choice:** Sem hash — PVA assina

### Nome do arquivo

| Option                    | Description                | Selected |
| ------------------------- | -------------------------- | -------- |
| Padrão fixo (Recomendado) | SPED*ECD*{CNPJ}\_{ANO}.txt | ✓        |
| Você decide               | Claude define              |          |

**User's choice:** Padrão fixo

### Registros I350/I355

| Option                         | Description              | Selected |
| ------------------------------ | ------------------------ | -------- |
| Omitir I350/I355 (Recomendado) | Saldos diários opcionais | ✓        |
| Incluir I350/I355              | Saldos diários agregados |          |

**User's choice:** Omitir

---

## Pré-validação PVA

### Severidade

| Option                                          | Description                           | Selected |
| ----------------------------------------------- | ------------------------------------- | -------- |
| Erro bloqueia + Aviso informativo (Recomendado) | ERRO bloqueia download, AVISO permite | ✓        |
| Tudo bloqueia                                   | Qualquer problema impede download     |          |
| Você decide                                     | Claude classifica                     |          |

**User's choice:** Erro bloqueia + Aviso informativo

### Apresentação do relatório

| Option                               | Description                                  | Selected |
| ------------------------------------ | -------------------------------------------- | -------- |
| Lista inline na página (Recomendado) | Ícones vermelho/amarelo, links para corrigir | ✓        |
| Modal com relatório                  | Modal separado com tabela                    |          |
| PDF de validação                     | PDF para imprimir                            |          |

**User's choice:** Lista inline na página

### Trigger da validação

| Option                                           | Description                   | Selected |
| ------------------------------------------------ | ----------------------------- | -------- |
| Automático ao selecionar exercício (Recomendado) | Valida ao escolher FiscalYear | ✓        |
| Botão "Validar" explícito                        | Duas etapas separadas         |          |
| Você decide                                      | Claude escolhe fluxo          |          |

**User's choice:** Automático ao selecionar exercício

### Consistência I155

| Option                       | Description             | Selected |
| ---------------------------- | ----------------------- | -------- |
| Sim, verificar (Recomendado) | Soma I250 bate com I155 | ✓        |
| Não, confiar nos dados       | Menos processamento     |          |

**User's choice:** Sim, verificar

---

## Relatório Integrado PDF

### Seções do PDF

| Option                                               | Description     | Selected |
| ---------------------------------------------------- | --------------- | -------- |
| Capa + Índice + DRE + BP + DFC + Notas (Recomendado) | 6 seções padrão | ✓        |
| Adicionar DLPA + Balancete                           | 8 seções        |          |
| Você decide                                          | Claude define   |          |

**User's choice:** 6 seções

### Notas explicativas

| Option                                          | Description                                | Selected |
| ----------------------------------------------- | ------------------------------------------ | -------- |
| Template automático + texto livre (Recomendado) | Geradas auto + campo para notas adicionais | ✓        |
| Só template automático                          | Padrão sem customização                    |          |
| Só texto livre                                  | Contador escreve tudo                      |          |

**User's choice:** Template automático + texto livre

### Dados da capa

| Option                                        | Description                              | Selected |
| --------------------------------------------- | ---------------------------------------- | -------- |
| Organization + Farm selecionada (Recomendado) | Razão social/CNPJ da Org + dados da farm | ✓        |
| Formulário manual                             | Preenche a cada geração                  |          |

**User's choice:** Organization + Farm selecionada

### Período

| Option                         | Description                 | Selected |
| ------------------------------ | --------------------------- | -------- |
| Exercício fiscal (Recomendado) | Mesmo seletor de FiscalYear | ✓        |
| Período customizável           | Data início/fim             |          |

**User's choice:** Exercício fiscal

### Formato numérico

| Option                         | Description           | Selected |
| ------------------------------ | --------------------- | -------- |
| Padrão BR com R$ (Recomendado) | 1.234,56 com R$       | ✓        |
| Você decide                    | Claude define formato |          |

**User's choice:** Padrão BR com R$

---

## Frontend e Navegação

### Páginas

| Option                              | Description                         | Selected |
| ----------------------------------- | ----------------------------------- | -------- |
| Página única com tabs (Recomendado) | /sped-ecd com tabs SPED e Relatório | ✓        |
| Páginas separadas                   | /sped-ecd e /integrated-report      |          |
| Você decide                         | Claude escolhe                      |          |

**User's choice:** Página única com tabs

### Sidebar

| Option                               | Description                    | Selected |
| ------------------------------------ | ------------------------------ | -------- |
| No grupo CONTABILIDADE (Recomendado) | Último item do grupo existente | ✓        |
| Novo grupo OBRIGAÇÕES                | Grupo separado para obrigações |          |
| Você decide                          | Claude decide                  |          |

**User's choice:** No grupo CONTABILIDADE

### Edição de notas

| Option                                   | Description                      | Selected |
| ---------------------------------------- | -------------------------------- | -------- |
| Textarea na própria página (Recomendado) | Campo na tab Relatório Integrado | ✓        |
| Modal dedicado                           | Botão abre modal com editor      |          |

**User's choice:** Textarea na própria página

---

## Claude's Discretion

- Estrutura interna do SpedEcdWriter
- Queries para buscar lançamentos
- Formato exato dos registros SPED
- Template das notas explicativas automáticas
- Modelo de dados para rascunho de notas
- Layout visual do PDF
- Detalhes do textarea de notas
- Campos adicionais na Organization (migration design)

## Deferred Ideas

None — discussion stayed within phase scope
