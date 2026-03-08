# US-036 CA1 — Formulário simplificado de registro de operações

## O que foi feito

Implementação do formulário de registro rápido de operações no app mobile, permitindo ao produtor registrar atividades de campo (pulverização, plantio, colheita, etc.) em menos de 60 segundos.

## Por quê

O produtor precisa de uma forma rápida e simples de registrar operações no campo, mesmo offline. O formulário auto-preenche data/hora e detecta o talhão/pasto via GPS, minimizando entrada manual.

## Arquivos criados/modificados

### Banco de dados

- `services/database.ts` — migrationV5: tabelas `field_operations` e `operation_templates`
- `types/offline.ts` — tipos `FieldOperationType`, `OfflineFieldOperation`, `OfflineOperationTemplate`
- `services/db/operation-repository.ts` — CRUD para operações e templates
- `services/db/index.ts` — exports dos novos repos

### Tela

- `app/(app)/(tabs)/register.tsx` — formulário completo substituindo placeholder

## Schema das tabelas

### field_operations

| Coluna             | Tipo    | Descrição                               |
| ------------------ | ------- | --------------------------------------- |
| id                 | TEXT PK | ID local gerado                         |
| farm_id            | TEXT FK | Fazenda                                 |
| location_id        | TEXT    | Talhão/pasto/instalação                 |
| location_type      | TEXT    | PLOT, PASTURE, FACILITY                 |
| location_name      | TEXT    | Nome desnormalizado p/ exibição offline |
| operation_type     | TEXT    | Tipo da operação (12 opções)            |
| notes              | TEXT    | Observações livres                      |
| photo_uri          | TEXT    | URI local da foto (CA3)                 |
| latitude/longitude | REAL    | Coordenadas GPS                         |
| recorded_at        | TEXT    | Timestamp do registro                   |
| synced             | INTEGER | 0=pendente, 1=sincronizado              |

### operation_templates (para CA5)

| Coluna         | Tipo    | Descrição                |
| -------------- | ------- | ------------------------ |
| id             | TEXT PK | ID                       |
| farm_id        | TEXT FK | Fazenda                  |
| name           | TEXT    | Nome do template         |
| operation_type | TEXT    | Tipo pré-definido        |
| default_notes  | TEXT    | Observações padrão       |
| usage_count    | INTEGER | Ordenação por frequência |

## Funcionalidades do formulário

1. **Tipo de operação** — picker modal com 12 tipos (campo obrigatório)
2. **Talhão/pasto** — picker modal com dados offline + auto-detecção GPS via pointInPolygon
3. **Data/hora** — auto-preenchido, read-only
4. **Coordenadas GPS** — capturadas automaticamente
5. **Observações** — campo de texto livre multiline
6. **Foto** — botão placeholder (implementação real no CA3)
7. **Salvar** — persiste no SQLite local com `synced=0`, haptic feedback de sucesso

## Dependências adicionadas

- `expo-location` — permissão e captura de GPS
