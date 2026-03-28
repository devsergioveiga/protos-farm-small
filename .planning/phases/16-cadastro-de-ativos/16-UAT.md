---
status: testing
phase: 16-cadastro-de-ativos
source: 16-VERIFICATION.md
started: 2026-03-19T23:50:00Z
updated: 2026-03-19T23:55:00Z
---

## Current Test

<!-- OVERWRITE each test - shows where we are -->

number: 3
name: Cadastro de Ativo (Máquina)
expected: |
Clicar "Novo Ativo" abre modal. Selecionar tipo MAQUINA mostra campos específicos (HP, RENAVAM). Preencher dados obrigatórios e salvar — ativo aparece na lista com tag PAT-NNNNN gerada automaticamente.
awaiting: paused

## Tests

### 1. Cold Start Smoke Test

expected: Kill any running server/service. Start backend and frontend from scratch. Server boots without errors, migrations/seed complete, and navigating to the app shows the login page or dashboard.
result: pass

### 2. Navegação para Ativos

expected: No sidebar, o grupo "PATRIMÔNIO" aparece com o item "Ativos" (ícone Tractor). Clicar abre a página /assets com filtros, cards de resumo e lista vazia ou com dados.
result: pass

### 3. Cadastro de Ativo (Máquina)

expected: Clicar "Novo Ativo" abre modal. Selecionar tipo MAQUINA mostra campos específicos (HP, RENAVAM). Preencher dados obrigatórios e salvar — ativo aparece na lista com tag PAT-NNNNN gerada automaticamente.
result: [pending]

### 4. Cadastro de Benfeitoria com Coordenadas

expected: No modal, selecionar tipo BENFEITORIA mostra campos de latitude/longitude e área m². Preencher coordenadas decimais (ex: -23.55, -46.63) e salvar. O ativo aparece na lista.
result: [pending]

### 5. Campos Específicos por Tipo

expected: Ao trocar o tipo no modal (VEICULO, IMPLEMENTO, TERRA), os campos condicionais mudam: VEICULO mostra RENAVAM, IMPLEMENTO mostra "Máquina principal" (parent), TERRA mostra hectares/matrícula com classificação NON_DEPRECIABLE_CPC27 forçada.
result: [pending]

### 6. Filtros e Busca na Lista

expected: A página de ativos tem filtros por fazenda, tipo, status e período de aquisição. Aplicar um filtro atualiza a lista. O campo de busca filtra por nome/tag.
result: [pending]

### 7. Exportação CSV e PDF

expected: Na página de ativos, botões de exportação CSV e PDF estão visíveis. Clicar em CSV baixa um arquivo .csv com os ativos filtrados. Clicar em PDF baixa um relatório formatado.
result: [pending]

### 8. Ficha do Ativo (AssetDrawer)

expected: Clicar em um ativo na lista abre um drawer lateral com 6 abas: Geral, Documentos, Combustível, Leituras, Manutenção, Timeline. A aba Geral mostra os dados cadastrais completos.
result: [pending]

### 9. Registro de Abastecimento com Benchmarking

expected: Na aba Combustível do drawer, cadastrar um abastecimento (litros, custo). Após salvar, a aba mostra custo/litro e comparação com média da frota (benchmarking visual).
result: [pending]

### 10. Registro de Horímetro com Anti-Regressão

expected: Na aba Leituras do drawer, registrar uma leitura de horímetro. Tentar registrar um valor menor que o anterior — deve exibir erro de validação impedindo a regressão.
result: [pending]

### 11. Documentos com Alerta de Vencimento

expected: Na aba Documentos do drawer, cadastrar um documento com data de vencimento próxima (ex: 5 dias). O documento aparece com badge/indicador visual de vencimento (alerta 7 dias).
result: [pending]

### 12. Importação em Massa (Wizard)

expected: Na página de ativos, abrir o modal de importação. Upload de CSV → mapeamento de colunas → preview de dados → confirmação → relatório com sucessos e erros. Fluxo completo de 5 passos.
result: [pending]

### 13. Toggle List/Card View

expected: Na página de ativos, há toggle para alternar entre visão em lista (tabela) e visão em cards. Ambas exibem os ativos com informações resumidas.
result: [pending]

## Summary

total: 13
passed: 2
issues: 0
pending: 11
skipped: 0

## Gaps

[none yet]
