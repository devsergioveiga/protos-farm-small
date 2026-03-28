---
phase: 24-ativos-biol-gicos-leasing-e-features-avan-adas
verified: 2026-03-23T14:30:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: 'Abrir /biological-assets e registrar avaliacao de VACA_LACTACAO com 100 cabecas a R$3.000 cada — verificar calculo automatico do totalFairValue (R$300.000) e que KPI cards aparecem'
    expected: 'Pagina carrega, modal abre, totalFairValue calculado automaticamente, KPI card exibe variacao com seta verde/vermelha (nunca so cor)'
    why_human: 'Calculo de totalFairValue e renderizacao do indicador visual requerem interacao real no browser'
  - test: 'Registrar segunda avaliacao do mesmo assetGroup com preco diferente — verificar que fairValueChange aparece na tabela como valor positivo ou negativo com icone'
    expected: 'fairValueChange exibido com indicador de seta + texto, nao apenas cor'
    why_human: 'Comportamento de variacao depende de estado acumulado entre registros'
  - test: "Abrir /asset-leasings e criar contrato de leasing — verificar que o badge de status ATIVO aparece e os botoes 'Exercer Opcao', 'Devolver' e 'Cancelar' ficam visiveis"
    expected: 'Status badge aparece com cor + texto + icone (nunca so cor); botoes de acao com ConfirmModal ao clicar'
    why_human: 'Comportamento de badges e dropdowns de acao requer inspecao visual'
  - test: "No drawer de um ativo ATIVO, verificar que botao 'Trocar Ativo' aparece ao lado de 'Alienar'"
    expected: "Botao com icone ArrowLeftRight e label 'Trocar Ativo' visivel; clicar abre AssetTradeInModal"
    why_human: 'Integracao no AssetDrawer requer inspecao visual do contexto de ativo ativo'
  - test: 'Executar trade-in no modal: selecionar ativo antigo, preencher ativo novo com valor maior — verificar secao de Resumo Financeiro mostra saldo a pagar correto'
    expected: 'Saldo a pagar = valor novo - valor antigo, destacado quando positivo; confirmacao obrigatoria antes de executar'
    why_human: 'Calculo de resumo financeiro e fluxo de confirmacao requerem interacao com estado do formulario'
---

# Phase 24: Ativos Biológicos, Leasing e Features Avançadas — Verification Report

**Phase Goal:** Contador pode registrar valor justo de ativos biológicos (CPC 29) e leasing (CPC 06), e o gerente pode registrar troca de ativo com compensação financeira — cobrindo os cenários contábeis mais complexos do patrimônio rural
**Verified:** 2026-03-23T14:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                          | Status   | Evidence                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Contador pode registrar valor justo de ativos biológicos (rebanho por categoria e culturas perenes por estágio) com variação de valor justo registrada automaticamente         | VERIFIED | `biological-assets.service.ts` calcula `fairValueChange = totalFairValue - previousValue` via `decimal.js`; `findFirst` por `organizationId + assetGroup` ordenado por data; 14 testes passando                                                                                                |
| 2   | Planta portadora (café, laranja) classificada como CPC 27 depreciável — não CPC 29 — e entra no lote de depreciação normal                                                     | VERIFIED | `BEARER_PLANT_CPC27` enum existe no schema; `depreciation-batch.service.ts:62` inclui `BEARER_PLANT_CPC27` no lote; frontend `asset.ts:238` rotula como "CPC 27 — Planta portadora"; `PERENNIAL_CROP_GROUPS` no módulo biological-assets contém apenas culturas "em formação"                  |
| 3   | Gerente pode registrar leasing (CPC 06) com ROU asset criado automaticamente, parcelas no CP com categoria FINANCING e controle de opção de compra                             | VERIFIED | `asset-leasings.service.ts`: `prisma.$transaction` atômico cria ROU Asset (`DEPRECIABLE_CPC27`) + `depreciationConfig` (`STRAIGHT_LINE`) + `payable` (`FINANCING`) + `payableInstallment.createMany` via `generateInstallments`; 13 testes passando                                            |
| 4   | Gerente pode registrar troca de ativo (trade-in) com compensação financeira automática — valor do ativo antigo abatido do novo — gerando baixa e aquisição no mesmo lançamento | VERIFIED | `asset-trade-ins.service.ts`: `prisma.$transaction` atômico: valida ativo (`ATIVO`), computa NBV via `depreciationEntry.aggregate`, seta `ALIENADO` + cancela depreciações, cria ativo novo com `getNextAssetTag`, cria `AssetTradeIn`, gera CP apenas se `netPayable > 0`; 15 testes passando |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                                                                      | Expected                                                     | Status   | Details                                                                                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/backend/src/modules/biological-assets/biological-assets.service.ts`     | CRUD + fair value change calculation                         | VERIFIED | 222 linhas; `createValuation`, `listValuations`, `getValuation`, `deleteValuation`, `getSummary`; `new Decimal` presente |
| `apps/backend/src/modules/biological-assets/biological-assets.routes.ts`      | REST endpoints                                               | VERIFIED | `biologicalAssetsRouter` exportado; `/org/:orgId/biological-assets`; `/summary` registrado antes de `/:id`               |
| `apps/backend/src/modules/biological-assets/biological-assets.routes.spec.ts` | 14 testes                                                    | VERIFIED | 14 testes passando: auth guard, ANIMAL/PERENNIAL_CROP, fairValueChange, filtros, summary, CRUD                           |
| `apps/backend/src/modules/asset-leasings/asset-leasings.service.ts`           | Leasing CRUD + ROU + installments + lifecycle                | VERIFIED | 422 linhas; `createLeasing`, `listLeasings`, `getLeasing`, `exercisePurchaseOption`, `returnAsset`, `cancelLeasing`      |
| `apps/backend/src/modules/asset-leasings/asset-leasings.routes.ts`            | REST endpoints + lifecycle routes                            | VERIFIED | `assetLeasingsRouter` exportado; `exercise-purchase`, `return`, `cancel` presentes                                       |
| `apps/backend/src/modules/asset-leasings/asset-leasings.routes.spec.ts`       | 13 testes                                                    | VERIFIED | 13 testes passando: criação atômica, datas inválidas, exercise/return/cancel, 401                                        |
| `apps/backend/src/modules/asset-trade-ins/asset-trade-ins.service.ts`         | Atomic trade-in                                              | VERIFIED | 262 linhas; `createTradeIn`, `listTradeIns`, `getTradeIn`; `depreciationEntry.aggregate` para NBV                        |
| `apps/backend/src/modules/asset-trade-ins/asset-trade-ins.routes.ts`          | REST endpoints                                               | VERIFIED | `assetTradeInsRouter` exportado; `/org/:orgId/asset-trade-ins`                                                           |
| `apps/backend/src/modules/asset-trade-ins/asset-trade-ins.routes.spec.ts`     | 15 testes                                                    | VERIFIED | 15 testes passando: todos os cenários (404, 409, 400, 401, gain/loss, netPayable)                                        |
| `apps/frontend/src/pages/BiologicalAssetsPage.tsx`                            | Página com KPI cards, tabela filtrável, modal                | VERIFIED | `useBiologicalAssets` wired; `fairValueChange` renderizado; `ConfirmModal` para delete; skeleton loading                 |
| `apps/frontend/src/components/assets/BiologicalAssetValuationModal.tsx`       | Modal de criação de avaliação                                | VERIFIED | `aria-required`, `role="alert"`, `onSuccess`; grupos ANIMAL/PERENNIAL_CROP; auto-compute `totalFairValue`                |
| `apps/frontend/src/hooks/useBiologicalAssets.ts`                              | Hook com fetch e mutations                                   | VERIFIED | GET `/biological-assets` + `/biological-assets/summary`; `createValuation`; `deleteValuation`                            |
| `apps/frontend/src/pages/AssetLeasingsPage.tsx`                               | Página com status badges e lifecycle actions                 | VERIFIED | `useAssetLeasings` wired; `ConfirmModal`; `exercisePurchase`; status badges com labels                                   |
| `apps/frontend/src/components/assets/AssetLeasingModal.tsx`                   | Modal de criação de contrato                                 | VERIFIED | `aria-required`; `hasPurchaseOption`; grupos de campos; `onSuccess`                                                      |
| `apps/frontend/src/hooks/useAssetLeasings.ts`                                 | Hook com lifecycle methods                                   | VERIFIED | `exercisePurchase` → PUT `exercise-purchase`; `returnAsset` → PUT `return`; `cancelLeasing` → PUT `cancel`               |
| `apps/frontend/src/components/assets/AssetTradeInModal.tsx`                   | Modal trade-in com 3 seções                                  | VERIFIED | `tradedAssetId`, `newAssetValue`, `ConfirmModal`, `aria-required`, `role="alert"`, `onSuccess`                           |
| `apps/frontend/src/hooks/useAssetTradeIns.ts`                                 | Hook com createTradeIn                                       | VERIFIED | POST `/asset-trade-ins`; `createTradeIn` exportado                                                                       |
| `apps/backend/prisma/schema.prisma`                                           | Modelos BiologicalAssetValuation, AssetLeasing, AssetTradeIn | VERIFIED | Todos os modelos presentes; relations em Organization/Farm/User/Asset; índices corretos                                  |

### Key Link Verification

| From                           | To                                                                       | Via                              | Status | Details                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------ | -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `biological-assets.service.ts` | `prisma.biologicalAssetValuation`                                        | `findFirst` + `create`           | WIRED  | `biologicalAssetValuation.findFirst` para valor anterior; `biologicalAssetValuation.create` para novo registro                                          |
| `biological-assets.service.ts` | `decimal.js`                                                             | `new Decimal` aritmética         | WIRED  | `new Decimal` presente; `fairValueChange = totalFairValueDec.minus(previousValueDec)`                                                                   |
| `BiologicalAssetsPage.tsx`     | `/api/org/:orgId/biological-assets`                                      | `useBiologicalAssets` hook       | WIRED  | Hook importado e consumido; `valuations` e `summary` renderizados                                                                                       |
| `asset-leasings.service.ts`    | `prisma.$transaction` (ROU + DeprecConfig + Payable + Installments)      | transação atômica                | WIRED  | `prisma.$transaction` com `asset.create`, `depreciationConfig.create`, `payable.create`, `payableInstallment.createMany`                                |
| `asset-leasings.service.ts`    | `@protos-farm/shared`                                                    | `generateInstallments` + `Money` | WIRED  | Importados no topo; `generateInstallments(Money(totalContractValue), installmentCount, firstDueDate)`                                                   |
| `AssetLeasingsPage.tsx`        | `/api/org/:orgId/asset-leasings`                                         | `useAssetLeasings` hook          | WIRED  | Hook importado e consumido; `leasings` renderizados com status badges                                                                                   |
| `asset-trade-ins.service.ts`   | `prisma.$transaction` (ALIENADO + depreciation cancel + new asset + CP)  | transação atômica                | WIRED  | `prisma.$transaction` com `asset.update(ALIENADO)`, `depreciationEntry.updateMany`, `asset.create`, `assetTradeIn.create`, `payable.create` condicional |
| `asset-trade-ins.service.ts`   | NBV calculation                                                          | `depreciationEntry.aggregate`    | WIRED  | `depreciationEntry.aggregate` com `_sum.depreciationAmount`                                                                                             |
| `AssetTradeInModal.tsx`        | `/api/org/:orgId/asset-trade-ins`                                        | `useAssetTradeIns` hook          | WIRED  | Hook importado; `createTradeIn` chamado no submit                                                                                                       |
| `AssetDrawer.tsx`              | `AssetTradeInModal`                                                      | botão "Trocar Ativo"             | WIRED  | `import AssetTradeInModal from './AssetTradeInModal'`; `ArrowLeftRight` icon; visível apenas para assets `ATIVO`                                        |
| `app.ts`                       | `biologicalAssetsRouter` + `assetLeasingsRouter` + `assetTradeInsRouter` | `app.use('/api', ...)`           | WIRED  | Linhas 250, 268-269 de `app.ts`; todos os 3 routers registrados                                                                                         |
| `App.tsx`                      | `BiologicalAssetsPage` + `AssetLeasingsPage`                             | lazy routes                      | WIRED  | `/biological-assets` e `/asset-leasings` registrados; imports lazy presentes                                                                            |
| `Sidebar.tsx`                  | `/biological-assets` + `/asset-leasings`                                 | entradas PATRIMÔNIO              | WIRED  | `Leaf` icon para Ativos Biologicos (linha 208); `FileText` para Contratos Leasing (linha 209)                                                           |

### Data-Flow Trace (Level 4)

| Artifact                   | Data Variable                     | Source                                                                                                                       | Produces Real Data | Status  |
| -------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------- |
| `BiologicalAssetsPage.tsx` | `valuations`, `summary`           | `useBiologicalAssets` → GET `/biological-assets` + `/biological-assets/summary` → `prisma.biologicalAssetValuation.findMany` | Sim                | FLOWING |
| `AssetLeasingsPage.tsx`    | `leasings`                        | `useAssetLeasings` → GET `/asset-leasings` → `prisma.assetLeasing.findMany`                                                  | Sim                | FLOWING |
| `AssetTradeInModal.tsx`    | `tradedAsset` (asset selecionado) | `useAssets` (assets existentes do org) → `prisma.asset.findMany`                                                             | Sim                | FLOWING |

### Behavioral Spot-Checks

| Behavior                        | Command                                                                        | Result                                                   | Status |
| ------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- | ------ |
| Testes biological-assets passam | `npx jest biological-assets --no-coverage`                                     | 14/14 passando em 1.55s                                  | PASS   |
| Testes asset-leasings passam    | `npx jest asset-leasings --no-coverage`                                        | 13/13 passando em 0.92s                                  | PASS   |
| Testes asset-trade-ins passam   | `npx jest asset-trade-ins --no-coverage`                                       | 15/15 passando em 0.92s                                  | PASS   |
| Commits documentados existem    | `git log --oneline e956bdef 7db1c157 5fe31b29 4cb15172 04209f6c 5786c2b1`      | Todos os 6 commits encontrados                           | PASS   |
| Routers registrados no app.ts   | `grep biologicalAssetsRouter\|assetLeasingsRouter\|assetTradeInsRouter app.ts` | Linhas 112, 130-131 (imports) + 250, 268-269 (registros) | PASS   |
| Entradas na sidebar             | `grep biological-assets\|asset-leasings Sidebar.tsx`                           | Linhas 208-209 confirmadas                               | PASS   |

### Requirements Coverage

| Requirement | Source Plan   | Description                                                                               | Status    | Evidence                                                                                                                                                          |
| ----------- | ------------- | ----------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEPR-03     | 24-01-PLAN.md | Contador pode registrar valor justo de ativos biológicos (CPC 29/IAS 41)                  | SATISFIED | `biological-assets` módulo completo: `BiologicalAssetValuation` model, `fairValueChange` auto-calculado, 14 testes, frontend page + modal                         |
| AQUI-05     | 24-02-PLAN.md | Gerente pode registrar leasing e arrendamento mercantil (CPC 06) com CP e opção de compra | SATISFIED | `asset-leasings` módulo completo: criação atômica ROU+DepreciationConfig+Payable+Installments, lifecycle exercise/return/cancel, 13 testes, frontend page + modal |
| AQUI-06     | 24-03-PLAN.md | Gerente pode registrar troca de ativo (trade-in) com compensação financeira automática    | SATISFIED | `asset-trade-ins` módulo completo: transação atômica (baixa + criação + CP condicional), NBV via aggregate, 15 testes, modal integrado no AssetDrawer             |

**Nota:** REQUIREMENTS.md marca DEPR-03, AQUI-05 e AQUI-06 como "Pending" na tabela de rastreamento (linhas 142-144). A implementação está completa — apenas o arquivo de tracking precisa ser atualizado de `Pending` para `Complete` e os checkboxes `[ ]` marcados como `[x]`.

### Anti-Patterns Found

| File                                     | Line | Pattern | Severity | Impact |
| ---------------------------------------- | ---- | ------- | -------- | ------ |
| Nenhum anti-padrão bloqueador encontrado | —    | —       | —        | —      |

Observações:

- `biological-assets.service.ts:116` usa cast `(ctx as { userId?: string }).userId ?? 'system'` — workaround para campo opcional no tipo `RlsContext`. Não impede funcionamento mas pode ser melhorado adicionando `userId` ao tipo `RlsContext`.
- `asset-leasings.service.ts:162` usa `input.assetType as never` para contornar tipagem — seguro mas sugere que o enum `AssetType` poderia ser importado explicitamente.
- REQUIREMENTS.md não foi atualizado para refletir a conclusão da fase (checkboxes e status de "Pending" para "Complete").

### Human Verification Required

#### 1. Biological Assets — KPI Cards e Variação Visual

**Test:** Abrir `/biological-assets`, criar duas avaliações do mesmo grupo (ex: VACA_LACTACAO) com preços diferentes em datas distintas. Na segunda avaliação, verificar que o campo `fairValueChange` é calculado automaticamente e exibido na tabela com seta + texto (não apenas cor).
**Expected:** KPI card mostra valor mais recente com indicador de seta verde (ganho) ou vermelha (perda) acompanhado de texto. Tabela exibe linha da segunda avaliação com variação não-nula.
**Why human:** Renderização dos indicadores visuais e cálculo de totalFairValue a partir dos campos do formulário requerem interação real no browser.

#### 2. Biological Assets — Primeiro Registro com Variação Nula

**Test:** Criar a primeira avaliação para um grupo novo. Verificar que `fairValueChange` na tabela aparece como "—" ou vazio, não como zero.
**Expected:** Coluna de variação mostra valor nulo/vazio (não "R$ 0,00") para a primeira avaliação de cada grupo.
**Why human:** Distinção visual entre `null` e `0` requer inspeção do componente renderizado.

#### 3. Asset Leasings — Status Badges e Ações de Lifecycle

**Test:** Criar contrato de leasing com opção de compra. Verificar que badge ATIVO aparece com cor + ícone + texto. Clicar em "Exercer Opção" e confirmar no ConfirmModal.
**Expected:** Badge não usa cor como único indicador; ConfirmModal abre com mensagem clara sobre o valor residual; após confirmação o status muda para "Opção Exercida".
**Why human:** Comportamento de estados visuais e transições de lifecycle requerem interação.

#### 4. Trade-In — Resumo Financeiro e Integração no AssetDrawer

**Test:** Abrir o drawer de um ativo ATIVO, clicar em "Trocar Ativo", preencher o modal com ativo novo de valor maior. Verificar seção de Resumo Financeiro com "Saldo a pagar" destacado.
**Expected:** Seção 3 do modal mostra saldo a pagar calculado em tempo real; dueDate aparece apenas quando saldo > 0; ConfirmModal exige confirmação antes de executar.
**Why human:** Cálculo reactivo do resumo financeiro e exibição condicional do campo dueDate requerem interação com estado do formulário.

### Gaps Summary

Nenhum gap de implementação encontrado. Todos os 4 critérios de aceite estão implementados e verificados com testes automatizados. Os 5 itens acima são verificações de comportamento visual e de UX que requerem inspeção humana no browser.

**Nota de rastreamento:** REQUIREMENTS.md deve ser atualizado:

- Linha 30: `- [ ] **DEPR-03**` → `- [x] **DEPR-03**`
- Linha 64: `- [ ] **AQUI-05**` → `- [x] **AQUI-05**`
- Linha 65: `- [ ] **AQUI-06**` → `- [x] **AQUI-06**`
- Linhas 142-144: status de `Pending` para `Complete`

---

_Verified: 2026-03-23T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
