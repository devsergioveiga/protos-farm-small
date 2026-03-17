# Gestao de Contratos de Arrendamento

**Data:** 2026-03-17
**Status:** Documentacao de especificacao (nao implementado)

---

## Contexto — O que ja existe

O sistema ja modela a relacao arrendatario-fazenda atraves do vinculo produtor-fazenda (`ProducerFarmLink`):

| Campo              | Tipo      | Descricao                      |
| ------------------ | --------- | ------------------------------ |
| `bondType`         | Enum      | `ARRENDATARIO` (entre 7 tipos) |
| `startDate`        | DateTime? | Inicio do vinculo              |
| `endDate`          | DateTime? | Termino do vinculo             |
| `participationPct` | Decimal?  | Percentual de participacao     |
| `isItrDeclarant`   | Boolean   | Se e o declarante do ITR       |

Alem disso, o endpoint `GET /org/contracts/expiring?days=30` ja retorna alertas de vencimento para vinculos com `endDate` proximo.

**Lacuna atual:** nao ha gestao do contrato de arrendamento em si — valores, clausulas, reajustes, pagamentos, documentos anexos e renovacoes.

---

## Proposta — Modulo de Contratos de Arrendamento

### Modelo de dados

```prisma
model LeaseContract {
  id                String   @id @default(uuid())
  organizationId    String
  farmId            String
  producerFarmLinkId String  @unique

  // Partes
  lessorName        String               // Arrendador (proprietario)
  lessorDocument    String               // CPF/CNPJ do arrendador
  lesseeName        String               // Arrendatario
  lesseeDocument    String               // CPF/CNPJ do arrendatario

  // Vigencia
  startDate         DateTime
  endDate           DateTime
  autoRenew         Boolean  @default(false)
  renewalNoticeDays Int      @default(90)  // Dias de antecedencia para aviso de renovacao

  // Area
  leasedAreaHa      Decimal  @db.Decimal(12, 4)
  plotIds           String[] // Talhoes especificos incluidos no arrendamento

  // Valores
  paymentType       LeasePaymentType     // FIXED, PER_HECTARE, PERCENTAGE_PRODUCTION
  annualValueBrl    Decimal? @db.Decimal(14, 2)  // Valor fixo anual
  perHectareValueBrl Decimal? @db.Decimal(14, 2) // Valor por hectare
  productionPct     Decimal? @db.Decimal(5, 2)   // % da producao
  paymentFrequency  PaymentFrequency     // MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL, AT_HARVEST

  // Reajuste
  adjustmentIndex   String?              // IGPM, IPCA, INPC, preco_saca
  adjustmentMonth   Int?                 // Mes de referencia do reajuste (1-12)

  // Clausulas
  allowedActivities String[]             // Atividades permitidas: agricultura, pecuaria, etc.
  restrictions      String?              // Clausulas restritivas em texto livre

  // Documentacao
  contractNumber    String?              // Numero/protocolo do contrato
  notaryOffice      String?              // Cartorio de registro
  registrationDate  DateTime?            // Data de registro em cartorio

  // Status
  status            LeaseContractStatus  @default(ACTIVE)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  organization      Organization     @relation(fields: [organizationId], references: [id])
  farm              Farm             @relation(fields: [farmId], references: [id])
  producerFarmLink  ProducerFarmLink @relation(fields: [producerFarmLinkId], references: [id])
  payments          LeasePayment[]
  documents         LeaseDocument[]
  adjustments       LeaseAdjustment[]

  @@index([organizationId])
  @@index([farmId])
  @@index([status])
  @@index([endDate])
  @@map("lease_contracts")
}

model LeasePayment {
  id              String   @id @default(uuid())
  leaseContractId String

  referenceDate   DateTime             // Competencia (mes/ano)
  dueDate         DateTime
  valueBrl        Decimal  @db.Decimal(14, 2)
  paidValueBrl    Decimal? @db.Decimal(14, 2)
  paidAt          DateTime?
  status          LeasePaymentStatus   // PENDING, PAID, OVERDUE, CANCELLED
  notes           String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  leaseContract   LeaseContract @relation(fields: [leaseContractId], references: [id], onDelete: Cascade)

  @@index([leaseContractId])
  @@index([dueDate])
  @@index([status])
  @@map("lease_payments")
}

model LeaseDocument {
  id              String   @id @default(uuid())
  leaseContractId String

  fileName        String
  fileUrl         String
  fileType        String               // PDF, JPG, etc.
  category        LeaseDocCategory     // CONTRACT, ADDENDUM, RECEIPT, INSPECTION, OTHER
  description     String?

  uploadedAt      DateTime @default(now())

  leaseContract   LeaseContract @relation(fields: [leaseContractId], references: [id], onDelete: Cascade)

  @@index([leaseContractId])
  @@map("lease_documents")
}

model LeaseAdjustment {
  id              String   @id @default(uuid())
  leaseContractId String

  referenceDate   DateTime             // Data base do reajuste
  indexUsed        String              // IGPM, IPCA, etc.
  indexValuePct    Decimal  @db.Decimal(8, 4)  // Percentual do indice
  previousValueBrl Decimal @db.Decimal(14, 2)
  newValueBrl      Decimal @db.Decimal(14, 2)
  appliedAt        DateTime

  createdAt       DateTime @default(now())

  leaseContract   LeaseContract @relation(fields: [leaseContractId], references: [id], onDelete: Cascade)

  @@index([leaseContractId])
  @@map("lease_adjustments")
}

enum LeasePaymentType {
  FIXED                    // Valor fixo
  PER_HECTARE              // Valor por hectare
  PERCENTAGE_PRODUCTION    // Percentual da producao
}

enum PaymentFrequency {
  MONTHLY
  QUARTERLY
  SEMIANNUAL
  ANNUAL
  AT_HARVEST
}

enum LeaseContractStatus {
  DRAFT
  ACTIVE
  EXPIRED
  TERMINATED
  RENEWED
}

enum LeasePaymentStatus {
  PENDING
  PAID
  OVERDUE
  CANCELLED
}

enum LeaseDocCategory {
  CONTRACT
  ADDENDUM
  RECEIPT
  INSPECTION
  OTHER
}
```

### Relacao com estruturas existentes

```
Producer ──(ProducerFarmLink: bondType=ARRENDATARIO)──> Farm
                          │
                          └── LeaseContract (1:1 com o link)
                                ├── LeasePayment[]
                                ├── LeaseDocument[]
                                └── LeaseAdjustment[]
```

- O `LeaseContract` e criado **a partir** de um `ProducerFarmLink` com `bondType=ARRENDATARIO`
- Relacao 1:1 via `producerFarmLinkId` (unique)
- `startDate`/`endDate` do contrato sincronizam com os do vínculo
- `plotIds` permite arrendar talhoes especificos (nao obrigatoriamente a fazenda inteira)

---

## Endpoints propostos

### CRUD do contrato

| Metodo | Rota                                 | Permissao      | Descricao                   |
| ------ | ------------------------------------ | -------------- | --------------------------- |
| POST   | `/org/farms/:farmId/lease-contracts` | `farms:update` | Criar contrato              |
| GET    | `/org/farms/:farmId/lease-contracts` | `farms:read`   | Listar contratos da fazenda |
| GET    | `/org/lease-contracts`               | `farms:read`   | Listar todos da organizacao |
| GET    | `/org/lease-contracts/:id`           | `farms:read`   | Detalhe do contrato         |
| PATCH  | `/org/lease-contracts/:id`           | `farms:update` | Atualizar contrato          |
| DELETE | `/org/lease-contracts/:id`           | `farms:delete` | Soft delete                 |

### Pagamentos

| Metodo | Rota                                           | Permissao      | Descricao                  |
| ------ | ---------------------------------------------- | -------------- | -------------------------- |
| POST   | `/org/lease-contracts/:id/payments/generate`   | `farms:update` | Gerar parcelas do periodo  |
| GET    | `/org/lease-contracts/:id/payments`            | `farms:read`   | Listar parcelas            |
| PATCH  | `/org/lease-contracts/:id/payments/:paymentId` | `farms:update` | Registrar pagamento        |
| GET    | `/org/lease-payments/overdue`                  | `farms:read`   | Parcelas em atraso (todos) |

### Documentos

| Metodo | Rota                                        | Permissao      | Descricao           |
| ------ | ------------------------------------------- | -------------- | ------------------- |
| POST   | `/org/lease-contracts/:id/documents`        | `farms:update` | Upload de documento |
| GET    | `/org/lease-contracts/:id/documents`        | `farms:read`   | Listar documentos   |
| DELETE | `/org/lease-contracts/:id/documents/:docId` | `farms:update` | Remover documento   |

### Reajustes

| Metodo | Rota                                   | Permissao      | Descricao              |
| ------ | -------------------------------------- | -------------- | ---------------------- |
| POST   | `/org/lease-contracts/:id/adjustments` | `farms:update` | Registrar reajuste     |
| GET    | `/org/lease-contracts/:id/adjustments` | `farms:read`   | Historico de reajustes |

### Alertas e relatorios

| Metodo | Rota                                  | Permissao    | Descricao                                        |
| ------ | ------------------------------------- | ------------ | ------------------------------------------------ |
| GET    | `/org/lease-contracts/expiring`       | `farms:read` | Contratos proximos ao vencimento                 |
| GET    | `/org/lease-contracts/summary`        | `farms:read` | Resumo financeiro (total pago, a pagar, vencido) |
| GET    | `/org/lease-contracts/:id/export/pdf` | `farms:read` | Exportar resumo em PDF                           |

---

## Criterios de aceite propostos

### CA1 — CRUD de contrato de arrendamento

- Criar contrato vinculado a um `ProducerFarmLink` com `bondType=ARRENDATARIO`
- Validar que o link existe e pertence a organizacao
- Impedir duplicidade (1 contrato por link ativo)
- Campos obrigatorios: `startDate`, `endDate`, `leasedAreaHa`, `paymentType`
- Soft delete com `deletedAt`

### CA2 — Tipos de pagamento e calculo de parcelas

- Suportar 3 modalidades: valor fixo, por hectare, percentual da producao
- Gerar parcelas automaticamente conforme `paymentFrequency`
- Calculo por hectare: `perHectareValueBrl * leasedAreaHa`
- Percentual da producao: parcela fica como "a definir" ate registro da colheita

### CA3 — Controle de pagamentos

- Registrar pagamento com valor pago e data
- Marcar automaticamente como `OVERDUE` quando passa da `dueDate` (job ou consulta)
- Dashboard de inadimplencia por fazenda/organizacao

### CA4 — Reajuste anual

- Registrar reajuste com indice e percentual aplicado
- Atualizar valor base do contrato apos reajuste
- Historico de reajustes para auditoria

### CA5 — Documentos anexos

- Upload de PDF/imagens do contrato, aditivos, comprovantes
- Categorizar por tipo: contrato, aditivo, comprovante, vistoria
- Limite de tamanho: 10 MB por arquivo

### CA6 — Alertas de vencimento e renovacao

- Integrar com o endpoint `expiring` existente (ou substituir)
- Alerta configuravel: 30, 60, 90 dias antes do vencimento
- Alerta de renovacao automatica (quando `autoRenew=true`)
- Alerta de parcelas em atraso

### CA7 — Vinculacao com talhoes

- Permitir selecionar talhoes especificos da fazenda
- Calcular area arrendada como soma dos talhoes selecionados
- Validar que area arrendada nao excede area total da fazenda

### CA8 — Frontend (web)

- Aba "Contratos" na pagina de detalhe da fazenda
- Modal de criacao/edicao seguindo design system
- Lista de pagamentos com status visual (cores por status)
- Upload de documentos com drag-and-drop
- Cards de resumo: valor total, pago, pendente, vencido

### CA9 — Relatorios

- Resumo financeiro por contrato e consolidado por organizacao
- Export PDF do contrato com dados principais e historico de pagamentos
- Export CSV de pagamentos para integracao contabil

---

## Estrutura de modulo proposta

```
apps/backend/src/modules/lease-contracts/
  ├── lease-contracts.routes.ts
  ├── lease-contracts.routes.spec.ts
  ├── lease-contracts.service.ts
  └── lease-contracts.types.ts
```

---

## Dependencias

- **Existentes:** `ProducerFarmLink`, `Farm`, `Organization`, `Plot`
- **Novas:** upload de arquivos (S3/minio), geracao de PDF (pdfkit ja usado no projeto)
- **Opcionais (futuro):** integracao com API de indices economicos (IGPM, IPCA) para reajuste automatico

---

## Fluxo do usuario

1. Cadastra fazenda e produtor normalmente
2. Vincula o produtor a fazenda com `bondType=ARRENDATARIO`, preenchendo `startDate` e `endDate`
3. A partir do vinculo, acessa "Criar contrato de arrendamento"
4. Preenche dados do contrato: area, talhoes, valores, forma de pagamento, clausulas
5. Sistema gera parcelas de pagamento conforme frequencia
6. Faz upload do PDF do contrato registrado em cartorio
7. Recebe alertas de vencimento de parcelas e do contrato
8. No vencimento, renova ou encerra o contrato

---

## Por que

- Arrendamento e a principal forma de acesso a terra no agro brasileiro (~30% da area agricola)
- Controle financeiro dos pagamentos evita inadimplencia e conflitos
- Rastreabilidade documental e exigencia legal para financiamentos rurais (Pronaf, Pronamp)
- Alertas de vencimento previnem perda de prazos e renovacoes automaticas indesejadas
- Vinculacao com talhoes especificos reflete a realidade de arrendamentos parciais
