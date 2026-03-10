# US-078 CA1 — Modo Rápido (Tela Única)

## O que foi feito

Implementação da tela de lançamento rápido de serviço diário para equipes de campo, otimizada para uso mobile por encarregados de turma.

## Decisões técnicas

### Mobile (SQLite offline-first)

1. **Migration V8** — Novas tabelas:
   - `field_teams` — cache local das equipes de campo (sync do backend)
   - `field_team_members` — membros ativos de cada equipe
   - `quick_services` — serviços registrados localmente (sync → team-operations API)

2. **Repositórios** — `field-team-repository.ts` e `quick-service-repository.ts`:
   - Padrão existente de prepare/execute/finalize com expo-sqlite
   - Suporte a upsertMany para sync em lote

3. **Sync** — Field teams adicionadas ao SyncService:
   - Passo 8 no `syncFarmData()` — baixa equipes com membros ativos
   - API: `GET /org/farms/:farmId/field-teams` (paginado)
   - Membros inativos (`leftAt != null`) filtrados no mapper

4. **Equipe favorita** — Armazenada em SecureStore (`protos_favorite_team_{userId}`):
   - Auto-selecionada ao abrir a tela
   - Fallback: se líder de exatamente 1 equipe, auto-seleciona

### Tela quick-service.tsx

- **Formulário tela única**: equipe → presença → atividade → local → horário → obs → confirmar
- **Toggle de presença**: Switch nativo por membro, todos marcados por padrão
- **Botão "Todos/Nenhum"**: toggle em lote dos membros
- **Time pickers**: DateTimePicker nativo (modo time, 24h), defaults 07:00–11:00
- **Summary bar**: resumo visual antes do botão de confirmar
- **Offline queue**: enfileira como pending_operation para sync automático

### Navegação

- Acessível via atalho "Serviço rápido da equipe" na tab Registrar
- Route: `/quick-service` (stack screen)

## Arquivos criados/modificados

- `apps/mobile/services/database.ts` — Migration V8
- `apps/mobile/services/db/field-team-repository.ts` — Novo
- `apps/mobile/services/db/quick-service-repository.ts` — Novo
- `apps/mobile/services/db/index.ts` — Exports
- `apps/mobile/services/sync.ts` — Sync field teams (step 8)
- `apps/mobile/types/offline.ts` — Tipos OfflineFieldTeam, OfflineFieldTeamMember, OfflineQuickService
- `apps/mobile/app/(app)/quick-service.tsx` — Tela principal
- `apps/mobile/app/(app)/(tabs)/register.tsx` — Atalho de navegação

## Dependências adicionadas

- `@react-native-community/datetimepicker` — Time picker nativo
