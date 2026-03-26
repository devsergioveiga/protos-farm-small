// ─── Payslip PDF Service Tests ────────────────────────────────────────

import { generatePayslipPdf } from './payroll-pdf.service';
import type { PayslipData } from './payroll-pdf.service';

const mockData: PayslipData = {
  orgName: 'Fazenda Teste Ltda',
  orgCnpj: '12345678000195',
  employeeName: 'João Silva',
  employeeCpf: '12345678901',
  employeeCargo: 'Tratorista',
  admissionDate: new Date('2020-01-15'),
  referenceMonth: '2026-03',
  runType: 'MONTHLY',
  lineItems: [
    {
      code: '0001',
      description: 'Salário Base',
      reference: '31 dias',
      type: 'PROVENTO',
      value: 3000,
    },
    {
      code: '0071',
      description: 'INSS',
      reference: '11.00%',
      type: 'DESCONTO',
      value: 330,
    },
  ],
  grossSalary: 3000,
  totalDeductions: 330,
  netSalary: 2670,
  inssBase: 3000,
  irrfBase: 2670,
  fgtsMonth: 240,
};

describe('generatePayslipPdf', () => {
  it('returns Buffer starting with %PDF', async () => {
    const buffer = await generatePayslipPdf(mockData);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('PDF buffer has length > 1000 bytes (not empty)', async () => {
    const buffer = await generatePayslipPdf(mockData);

    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('handles empty lineItems array without error', async () => {
    const emptyData: PayslipData = {
      ...mockData,
      lineItems: [],
      grossSalary: 0,
      totalDeductions: 0,
      netSalary: 0,
      inssBase: 0,
      irrfBase: 0,
      fgtsMonth: 0,
    };

    const buffer = await generatePayslipPdf(emptyData);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });
});
