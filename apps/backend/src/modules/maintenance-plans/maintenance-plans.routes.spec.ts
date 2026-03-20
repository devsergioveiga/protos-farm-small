describe('MaintenancePlans Routes', () => {
  describe('POST /org/maintenance-plans', () => {
    it.todo('creates maintenance plan with CALENDAR trigger and computes nextDueAt');
    it.todo('creates maintenance plan with HOURMETER trigger and computes nextDueMeter');
    it.todo('creates maintenance plan with ODOMETER trigger and computes nextDueMeter');
    it.todo('returns 400 when required fields missing');
    it.todo('returns 403 when user lacks maintenance-plans:create permission');
  });

  describe('GET /org/maintenance-plans', () => {
    it.todo('lists plans filtered by assetId');
    it.todo('lists plans filtered by triggerType');
    it.todo('lists plans filtered by isActive');
    it.todo('returns overdue plans with nextDueAt in the past');
  });

  describe('GET /org/maintenance-plans/:id', () => {
    it.todo('returns single plan with asset and recent work orders');
    it.todo('returns 404 when plan not found');
  });

  describe('PUT /org/maintenance-plans/:id', () => {
    it.todo('updates plan fields and recalculates nextDue when intervalValue changes');
    it.todo('toggles isActive flag');
  });

  describe('DELETE /org/maintenance-plans/:id', () => {
    it.todo('deletes plan');
    it.todo('returns 404 when plan not found');
  });

  describe('computeNextDue function', () => {
    it.todo('CALENDAR: returns nextDueAt = lastExecutedAt + intervalValue days');
    it.todo('HOURMETER: returns nextDueMeter = lastMeterValue + intervalValue');
    it.todo('ODOMETER: returns nextDueMeter = lastMeterValue + intervalValue');
    it.todo('CALENDAR with null lastExecutedAt: uses current date as base');
    it.todo('HOURMETER with null lastMeterValue: uses 0 as base');
  });

  describe('Next-due recalculation after OS close', () => {
    it.todo('recalculates nextDueAt after linked OS is closed');
    it.todo('recalculates nextDueMeter after linked OS is closed');
  });

  describe('Daily alert cron', () => {
    it.todo('marks overdue CALENDAR plans and fires notification');
    it.todo('marks overdue HOURMETER plans comparing current meter reading');
  });
});
