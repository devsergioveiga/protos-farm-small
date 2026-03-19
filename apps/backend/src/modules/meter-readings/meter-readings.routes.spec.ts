import { describe, it } from '@jest/globals';

describe('Meter Readings API', () => {
  describe('POST /api/org/:orgId/meter-readings', () => {
    it.todo('creates first reading (no previous) successfully');
    it.todo('creates reading and updates Asset.currentHourmeter');
    it.todo('rejects value less than previous (400)');
    it.todo('rejects value equal to previous (400)');
    it.todo('stores previousValue from last reading');
  });

  describe('GET /api/org/:orgId/meter-readings', () => {
    it.todo('returns paginated list filtered by assetId');
    it.todo('filters by readingType');
  });

  describe('GET /api/org/:orgId/meter-readings/latest/:assetId', () => {
    it.todo('returns latest HOURMETER and ODOMETER readings');
    it.todo('returns null for readings that do not exist');
  });
});
