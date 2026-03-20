describe('Depreciation Batch Service', () => {
  describe('runDepreciationBatch', () => {
    it.todo('processes eligible DEPRECIABLE_CPC27 assets and creates entries');
    it.todo('skips EM_ANDAMENTO assets');
    it.todo('skips assets without DepreciationConfig');
    it.todo('catches P2002 and marks as skipped (idempotent re-run)');
    it.todo('creates DepreciationRun with correct counts');
    it.todo('creates DepreciationEntryCCItem for asset with costCenterId');
    it.todo('reconciliation: sum(ccItems.amount) === depreciationAmount');
    it.todo('rejects duplicate run when force=false (409)');
    it.todo('allows force re-run when force=true');
    it.todo('handles empty organizationId by querying all organizations');
  });

  describe('reverseEntry', () => {
    it.todo('creates reversal entry with negative amounts');
    it.todo('marks original entry with reversedAt');
    it.todo('rejects already-reversed entry with 400');
    it.todo('deletes CC items of original entry');
  });
});
