---
phase: 19-integrao-financeira-aquisio
verified: 2026-03-22T14:30:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
human_verification:
  - test: 'Open AssetModal with acquisitionValue > 0 and observe Dados Financeiros section'
    expected: 'Section appears, AVISTA/FINANCIADO radio cards are clickable and visually distinct'
    why_human: 'Cannot verify conditional display:block toggle and visual state differences programmatically'
  - test: 'Select FINANCIADO, enter installmentCount and firstDueDate, observe InstallmentPreviewTable'
    expected: 'Table appears with first 6 rows, expand button shows for 7+ installments, JetBrains Mono formatting'
    why_human: 'Live client-side recalculation and table rendering require browser execution'
  - test: 'Drag-drop an NF-e XML file onto the upload zone in AssetNfeImportModal'
    expected: 'Border turns primary-500, file is accepted, parse proceeds, step 2 shows item list'
    why_human: 'Drag-and-drop event handling requires real browser interaction'
  - test: 'Submit asset creation with financial data and verify toast message'
    expected: "Toast shows 'Ativo registrado. Conta a pagar criada automaticamente.' after successful POST"
    why_human: 'Toast rendering and message content require browser interaction with live API'
---

# Phase 19: Integração Financeira — Aquisição de Patrimônio Verification Report

**Phase Goal:** Integração financeira para aquisição de patrimônio — NF-e parser, criação atômica Asset+CP, fluxo frontend com dados financeiros e wizard de importação NF-e.
**Verified:** 2026-03-22T14:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                             | Status   | Evidence                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | POST /asset-acquisitions creates Asset + CP atomically in one Prisma transaction                  | VERIFIED | `asset-acquisitions.service.ts:77` uses `prisma.$transaction`; `tx.asset.create` at line 85, `tx.payable.create` at line 157                                |
| 2   | CP has originType=ASSET_ACQUISITION and originId=asset.id                                         | VERIFIED | `service.ts:168–169` sets `originType: 'ASSET_ACQUISITION', originId: asset.id`                                                                             |
| 3   | Financed purchase creates N PayableInstallments summing exactly to acquisitionValue               | VERIFIED | `generateInstallments` called at `service.ts:150,329` from `@protos-farm/shared`; Test 3 in routes.spec.ts covers 36-installment sum                        |
| 4   | POST /asset-acquisitions/parse-nfe returns parsed supplier, value, items from XML                 | VERIFIED | `routes.ts:77–94` multer upload + `parseNfeUpload`; `nfe-parser.ts:33` exports `parseNfeXml`; 11 unit tests in nfe-parser.spec.ts                           |
| 5   | POST /asset-acquisitions/from-nfe creates N assets with proportional rateio of accessory expenses | VERIFIED | `service.ts:224` exports `createFromNfe`; `nfe-parser.ts:100` exports `calculateRateio` (Decimal.js cent-exact); Test 9–11 in routes.spec.ts                |
| 6   | Each CP gets PayableCostCenterItem with the asset's costCenterId                                  | VERIFIED | `service.ts:185–190` creates `PayableCostCenterItem` when `costCenterId` is provided; same at line 361 for from-nfe path                                    |
| 7   | AssetModal shows collapsible "Dados Financeiros" section when acquisitionValue > 0                | VERIFIED | `AssetModal.tsx:562` `<fieldset>` with `<legend>Tipo de pagamento</legend>`; conditional rendering on `acquisitionValue > 0`                                |
| 8   | User can select AVISTA or FINANCIADO payment type via radio card UI                               | VERIFIED | `AssetModal.tsx:568–600` two radio cards with hidden input, `checked={paymentType === 'AVISTA'}` / `checked={paymentType === 'FINANCIADO'}`                 |
| 9   | Saving asset with financial data calls POST /asset-acquisitions and creates CP automatically      | VERIFIED | `AssetModal.tsx:228–266` routes through `createAcquisition()` when `paymentType` set; `useAssetAcquisition.ts:28` POSTs to `/org/:orgId/asset-acquisitions` |
| 10  | User can upload NF-e XML file and see parsed supplier, value, and items in preview                | VERIFIED | `AssetNfeImportModal.tsx:227` calls `parseNfe(selectedFile)`; step 2 renders items from `parsedData`; drag-drop at line 451–453                             |
| 11  | Multi-item NF creates N assets with proportional rateio and CP auto-generated                     | VERIFIED | `AssetNfeImportModal.tsx:357` calls `createFromNfe(parsedData, input)`; backend `calculateRateio` distributes expenses; step 3 info banner at line 808      |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact                                                                                             | Expected                                                      | Status                | Details                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/modules/asset-acquisitions/asset-acquisitions.service.ts`                          | Atomic asset+CP creation, financed purchase, NF-e multi-asset | VERIFIED (378 lines)  | Exports `createAcquisitionAndPayable`, `parseNfeUpload`, `createFromNfe`                                  |
| `apps/backend/src/modules/asset-acquisitions/nfe-parser.ts`                                          | NF-e v4.0 XML tag extraction                                  | VERIFIED (133 lines)  | Exports `parseNfeXml` and `calculateRateio`                                                               |
| `apps/backend/src/modules/asset-acquisitions/asset-acquisitions.routes.ts`                           | REST endpoints for asset acquisition                          | VERIFIED (112 lines)  | Exports `assetAcquisitionsRouter` with 3 POST endpoints                                                   |
| `apps/backend/src/modules/asset-acquisitions/asset-acquisitions.routes.spec.ts`                      | Integration tests (min 200 lines)                             | VERIFIED (486 lines)  | 15 test cases covering AQUI-01 through AQUI-07                                                            |
| `apps/backend/src/modules/asset-acquisitions/nfe-parser.spec.ts`                                     | Unit tests for parser                                         | VERIFIED (214 lines)  | 11 test cases covering all parser behaviors                                                               |
| `apps/backend/prisma/migrations/20260426100000_add_payable_category_asset_acquisition/migration.sql` | ASSET_ACQUISITION PayableCategory migration                   | VERIFIED              | SQL: `ALTER TYPE "PayableCategory" ADD VALUE 'ASSET_ACQUISITION'`                                         |
| `apps/frontend/src/hooks/useAssetAcquisition.ts`                                                     | Hook for asset acquisition API calls                          | VERIFIED (108 lines)  | Exports `useAssetAcquisition` with `createAcquisition`, `parseNfe`, `createFromNfe`, `isLoading`, `error` |
| `apps/frontend/src/components/assets/InstallmentPreviewTable.tsx`                                    | Read-only installment schedule preview table (min 80 lines)   | VERIFIED (126 lines)  | Caption "Parcelas geradas", th scope="col", expand/collapse for >6 rows                                   |
| `apps/frontend/src/components/assets/AssetNfeImportModal.tsx`                                        | 3-step NF-e import wizard (min 300 lines)                     | VERIFIED (1020 lines) | Steps: upload XML → review items → confirm; stepper, drag-drop, success state                             |
| `apps/frontend/src/components/assets/AssetNfeImportModal.css`                                        | Styling for NF-e import modal (min 100 lines)                 | VERIFIED              | Full CSS with stepper dots, upload zone, item cards, responsive breakpoint                                |

### Key Link Verification

| From                            | To                                             | Via                                        | Status | Details                                                                                                                                        |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset-acquisitions.service.ts` | `prisma.payable + prisma.asset`                | Prisma `$transaction`                      | WIRED  | `tx.asset.create` line 85, `tx.payable.create` line 157, both inside `prisma.$transaction` at line 77                                          |
| `asset-acquisitions.service.ts` | `generateInstallments`                         | import from `@protos-farm/shared`          | WIRED  | Line 1: `import { Money, generateInstallments } from '@protos-farm/shared'`; called at lines 150 and 329                                       |
| `asset-acquisitions.routes.ts`  | `app.ts`                                       | router registration                        | WIRED  | `app.ts:121` imports `assetAcquisitionsRouter`; `app.ts:249` registers at `/api` prefix; router uses `base = '/org/:orgId/asset-acquisitions'` |
| `AssetModal.tsx`                | `/api/org/:orgId/asset-acquisitions`           | `useAssetAcquisition` hook                 | WIRED  | `AssetModal.tsx:6,88` imports and uses hook; `useAssetAcquisition.ts:28` POSTs to correct path                                                 |
| `AssetNfeImportModal.tsx`       | `/api/org/:orgId/asset-acquisitions/parse-nfe` | `useAssetAcquisition` hook `parseNfe`      | WIRED  | `AssetNfeImportModal.tsx:116` destructures `parseNfe` from hook; called at line 227                                                            |
| `AssetNfeImportModal.tsx`       | `/api/org/:orgId/asset-acquisitions/from-nfe`  | `useAssetAcquisition` hook `createFromNfe` | WIRED  | `AssetNfeImportModal.tsx:116` destructures `createFromNfe`; called at line 357                                                                 |
| `AssetModal.tsx`                | `AssetNfeImportModal.tsx`                      | "Importar NF-e" button                     | WIRED  | `AssetModal.tsx:17` imports; line 306–309 renders button; line 1171–1173 renders modal                                                         |
| `AssetsPage.tsx`                | `AssetNfeImportModal.tsx`                      | "Importar NF-e" header button              | WIRED  | `AssetsPage.tsx:41` imports; line 456–457 renders button; line 903–904 renders modal                                                           |

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                                                                    | Status    | Evidence                                                                                                                                                                                        |
| ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AQUI-01     | 19-01, 19-02 | Ao cadastrar ativo com valor de aquisicao, sistema gera CP automaticamente com fornecedor, valor, vencimento e centro de custo | SATISFIED | Backend: `createAcquisitionAndPayable` creates Payable+CostCenterItem in transaction. Frontend: `AssetModal` routes to `createAcquisition()` when `paymentType` set                             |
| AQUI-02     | 19-01, 19-02 | Gerente pode registrar compra financiada com dados do financiamento e parcelas geradas automaticamente                         | SATISFIED | `generateInstallments` called with `installmentCount` and `firstDueDate`; routes.spec.ts Test 3 verifies 36 installments summing to `acquisitionValue`; `InstallmentPreviewTable` shows preview |
| AQUI-03     | 19-01, 19-03 | Gerente pode importar dados do ativo a partir de NF-e XML com preenchimento automatico                                         | SATISFIED | `parseNfeXml` extracts supplier, invoice number, total, items; `POST /parse-nfe` endpoint; `AssetNfeImportModal` step 1 uploads + step 2 previews                                               |
| AQUI-04     | 19-01, 19-03 | Gerente pode registrar compra com multiplos ativos na mesma NF com rateio proporcional das despesas acessorias                 | SATISFIED | `calculateRateio` in nfe-parser.ts uses Decimal.js for cent-exact rateio; `createFromNfe` creates N assets; `AssetNfeImportModal` step 2 shows accessory expenses section                       |
| AQUI-07     | 19-01        | Cada aquisicao tem centro de custo e classificacao contabil definidos para apropriacao correta de depreciacao futura           | SATISFIED | `createAcquisitionAndPayable` creates `PayableCostCenterItem` when `costCenterId` provided; `ASSET_ACQUISITION` maps to DFC `INVESTIMENTO` in `cashflow.types.ts:17`                            |

**No orphaned requirements:** AQUI-05 and AQUI-06 are mapped to Phase 24 (Pending) — correctly excluded from Phase 19.

### Anti-Patterns Found

| File       | Line | Pattern | Severity | Impact |
| ---------- | ---- | ------- | -------- | ------ |
| None found | —    | —       | —        | —      |

All `placeholder` occurrences in AssetModal.tsx and AssetNfeImportModal.tsx are HTML `placeholder` attributes on `<input>` elements (user-facing hint text), not implementation stubs.

### Human Verification Required

#### 1. AssetModal Dados Financeiros Section Visibility

**Test:** Open AssetModal in create mode, enter a value in the "Valor de Aquisicao" field (e.g., R$ 50.000), then observe whether the "Dados Financeiros" collapsible section appears below the acquisition data fields.
**Expected:** Section appears automatically; clicking the header collapses/expands it; AVISTA and FINANCIADO radio cards are visually distinct.
**Why human:** Conditional rendering based on `acquisitionValue > 0` form state and CSS display:none/block toggle cannot be verified statically.

#### 2. InstallmentPreviewTable Live Preview

**Test:** In the FINANCIADO flow inside AssetModal, enter installmentCount=12 and firstDueDate, then blur the field. Observe whether the InstallmentPreviewTable updates with 12 installments (first 6 visible, expand button for remaining 6).
**Expected:** Table shows first 6 rows with formatted BRL amounts in JetBrains Mono; "Ver todas as 12 parcelas" button appears; clicking expands to show all 12; footer shows correct total.
**Why human:** Client-side recalculation and table DOM state require browser execution.

#### 3. NF-e Import Modal Drag-and-Drop

**Test:** Open AssetNfeImportModal from the AssetsPage header "Importar NF-e" button. Drag a valid NF-e v4.0 XML file onto the upload zone.
**Expected:** Upload zone border changes to primary-500 color on dragover; file is accepted on drop; parse begins immediately; step 2 shows item list with supplier name, invoice number, and total NF.
**Why human:** Drag-and-drop events require real browser interaction; visual border state change cannot be verified statically.

#### 4. End-to-End NF-e Asset Creation with CP

**Test:** Complete full NF-e wizard (steps 1-3), assign all items, select payment type, and click "Criar Ativos".
**Expected:** Assets created in database, single CP generated for total NF amount, success state shows "{N} ativos criados com sucesso." heading and "Conta a pagar registrada automaticamente." text with CheckCircle2 icon. AssetsPage list refreshes.
**Why human:** Full flow requires live API, real NF-e XML file, and database verification.

### Gaps Summary

No gaps found. All 11 observable truths are verified at all three levels (exists, substantive, wired). All 5 requirement IDs (AQUI-01, AQUI-02, AQUI-03, AQUI-04, AQUI-07) are satisfied with implementation evidence. All 6 task commits (aeea1f94, 6e268963, 23bd6635, f4bdc1b3, 1f7c5ab3, 885a8d71) exist in git history.

Key quality observations:

- Backend service correctly avoids nested RLS deadlock by using `tx.payable.create` directly instead of `payables.service.createPayable` (documented decision in SUMMARY-01)
- `ASSET_ACQUISITION` correctly maps to DFC `INVESTIMENTO` (not `OPERACIONAL`) in cashflow.types.ts
- Cent residual in rateio assigned to first item — consistent with `generateInstallments` behavior
- `ASSET_ACQUISITION` correctly excluded from PayableModal manual category dropdown (generated-only category)
- Plan 03 auto-fixed a type mismatch in `useAssetAcquisition.ts` where `createFromNfe` body structure didn't match backend contract — the fix is in commit 1f7c5ab3 and was verified in the SUMMARY

---

_Verified: 2026-03-22T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
