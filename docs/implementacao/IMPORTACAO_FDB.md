# Importação de Dados — DADOS988.FDB (Firebird 2.5)

## Visão Geral

Banco de dados Firebird 2.5 (ODS 11, page size 16384) de software pecuário legado. Contém dados reais de produção de uma fazenda leiteira.

### Volumetria

| Tabela FDB            | Registros | Mapeamento Protos Farm                                                                        |
| --------------------- | --------- | --------------------------------------------------------------------------------------------- |
| ANIMAL                | 3.563     | Animal                                                                                        |
| RACA                  | 111       | Breed                                                                                         |
| COMPOSICAORACIAL      | 132       | AnimalBreedComposition                                                                        |
| ANIMALRACA            | 3.562     | AnimalBreedComposition                                                                        |
| PESO                  | 23.895    | AnimalWeighing                                                                                |
| LEITE                 | 83.484    | MilkingRecord                                                                                 |
| LACTACAO              | 4.326     | Lactation                                                                                     |
| MAMITE                | 5.280     | MastitisCase + MastitisQuarter                                                                |
| REPRODUCAO            | 82.149    | Insemination / NaturalMating / PregnancyDiagnosis / CalvingEvent (separar por TIPOREPRODUCAO) |
| EXAMEANIMAL           | 1.125     | AnimalExam                                                                                    |
| APLICACAOPRODUTO      | 582       | Vaccination / Deworming / TreatmentApplication                                                |
| PROTOCOLOSANITARIO    | 4         | SanitaryProtocol                                                                              |
| PROTOCOLOIATF         | 9         | IatfProtocol                                                                                  |
| GRUPOANIMAL           | 11        | AnimalLot                                                                                     |
| MOVGRUPOANIMAL        | 7.299     | AnimalLotMovement                                                                             |
| CATEGORIA             | 7         | Enum no Animal                                                                                |
| CENTRALSEMEN          | 25        | Bull / SemenBatch                                                                             |
| MOTIVOBAIXA           | 79        | AnimalExit (tipo)                                                                             |
| PRODUTO               | 19.934    | Product                                                                                       |
| PRINCIPIOATIVO        | 667       | **ActiveIngredient** (novo)                                                                   |
| PRODUTOPRINCIPIOATIVO | 12.420    | **ProductActiveIngredient** (novo)                                                            |
| CLASSIFICACAO         | 96        | Product.category / Product.type                                                               |
| UNIDADEMEDIDA         | 27        | MeasurementUnit                                                                               |
| MOVIMENTOESTOQUE      | 13.150    | StockEntry / StockOutput                                                                      |
| LOCALARMAZENAMENTO    | 4         | **StorageLocation** (novo)                                                                    |
| CENTROCUSTO           | 266       | CostCenter                                                                                    |
| PATRIMONIO            | 79        | Asset                                                                                         |
| PESSOA                | 2.491     | Producer + Supplier (separar por uso)                                                         |
| MUNICIPIO             | 5.570     | Dados de endereço (inline)                                                                    |
| FAZENDA               | 1         | Farm                                                                                          |
| SETOR                 | 1         | FarmLocation                                                                                  |
| NOTA                  | 50.123    | FinancialTransaction / Payable / Receivable                                                   |
| NOTAITEM              | 102.771   | (itens das notas — granularidade não existe hoje)                                             |
| NOTAITEMAPRO          | 105.511   | PayableCostCenterItem / ReceivableCostCenterItem                                              |
| NOTAANIMAL            | 359       | (vínculo animal ↔ transação — não existe hoje)                                                |
| MOVIMENTO             | 57.920    | PayableInstallment / ReceivableInstallment                                                    |
| CONTAGERENCIAL        | 188       | **Não implementado** — futuro milestone Contabilidade                                         |
| RATEIO / RATEIOITEM   | 1.099     | Rateio parcial via CostCenter                                                                 |
| BANCO                 | 216       | BankAccount (dados de referência)                                                             |
| CONTACORRENTE         | 25        | BankAccount                                                                                   |
| TRANSFERENCIABANCARIA | 1.309     | AccountTransfer                                                                               |
| DOENCA                | 35        | Disease                                                                                       |
| TRATAMENTO            | 91        | TreatmentProtocol                                                                             |
| NUTRIENTE             | 32        | FeedIngredient                                                                                |
| PRODUCAOLEITE         | 227       | MilkCollection                                                                                |

### Tabelas com zero registros (não importar)

DIETA, TANQUE, ANALISELEITE, ANALISETANQUE, ESTACAO, INVENTARIO, MANEJOAGRICOLA, PROJETOAGRICOLA, PLANEJAMENTO, DOENCAANIMAL, MOVSETOR, BRINCOSISBOV, PATRIMONIOMANUTENCAO, AGENDASANIDADE, CLT\_\*, COTACAO, PELAGEM, MOVREBANHO, PRODUCAOLEITERATEIO, HORAMAQUINAHOMEM, PESSOALIVROCAIXA, CLASSIFICACAOCARCACA.

## Models Criados para Importação

### ActiveIngredient + ProductActiveIngredient

Normaliza os princípios ativos que antes eram strings livres em `ProductComposition.activeIngredient`.

- **ActiveIngredient**: id, organizationId, name, type (VETERINARY/AGROCHEMICAL/FERTILIZER/OTHER), casNumber?, notes
- **ProductActiveIngredient**: productId, activeIngredientId, concentration?, function?
- Unique constraint: (organizationId, name) para ActiveIngredient
- Unique constraint: (productId, activeIngredientId) para ProductActiveIngredient
- Migration: `20260423100000_add_active_ingredients_and_storage_locations`

### StorageLocation

Normaliza o campo texto livre `StockEntry.storageLocation` para entidade referenciável.

- **StorageLocation**: id, organizationId, name, code?, assetId? (vínculo com Asset/patrimônio), isDefault, isActive, notes
- Novo FK `storageLocationId` em `StockEntry` (campo legado `storageLocation` string mantido)
- Unique constraints: (organizationId, name) e (organizationId, code)

## Decisões Arquiteturais

### O que NÃO foi criado e por quê

| Conceito FDB                         | Decisão         | Motivo                                                                               |
| ------------------------------------ | --------------- | ------------------------------------------------------------------------------------ |
| **CONTAGERENCIAL** (plano de contas) | Postergar       | Pertence ao futuro milestone "Contabilidade" (pós-v1.2)                              |
| **Pessoa unificada**                 | Manter separado | Design intencional: Producer + Supplier + User têm domínios distintos                |
| **CLIMA** (dados meteorológicos)     | Descartar       | Zero registros no FDB, baixa prioridade                                              |
| **NF-e / módulo fiscal**             | Fora de escopo  | Explicitamente fora de escopo no PROJECT.md. Phase 19 importa XML apenas para ativos |

### Mapeamento PESSOA → Producer + Supplier

A tabela PESSOA do FDB é unificada. Na importação, determinar o papel pela utilização:

- Se referenciado em NOTA como fornecedor → **Supplier**
- Se referenciado como proprietário de animal → **Producer**
- Se referenciado como inseminador (REPRODUCAO.CDPESSOA) → **User** ou campo texto
- Uma mesma PESSOA pode gerar registros em ambos os models

### Mapeamento REPRODUCAO → Múltiplos models

A tabela REPRODUCAO do FDB é genérica (tipo definido por TIPOREPRODUCAO). Mapear para:

- Inseminação (IA/IATF) → **Insemination**
- Monta natural → **NaturalMating**
- Diagnóstico gestação → **PregnancyDiagnosis**
- Parto → **CalvingEvent** + **CalvingCalf**
- Secagem → **Lactation** (dtfim)
- Desmama → **WeaningRecord**
- Cio → **HeatRecord**

### Mapeamento NOTA → Financeiro

NOTA.TIPONOTA determina o destino:

- Compra → **Payable** + **PayableInstallment** (via MOVIMENTO)
- Venda → **Receivable** + **ReceivableInstallment**
- NOTAITEMAPRO → **PayableCostCenterItem** / **ReceivableCostCenterItem**

## Ordem de Importação (dependências)

```
Fase 1 — Dados Mestres (sem dependências)
  FAZENDA → Farm
  SETOR → FarmLocation
  RACA → Breed
  CATEGORIA → mapeamento enum
  UNIDADEMEDIDA → MeasurementUnit
  CLASSIFICACAO → Product.category
  BANCO + CONTACORRENTE → BankAccount
  CENTRALSEMEN → Bull/SemenBatch seed
  MOTIVOBAIXA → lookup para AnimalExit
  LOCALARMAZENAMENTO → StorageLocation
  MUNICIPIO → cache de endereço

Fase 2 — Pessoas e Produtos
  PESSOA → Producer + Supplier (separar por uso)
  PRODUTO → Product
  PRINCIPIOATIVO → ActiveIngredient
  PRODUTOPRINCIPIOATIVO → ProductActiveIngredient
  LOTEPRODUTO → SemenBatch

Fase 3 — Animais
  ANIMAL → Animal
  COMPOSICAORACIAL + ANIMALRACA → AnimalBreedComposition
  GRUPOANIMAL → AnimalLot
  MOVGRUPOANIMAL → AnimalLotMovement

Fase 4 — Eventos Pecuários
  PESO → AnimalWeighing
  REPRODUCAO → Insemination/NaturalMating/PregnancyDiagnosis/CalvingEvent/HeatRecord
  LACTACAO → Lactation
  LEITE → MilkingRecord
  MAMITE → MastitisCase + MastitisQuarter
  EXAMEANIMAL → AnimalExam
  APLICACAOPRODUTO → Vaccination/Deworming/TreatmentApplication
  PROTOCOLOSANITARIO → SanitaryProtocol
  PROTOCOLOIATF → IatfProtocol

Fase 5 — Financeiro
  NOTA + NOTAITEM → Payable/Receivable com itens
  NOTAITEMAPRO → CostCenterItems
  MOVIMENTO → Installments
  NOTAANIMAL → vínculo animal ↔ transação
  TRANSFERENCIABANCARIA → AccountTransfer
  CENTROCUSTO → CostCenter
  PATRIMONIO → Asset
  MOVIMENTOESTOQUE → StockEntry/StockOutput
```

## Acesso ao Banco FDB

```bash
# Iniciar container Firebird 2.5
docker run --rm -d --name fb25_reader \
  -v "$(pwd)/DADOS988.FDB:/firebird/data/DADOS988.FDB" \
  -e ISC_PASSWORD=masterkey \
  jacobalberty/firebird:2.5-ss

# Executar queries (usar -nod para ignorar triggers com UDFs ausentes)
docker exec fb25_reader /usr/local/firebird/bin/isql \
  -u SYSDBA -p masterkey -nod \
  /firebird/data/DADOS988.FDB -i /tmp/query.sql

# Parar container
docker stop fb25_reader
```

**Importante:** O flag `-nod` (nodbtriggers) é obrigatório — o banco tem triggers que referenciam UDFs (`SU$APPENDBLOBTOFILE`) não disponíveis no container.
