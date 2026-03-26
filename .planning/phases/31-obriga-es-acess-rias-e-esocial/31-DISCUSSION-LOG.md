# Phase 31: Obrigações Acessórias e eSocial - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 31-obrigações-acessórias-e-esocial
**Areas discussed:** Guias de Recolhimento, Transmissão eSocial e XML, Dashboard e Acompanhamento, Informe de Rendimentos e RAIS

---

## Guias de Recolhimento

| Option | Description | Selected |
|--------|-------------|----------|
| Gerar arquivo digital | Sistema gera arquivos nos formatos oficiais (SEFIP/GFIP .RE, DARF numérico) prontos para importar | ✓ |
| PDF com dados preenchidos | Gera PDFs das guias com campos preenchidos para impressão | |
| Apenas cálculo e resumo | Tela com resumo dos valores devidos, contador preenche guias nos portais | |

**User's choice:** Gerar arquivo digital
**Notes:** Contador não deve digitar valores manualmente

---

| Option | Description | Selected |
|--------|-------------|----------|
| CP automática | Ao gerar guia, cria CP com originType='TAX_GUIDE', valor, vencimento legal | ✓ |
| Opcional, com botão | Guia sem CP, contador clica para gerar | |
| Não, só guia | Guias independentes do financeiro | |

**User's choice:** CP automática
**Notes:** Mesmo padrão payroll→payables

---

| Option | Description | Selected |
|--------|-------------|----------|
| 10 e 5 dias | Amarelo 10d, vermelho 5d antes do vencimento | ✓ |
| 15 e 7 dias | Mais antecedência | |
| Você decide | Claude define | |

**User's choice:** 10 e 5 dias

---

| Option | Description | Selected |
|--------|-------------|----------|
| Config por organização | Campo funruralBasis = 'GROSS_REVENUE' ou 'PAYROLL'. Default: PAYROLL | ✓ |
| Sempre sobre folha | 100% sobre folha, sem configuração | |
| Você decide | Claude define | |

**User's choice:** Config por organização
**Notes:** É decisão fiscal da fazenda (PJ vs PF)

---

## Transmissão eSocial e XML

| Option | Description | Selected |
|--------|-------------|----------|
| Gerar XML para download | Gera XMLs válidos (S-1.3), valida XSD, download. Contador transmite manual | ✓ |
| Transmissão direta Web Service | Assina XML com certificado A1, transmite ao WS governo | |
| Ambos | Gera + transmite quando certificado configurado | |

**User's choice:** Gerar XML para download
**Notes:** Mais seguro, não requer certificado digital no servidor

---

| Option | Description | Selected |
|--------|-------------|----------|
| Validação XSD obrigatória | XSDs oficiais embarcados, validação antes do download, erros inline | ✓ |
| Validação lógica apenas | Campos obrigatórios e formatos no código TS, sem XSD | |
| Você decide | Claude define | |

**User's choice:** Validação XSD obrigatória

---

| Option | Description | Selected |
|--------|-------------|----------|
| Todos os 4 grupos | Tabela + Não Periódicos + Periódicos + SST | ✓ |
| Apenas periódicos + tabela | Foco no ciclo mensal, demais em phase futura | |
| Você decide | Claude define | |

**User's choice:** Todos os 4 grupos

---

| Option | Description | Selected |
|--------|-------------|----------|
| Automático + fila | Ações no sistema criam eventos em PENDENTE, contador revisa e baixa XML | ✓ |
| Manual com assistência | Contador vai na tela, seleciona tipo, sistema gera | |
| Você decide | Claude define | |

**User's choice:** Automático + fila

---

## Dashboard e Acompanhamento

| Option | Description | Selected |
|--------|-------------|----------|
| Por competência + status | Seletor mês/ano, cards resumo, tabela com filtro por grupo e status | ✓ |
| Timeline cronológica | Lista cronológica com chips, filtro lateral | |
| Você decide | Claude define | |

**User's choice:** Por competência + status

---

| Option | Description | Selected |
|--------|-------------|----------|
| PENDENTE → EXPORTADO | Download muda status, contador marca ACEITO/REJEITADO manualmente | ✓ |
| Status manual apenas | Download não muda status, tudo manual | |
| Você decide | Claude define | |

**User's choice:** PENDENTE → EXPORTADO

---

| Option | Description | Selected |
|--------|-------------|----------|
| Corrigir + regenerar | Marca REJEITADO com motivo, corrige dados, regenera XML v2/v3. Histórico preservado | ✓ |
| Excluir e recriar | Evento excluído, cria novo do zero, sem histórico | |
| Você decide | Claude define | |

**User's choice:** Corrigir + regenerar

---

| Option | Description | Selected |
|--------|-------------|----------|
| Páginas separadas | Sidebar grupo OBRIGAÇÕES: Guias, eSocial, Informes — cada um com página | ✓ |
| Dashboard unificado com tabs | Uma página com tabs | |
| Você decide | Claude define | |

**User's choice:** Páginas separadas

---

## Informe de Rendimentos e RAIS

| Option | Description | Selected |
|--------|-------------|----------|
| Modelo oficial RFB | PDF seguindo layout oficial Receita Federal com todas as seções | ✓ |
| Layout simplificado | PDF tabular simples | |
| Você decide | Claude define | |

**User's choice:** Modelo oficial RFB

---

| Option | Description | Selected |
|--------|-------------|----------|
| Email em lote + acesso web/app | Botão enviar informes, acesso na ficha e app. Padrão holerites | ✓ |
| Apenas download manual | Contador gera e baixa PDFs | |
| Você decide | Claude define | |

**User's choice:** Email em lote + acesso web/app

---

| Option | Description | Selected |
|--------|-------------|----------|
| Verificar via eSocial | Banner informativo + relatório consistência eventos do ano-base | ✓ |
| Gerar arquivo RAIS legado | Formato .txt antigo | |
| Ignorar RAIS | Não implementar | |

**User's choice:** Verificar via eSocial
**Notes:** RAIS substituída pelo eSocial desde 2019

---

| Option | Description | Selected |
|--------|-------------|----------|
| 5 anos | Últimos 5 anos-base, prazo prescricional | |
| Todos os anos | Sem limite, compliance máximo | ✓ |
| Você decide | Claude define | |

**User's choice:** Todos os anos

---

## Claude's Discretion

- Estrutura dos models Prisma (TaxGuide, EsocialEvent, IncomeStatement)
- Endpoints REST e query params
- Formato interno dos arquivos SEFIP/GFIP e DARF
- Implementação da validação XSD
- Componentes frontend
- Template do relatório de consistência RAIS
- Mapeamento ação→evento eSocial
- Lógica de versionamento de XMLs

## Deferred Ideas

- Transmissão direta via Web Service eSocial (certificado A1)
- Assinatura digital XML com ICP-Brasil
- Integração com DCTFWeb
- DIRF (verificar substituição por EFD-Reinf)
- Contribuição sindical patronal/laboral
- Relatórios gerenciais de custo tributário por fazenda
