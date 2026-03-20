describe('WorkOrders Routes', () => {
  describe('POST /org/work-orders', () => {
    it.todo('creates work order and sets asset status to EM_MANUTENCAO atomically');
    it.todo('assigns sequential number per organization');
    it.todo('creates PREVENTIVA OS linked to maintenance plan');
    it.todo('creates SOLICITACAO OS with photo and geolocation');
    it.todo('returns 400 when required fields missing');
    it.todo('returns 403 when user lacks work-orders:create permission');
  });

  describe('GET /org/work-orders', () => {
    it.todo('lists work orders with pagination');
    it.todo('filters by status');
    it.todo('filters by assetId');
    it.todo('filters by type');
    it.todo('filters by date range');
  });

  describe('GET /org/work-orders/:id', () => {
    it.todo('returns work order with parts, ccItems, and asset');
    it.todo('returns 404 when work order not found');
  });

  describe('PATCH /org/work-orders/:id', () => {
    it.todo('updates status to EM_ANDAMENTO');
    it.todo('updates status to AGUARDANDO_PECA');
    it.todo('updates title and description');
  });

  describe('POST /org/work-orders/:id/parts', () => {
    it.todo('adds part to work order and updates totalPartsCost');
    it.todo('returns 400 when product not found');
  });

  describe('DELETE /org/work-orders/:id/parts/:partId', () => {
    it.todo('removes part and recalculates totalPartsCost');
  });

  describe('PATCH /org/work-orders/:id/close', () => {
    it.todo('returns 400 when accountingTreatment is absent');
    it.todo('closes OS with DESPESA treatment and resets asset to ATIVO');
    it.todo('closes OS with CAPITALIZACAO and increases asset acquisitionValue');
    it.todo('closes OS with DIFERIMENTO and creates DeferredMaintenance record');
    it.todo('returns 400 when DIFERIMENTO selected without deferralMonths');
    it.todo('deducts parts from stock via createConsumptionOutput');
    it.todo('creates WorkOrderCCItem inheriting asset.costCenterId');
    it.todo('creates WorkOrderCCItem with manual costCenterId override');
    it.todo('WorkOrderCCItem amount equals totalCost exactly (no cent drift)');
    it.todo('recalculates MaintenancePlan nextDue after closing linked PREVENTIVA OS');
  });

  describe('PATCH /org/work-orders/:id/cancel', () => {
    it.todo('cancels OS and resets asset status to ATIVO');
    it.todo('returns 400 when OS is already closed');
  });

  describe('GET /org/maintenance/dashboard', () => {
    it.todo('returns availability, MTBF, MTTR, cost YTD, open count');
    it.todo('returns null for MTBF/MTTR when no corrective OS exist');
    it.todo('returns byStatus counts');
    it.todo('returns costByAsset top N');
  });
});
