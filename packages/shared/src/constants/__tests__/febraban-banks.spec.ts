import { FEBRABAN_BANKS, FEBRABAN_BANK_MAP, type FebrabanBank } from '../febraban-banks';

describe('FEBRABAN_BANKS', () => {
  it('has at least 30 entries covering major banks and fintechs', () => {
    expect(FEBRABAN_BANKS.length).toBeGreaterThanOrEqual(30);
  });

  it('every bank has non-empty code, name and shortName', () => {
    for (const bank of FEBRABAN_BANKS) {
      expect(bank.code.trim()).not.toBe('');
      expect(bank.name.trim()).not.toBe('');
      expect(bank.shortName.trim()).not.toBe('');
    }
  });

  it('contains Banco do Brasil (001)', () => {
    expect(FEBRABAN_BANKS.some((b) => b.code === '001')).toBe(true);
  });

  it('contains Bradesco (237)', () => {
    expect(FEBRABAN_BANKS.some((b) => b.code === '237')).toBe(true);
  });

  it('contains Sicoob (756)', () => {
    expect(FEBRABAN_BANKS.some((b) => b.code === '756')).toBe(true);
  });

  it('contains Nubank (260)', () => {
    expect(FEBRABAN_BANKS.some((b) => b.code === '260')).toBe(true);
  });
});

describe('FEBRABAN_BANK_MAP', () => {
  it("get('001') returns Banco do Brasil with shortName BB", () => {
    const bb = FEBRABAN_BANK_MAP.get('001');
    expect(bb).toBeDefined();
    expect(bb?.shortName).toBe('BB');
    expect(bb?.name).toContain('Brasil');
  });

  it("get('756') returns Sicoob", () => {
    const sicoob = FEBRABAN_BANK_MAP.get('756');
    expect(sicoob).toBeDefined();
    expect(sicoob?.shortName).toBe('Sicoob');
  });

  it("get('260') returns Nubank", () => {
    const nubank = FEBRABAN_BANK_MAP.get('260');
    expect(nubank).toBeDefined();
    expect(nubank?.shortName).toBe('Nubank');
  });

  it('map size equals FEBRABAN_BANKS.length (no duplicate codes)', () => {
    expect(FEBRABAN_BANK_MAP.size).toBe(FEBRABAN_BANKS.length);
  });

  it('FebrabanBank type has required fields', () => {
    const bank: FebrabanBank = { code: '001', name: 'Test', shortName: 'T' };
    expect(bank).toBeDefined();
  });
});
