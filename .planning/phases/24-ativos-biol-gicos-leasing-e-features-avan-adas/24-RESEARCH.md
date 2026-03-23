# Phase 24: Ativos Biológicos, Leasing e Features Avançadas — Research

**Researched:** 2026-03-23
**Domain:** Contabilidade patrimonial avançada — CPC 29 (ativos biológicos), CPC 06 (leasing), trade-in de ativos
**Confidence:** HIGH

---

## Summary

Phase 24 fecha o ciclo de gestão patrimonial do Protos Farm com três features contábeis avançadas. Cada feature tem um módulo backend independente, tela ou modal frontend dedicado, e integração com o módulo financeiro (CP/CR).

**DEPR-03 — Ativos Biológicos (CPC 29):** O schema já possui `AssetClassification.FAIR_VALUE_CPC29`. O que falta é um módulo `biological-assets` que registre avaliações periódicas (valor justo por categoria de rebanho ou estágio de cultura perene) e calcule a variação líquida como item não-caixa no resultado do período. Plantas portadoras (café, laranja) têm classificação `BEARER_PLANT_CPC27` — já corretamente mapeadas para o lote de depreciação normal na `depreciation-batch.service.ts`.

**AQUI-05 — Leasing/Arrendamento Mercantil (CPC 06):** Requer novo módulo `asset-leasings` com criação de ROU asset (Right-of-Use) como ativo depreciável, geração de parcelas mensais no CP (`PayableCategory.FINANCING`), e controle de opção de compra no vencimento do contrato. ROU asset é criado como `Asset` com `classification = DEPRECIABLE_CPC27`, evitando a necessidade de novo tipo de classificação.

**AQUI-06 — Trade-in de Ativo (permuta com compensação financeira):** Requer novo módulo `asset-trade-ins` que atomicamente realiza baixa do ativo antigo (via lógica similar a `AssetDisposal`) e cria o ativo novo abatendo o valor do antigo. A diferença financeira gera CP para o saldo devedor. Tudo em única transação Prisma.

**Primary recommendation:** Implementar em três planos sequenciais: (1) biological assets backend + frontend, (2) leasing backend + frontend, (3) trade-in backend + frontend. Cada plano é independente do outro — sem dependências entre eles dentro da Phase 24.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPR-03 | Contador pode registrar valor justo de ativos biológicos (CPC 29/IAS 41) — rebanho por categoria com preço de mercado e culturas perenes por estágio — com variação registrada no resultado | Novo módulo `biological-assets` com modelo `BiologicalAssetValuation`; rebanho usa `AnimalCategory` enum existente; variação não-caixa gravada como resultado do período |
| AQUI-05 | Gerente pode registrar leasing e arrendamento mercantil (CPC 06) com parcelas no CP e controle de opção de compra ao final do contrato | Novo módulo `asset-leasings`; ROU asset criado como `Asset` com `DEPRECIABLE_CPC27`; parcelas via `generateInstallments` + `tx.payable.create` (padrão Phase 19) |
| AQUI-06 | Gerente pode registrar troca de ativo (trade-in) com compensação financeira automática (valor do ativo antigo abatido do novo) | Novo módulo `asset-trade-ins`; transação atômica: baixa ativo antigo + cria ativo novo + gera CP para diferença; reutiliza lógica de `AssetDisposal` |

</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

### Backend
- Express 5 + TypeScript + Prisma 7 — módulos colocalizados em `modules/{domínio}/`
- `prisma.$transaction` direto (NÃO `withRlsContext`) para evitar deadlocks em nested transactions — padrão estabelecido em Phase 19 e confirmado em Phase 20
- `tx.payable.create` direto (NÃO `payables.service.createPayable`) — padrão Phase 19
- Toda aritmética monetária usa `Decimal` de `decimal.js`
- `AssetAcquisition never routes through GoodsReceipt` — guarda no GoodsReceipt service
- Testes: Jest, arquivos `*.spec.ts`
- `app.ts` separado de `main.ts`

### Frontend
- React 19 + Vite 6 + TypeScript
- Formulários de criação/edição SEMPRE em modal, nunca página dedicada
- ConfirmModal para ações destrutivas, ConfirmDeleteModal para alta criticidade
- Nunca `window.confirm()`
- Testes: Vitest + @testing-library/react, arquivos `*.spec.tsx`
- CSS custom properties — nunca hardcodar hex
- Lucide icons — tamanhos 16/20/24/48-64px

### Design System
- Fonte: DM Sans (headlines), Source Sans 3 (body), JetBrains Mono (dados)
- Touch targets mínimos 48x48px
- Escala de 4px — sem valores arbitrários
- Máximo 1 botão primário por tela
- Skeleton screens, não spinner full-page
- WCAG AA: 4.5:1 texto normal, 3:1 texto grande

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 7.x | ORM + migrations | Padrão do projeto |
| decimal.js | - | Aritmética monetária | Decisão locked — todo cálculo financeiro |
| @protos-farm/shared | workspace | `generateInstallments`, `Money` | Reutilização entre Phase 19 e 24 |
| supertest | - | Testes de rotas HTTP | Padrão em todos os `*.routes.spec.ts` |
| jest | - | Framework de testes backend | Padrão do projeto |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | - | Ícones frontend | Sempre no frontend |
| @testing-library/react | - | Testes componentes | Specs frontend |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Criar novo AssetType para ROU | Reutilizar MAQUINA/BENFEITORIA | ROU asset é ativo depreciável — classificação `DEPRECIABLE_CPC27` é suficiente; AssetType pode ser MAQUINA ou o que o usuário escolher |
| Novo enum para BiologicalAssetType | Reutilizar AnimalCategory existente | AnimalCategory já tem BEZERRO, BEZERRA, NOVILHA, NOVILHO, VACA_LACTACAO, VACA_SECA, TOURO_REPRODUTOR, DESCARTE — suficiente para CPC 29 |

**Installation:** Nenhuma dependência nova requerida.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/
├── biological-assets/           # DEPR-03
│   ├── biological-assets.routes.ts
│   ├── biological-assets.routes.spec.ts
│   ├── biological-assets.service.ts
│   └── biological-assets.types.ts
├── asset-leasings/              # AQUI-05
│   ├── asset-leasings.routes.ts
│   ├── asset-leasings.routes.spec.ts
│   ├── asset-leasings.service.ts
│   └── asset-leasings.types.ts
└── asset-trade-ins/             # AQUI-06
    ├── asset-trade-ins.routes.ts
    ├── asset-trade-ins.routes.spec.ts
    ├── asset-trade-ins.service.ts
    └── asset-trade-ins.types.ts

apps/frontend/src/
├── components/assets/
│   ├── BiologicalAssetValuationModal.tsx + .css   # DEPR-03
│   ├── AssetLeasingModal.tsx + .css               # AQUI-05
│   └── AssetTradeInModal.tsx + .css               # AQUI-06
├── hooks/
│   ├── useBiologicalAssets.ts
│   ├── useAssetLeasings.ts
│   └── useAssetTradeIns.ts
└── pages/
    ├── BiologicalAssetsPage.tsx + .css            # lista avaliações CPC 29
    └── AssetLeasingsPage.tsx + .css               # lista contratos de leasing
```

### Schema: Novos modelos requeridos

#### DEPR-03 — BiologicalAssetValuation

```prisma
// Fonte: análise do schema existente + CPC 29/IAS 41
model BiologicalAssetValuation {
  id             String   @id @default(uuid())
  organizationId String
  farmId         String
  valuationDate  DateTime @db.Date
  assetGroup     String   // ex: 'VACA_LACTACAO', 'NOVILHA', 'CAFE_PRODUCAO'
  groupType      String   // 'ANIMAL' | 'PERENNIAL_CROP'
  headCount      Int?     // para rebanho
  areaHa         Decimal? @db.Decimal(12, 4) // para culturas perenes
  pricePerUnit   Decimal  @db.Decimal(15, 4) // R$/cabeça ou R$/ha
  totalFairValue Decimal  @db.Decimal(15, 2)
  previousValue  Decimal? @db.Decimal(15, 2) // null se primeira avaliação
  fairValueChange Decimal? @db.Decimal(15, 2) // calculado: totalFairValue - previousValue
  notes          String?
  createdBy      String
  createdAt      DateTime @default(now())

  organization Organization @relation(...)
  farm         Farm         @relation(...)
  creator      User         @relation(...)

  @@index([organizationId, valuationDate])
  @@index([organizationId, assetGroup])
  @@map("biological_asset_valuations")
}
```

**Chave de design:** `previousValue` é buscado na query (última avaliação do mesmo `organizationId + assetGroup`), não armazenado estaticamente — o serviço calcula `fairValueChange = totalFairValue - previousValue` e armazena no registro.

#### AQUI-05 — AssetLeasing

```prisma
enum LeasingStatus {
  ACTIVE
  PURCHASE_OPTION_EXERCISED
  RETURNED
  CANCELLED
}

model AssetLeasing {
  id                    String        @id @default(uuid())
  organizationId        String
  farmId                String
  rouAssetId            String        @unique // FK -> Asset (ROU criado automaticamente)
  lessorName            String
  lessorDocument        String?       // CNPJ/CPF
  contractNumber        String?
  contractDate          DateTime      @db.Date
  startDate             DateTime      @db.Date
  endDate               DateTime      @db.Date
  totalContractValue    Decimal       @db.Decimal(15, 2)
  monthlyInstallment    Decimal       @db.Decimal(15, 2)
  installmentCount      Int
  purchaseOptionValue   Decimal?      @db.Decimal(15, 2) // null se sem opção de compra
  purchaseOptionDate    DateTime?     @db.Date
  hasPurchaseOption     Boolean       @default(false)
  status                LeasingStatus @default(ACTIVE)
  payableId             String?       // FK -> Payable (cabeçalho das parcelas)
  notes                 String?
  createdBy             String
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  organization Organization @relation(...)
  farm         Farm         @relation(...)
  rouAsset     Asset        @relation("LeasingROU", ...)
  creator      User         @relation(...)

  @@index([organizationId, status])
  @@map("asset_leasings")
}
```

**ROU Asset:** criado na mesma transação que o contrato. AssetType escolhido pelo usuário (ex: MAQUINA). Classification = `DEPRECIABLE_CPC27`. O `acquisitionValue` do ROU = `totalContractValue`. Depreciation config criada imediatamente (STRAIGHT_LINE, usefulLifeMonths = duração do contrato em meses).

#### AQUI-06 — AssetTradeIn

```prisma
model AssetTradeIn {
  id                String   @id @default(uuid())
  organizationId    String
  farmId            String
  tradedAssetId     String   @unique // ativo dado como parte do pagamento (será baixado)
  newAssetId        String   @unique // ativo adquirido
  tradeInDate       DateTime @db.Date
  tradedAssetValue  Decimal  @db.Decimal(15, 2) // valor acordado para o ativo antigo
  newAssetValue     Decimal  @db.Decimal(15, 2) // preço total do ativo novo
  netPayable        Decimal  @db.Decimal(15, 2) // newAssetValue - tradedAssetValue
  payableId         String?                      // CP gerado para o netPayable (null se tradedAssetValue >= newAssetValue)
  gainLossOnTrade   Decimal  @db.Decimal(15, 2) // tradedAssetValue - nbv do ativo antigo
  notes             String?
  createdBy         String
  createdAt         DateTime @default(now())

  organization Organization @relation(...)
  tradedAsset  Asset        @relation("TradeInOld", ...)
  newAsset     Asset        @relation("TradeInNew", ...)
  creator      User         @relation(...)

  @@map("asset_trade_ins")
}
```

### Pattern 1: Transação atômica para Trade-in (AQUI-06)

```typescript
// Padrão Phase 19/20 — prisma.$transaction direto (NÃO withRlsContext)
export async function createTradeIn(
  ctx: RlsContext,
  input: CreateTradeInInput,
): Promise<TradeInOutput> {
  return prisma.$transaction(async (tx) => {
    // 1. Buscar NBV do ativo antigo
    const nbv = await getNetBookValue(tx, input.tradedAssetId);
    const gainLoss = new Decimal(input.tradedAssetValue).minus(nbv);
    const netPayable = new Decimal(input.newAssetValue).minus(input.tradedAssetValue);

    // 2. Criar ativo novo
    const assetTag = await getNextAssetTag(tx, ctx.organizationId);
    const newAsset = await tx.asset.create({ data: { ...input.newAssetData, assetTag } });

    // 3. Baixar ativo antigo (status ALIENADO, cancelar depreciações pendentes)
    await tx.asset.update({ where: { id: input.tradedAssetId }, data: { status: 'ALIENADO', disposalDate: new Date() } });
    await tx.depreciationEntry.updateMany({
      where: { assetId: input.tradedAssetId, reversedAt: null },
      data: { reversedAt: new Date() },
    });

    // 4. Criar registro TradeIn
    const tradeIn = await tx.assetTradeIn.create({ ... });

    // 5. Gerar CP se netPayable > 0
    let payableId: string | null = null;
    if (netPayable.greaterThan(0)) {
      const payable = await tx.payable.create({
        data: {
          organizationId: ctx.organizationId,
          farmId: input.farmId,
          category: 'ASSET_ACQUISITION',
          description: `Trade-in ${newAsset.assetTag} — ${newAsset.name}`,
          totalAmount: netPayable.toDecimalPlaces(2).toString(),
          dueDate: new Date(input.dueDate),
          originType: 'ASSET_TRADE_IN',
          originId: tradeIn.id,
        },
      });
      payableId = payable.id;
    }

    return { tradeIn, newAsset, payableId, gainLoss: gainLoss.toNumber() };
  });
}
```

### Pattern 2: Cálculo de variação de valor justo (DEPR-03)

```typescript
// Buscar avaliação anterior do mesmo grupo para calcular variação
export async function createValuation(
  ctx: RlsContext,
  input: CreateValuationInput,
): Promise<ValuationOutput> {
  // Buscar última avaliação anterior do mesmo grupo
  const previous = await prisma.biologicalAssetValuation.findFirst({
    where: {
      organizationId: ctx.organizationId,
      assetGroup: input.assetGroup,
      valuationDate: { lt: new Date(input.valuationDate) },
    },
    orderBy: { valuationDate: 'desc' },
    select: { totalFairValue: true },
  });

  const totalFairValue = new Decimal(input.totalFairValue);
  const previousValue = previous ? new Decimal(previous.totalFairValue) : null;
  const fairValueChange = previousValue ? totalFairValue.minus(previousValue) : null;

  return prisma.biologicalAssetValuation.create({
    data: {
      ...input,
      totalFairValue: totalFairValue.toDecimalPlaces(2).toString(),
      previousValue: previousValue?.toDecimalPlaces(2).toString() ?? null,
      fairValueChange: fairValueChange?.toDecimalPlaces(2).toString() ?? null,
    },
  });
}
```

### Pattern 3: Leasing — criação de ROU Asset + Parcelas CP (AQUI-05)

```typescript
// ROU Asset criado na mesma transação do contrato
export async function createLeasing(
  ctx: RlsContext,
  input: CreateLeasingInput,
): Promise<LeasingOutput> {
  return prisma.$transaction(async (tx) => {
    const assetTag = await getNextAssetTag(tx, ctx.organizationId);

    // 1. Criar ROU Asset como ativo depreciável normal
    const rouAsset = await tx.asset.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId,
        assetType: input.assetType,           // escolhido pelo usuário
        classification: 'DEPRECIABLE_CPC27',  // ROU sempre depreciável
        name: `ROU — ${input.lessorName} — ${input.contractNumber ?? assetTag}`,
        assetTag,
        acquisitionDate: new Date(input.startDate),
        acquisitionValue: String(input.totalContractValue),
        notes: `Arrendamento mercantil CPC 06. Contrato: ${input.contractNumber ?? '—'}`,
      },
    });

    // 2. Criar DepreciationConfig para o ROU (STRAIGHT_LINE, vida útil = duração contrato)
    const durationMonths = monthsBetween(input.startDate, input.endDate);
    await tx.depreciationConfig.create({
      data: {
        organizationId: ctx.organizationId,
        assetId: rouAsset.id,
        method: 'STRAIGHT_LINE',
        usefulLifeMonths: durationMonths,
        residualValue: '0',
      },
    });

    // 3. Gerar parcelas no CP (categoria FINANCING)
    const installments = generateInstallments(
      Money(input.totalContractValue),
      input.installmentCount,
      new Date(input.firstDueDate),
    );
    const payable = await tx.payable.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId,
        supplierName: input.lessorName,
        category: 'FINANCING',
        description: `Leasing CPC 06 — ${rouAsset.assetTag}`,
        totalAmount: Money(input.totalContractValue).toDecimal(),
        dueDate: installments[0].dueDate,
        installmentCount: input.installmentCount,
        originType: 'ASSET_LEASING',
        originId: rouAsset.id,
      },
    });
    await tx.payableInstallment.createMany({
      data: installments.map((i) => ({
        payableId: payable.id,
        number: i.number,
        amount: i.amount.toDecimal(),
        dueDate: i.dueDate,
      })),
    });

    // 4. Criar contrato de leasing
    const leasing = await tx.assetLeasing.create({ data: { ...input, rouAssetId: rouAsset.id, payableId: payable.id } });
    return { leasing, rouAsset, payableId: payable.id };
  });
}
```

### Anti-Patterns to Avoid

- **Não usar `withRlsContext` aninhado:** Toda lógica transacional usa `prisma.$transaction` direto — padrão consolidado desde Phase 19.
- **Não criar `BiologicalAssetValuation` com `fairValueChange` calculado no frontend:** Cálculo deve ser feito no serviço com `decimal.js` para precisão.
- **Não criar novo `AssetClassification` enum para ROU:** Leasing ROU é depreciável (`DEPRECIABLE_CPC27`) — o batch de depreciação já o incluirá automaticamente.
- **Não omitir `DepreciationConfig` ao criar ROU:** O batch exclui ativos sem config (skip). Criar config imediatamente na transaction.
- **Não fazer baixa do ativo antigo em trade-in como `AssetDisposal` separado:** Trade-in é uma operação atômica única — não compor com `asset-disposals` module.
- **Não usar `FAIR_VALUE_CPC29` para plantas portadoras:** Café e laranja são `BEARER_PLANT_CPC27` (depreciáveis CPC 27) — já correto no schema e no batch. DEPR-03 só cobre rebanho e culturas não-portadoras.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Geração de parcelas mensais | Loop manual de datas | `generateInstallments` de `@protos-farm/shared` | Já usado em Phase 19 (acquisitions) e Phase 6 (crédito rural) |
| Aritmética de valor justo | JS nativo `number` | `Decimal` de `decimal.js` | Floating point errors em valores financeiros |
| Sequência do asset tag (PAT-XXXXX) | Query separada | `getNextAssetTag(tx, orgId)` — copiar o helper de `asset-acquisitions.service.ts` | Já testado e consistente |
| CP para leasing | Novo tipo de payable | `PayableCategory.FINANCING` existente | Leasing é financiamento de ativo — categoria correta e já no enum |
| NBV para cálculo de ganho/perda | Cálculo from scratch | Query `depreciationEntries` (soma `depreciationAmount`) subtraída de `acquisitionValue` — padrão de `asset-disposals.service.ts` | Evita divergência com lógica de baixa já testada |

**Key insight:** O projeto tem infra completa para aquisição financiada de ativos. Leasing reusa 100% desse padrão (generateInstallments + tx.payable.create). A única peça nova é o modelo `AssetLeasing` e a criação automática do ROU.

---

## Common Pitfalls

### Pitfall 1: FAIR_VALUE_CPC29 vs BEARER_PLANT_CPC27
**What goes wrong:** Desenvolvedor classifica café/laranja como `FAIR_VALUE_CPC29` ao implementar DEPR-03.
**Why it happens:** CPC 29 fala em "plantas" mas IAS 41 excluiu plantas portadoras em 2016 (emenda IAS 16). CPC 29 BR foi alinhado.
**How to avoid:** DEPR-03 cobre apenas animais (`groupType: 'ANIMAL'`) e culturas em fase de formação (`groupType: 'PERENNIAL_CROP'`). Café e laranja em produção são `BEARER_PLANT_CPC27` e já estão no batch de depreciação normal.
**Warning signs:** Se o success criterion 2 da fase ("Planta portadora... entra no lote de depreciação normal") estiver sendo testado com `FAIR_VALUE_CPC29` — está errado.

### Pitfall 2: DepreciationConfig ausente no ROU Asset
**What goes wrong:** ROU Asset criado sem `DepreciationConfig` — batch de depreciação o pula silenciosamente.
**Why it happens:** A criação de config é opcional em assets normais, mas obrigatória para ROU funcionar.
**How to avoid:** Na transação de criação de leasing, sempre criar `DepreciationConfig` com `usefulLifeMonths = duração do contrato` e `method = STRAIGHT_LINE`. O frontend deve mostrar aviso se `depreciationConfigMissing` (padrão Phase 22).
**Warning signs:** ROU asset existe mas não aparece nas projeções de depreciação.

### Pitfall 3: Trade-in sem cancelamento de depreciações pendentes
**What goes wrong:** Ativo antigo é baixado (`status = ALIENADO`) mas entradas de depreciação futuras permanecem ativas — distorce relatórios.
**Why it happens:** Padrão de baixa (`asset-disposals`) já trata isso via `cancelledDepreciationCount`, mas um trade-in novo pode não replicar essa lógica.
**How to avoid:** Na transação de trade-in, aplicar `tx.depreciationEntry.updateMany({ where: { assetId: tradedAssetId, reversedAt: null }, data: { reversedAt: new Date() } })` — mesma lógica do disposal service.
**Warning signs:** NBV do ativo antigo diferente de zero após trade-in quando calculado por relatórios.

### Pitfall 4: Variação de valor justo sem comparação ao período anterior correto
**What goes wrong:** `fairValueChange` calculado errado porque busca a última avaliação de qualquer grupo ao invés de `organizationId + assetGroup`.
**Why it happens:** Query sem filtro de `assetGroup`.
**How to avoid:** `findFirst({ where: { organizationId, assetGroup, valuationDate: { lt: valuationDate } }, orderBy: { valuationDate: 'desc' } })`.
**Warning signs:** Variação de VACA_LACTACAO mostrando diferença de NOVILHA.

### Pitfall 5: Opção de compra de leasing gerando CP automático sem confirmação
**What goes wrong:** Ao exercer opção de compra, sistema cria CP automaticamente sem o usuário confirmar.
**Why it happens:** Endpoint de "exercer opção" implementado como PUT sem modal de confirmação no frontend.
**How to avoid:** Frontend usa `ConfirmModal variant="warning"` antes de chamar `PUT /asset-leasings/:id/exercise-purchase`. Backend retorna 400 se `hasPurchaseOption = false` ou `status != ACTIVE`.
**Warning signs:** Usuário relata que clicou sem querer e gerou CP indesejado.

---

## Code Examples

### Roteamento — padrão Phase 19

```typescript
// Source: apps/backend/src/modules/asset-acquisitions/asset-acquisitions.routes.ts
router.post(
  '/',
  authenticate,
  checkPermission('assets:create'),
  asyncHandler(async (req, res) => {
    const ctx: RlsContext = { organizationId: req.user!.organizationId, userId: req.user!.id };
    const result = await createLeasing(ctx, req.body);
    res.status(201).json(result);
  }),
);
```

### Busca de NBV para cálculo de ganho/perda

```typescript
// Padrão de asset-disposals.service.ts
async function getNetBookValue(tx: TxClient, assetId: string): Promise<Decimal> {
  const asset = await tx.asset.findUniqueOrThrow({
    where: { id: assetId },
    select: { acquisitionValue: true },
  });
  const depAgg = await tx.depreciationEntry.aggregate({
    where: { assetId, reversedAt: null },
    _sum: { depreciationAmount: true },
  });
  const acqVal = new Decimal(asset.acquisitionValue ?? 0);
  const totalDepr = new Decimal(depAgg._sum.depreciationAmount ?? 0);
  return acqVal.minus(totalDepr);
}
```

### Frontend: hook pattern (padrão existente)

```typescript
// Padrão de useAssetAcquisition.ts / useAssetDisposal.ts
export function useAssetLeasings() {
  const [leasings, setLeasings] = useState<AssetLeasing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeasings = useCallback(async (orgId: string) => {
    setLoading(true);
    try {
      const data = await api.get<AssetLeasing[]>(`/orgs/${orgId}/asset-leasings`);
      setLeasings(data);
    } catch (e) {
      setError('Não foi possível carregar os contratos de leasing.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { leasings, loading, error, fetchLeasings };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IAS 41 incluía plantas portadoras como ativo biológico | Emenda IAS 16 (2016) retirou plantas portadoras do IAS 41 — CPC 29 BR alinhado | 2016 | Café/laranja são CPC 27 depreciáveis, não CPC 29 |
| IFRS 16 / CPC 06 (R2) — leasing operacional off-balance | CPC 06 (R2) — todo leasing cria ROU asset e passivo (on-balance) | 2019 BR | Simplifica: sempre cria ROU asset, não há distinção operacional/financeiro para fins de reconhecimento |

**Deprecated/outdated:**
- Distinção leasing operacional vs financeiro para reconhecimento on/off-balance: obsoleta no CPC 06 (R2). Para o Protos Farm: todo contrato de arrendamento > 12 meses cria ROU asset. Arrendamentos de curto prazo (< 12 meses) podem ser isentos — implementar como opção no formulário.

---

## Open Questions

1. **Valor justo biológico: input manual vs automático**
   - What we know: STATE.md pendente confirma "Confirm biological asset fair value input method (manual vs automatic) before Phase 24 planning"
   - What's unclear: Cliente quer importar preços de boletins externos (CEPEA/ESALQ) ou entrada manual é suficiente?
   - Recommendation: Implementar entrada manual (valor + data + grupo). Integração automática pode vir depois sem retrabalho no modelo.

2. **Leasing de curto prazo (< 12 meses)**
   - What we know: CPC 06 (R2) isenta arrendamentos de curto prazo da criação de ROU asset
   - What's unclear: Clientes têm arrendamentos < 12 meses que querem controlar?
   - Recommendation: Adicionar flag `isShortTerm: Boolean` no formulário. Se `true`, não cria ROU asset — apenas registra parcelas no CP com `category: RENT`.

3. **Frotas com leasing ativo**
   - What we know: STATE.md pending: "Confirm whether any customer fleet has active finance leases before committing to Phase 24 leasing scope"
   - What's unclear: Volume de contratos a importar (pode precisar de importação em massa)
   - Recommendation: Implementar cadastro unitário. Importação em massa pode ser fase posterior se demandada.

4. **Trade-in sem saldo devedor (valor do ativo antigo >= valor do novo)**
   - What we know: Raro mas possível (ativo antigo muito valioso)
   - What's unclear: Gera crédito a receber ou simplesmente não gera CP?
   - Recommendation: Se `netPayable <= 0`, não criar CP. Criar CR com `category: ASSET_SALE` para o saldo favorável ao cliente se `tradedAssetValue > newAssetValue`. Documentar no código.

---

## Environment Availability

Step 2.6: SKIPPED — fase é puramente código/configuração. Sem dependências externas além das já instaladas (PostgreSQL, Node.js, pnpm).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (backend) + Vitest (frontend) |
| Config file | `apps/backend/jest.config.js`, `apps/frontend/vite.config.ts` |
| Quick run command | `cd apps/backend && pnpm test -- --testPathPattern biological-assets` |
| Full suite command | `cd apps/backend && pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPR-03 | POST /biological-asset-valuations cria avaliação com fairValueChange calculado | unit (route+service mock) | `pnpm test -- --testPathPattern biological-assets.routes` | ❌ Wave 0 |
| DEPR-03 | fairValueChange = null na primeira avaliação de um grupo | unit | idem | ❌ Wave 0 |
| DEPR-03 | FAIR_VALUE_CPC29 excluído do lote de depreciação normal | unit (depreciation-batch) | `pnpm test -- --testPathPattern depreciation-batch` | ✅ existe — verificar cobertura |
| AQUI-05 | POST /asset-leasings cria ROU asset + DepreciationConfig + CP com parcelas | unit (route+service mock) | `pnpm test -- --testPathPattern asset-leasings.routes` | ❌ Wave 0 |
| AQUI-05 | PUT /asset-leasings/:id/exercise-purchase atualiza status e gera novo CP | unit | idem | ❌ Wave 0 |
| AQUI-05 | Retorna 400 se hasPurchaseOption=false ao exercer opção | unit | idem | ❌ Wave 0 |
| AQUI-06 | POST /asset-trade-ins cria ativo novo + baixa ativo antigo + CP p/ diferença | unit (route+service mock) | `pnpm test -- --testPathPattern asset-trade-ins.routes` | ❌ Wave 0 |
| AQUI-06 | gainLoss calculado como tradedAssetValue - NBV do ativo antigo | unit | idem | ❌ Wave 0 |
| AQUI-06 | Depreciações pendentes do ativo antigo canceladas (reversedAt set) | unit | idem | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/backend && pnpm test -- --testPathPattern {módulo}`
- **Per wave merge:** `cd apps/backend && pnpm test`
- **Phase gate:** Full suite green antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/backend/src/modules/biological-assets/biological-assets.routes.spec.ts` — cobre DEPR-03
- [ ] `apps/backend/src/modules/asset-leasings/asset-leasings.routes.spec.ts` — cobre AQUI-05
- [ ] `apps/backend/src/modules/asset-trade-ins/asset-trade-ins.routes.spec.ts` — cobre AQUI-06
- [ ] Verificar cobertura em `depreciation-batch.spec.ts` para exclusão de `FAIR_VALUE_CPC29` (pode já existir)

---

## Sources

### Primary (HIGH confidence)
- Código-fonte analisado diretamente:
  - `apps/backend/prisma/schema.prisma` — modelos Asset, DepreciationConfig, DepreciationEntry, PayableCategory, AnimalCategory
  - `apps/backend/src/modules/asset-acquisitions/asset-acquisitions.service.ts` — padrão transacional, getNextAssetTag, generateInstallments
  - `apps/backend/src/modules/depreciation/depreciation-batch.service.ts` — filtro de classificação (linha 62: `classification: { in: ['DEPRECIABLE_CPC27', 'BEARER_PLANT_CPC27'] }`)
  - `apps/backend/src/modules/depreciation/depreciation.types.ts` — EngineInput, DEFAULT_RFB_RATES
  - `.planning/STATE.md` — decisões acumuladas Phase 17-23, pending todos
  - `.planning/REQUIREMENTS.md` — DEPR-03, AQUI-05, AQUI-06 specs completas

### Secondary (MEDIUM confidence)
- CPC 29 (Pronunciamento CPC 29 — Ativo Biológico e Produto Agrícola): plantas portadoras excluídas por emenda alinhada à IAS 16 (2016)
- CPC 06 (R2) — Operações de Arrendamento Mercantil: todo arrendamento > 12 meses cria ROU asset e passivo financeiro

### Tertiary (LOW confidence)
- Nenhum item de baixa confiança identificado — toda a arquitetura deriva do código existente

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — derivado do código existente, sem novas dependências
- Architecture: HIGH — padrões idênticos a Phase 19 (acquisitions) e Phase 20 (disposals)
- Pitfalls: HIGH — FAIR_VALUE_CPC29 vs BEARER_PLANT_CPC27 verificado diretamente no depreciation-batch.service.ts

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (schema estável, sem dependências externas voláteis)
