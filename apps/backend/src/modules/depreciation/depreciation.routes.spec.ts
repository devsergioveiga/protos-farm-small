describe('Depreciation Routes', () => {
  describe('POST /config', () => {
    it.todo('creates config for depreciable asset (201)');
    it.todo('rejects non-depreciable asset (400)');
    it.todo('rejects duplicate config (409)');
  });

  describe('GET /config/:assetId', () => {
    it.todo('returns config (200)');
    it.todo('returns 404 when not found');
  });

  describe('PATCH /config/:assetId', () => {
    it.todo('updates method and rates (200)');
  });

  describe('DELETE /config/:assetId', () => {
    it.todo('deletes config (204)');
  });

  describe('POST /run', () => {
    it.todo('triggers batch for period (202)');
    it.todo('rejects duplicate run without force (409)');
    it.todo('allows force re-run (202)');
  });

  describe('POST /entries/:entryId/reverse', () => {
    it.todo('creates reversal (200)');
    it.todo('rejects already reversed (400)');
  });

  describe('GET /report', () => {
    it.todo('returns paginated entries (200)');
    it.todo('returns empty array when no entries (200)');
    it.todo('filters by assetId when query param provided (200)');
  });

  describe('GET /last-run', () => {
    it.todo('returns latest run (200)');
    it.todo('returns null when no run (200)');
  });

  describe('GET /report/export', () => {
    it.todo('exports CSV with correct headers');
    it.todo('exports XLSX with formatted columns');
  });
});
