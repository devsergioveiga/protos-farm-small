# CCIR — Histórico de Exercícios (Implementação Futura)

## Contexto

O CCIR (Certificado de Cadastro de Imóvel Rural) é emitido anualmente pelo INCRA e exige pagamento de taxa para cada exercício fiscal. O documento é necessário para operações como venda, arrendamento, hipoteca, desmembramento e inventário do imóvel rural.

### Situação Atual (Camada 1)

Os dados do CCIR vigente são armazenados diretamente no modelo `RuralProperty`:

- `ccirCode` — Número do CCIR (11 dígitos)
- `ccirValidUntil` — Data de vencimento
- `ccirPaymentStatus` — Situação (QUITADO / PENDENTE / VENCIDO)
- `ccirIssuedAt` / `ccirGeneratedAt` — Datas de controle (campos de formulário, pendente persistência)

O PDF do CCIR é armazenado como `PropertyDocument` tipo `CCIR`.

### Limitações

- Apenas o CCIR vigente é rastreado — sem histórico
- Ao atualizar para o exercício seguinte, os dados do anterior são sobrescritos
- Não há alertas automáticos para emissão/pagamento anual
- Não há rastreabilidade de compliance ao longo dos anos

---

## Proposta: Modelo CcirExercicio (Camada 2)

### Novo Modelo Prisma

```prisma
model CcirExercise {
  id                String    @id @default(uuid())
  ruralPropertyId   String
  exerciseYear      Int                          // Ex: 2025
  ccirNumber        String                       // 70896758258
  issuedAt          DateTime? @db.Date           // Data de lançamento
  generatedAt       DateTime? @db.Date           // Data de geração
  validUntil        DateTime? @db.Date           // Data de vencimento
  paymentStatus     String    @default("PENDENTE") // QUITADO, PENDENTE, VENCIDO
  taxAmount         Decimal?  @db.Decimal(10, 2) // Valor da taxa (R$)
  taxPreviousDebts  Decimal?  @db.Decimal(10, 2) // Débitos anteriores
  taxPenalty        Decimal?  @db.Decimal(10, 2) // Multa
  taxInterest       Decimal?  @db.Decimal(10, 2) // Juros
  taxTotal          Decimal?  @db.Decimal(10, 2) // Valor total
  documentId        String?                      // FK para PropertyDocument (PDF do CCIR)
  notes             String?                      // Observações
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  ruralProperty RuralProperty   @relation(fields: [ruralPropertyId], references: [id], onDelete: Cascade)
  document      PropertyDocument? @relation(fields: [documentId], references: [id], onDelete: SetNull)

  @@unique([ruralPropertyId, exerciseYear])
  @@index([ruralPropertyId])
  @@map("ccir_exercises")
}
```

### Campos Extraídos do CCIR PDF

| Campo PDF                   | Campo do Modelo             |
| --------------------------- | --------------------------- |
| EMISSÃO EXERCÍCIO 2025      | `exerciseYear`              |
| DATA DE LANÇAMENTO          | `issuedAt`                  |
| NÚMERO DO CCIR              | `ccirNumber`                |
| DATA DE GERAÇÃO DO CCIR     | `generatedAt`               |
| DATA DE VENCIMENTO          | `validUntil`                |
| TAXA DE SERVIÇOS CADASTRAIS | `taxAmount`                 |
| DÉBITOS ANTERIORES          | `taxPreviousDebts`          |
| MULTA                       | `taxPenalty`                |
| JUROS                       | `taxInterest`               |
| VALOR TOTAL                 | `taxTotal`                  |
| **_ QUITADO _**             | `paymentStatus = 'QUITADO'` |

### Endpoints

```
GET    /org/farms/:farmId/properties/:propertyId/ccir-exercises
POST   /org/farms/:farmId/properties/:propertyId/ccir-exercises
GET    /org/farms/:farmId/properties/:propertyId/ccir-exercises/:exerciseId
PATCH  /org/farms/:farmId/properties/:propertyId/ccir-exercises/:exerciseId
DELETE /org/farms/:farmId/properties/:propertyId/ccir-exercises/:exerciseId
```

### Fluxo de Uso

1. **Upload do CCIR**: Ao anexar o PDF, o parser extrai os dados e cria/atualiza o exercício correspondente
2. **Listagem**: Timeline de exercícios com status de pagamento (badges coloridos)
3. **Alertas**: A partir de julho, alertar imóveis sem CCIR do exercício atual
4. **Relatório de Compliance**: Visão consolidada de todos os imóveis e seus CCIRs

### Alertas Automáticos (Integração com stock-alerts pattern)

| Alerta                     | Condição                                           | Prioridade |
| -------------------------- | -------------------------------------------------- | ---------- |
| CCIR não emitido           | Exercício atual sem registro a partir de julho     | Alta       |
| CCIR pendente              | `paymentStatus = 'PENDENTE'` há mais de 30 dias    | Média      |
| CCIR vencido               | `paymentStatus = 'VENCIDO'` ou `validUntil < hoje` | Alta       |
| CCIR próximo do vencimento | `validUntil` dentro de 15 dias                     | Média      |

### UI — Aba "Histórico CCIR" no Modal de Edição

```
┌─────────────────────────────────────────────────────┐
│ Histórico CCIR                                      │
├─────────────────────────────────────────────────────┤
│ 2025  │ 70896758258 │ 16/06/2025 │ ✅ Quitado     │
│       │ R$ 33,87    │            │ 📄 PDF anexado  │
├─────────────────────────────────────────────────────┤
│ 2024  │ 70896758241 │ 20/06/2024 │ ✅ Quitado     │
│       │ R$ 31,52    │            │ 📄 PDF anexado  │
├─────────────────────────────────────────────────────┤
│ 2023  │ —           │ —          │ ⚠️ Não emitido  │
└─────────────────────────────────────────────────────┘
```

### Migração dos Dados Existentes

Ao implementar, criar script de migração que:

1. Lê os campos `ccirCode`, `ccirValidUntil`, `ccirPaymentStatus` de cada `RuralProperty`
2. Cria um `CcirExercise` para o exercício vigente
3. Vincula o `PropertyDocument` tipo `CCIR` existente (se houver)
4. Opcionalmente, mantém os campos no `RuralProperty` como cache do exercício vigente

### Estimativa

- Backend (modelo + CRUD + parser): 2-3 dias
- Frontend (aba + timeline + formulário): 2 dias
- Alertas automáticos: 1 dia
- Migração de dados: 0.5 dia
- **Total: ~6 dias**

### Dependências

- Parser CCIR já extrai todos os dados necessários (exercício, datas, valores)
- PropertyDocument já suporta múltiplos CCIRs por imóvel
- Padrão de alertas pode seguir o existente em `stock-alerts`
