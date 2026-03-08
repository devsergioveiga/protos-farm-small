# US-030 CA5 — Exportação do resultado filtrado em CSV/Excel

## Critério de Aceite

> Exportação do resultado filtrado em CSV/Excel

## O que foi feito

### Backend

- **`animals.service.ts`**: Nova função `exportAnimalsXlsx(ctx, farmId, query)` que gera workbook Excel via `exceljs`:
  - Header bold com auto-filter
  - Auto-fit de largura das colunas baseado no conteúdo
  - Summary row ao final com contagem total e peso médio
  - Retorna `Buffer` para streaming ao client
- **`animals.routes.ts`**: Endpoint `GET /org/farms/:farmId/animals/export` aceita query param `?format=xlsx`:
  - `format=xlsx` → Content-Type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - Sem `format` (ou `csv`) → Content-Type `text/csv; charset=utf-8` (comportamento existente)
  - Ambos formatos respeitam todos os filtros ativos (search, sex, category, breed, lot, location, special, peso, idade, sort)
- **Dependência:** `exceljs` adicionada ao backend

### Frontend

- **`AnimalsPage.tsx`**: Dois botões separados de exportação:
  - Botão "CSV" → `handleExport('csv')`
  - Botão "Excel" → `handleExport('xlsx')`
  - Ambos desabilitados durante exportação (`isExporting` state)
  - Usa `api.getBlob()` para download do arquivo com nome `animais-{farmId}.{csv|xlsx}`

### Testes

- Backend: testes de exportação CSV e XLSX no spec existente
- Frontend: testes dos botões de exportação

## Decisões técnicas

- Usou `exceljs` (já presente como dep de `animal-file-parser` para import) — sem nova dependência real
- Summary row no Excel dá contexto imediato ao abrir a planilha (total + média)
- Auto-fit melhora legibilidade sem intervenção manual do usuário
- Dois botões separados em vez de dropdown — mais direto para ação frequente
