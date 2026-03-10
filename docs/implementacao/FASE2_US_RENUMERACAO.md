# Fase 2 — Renumeração Global de User Stories

**Data:** 2026-03-10
**Motivação:** O documento original (`ProtosFarm_Fase2_Operacoes_Core_UserStories.docx`) reutiliza US-076 a US-080 em múltiplos EPICs. Esta tabela atribui números globais únicos, continuando a sequência da Fase 1 (última US implementada: US-078).

---

## Legenda de Status

- **FEITO** — Implementado e merged em develop
- **PARCIAL** — Alguns CAs implementados, outros pendentes
- **PENDENTE** — Não iniciado

---

## Stories Já Implementadas (mantêm numeração original)

| Global | EPIC | Título                                      | Pts | Status                            |
| ------ | ---- | ------------------------------------------- | --- | --------------------------------- |
| US-037 | 07   | Gestão de cultivares e sementes             | 5   | FEITO                             |
| US-038 | 08   | Registro de aplicação de defensivos         | 8   | PARCIAL (falta CA8 baixa estoque) |
| US-039 | 08   | Registro de adubação cobertura/foliar       | 5   | FEITO                             |
| US-040 | 08   | Operações genéricas de trato cultural       | 5   | FEITO                             |
| US-041 | 08   | Cadastro de equipes de campo                | 5   | PARCIAL (falta CA8 centro custo)  |
| US-076 | 08   | Monitoramento de pragas e doenças (MIP)     | 8   | FEITO                             |
| US-077 | 08   | Lançamento de operação em bloco para equipe | 13  | PARCIAL (falta CA7-CA10)          |
| US-078 | 08   | Lançamento rápido de serviço manual diário  | 8   | FEITO                             |

> **Nota:** US-036 no projeto = "Registro rápido de operações (mobile)" da Fase 1/EPIC-06.
> O US-036 do doc Fase 2/EPIC-07 ("Planejamento de safra") foi renumerado abaixo.

---

## Stories Renumeradas — EPIC-08 (Tratos Culturais, restante)

| Global | Doc Original   | Título                                           | Pri   | Pts | Status   |
| ------ | -------------- | ------------------------------------------------ | ----- | --- | -------- |
| US-079 | EPIC-08/US-079 | Produtividade individual e bonificação de equipe | Média | 5   | PENDENTE |
| US-080 | EPIC-08/US-080 | Visualização e edição de operações em bloco      | Alta  | 5   | PENDENTE |

---

## Stories Renumeradas — EPIC-07 (Plantio, restante)

| Global | Doc Original   | Título                                                          | Pri  | Pts | Status   |
| ------ | -------------- | --------------------------------------------------------------- | ---- | --- | -------- |
| US-081 | EPIC-07/US-093 | Cadastro de operações de campo (hierárquico, fases fenológicas) | Alta | 5   | PENDENTE |
| US-082 | EPIC-07/US-034 | Registro de operação de preparo de solo                         | Alta | 8   | PENDENTE |
| US-083 | EPIC-07/US-035 | Registro de operação de plantio                                 | Alta | 8   | PENDENTE |
| US-084 | EPIC-07/US-036 | Planejamento de safra e calendário agrícola                     | Alta | 8   | PENDENTE |

---

## Stories Renumeradas — EPIC-09 (Colheita)

| Global | Doc Original   | Título                           | Pri   | Pts | Status   |
| ------ | -------------- | -------------------------------- | ----- | --- | -------- |
| US-085 | EPIC-09/US-077 | Registro de colheita de grãos    | Alta  | 8   | PENDENTE |
| US-086 | EPIC-09/US-078 | Registro de colheita de café     | Alta  | 5   | PENDENTE |
| US-087 | EPIC-09/US-079 | Registro de colheita de laranja  | Média | 5   | PENDENTE |
| US-088 | EPIC-09/US-080 | Mapa de produtividade por talhão | Alta  | 5   | PENDENTE |

---

## Stories Renumeradas — EPIC-10 (Estoque de Insumos)

| Global | Doc Original        | Título                                                | Pri   | Pts | Status   |
| ------ | ------------------- | ----------------------------------------------------- | ----- | --- | -------- |
| US-089 | EPIC-10/US-076 (1º) | Cadastro de produtos, insumos e serviços              | Alta  | 8   | PENDENTE |
| US-090 | EPIC-10/US-077 (1º) | Entrada de insumos no estoque (compra)                | Alta  | 8   | PENDENTE |
| US-091 | EPIC-10/US-078 (1º) | Saída de insumos (consumo e transferência)            | Alta  | 5   | PENDENTE |
| US-092 | EPIC-10/US-079 (1º) | Alertas de estoque e validade                         | Alta  | 5   | PENDENTE |
| US-093 | EPIC-10/US-080 (1º) | Inventário e conciliação de estoque                   | Média | 5   | PENDENTE |
| US-094 | EPIC-10/US-076 (2º) | Receituário agronômico integrado                      | Média | 8   | PENDENTE |
| US-095 | EPIC-10/US-077 (2º) | Cadastro de unidades de medida e fatores de conversão | Alta  | 8   | PENDENTE |
| US-096 | EPIC-10/US-078 (2º) | Conversão automática em operações de campo            | Alta  | 8   | PENDENTE |
| US-097 | EPIC-10/US-079 (2º) | Conversão automática em compras e NF de entrada       | Alta  | 5   | PENDENTE |
| US-098 | EPIC-10/US-080 (2º) | Conversão em comercialização e produção               | Alta  | 5   | PENDENTE |
| US-099 | EPIC-10/US-076 (3º) | Tabela de umidade e classificação de grãos            | Alta  | 5   | PENDENTE |

---

## Stories Renumeradas — EPIC-11 (Manejo Sanitário Pecuário)

| Global | Doc Original   | Título                                           | Pri   | Pts | Status   |
| ------ | -------------- | ------------------------------------------------ | ----- | --- | -------- |
| US-100 | EPIC-11/US-077 | Cadastro de protocolos sanitários                | Alta  | 8   | PENDENTE |
| US-101 | EPIC-11/US-078 | Registro de vacinação por animal e lote          | Alta  | 5   | PENDENTE |
| US-102 | EPIC-11/US-079 | Registro de vermifugação e controle de parasitas | Alta  | 5   | PENDENTE |
| US-103 | EPIC-11/US-086 | Cadastro de doenças                              | Alta  | 5   | PENDENTE |
| US-104 | EPIC-11/US-087 | Cadastro de protocolos de tratamento             | Alta  | 5   | PENDENTE |
| US-105 | EPIC-11/US-080 | Registro de tratamentos terapêuticos             | Alta  | 5   | PENDENTE |
| US-106 | EPIC-11/US-088 | Registro de exames dos animais                   | Alta  | 8   | PENDENTE |
| US-107 | EPIC-11/US-076 | Dashboard sanitário do rebanho                   | Média | 5   | PENDENTE |

---

## Stories Renumeradas — EPIC-12 (Manejo Reprodutivo)

> **Nota:** O doc lista 10 stories / 60 pts para EPIC-12, mas a extração capturou 7 (39 pts). 3 stories podem estar em formatação não-padrão no docx. Verificar manualmente se necessário.

| Global | Doc Original   | Título                                       | Pri   | Pts | Status   |
| ------ | -------------- | -------------------------------------------- | ----- | --- | -------- |
| US-108 | EPIC-12/US-077 | Cadastro de touros e sêmen                   | Alta  | 5   | PENDENTE |
| US-109 | EPIC-12/US-083 | Liberação de novilhas para reprodução        | Alta  | 5   | PENDENTE |
| US-110 | EPIC-12/US-084 | Detecção e registro de cio                   | Alta  | 5   | PENDENTE |
| US-111 | EPIC-12/US-085 | Cadastro de protocolos de IATF               | Alta  | 5   | PENDENTE |
| US-112 | EPIC-12/US-079 | Registro de monta natural (repasse)          | Média | 3   | PENDENTE |
| US-113 | EPIC-12/US-076 | Registro de parto, aborto e cria             | Alta  | 8   | PENDENTE |
| US-114 | EPIC-12/US-081 | Controle de desmama e desaleitamento         | Alta  | 8   | PENDENTE |
| US-115 | EPIC-12/???    | _(3 stories não extraídas — verificar docx)_ | —     | ~21 | PENDENTE |

---

## Stories Renumeradas — EPIC-13 (Controle de Produção de Leite)

| Global | Doc Original   | Título                                        | Pri   | Pts | Status   |
| ------ | -------------- | --------------------------------------------- | ----- | --- | -------- |
| US-116 | EPIC-13/US-077 | Registro de ordenha diária                    | Alta  | 8   | PENDENTE |
| US-117 | EPIC-13/US-078 | Registro e acompanhamento de análise de leite | Alta  | 8   | PENDENTE |
| US-118 | EPIC-13/US-089 | Registro clínico de mastite e tratamento      | Alta  | 8   | PENDENTE |
| US-119 | EPIC-13/US-079 | Gestão de tanque de resfriamento e entregas   | Alta  | 5   | PENDENTE |
| US-120 | EPIC-13/US-080 | Controle de lactação, secagem e indução       | Alta  | 8   | PENDENTE |
| US-121 | EPIC-13/US-076 | Dashboard de produção de leite                | Média | 5   | PENDENTE |

---

## Stories Renumeradas — EPIC-15 (Nutrição Animal)

| Global | Doc Original   | Título                                                     | Pri   | Pts | Status   |
| ------ | -------------- | ---------------------------------------------------------- | ----- | --- | -------- |
| US-122 | EPIC-15/US-090 | Cadastro de alimentos/ingredientes e análise bromatológica | Alta  | 8   | PENDENTE |
| US-123 | EPIC-15/US-091 | Cadastro de dietas por categoria de animal                 | Alta  | 8   | PENDENTE |
| US-124 | EPIC-15/US-092 | Registro de trato/fornecimento e consumo                   | Média | 5   | PENDENTE |

---

## Stories Renumeradas — EPIC-14 (Sincronização Offline Avançada)

| Global | Doc Original   | Título                                       | Pri   | Pts | Status   |
| ------ | -------------- | -------------------------------------------- | ----- | --- | -------- |
| US-125 | EPIC-14/US-077 | Sync bidirecional com resolução de conflitos | Alta  | 13  | PENDENTE |
| US-126 | EPIC-14/US-078 | Fila de operações offline com priorização    | Alta  | 8   | PENDENTE |
| US-127 | EPIC-14/US-079 | Cache inteligente de dados de referência     | Alta  | 8   | PENDENTE |
| US-128 | EPIC-14/US-080 | Modo de operação degradada com indicadores   | Média | 5   | PENDENTE |

---

## Resumo por EPIC

| EPIC      | Tema                        | Stories               | Pts      | Status   |
| --------- | --------------------------- | --------------------- | -------- | -------- |
| 07        | Plantio (restante)          | 4 (US-081 a US-084)   | 29       | PENDENTE |
| 08        | Tratos Culturais (restante) | 2 (US-079, US-080)    | 10       | PENDENTE |
| 09        | Colheita                    | 4 (US-085 a US-088)   | 23       | PENDENTE |
| 10        | Estoque de Insumos          | 11 (US-089 a US-099)  | 70       | PENDENTE |
| 11        | Sanitário Pecuário          | 8 (US-100 a US-107)   | 46       | PENDENTE |
| 12        | Reprodutivo                 | 7+3 (US-108 a US-115) | ~60      | PENDENTE |
| 13        | Leite                       | 6 (US-116 a US-121)   | 42       | PENDENTE |
| 15        | Nutrição Animal             | 3 (US-122 a US-124)   | 21       | PENDENTE |
| 14        | Sync Avançada               | 4 (US-125 a US-128)   | 34       | PENDENTE |
| **TOTAL** |                             | **~52**               | **~335** |          |

> **Nota:** ~8 stories residuais da Fase 1 (CAs pendentes de US-038, US-041, US-077) não estão contabilizadas aqui. Totalizando com o doc: 60 stories / 392 pts originais.
