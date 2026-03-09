# US-076 CA8 — Registro Mobile de Monitoramento MIP com Foto e GPS

## O que foi implementado

Tela mobile para registro de monitoramento MIP no campo, com captura de foto pela câmera, coordenadas GPS automáticas (do ponto de monitoramento ou do dispositivo), e suporte offline completo.

## Por que

O técnico de campo precisa registrar observações de pragas diretamente no ponto de monitoramento, sem depender de conexão. A foto é evidência visual do nível de infestação e pode ser revisada posteriormente no escritório. O GPS garante rastreabilidade geográfica.

## Dados offline (SQLite)

### Migration V7

Três novas tabelas no SQLite mobile:

| Tabela               | Propósito                                    |
| -------------------- | -------------------------------------------- |
| `pests`              | Cache local da biblioteca de pragas (org)    |
| `monitoring_points`  | Cache dos pontos de monitoramento por talhão |
| `monitoring_records` | Registros criados no campo (offline-first)   |

### Sync

- **Pests:** sincronizados do endpoint `GET /org/pests` (paginado)
- **Monitoring Points:** sincronizados por talhão via `GET /org/farms/:farmId/field-plots/:plotId/monitoring-points` (paginado)
- **Monitoring Records:** enfileirados no `pending_operations` para sync com `POST /org/farms/:farmId/field-plots/:plotId/monitoring-records`

## Tela mobile

**Rota:** `/(app)/monitoring-record`
**Acesso:** Menu "Registrar" → Tipo "Monitoramento MIP"

### Campos do formulário

| Campo              | Tipo         | Obrigatório | Descrição                           |
| ------------------ | ------------ | ----------- | ----------------------------------- |
| Talhão             | Picker       | Sim         | Seleção do talhão da fazenda        |
| Ponto              | Picker       | Sim         | Ponto de monitoramento do talhão    |
| Praga/Doença       | Picker+Busca | Sim         | Da biblioteca de pragas com search  |
| Nível infestação   | Chips        | Sim         | AUSENTE/BAIXO/MODERADO/ALTO/CRITICO |
| Amostras           | Number       | Não         | Quantidade de amostras coletadas    |
| Contagem           | Number       | Não         | Indivíduos encontrados              |
| Dano estimado (%)  | Decimal      | Não         | Percentual de dano                  |
| Estádio fenológico | Picker       | Não         | VE a R9                             |
| Inimigos naturais  | Switch+Texto | Não         | Presença + descrição                |
| Foto               | Câmera       | Não         | expo-image-picker, quality 0.8      |
| Observações        | Textarea     | Não         | Texto livre                         |

### Comportamentos

- **GPS automático:** ao selecionar ponto, usa coordenadas do ponto; fallback para GPS do dispositivo; fallback para EXIF da foto
- **Após salvar:** opção "Novo registro" (mantém talhão/ponto) ou "Voltar"
- **Offline:** banner "Sem conexão", dados salvos localmente, sync automático
- **Haptics:** feedback tátil em seleções e ações
- **Acessibilidade:** accessibilityLabel, accessibilityRole, accessibilityState em todos os componentes

## Arquivos criados/modificados

### Criados

- `apps/mobile/app/(app)/monitoring-record.tsx` — Tela principal
- `apps/mobile/services/db/pest-repository.ts` — Repositório SQLite pragas
- `apps/mobile/services/db/monitoring-point-repository.ts` — Repositório pontos
- `apps/mobile/services/db/monitoring-record-repository.ts` — Repositório registros

### Modificados

- `apps/mobile/types/offline.ts` — Tipos: OfflinePest, OfflineMonitoringPoint, OfflineMonitoringRecord, InfestationLevel
- `apps/mobile/services/database.ts` — Migration V7 (pests + monitoring_points + monitoring_records)
- `apps/mobile/services/db/index.ts` — Exports dos novos repositórios
- `apps/mobile/services/db/pending-operations-repository.ts` — monitoring_records em OperationEntity
- `apps/mobile/services/sync.ts` — Sync de pragas e pontos de monitoramento
- `apps/mobile/app/(app)/(tabs)/register.tsx` — Entrada "Monitoramento MIP" no menu de tipos
