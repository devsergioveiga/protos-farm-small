# US-015-FE CA2 — Upload de perímetro da matrícula

**Data:** 2026-03-03
**Tipo:** Frontend-only (backend já existia)

## O que foi feito

Upload de perímetro para matrículas individuais, reutilizando o mesmo modal e hook de upload de perímetro da fazenda (US-015-FE CA1), dentro do painel de matrículas.

## Decisões técnicas

### Generalização ao invés de duplicação

Em vez de criar um novo modal e hook específicos para matrícula, os componentes existentes foram generalizados com props opcionais:

- **`useBoundaryUpload.upload()`**: agora recebe `uploadUrl` (string) em vez de `farmId`, permitindo qualquer endpoint de upload
- **`BoundaryUploadModal`**: novas props opcionais `registrationId`, `referenceAreaHa` e `entityLabel` para contextualizar o upload

### Integração no RegistrationsPanel

- Botão `MapPin` adicionado ao `RegistrationCard` (ao lado de editar/excluir)
- Badge visual `Perímetro: X,XX ha` quando a matrícula já possui boundary (`boundaryAreaHa != null`)
- O modal reutiliza o `existingBoundary` da matrícula via `registrationBoundaries` do `useFarmMap`

## Endpoint consumido

```
POST /org/farms/:farmId/registrations/:regId/boundary
```

Aceita: FormData com campo `file` (GeoJSON, KML, KMZ, Shapefile .zip)
Retorna: `BoundaryUploadResult` com `boundaryAreaHa`, `areaDivergence`, `warnings`

## Arquivos criados/modificados

### Modificados

| Arquivo                                           | Mudança                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `hooks/useBoundaryUpload.ts`                      | `upload(farmId)` → `upload(uploadUrl)`                                 |
| `components/boundary/BoundaryUploadModal.tsx`     | Props opcionais `registrationId`, `referenceAreaHa`, `entityLabel`     |
| `components/registrations/RegistrationsPanel.tsx` | Botão MapPin, badge perímetro, prop `onUploadBoundary`                 |
| `components/registrations/RegistrationsPanel.css` | Estilos `.reg-card__boundary-badge`, `.reg-card__action-btn--boundary` |
| `pages/FarmMapPage.tsx`                           | State `uploadingBoundaryReg`, handler, segundo `BoundaryUploadModal`   |

### Testes atualizados

| Arquivo                                                | Mudança                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `hooks/useBoundaryUpload.spec.ts`                      | `upload()` agora recebe URL                                                     |
| `components/boundary/BoundaryUploadModal.spec.tsx`     | +4 testes para registro boundary (aria-label, referenceAreaHa, URL, selectFile) |
| `components/registrations/RegistrationsPanel.spec.tsx` | +3 testes (onUploadBoundary, badge com boundary, badge sem boundary)            |

## Contagem de testes

- Frontend: 306 (eram 299, +7 novos)
