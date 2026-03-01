# US-012 — Etapa 1: Migration (Campos Fazenda + Matrículas + Documentos)

## O que foi implementado

Migration para suporte a dados detalhados de fazendas, múltiplas matrículas de cartório e esqueleto de documentos.

## Por que

Fazendas brasileiras frequentemente possuem múltiplas matrículas de cartório (uma para cada gleba adquirida ao longo do tempo). O sistema precisa modelar essa realidade para controle fundiário adequado, incluindo dados do CCIR, classificação fundiária, áreas ambientais e grau de utilização.

## Novos campos em `farms`

Campos adicionados para suporte a dados do CCIR, classificação fundiária, dados ambientais e produtividade:

- `ccirCode` — Código do CCIR (Certificado de Cadastro de Imóvel Rural)
- `landClassification` — MINIFUNDIO / PEQUENA / MEDIA / GRANDE
- `productive` — Se o imóvel é produtivo
- `fiscalModuleHa`, `fiscalModulesCount`, `minPartitionFraction` — Módulos fiscais
- `appAreaHa` — Área de Preservação Permanente
- `legalReserveHa` — Reserva Legal
- `taxableAreaHa`, `usableAreaHa` — Áreas tributável e utilizável
- `utilizationDegree` — Grau de utilização (%)

## Nova tabela `farm_registrations`

Matrículas de cartório (1:N → farms):

| Coluna           | Tipo          | Descrição                     |
| ---------------- | ------------- | ----------------------------- |
| id               | TEXT PK       | Identificador                 |
| farmId           | FK → farms    | Fazenda vinculada (CASCADE)   |
| number           | TEXT          | Número da matrícula           |
| cnsCode          | TEXT?         | Código CNS do cartório        |
| cartorioName     | TEXT          | Nome do cartório              |
| comarca          | TEXT          | Comarca                       |
| state            | VARCHAR(2)    | UF                            |
| livro            | TEXT?         | Livro de registro             |
| registrationDate | TIMESTAMP?    | Data do registro              |
| areaHa           | DECIMAL(12,4) | Área da matrícula em hectares |

## Nova tabela `farm_documents` (esqueleto)

Preparação para upload de documentos (CA10 futuro). Será implementado quando houver storage (S3/MinIO).

## RLS

Ambas as tabelas têm RLS habilitado com política `tenant_isolation_policy` que verifica se o `farmId` pertence à organização corrente via subquery em `farms`.

## Arquivos

- `prisma/migrations/20260303100000_add_farm_details/migration.sql` (novo)
- `prisma/schema.prisma` — novos campos Farm + modelos FarmRegistration, FarmDocument
