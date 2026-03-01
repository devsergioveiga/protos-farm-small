# US-014 Etapa 2 — Enriquecimento do Modulo Producers

## O que foi feito

### Types (`producers.types.ts`)

Campos adicionados a `CreateFarmLinkInput` e `UpdateFarmLinkInput`:

- `startDate?: string` — data de inicio do vinculo
- `endDate?: string` — data de termino (arrendamentos)
- `isItrDeclarant?: boolean` — declarante ITR
- `registrationIds?: string[]` — IDs de matriculas a vincular

### Service (`producers.service.ts`)

**Funcoes existentes modificadas:**

- `addFarmLink()` — aceita novos campos, cria registrationLinks, valida registrationIds pertencem a farmId, valida endDate >= startDate, gera exclusividade isItrDeclarant
- `updateFarmLink()` — aceita novos campos, sync registrationLinks (delete+create), valida datas e matriculas
- `listFarmLinks()` — inclui registrationLinks → farmRegistration no include
- `getProducersByFarm()` — inclui registrationLinks e IEs ativas do produtor para a fazenda

**3 funcoes novas:**

- `validateFarmParticipation(ctx, farmId)` — soma participationPct agrupada por bondType, retorna warnings se != 100%
- `getItrDeclarant(ctx, farmId)` — retorna produtor com isItrDeclarant=true para a fazenda (404 se nenhum)
- `setItrDeclarant(ctx, producerId, linkId)` — seta declarante ITR, desliga anteriores automaticamente
- `getExpiringContracts(ctx, daysAhead)` — lista unificada de alertas: producer_farm_links com endDate proximo + IEs com contractEndDate proximo

**Validacoes:**

- endDate >= startDate se ambos fornecidos
- registrationIds devem pertencer a mesma farm do link
- Apenas 1 isItrDeclarant=true por fazenda (ao setar, desliga outros)
- Aviso (nao erro) se soma participationPct por fazenda != 100%

### Routes (`producers.routes.ts`)

**Endpoints existentes atualizados** (POST/PATCH farm links aceitam novos campos, GET retorna registrationLinks).

**4 endpoints novos:**

| Metodo | Rota                                                     | Permissao          | Descricao                           |
| ------ | -------------------------------------------------------- | ------------------ | ----------------------------------- |
| GET    | `/org/farms/:farmId/participation`                       | `farms:read`       | Soma percentuais + warnings         |
| GET    | `/org/farms/:farmId/itr-declarant`                       | `farms:read`       | Declarante ITR da fazenda           |
| GET    | `/org/contracts/expiring`                                | `producers:read`   | Alertas vencimento (query: days=30) |
| PATCH  | `/org/producers/:producerId/farms/:linkId/itr-declarant` | `producers:update` | Setar declarante ITR                |

## Por que

- Vigencia de vinculos modela arrendamentos e contratos reais
- Vinculo com matriculas permite rastreabilidade por area registrada
- Declarante ITR e obrigacao fiscal critica (1 por fazenda)
- Alertas de vencimento previnem perda de prazos contratuais
- Validacao de percentuais alerta inconsistencias sem bloquear cadastro

## Arquivos modificados

- `src/modules/producers/producers.types.ts`
- `src/modules/producers/producers.service.ts`
- `src/modules/producers/producers.routes.ts`
