import { describe, it, expect } from '@jest/globals';
import { getCnabAdapter } from './cnab.adapter';
import type { CnabHeaderData, CnabPaymentRecord } from './cnab.adapter';
import { detectFormat } from './cnab.parser';

// ─── Test Fixtures ────────────────────────────────────────────────────────

const headerData: CnabHeaderData = {
  companyName: 'FAZENDA SAO JOAO LTDA',
  companyDocument: '12345678000199',
  convenioCode: 'CONV12345678901234567',
  agency: '1234',
  agencyDigit: '5',
  accountNumber: '123456',
  accountDigit: '7',
  carteira: '17',
  fileDate: new Date('2026-03-16T00:00:00Z'),
  sequentialNumber: 1,
};

const payments: CnabPaymentRecord[] = [
  {
    payableId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    amount: 1234.56,
    dueDate: new Date('2026-04-01T00:00:00Z'),
    supplierName: 'FORNECEDOR EXEMPLO',
    supplierDocument: '98765432000188',
    bankCode: '001',
    agency: '5678',
    agencyDigit: '9',
    accountNumber: '987654321',
    accountDigit: '0',
    documentNumber: 'NF-001',
  },
  {
    payableId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    amount: 500.0,
    dueDate: new Date('2026-04-15T00:00:00Z'),
    supplierName: 'OUTRO FORNECEDOR',
    supplierDocument: '11122233344',
    bankCode: '756',
    agency: '0001',
    agencyDigit: '0',
    accountNumber: '123456',
    accountDigit: '8',
  },
];

// ─── BB Adapter Tests ─────────────────────────────────────────────────────

describe('BB (001) CNAB 240 adapter', () => {
  const adapter = getCnabAdapter('001');

  it('generates CNAB 240 with correct line lengths (240 chars each)', () => {
    const result = adapter.generateRemessa240(headerData, payments);
    const lines = result.split(/\r?\n/).filter((l) => l.length > 0);

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.length).toBe(240);
    }
  });

  it('has bank code "001" in positions 1-3 of file header', () => {
    const result = adapter.generateRemessa240(headerData, payments);
    const firstLine = result.split(/\r?\n/)[0];
    // positions 1-3 (0-indexed: 0-2)
    expect(firstLine.substring(0, 3)).toBe('001');
  });

  it('file header has record type 0 at position 8', () => {
    const result = adapter.generateRemessa240(headerData, payments);
    const firstLine = result.split(/\r?\n/)[0];
    expect(firstLine[7]).toBe('0'); // 0-indexed position 7 = position 8
  });

  it('file trailer has record type 9 at position 8', () => {
    const result = adapter.generateRemessa240(headerData, payments);
    const lines = result.split(/\r?\n/).filter((l) => l.length > 0);
    const lastLine = lines[lines.length - 1];
    expect(lastLine[7]).toBe('9');
  });

  it('detail records have segment P and Q markers', () => {
    const result = adapter.generateRemessa240(headerData, payments);
    const lines = result.split(/\r?\n/).filter((l) => l.length > 0);

    const detailLines = lines.filter((l) => l[7] === '3');
    const segments = detailLines.map((l) => l[13]); // position 14 (0-indexed: 13)

    expect(segments).toContain('P');
    expect(segments).toContain('Q');
  });

  it('lot header has record type 1 at position 8', () => {
    const result = adapter.generateRemessa240(headerData, payments);
    const lines = result.split(/\r?\n/).filter((l) => l.length > 0);
    const lotHeader = lines.find((l) => l[7] === '1');
    expect(lotHeader).toBeDefined();
  });

  it('lot trailer has record type 5 at position 8', () => {
    const result = adapter.generateRemessa240(headerData, payments);
    const lines = result.split(/\r?\n/).filter((l) => l.length > 0);
    const lotTrailer = lines.find((l) => l[7] === '5');
    expect(lotTrailer).toBeDefined();
  });

  it('generates correct number of lines for 2 payments', () => {
    const result = adapter.generateRemessa240(headerData, payments);
    const lines = result.split(/\r?\n/).filter((l) => l.length > 0);
    // file_header(1) + lot_header(1) + 2 payments × 2 segments(4) + lot_trailer(1) + file_trailer(1) = 8
    expect(lines.length).toBe(8);
  });
});

describe('BB (001) CNAB 400 adapter', () => {
  const adapter = getCnabAdapter('001');

  it('generates CNAB 400 with correct line lengths (400 chars each)', () => {
    const result = adapter.generateRemessa400(headerData, payments);
    const lines = result.split(/\r?\n/).filter((l) => l.length > 0);

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.length).toBe(400);
    }
  });

  it('header has record type 0 at position 1', () => {
    const result = adapter.generateRemessa400(headerData, payments);
    const firstLine = result.split(/\r?\n/)[0];
    expect(firstLine[0]).toBe('0');
  });

  it('trailer has record type 9 at position 1', () => {
    const result = adapter.generateRemessa400(headerData, payments);
    const lines = result.split(/\r?\n/).filter((l) => l.length > 0);
    const lastLine = lines[lines.length - 1];
    expect(lastLine[0]).toBe('9');
  });

  it('detail records have type 1 at position 1', () => {
    const result = adapter.generateRemessa400(headerData, payments);
    const lines = result.split(/\r?\n/).filter((l) => l.length > 0);
    const detailLines = lines.filter((l) => l[0] === '1');
    expect(detailLines.length).toBe(payments.length);
  });
});

// ─── BB Retorno Parsing Tests ────────────────────────────────────────────

describe('BB retorno parsing', () => {
  const adapter = getCnabAdapter('001');

  it('parses CNAB 240 retorno and maps status codes correctly', () => {
    // Build a minimal CNAB 240 retorno with one segment T
    // status '00' = LIQUIDATED
    const segT = buildMockSegmentT(
      '001',
      1,
      1,
      '00',
      'a1b2c3d4e5f6789012345',
      '16032026',
      '0000000123456',
    );
    const records = adapter.parseRetorno(segT);
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('LIQUIDATED');
    expect(records[0].statusCode).toBe('00');
  });

  it('maps RETURNED status for code 02', () => {
    const segT = buildMockSegmentT(
      '001',
      1,
      1,
      '02',
      'testrefnumber0000001234',
      '16032026',
      '0000000050000',
    );
    const records = adapter.parseRetorno(segT);
    expect(records[0].status).toBe('RETURNED');
  });

  it('maps REJECTED status for unknown code', () => {
    const segT = buildMockSegmentT(
      '001',
      1,
      1,
      '99',
      'testrefnumber0000001234',
      '16032026',
      '0000000050000',
    );
    const records = adapter.parseRetorno(segT);
    expect(records[0].status).toBe('REJECTED');
  });

  it('extracts amountPaid correctly from centavos string', () => {
    // '0000000123456' = R$ 1234.56
    const segT = buildMockSegmentT(
      '001',
      1,
      1,
      '00',
      'a1b2c3d4e5f6789012345',
      '16032026',
      '0000000123456',
    );
    const records = adapter.parseRetorno(segT);
    expect(records[0].amountPaid).toBeCloseTo(1234.56, 2);
  });
});

// ─── Sicoob Adapter Tests ────────────────────────────────────────────────

describe('Sicoob (756) CNAB 240 adapter', () => {
  const adapter = getCnabAdapter('756');

  it('generates CNAB 240 with correct line lengths (240 chars each)', () => {
    const result = adapter.generateRemessa240(headerData, payments);
    const lines = result.split(/\r?\n/).filter((l) => l.length > 0);

    for (const line of lines) {
      expect(line.length).toBe(240);
    }
  });

  it('has bank code "756" in positions 1-3 (not "001")', () => {
    const result = adapter.generateRemessa240(headerData, payments);
    const firstLine = result.split(/\r?\n/)[0];
    expect(firstLine.substring(0, 3)).toBe('756');
  });

  it('Sicoob file header positions 53-57 contain "756" (Banco Cooperado field)', () => {
    const result = adapter.generateRemessa240(headerData, payments);
    const firstLine = result.split(/\r?\n/)[0];
    // positions 53-57 (0-indexed: 52-56) = "Banco Cooperado" field
    // Stored as zero-padded 5-char field: "00756"
    const bancoCooperado = firstLine.substring(52, 57);
    expect(bancoCooperado).toBe('00756');
  });

  it('BB file header positions 53-57 do NOT contain "756"', () => {
    const bbAdapter = getCnabAdapter('001');
    const result = bbAdapter.generateRemessa240(headerData, payments);
    const firstLine = result.split(/\r?\n/)[0];
    // BB uses agencia in positions 53-57
    const bbPositions53_57 = firstLine.substring(52, 57);
    expect(bbPositions53_57).not.toBe('00756'); // BB has agency here
  });

  it('detail records have segment A and B markers (Sicoob uses A/B not P/Q)', () => {
    const result = adapter.generateRemessa240(headerData, payments);
    const lines = result.split(/\r?\n/).filter((l) => l.length > 0);
    const detailLines = lines.filter((l) => l[7] === '3');
    const segments = detailLines.map((l) => l[13]);

    expect(segments).toContain('A');
    expect(segments).toContain('B');
    expect(segments).not.toContain('P');
    expect(segments).not.toContain('Q');
  });
});

describe('Sicoob (756) CNAB 400 adapter', () => {
  const adapter = getCnabAdapter('756');

  it('generates CNAB 400 with correct line lengths (400 chars each)', () => {
    const result = adapter.generateRemessa400(headerData, payments);
    const lines = result.split(/\r?\n/).filter((l) => l.length > 0);

    for (const line of lines) {
      expect(line.length).toBe(400);
    }
  });

  it('header first char is 0 (header record type)', () => {
    const result = adapter.generateRemessa400(headerData, payments);
    const firstLine = result.split(/\r?\n/)[0];
    expect(firstLine[0]).toBe('0');
  });
});

// ─── Adapter Registry Tests ──────────────────────────────────────────────

describe('getCnabAdapter registry', () => {
  it('returns BB adapter for bankCode "001"', () => {
    const adapter = getCnabAdapter('001');
    expect(adapter.bankCode).toBe('001');
  });

  it('returns Sicoob adapter for bankCode "756"', () => {
    const adapter = getCnabAdapter('756');
    expect(adapter.bankCode).toBe('756');
  });

  it('throws for unknown bank code', () => {
    expect(() => getCnabAdapter('999')).toThrow('CNAB adapter não disponível para banco 999');
  });
});

// ─── Format Detection Tests ───────────────────────────────────────────────

describe('detectFormat', () => {
  it('detects 240 format from 240-char lines', () => {
    const line = 'A'.repeat(240);
    expect(detectFormat(line + '\r\n' + line)).toBe('240');
  });

  it('detects 400 format from 400-char lines', () => {
    const line = 'A'.repeat(400);
    expect(detectFormat(line + '\r\n' + line)).toBe('400');
  });

  it('returns unknown for empty content', () => {
    expect(detectFormat('')).toBe('unknown');
  });
});

// ─── Round-trip consistency test ────────────────────────────────────────

describe('Round-trip consistency', () => {
  it('BB CNAB 240 remessa has consistent structure that can be re-parsed for line lengths', () => {
    const adapter = getCnabAdapter('001');
    const content = adapter.generateRemessa240(headerData, payments);
    const lines = content.split(/\r?\n/).filter((l) => l.length > 0);

    // All lines must be exactly 240 chars
    const allCorrect = lines.every((l) => l.length === 240);
    expect(allCorrect).toBe(true);

    // detectFormat should recognize it
    expect(detectFormat(content)).toBe('240');
  });

  it('Sicoob CNAB 400 remessa has consistent structure', () => {
    const adapter = getCnabAdapter('756');
    const content = adapter.generateRemessa400(headerData, payments);
    const lines = content.split(/\r?\n/).filter((l) => l.length > 0);

    const allCorrect = lines.every((l) => l.length === 400);
    expect(allCorrect).toBe(true);
    expect(detectFormat(content)).toBe('400');
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Build a minimal mock CNAB 240 retorno with one Segment T (BB style).
 * Positions based on BB CNAB 240 retorno manual.
 */
function buildMockSegmentT(
  bankCode: string,
  lotNumber: number,
  seqInLot: number,
  statusCode: string,
  ourNumber: string,
  dateStr: string, // DDMMYYYY
  amountStr: string, // centavos zero-padded 13 chars
): string {
  // Build a 240-char line with Segment T layout
  // Pos 1-3: banco, Pos 4-7: lote, Pos 8: tipo (3), Pos 9-13: seq, Pos 14: segmento (T)
  // Pos 15: branco, Pos 16-17: código movimento, Pos 38-57: nosso número
  // Pos 145-152: data pagamento, Pos 153-165: valor pago

  const bank = bankCode.padStart(3, '0').slice(0, 3);
  const lot = String(lotNumber).padStart(4, '0');
  const seq = String(seqInLot).padStart(5, '0');
  const ourNum = ourNumber.padStart(20, '0').slice(0, 20);
  const date = dateStr.padEnd(8, '0').slice(0, 8);
  const amount = amountStr.padStart(13, '0').slice(0, 13);

  // Build line positionally (1-based)
  let line = ' '.repeat(240);
  const set = (pos: number, val: string) => {
    const arr = line.split('');
    for (let i = 0; i < val.length; i++) {
      arr[pos - 1 + i] = val[i];
    }
    line = arr.join('');
  };

  set(1, bank); // pos 1-3
  set(4, lot); // pos 4-7
  set(8, '3'); // pos 8
  set(9, seq); // pos 9-13
  set(14, 'T'); // pos 14
  set(15, ' '); // pos 15
  set(16, statusCode.padEnd(2, ' ').slice(0, 2)); // pos 16-17
  set(38, ourNum); // pos 38-57
  set(145, date); // pos 145-152
  set(153, amount); // pos 153-165

  return line + '\r\n';
}
