# Phase 31: Obrigações Acessórias e eSocial - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Compliance fiscal e trabalhista completo: geração de guias de recolhimento (FGTS/INSS/IRRF/FUNRURAL) em formato digital com integração automática ao Contas a Pagar, geração de eventos eSocial em XML (leiaute S-1.3) com validação XSD e download para transmissão manual, dashboard de acompanhamento por competência/status com reprocessamento de rejeitados, e informes de rendimentos em PDF (modelo oficial RFB) com distribuição por email e histórico completo.

</domain>

<decisions>
## Implementation Decisions

### Guias de Recolhimento

- **D-01:** Gerar arquivos digitais nos formatos oficiais — SEFIP/GFIP (.RE) para FGTS, DARF numérico para INSS/IRRF, GPS/DARF para FUNRURAL. Contador importa nos sistemas da Receita/Caixa sem digitar valores manualmente.
- **D-02:** Cada guia gerada cria automaticamente uma Conta a Pagar com `originType='TAX_GUIDE'`, valor calculado, vencimento legal e categoria (FGTS/INSS/IRRF/FUNRURAL). Mesmo padrão payroll→payables existente.
- **D-03:** Alertas de vencimento: amarelo 10 dias antes, vermelho 5 dias antes. Visível no dashboard e na listagem de guias.
- **D-04:** FUNRURAL configurável por organização: campo `funruralBasis` = 'GROSS_REVENUE' (2,05% receita bruta) ou 'PAYROLL' (2,7% folha). Default: PAYROLL. Alíquotas via payroll-tables com effective-date.

### Transmissão eSocial e XML

- **D-05:** Sistema gera XMLs válidos conforme leiaute S-1.3 e disponibiliza para download. Contador transmite manualmente via portal eSocial ou software fiscal. Sem transmissão direta via Web Service nesta phase (não requer certificado digital no servidor).
- **D-06:** Validação XSD obrigatória — XSDs oficiais do leiaute S-1.3 embarcados no projeto. XML validado antes de liberar download. Erros exibidos inline com campo e mensagem.
- **D-07:** Todos os 4 grupos de eventos: Tabela (S-1000/S-1005/S-1010/S-1020), Não Periódicos (S-2190/S-2200/S-2206/S-2230/S-2299), Periódicos (S-1200/S-1210/S-1299), SST (S-2210/S-2220/S-2240).
- **D-08:** Eventos gerados automaticamente a partir de ações no sistema — admissão cria S-2200, rescisão cria S-2299, fechamento folha cria S-1200/S-1210/S-1299, ASO cria S-2220, etc. Eventos ficam em status PENDENTE para revisão pelo contador antes do download.

### Dashboard e Acompanhamento

- **D-09:** Dashboard eSocial por competência + status. Seletor mês/ano, cards resumo (total eventos, pendentes, exportados, com erro), tabela de eventos com filtro por grupo e status.
- **D-10:** Fluxo de status: PENDENTE → EXPORTADO (ao fazer download) → ACEITO ou REJEITADO (marcação manual pelo contador após transmitir no portal).
- **D-11:** Reprocessamento de rejeitados: contador marca REJEITADO com motivo (campo texto), corrige dados de origem, regenera XML com versão incremental (v2, v3). Histórico de versões preservado.
- **D-12:** Páginas separadas no sidebar: grupo OBRIGAÇÕES com sub-itens: Guias de Recolhimento, Eventos eSocial, Informes de Rendimentos. Cada um com página dedicada.

### Informe de Rendimentos e RAIS

- **D-13:** PDF seguindo modelo oficial da Receita Federal: seções de rendimentos tributáveis, deduções (INSS, dependentes), IRRF retido, rendimentos isentos, informações complementares. Gerado via pdfkit.
- **D-14:** Distribuição: email em lote (botão 'Enviar informes') para colaboradores com email + acesso na ficha do colaborador (web) e app. Mesmo padrão dos holerites (Phase 28).
- **D-15:** RAIS substituída pelo eSocial — sistema mostra banner informativo + relatório de consistência que verifica se todos os eventos de tabela/admissão/remuneração foram gerados corretamente no ano-base.
- **D-16:** Histórico de informes sem limite — manter todos os anos-base já gerados. Filtro por ano na tela de informes.

### Claude's Discretion

- Estrutura dos models Prisma (TaxGuide, EsocialEvent, IncomeStatement, etc.)
- Endpoints REST e query params
- Formato interno dos arquivos SEFIP/GFIP (.RE) e DARF numérico
- Implementação da validação XSD (libxmljs2 ou xml-validator ou custom)
- Organização dos componentes frontend
- Template do relatório de consistência RAIS
- Mapeamento exato de cada ação do sistema para evento eSocial correspondente
- Lógica de versionamento de XMLs rejeitados

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Roadmap

- `.planning/REQUIREMENTS.md` — ESOCIAL-01, ESOCIAL-02, ESOCIAL-03 (critérios de aceite detalhados)
- `.planning/ROADMAP.md` §Phase 31 — Goal, success criteria, dependencies

### Documentação de Domínio

- `protos-farm-documentation-small/ProtosFarm_Fase3_RH_Folha_UserStories.docx` — User stories originais de RH e Folha de Pagamento

### Decisões Anteriores (Phases 28-30)

- `.planning/phases/28-processamento-da-folha-mensal/28-CONTEXT.md` — PayrollRun, holerites, adiantamento, 13º, estorno, distribuição email
- `.planning/phases/30-seguranca-trabalho-nr31/30-CONTEXT.md` — ASOs e MedicalExam (SST events source), TrainingRecord, EpiDelivery
- `.planning/phases/25-cadastro-de-colaboradores-e-contratos/25-CONTEXT.md` — Employee entity, contracts, state machine (admissão/rescisão events source)

### Motor de Cálculo e Rubricas (já implementados)

- `apps/backend/src/modules/payroll-engine/payroll-engine.service.ts` — calculateINSS, calculateIRRF, calculateFGTS (totais para guias)
- `apps/backend/src/modules/payroll-engine/payroll-engine.types.ts` — INSSResult, IRRFResult, FGTSResult
- `apps/backend/src/modules/payroll-rubricas/` — Rubricas com eSocialCode (mapeamento para eventos periódicos)
- `apps/backend/src/modules/payroll-tables/` — Tabelas INSS/IRRF/FUNRURAL com effective-date
- `apps/backend/src/modules/payroll-runs/` — PayrollRun com items, totais por colaborador

### Contas a Pagar (integração)

- `apps/backend/src/modules/payables/` — originType/originId upsert pattern (reusar para TAX_GUIDE)

### Design System

- `docs/design-system/04-componentes.md` — Specs de componentes (modals, tabs, tables, chips de status)
- `docs/design-system/05-padroes-ux.md` — Padrões UX (voz pt-BR, validação, formulários)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `payroll-engine` — calculateINSS/IRRF/FGTS retornam totais que alimentam as guias
- `payroll-runs` — PayrollRun com items agregados por competência (fonte dos valores das guias e eventos periódicos)
- `payroll-rubricas` — Rubricas com `eSocialCode` já mapeado (alimenta S-1010 e S-1200)
- `payroll-tables` — Tabelas INSS/IRRF/FUNRURAL com effective-date (alíquotas para guias)
- `@xmldom/xmldom` — Já instalado, usado em NF-e parser e OFX parser
- `pdfkit` + `pdfkit-table` — Já instalado, usado em holerites, fichas EPI, certificados
- `payables` module — originType/originId upsert (reusar com originType='TAX_GUIDE')
- Employee model com email, contracts, positions — fonte de dados para eventos e informes
- MedicalExam (Phase 30) — fonte para eventos S-2220 (ASO)
- EmployeeAbsence (Phase 29) — fonte para eventos S-2230 (afastamentos)

### Established Patterns

- PayrollRun state machine (PENDING→PROCESSING→COMPLETED|ERROR) — modelo para EsocialEvent status
- Payables upsert prevents duplicate CPs on re-processing
- Express 5 module pattern: service + routes + types + spec colocalizados
- Frontend: useState+useCallback hooks, modals para CRUD, tabs para seções
- PDF distribution: email em lote ao fechar (holerites Phase 28)
- Status chips coloridos: padrão existente em várias páginas

### Integration Points

- PayrollRun.items → fonte para guias FGTS/INSS/IRRF (somar por competência)
- PayrollRun fechamento → trigger eventos periódicos S-1200/S-1210/S-1299
- Employee admissão/rescisão → trigger eventos não periódicos S-2200/S-2299
- MedicalExam criação → trigger evento SST S-2220
- Organization → fonte para evento tabela S-1000, campo funruralBasis
- Position → fonte para evento tabela S-1020 (lotação tributária)
- Sidebar: novo grupo OBRIGAÇÕES abaixo do grupo SEGURANÇA

</code_context>

<specifics>
## Specific Ideas

- Guias geram arquivos digitais nos formatos oficiais (SEFIP .RE, DARF numérico) — não PDFs genéricos
- FUNRURAL configurável por org (receita bruta vs. folha) — é decisão fiscal da fazenda
- eSocial: gerar XML para download, NÃO transmitir diretamente — mais seguro e prático para contadores rurais
- Eventos eSocial criados automaticamente por ações no sistema (admissão, rescisão, folha, ASO)
- Status dos eventos: PENDENTE → EXPORTADO (download) → ACEITO/REJEITADO (manual pelo contador)
- Rejeitados: corrigir e regenerar com versão incremental (v2, v3), preservar histórico
- RAIS substituída por eSocial — banner informativo + relatório de consistência
- Informes de rendimentos: modelo oficial RFB, distribuição por email, histórico ilimitado

</specifics>

<deferred>
## Deferred Ideas

- Transmissão direta via Web Service eSocial (requer certificado A1 no servidor) — phase futura
- Assinatura digital XML com ICP-Brasil — acompanha transmissão direta
- Integração com DCTFWeb (substituiu GFIP para parte das obrigações) — phase futura
- DIRF (Declaração de Imposto de Renda Retido na Fonte) — verificar se substituída pelo EFD-Reinf
- Contribuição sindical patronal e laboral — pode adicionar depois
- Relatórios gerenciais de custo tributário por fazenda — Phase 32 (dashboard RH)

</deferred>

---

_Phase: 31-obriga-es-acess-rias-e-esocial_
_Context gathered: 2026-03-26_
