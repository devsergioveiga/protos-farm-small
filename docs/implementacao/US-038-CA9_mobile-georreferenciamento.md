# US-038 CA9 — Mobile com georreferenciamento (foto + GPS)

## O que foi feito

### Backend

- **Migration `20260321000000`**: adicionados campos `photoUrl` (TEXT), `latitude` (DECIMAL 10,7), `longitude` (DECIMAL 10,7) ao model `PesticideApplication`
- **Types**: `CreatePesticideApplicationInput` e `PesticideApplicationItem` incluem `photoUrl`, `latitude`, `longitude`
- **Service**: `create`, `update`, `toItem` e CSV export tratam os novos campos
- Endpoint POST existente aceita os novos campos sem breaking change

### Mobile

- **SQLite Migration V6**: nova tabela `pesticide_applications` com 26 colunas (todos os campos obrigatórios + opcionais + GPS + foto)
- **Tipo `OfflinePesticideApplication`**: interface snake_case para SQLite
- **Repository**: `pesticide-application-repository.ts` com CRUD + `getUnsynced` + `markSynced`
- **`OperationEntity`**: adicionado `'pesticide_applications'` para offline queue
- **Tela `pesticide-application.tsx`**: formulário completo em stack screen (não tab)

### Tela mobile — funcionalidades

- GPS automático via `expo-location` (High accuracy)
- Auto-detecção de talhão por point-in-polygon contra `boundary_geojson`
- Captura de foto via `expo-image-picker` (câmera, EXIF GPS fallback)
- Campos obrigatórios: talhão, produto, ingrediente ativo, dose, volume calda, alvo
- Campos opcionais: receituário (ART, CREA, justificativa), condições ambientais, carência, observações
- Alertas visuais de condições inadequadas (temp >30°C, umidade <55%, vento >10 km/h)
- Offline: salva em SQLite + enfileira na offline queue para sync posterior
- Navegação: acessível via register tab → selecionando "Pulverização" redireciona para formulário detalhado

## Por que

CA9 exige que o registro de defensivos possa ser feito em campo pelo app mobile, com geolocalização (GPS) e registro fotográfico da aplicação para rastreabilidade. A tela dedicada oferece todos os campos específicos de defensivos (não apenas os campos genéricos de operação de campo), garantindo dados completos para conformidade fitossanitária.
