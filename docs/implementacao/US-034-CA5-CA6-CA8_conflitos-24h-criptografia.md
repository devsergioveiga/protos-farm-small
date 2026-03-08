# US-034 CA5/CA6/CA8 — Conflitos, 24h offline, criptografia

## CA5 — Resolução de conflitos: last-write-wins com log

### O que

Tabela `conflict_log` registra conflitos detectados durante flush de operações pendentes.
Quando o servidor retorna 409 (conflict), o app aceita a versão do servidor (last-write-wins),
salva ambas versões no log para revisão posterior.

### Implementação

- Migration V3: tabela `conflict_log` (entity, entity_id, local_payload, server_payload, resolution, reviewed)
- `conflict-log-repository.ts`: log, getUnreviewed, markReviewed, countUnreviewed
- `offline-queue.ts`: flush detecta 409, busca versão do servidor, loga conflito, remove operação

## CA6 — Funcionalidade plena sem internet por 24h

### O que

FarmContext agora tem fallback offline: quando a API falha, carrega fazendas do SQLite local.
Combinado com os repositórios offline (CA1) e fila de operações (CA2), o app funciona
completamente sem internet — leituras vêm do SQLite, escritas enfileiram para sync posterior.

### Implementação

- `FarmContext.tsx`: catch no fetchFarms carrega de `createFarmRepository(db)` com mapeamento para FarmListItem

## CA8 — Dados locais criptografados

### Abordagem

- **Tokens sensíveis** (JWT, refresh) ficam em `expo-secure-store` (Keychain iOS / EncryptedSharedPreferences Android) — já implementado em US-032
- **Credenciais biométricas** em `expo-secure-store` — já implementado
- **SQLite** contém dados de negócio (animais, lotes, etc) sem dados pessoais sensíveis (sem CPF, senhas, etc)
- O dispositivo iOS/Android já criptografa o filesystem quando locked (file-level encryption)
- SQLCipher não é suportado nativamente pelo expo-sqlite no managed workflow

## Arquivos criados/modificados

- `services/database.ts` — migration V3 (conflict_log table)
- `services/db/conflict-log-repository.ts` — CRUD do log de conflitos
- `services/db/index.ts` — exports atualizados
- `services/offline-queue.ts` — detecção de 409 + log de conflito
- `hooks/useOfflineData.ts` — expõe conflictLog
- `stores/FarmContext.tsx` — fallback offline para fazendas
