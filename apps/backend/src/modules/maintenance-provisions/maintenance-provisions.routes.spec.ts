describe('MaintenanceProvisions Routes', () => {
  describe('POST /org/maintenance-provisions', () => {
    it.todo('creates per-asset provision');
    it.todo('creates fleet-level provision with assetId null');
    it.todo('returns 400 when monthlyAmount is zero or negative');
    it.todo('returns 403 when user lacks maintenance-provisions:create permission');
  });

  describe('GET /org/maintenance-provisions', () => {
    it.todo('lists provisions filtered by isActive');
    it.todo('lists provisions filtered by assetId');
    it.todo('returns paginated results');
  });

  describe('GET /org/maintenance-provisions/:id', () => {
    it.todo('returns single provision with asset');
    it.todo('returns 404 when provision not found');
  });

  describe('PUT /org/maintenance-provisions/:id', () => {
    it.todo('updates monthlyAmount and costCenterId');
    it.todo('toggles isActive');
  });

  describe('DELETE /org/maintenance-provisions/:id', () => {
    it.todo('deletes provision');
    it.todo('returns 404 when provision not found');
  });

  describe('GET /org/maintenance-provisions/reconciliation', () => {
    it.todo('returns provision vs actual cost for given period');
    it.todo('returns per-asset breakdown in reconciliation');
    it.todo('returns zero variance when no actual costs for period');
  });

  describe('Monthly provision cron', () => {
    it.todo('creates provision entries for active provisions');
    it.todo('skips inactive provisions');
    it.todo('handles fleet-level provision (assetId null)');
  });
});
