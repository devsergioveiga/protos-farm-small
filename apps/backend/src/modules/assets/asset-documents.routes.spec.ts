import { describe, it } from '@jest/globals';

describe('Asset Documents API', () => {
  describe('POST /api/org/:orgId/asset-documents', () => {
    it.todo('creates document with documentType and expiresAt');
    it.todo('creates document without expiresAt');
  });

  describe('GET /api/org/:orgId/asset-documents', () => {
    it.todo('returns documents filtered by assetId');
    it.todo('filters by expiringWithinDays');
  });

  describe('GET /api/org/:orgId/asset-documents/expiring', () => {
    it.todo('returns expired, urgent, warning, upcoming groups');
    it.todo('correctly classifies documents by days until expiry');
  });

  describe('PATCH /api/org/:orgId/asset-documents/:id', () => {
    it.todo('updates document fields');
  });

  describe('DELETE /api/org/:orgId/asset-documents/:id', () => {
    it.todo('deletes document');
  });
});
