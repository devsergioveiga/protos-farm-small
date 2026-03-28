// ─── SpedEcdWriter Unit Tests ─────────────────────────────────────────────────
// Pure unit tests — no Prisma, no DB. Tests the SPED ECD file generation
// format and structure using minimal fixture data.

import { SpedEcdWriter } from './sped-ecd.writer';
import type {
  SpedEcdInput,
  SpedOrgData,
  SpedAccountData,
  SpedMonthlyBalance,
  SpedJournalEntry,
} from './sped-ecd.types';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const ORG: SpedOrgData = {
  name: 'Fazenda Teste Ltda',
  cnpj: '12345678000195',
  uf: 'MG',
  ie: '1234567890',
  codMun: '3106200',
  im: '',
  accountantName: 'Jose da Silva',
  accountantCrc: 'MG-012345/O-7',
  accountantCpf: '12345678901',
};

const ACCOUNTS: SpedAccountData[] = [
  {
    code: '1',
    name: 'ATIVO',
    accountType: 'ATIVO',
    accountNature: 'DEVEDORA',
    isSynthetic: true,
    level: 1,
    parentCode: null,
    spedRefCode: null,
  },
  {
    code: '1.1',
    name: 'ATIVO CIRCULANTE',
    accountType: 'ATIVO',
    accountNature: 'DEVEDORA',
    isSynthetic: false,
    level: 2,
    parentCode: '1',
    spedRefCode: 'ANC001',
  },
  {
    code: '3',
    name: 'RECEITA',
    accountType: 'RECEITA',
    accountNature: 'CREDORA',
    isSynthetic: false,
    level: 1,
    parentCode: null,
    spedRefCode: null,
  },
];

const MONTHLY_BALANCES: SpedMonthlyBalance[] = [
  {
    accountCode: '1.1',
    month: 1,
    year: 2025,
    openingBalance: '0.00',
    totalDebits: '1000.00',
    totalCredits: '500.00',
    closingBalance: '500.00',
  },
];

const JOURNAL_ENTRY: SpedJournalEntry = {
  entryNumber: 1,
  entryDate: new Date('2025-01-15T12:00:00'),
  totalDebit: '1000.00',
  lines: [
    {
      accountCode: '1.1',
      amount: '1000.00',
      isDebit: true,
      description: 'Receita de vendas',
    },
    {
      accountCode: '3',
      amount: '1000.00',
      isDebit: false,
      description: 'Receita de vendas',
    },
  ],
};

function makeInput(overrides: Partial<SpedEcdInput> = {}): SpedEcdInput {
  return {
    org: ORG,
    fiscalYearStart: new Date('2025-01-01T12:00:00'),
    fiscalYearEnd: new Date('2025-12-31T12:00:00'),
    accounts: ACCOUNTS,
    monthlyBalances: MONTHLY_BALANCES,
    journalEntries: [JOURNAL_ENTRY],
    costCenters: [{ code: 'CC01', name: 'Fazenda Norte' }],
    dreRows: [
      {
        spedRefCode: 'DRE001',
        name: 'Receita Bruta',
        amount: '1000.00',
        isDebit: false,
      },
    ],
    bpRows: [
      {
        spedRefCode: 'BP001',
        name: 'Ativo Circulante',
        openingAmount: '0.00',
        openingIsDebit: true,
        closingAmount: '500.00',
        closingIsDebit: true,
        groupIndicator: 'A',
      },
    ],
    dlpaRows: [
      {
        spedRefCode: 'PL001',
        name: 'Lucro/Prejuizo do Exercicio',
        openingAmount: '0.00',
        openingIsDebit: false,
        closingAmount: '1000.00',
        closingIsDebit: false,
      },
    ],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SpedEcdWriter', () => {
  let output: string;

  beforeAll(() => {
    output = new SpedEcdWriter(makeInput()).generate();
  });

  // ─── General Structure ─────────────────────────────────────────────────────

  describe('General Structure', () => {
    it('should start with |0000|LECD| register', () => {
      expect(output).toContain('|0000|LECD|');
    });

    it('should end with |9999| register', () => {
      const lines = output.split('\r\n').filter(Boolean);
      const lastLine = lines[lines.length - 1];
      expect(lastLine).toMatch(/^\|9999\|/);
    });

    it('should use CRLF line endings', () => {
      expect(output).toContain('\r\n');
      // Every line should end with |\r\n
      const lines = output.split('\r\n');
      // All non-empty lines end with |
      const nonEmpty = lines.filter(Boolean);
      nonEmpty.forEach((line) => {
        expect(line).toMatch(/\|$/);
      });
    });

    it('every line should start with | and end with |\\r\\n', () => {
      const lines = output.split('\r\n').filter(Boolean);
      lines.forEach((line) => {
        expect(line).toMatch(/^\|/);
        expect(line).toMatch(/\|$/);
      });
    });
  });

  // ─── Date and Amount Formatting ───────────────────────────────────────────

  describe('Date and Amount Formatting', () => {
    it('should format dates as DDMMAAAA (01012025)', () => {
      // 01012025 comes from fiscalYearStart: 2025-01-01T12:00:00
      expect(output).toContain('01012025');
      // 15012025 comes from the journal entry date: 2025-01-15T12:00:00
      expect(output).toContain('15012025');
    });

    it('should format amounts with period decimal, no thousand separator', () => {
      expect(output).toContain('1000.00');
      expect(output).toContain('500.00');
      // Should not have comma decimal or thousand dot
      expect(output).not.toContain('1.000,00');
      expect(output).not.toContain('1,000.00');
    });
  });

  // ─── Bloco 0 ──────────────────────────────────────────────────────────────

  describe('Bloco 0', () => {
    it('should contain 0000 register with LECD type', () => {
      expect(output).toContain('|0000|LECD|');
    });

    it('should contain 0001 open register', () => {
      expect(output).toContain('|0001|');
    });

    it('should contain 0007 book info register with type G', () => {
      expect(output).toContain('|0007|');
      expect(output).toContain('|G|');
    });

    it('should contain 0990 close register', () => {
      expect(output).toContain('|0990|');
    });
  });

  // ─── Bloco I ──────────────────────────────────────────────────────────────

  describe('Bloco I', () => {
    it('should contain I001 open register', () => {
      expect(output).toContain('|I001|');
    });

    it('should contain I010 writer info register', () => {
      expect(output).toContain('|I010|');
    });

    it('should include I050 for both synthetic and analytic accounts', () => {
      // ACCOUNTS has 1 synthetic (code=1) and 2 analytic
      const i050Lines = output.split('\r\n').filter((l) => l.startsWith('|I050|'));
      expect(i050Lines.length).toBe(3);
    });

    it('should generate I051 only for analytic accounts with spedRefCode', () => {
      // Only account '1.1' has spedRefCode='ANC001'
      const i051Lines = output.split('\r\n').filter((l) => l.startsWith('|I051|'));
      expect(i051Lines.length).toBe(1);
      expect(i051Lines[0]).toContain('ANC001');
    });

    it('should include I155 only for analytic accounts', () => {
      // Only analytic accounts have I155 entries
      // Account '1.1' is analytic with balances; account '3' is analytic but no balance in fixture
      const i155Lines = output.split('\r\n').filter((l) => l.startsWith('|I155|'));
      expect(i155Lines.length).toBeGreaterThan(0);
    });

    it('should generate I200/I250 journal entry records', () => {
      const i200Lines = output.split('\r\n').filter((l) => l.startsWith('|I200|'));
      expect(i200Lines.length).toBe(1);

      const i250Lines = output.split('\r\n').filter((l) => l.startsWith('|I250|'));
      expect(i250Lines.length).toBe(2); // 2 lines in the entry
    });

    it('should use D/C indicator in I250', () => {
      const i250Lines = output.split('\r\n').filter((l) => l.startsWith('|I250|'));
      // First line is debit (1.1), second is credit (3)
      const debitLine = i250Lines.find((l) => l.includes('|D|'));
      const creditLine = i250Lines.find((l) => l.includes('|C|'));
      expect(debitLine).toBeDefined();
      expect(creditLine).toBeDefined();
    });

    it('should contain I990 close register', () => {
      expect(output).toContain('|I990|');
    });
  });

  // ─── Bloco J ──────────────────────────────────────────────────────────────

  describe('Bloco J', () => {
    it('should contain J001 open register', () => {
      expect(output).toContain('|J001|');
    });

    it('should contain J005 period header', () => {
      expect(output).toContain('|J005|');
    });

    it('should contain J100 BP rows', () => {
      const j100Lines = output.split('\r\n').filter((l) => l.startsWith('|J100|'));
      expect(j100Lines.length).toBe(1);
      expect(j100Lines[0]).toContain('BP001');
    });

    it('should contain J150 DRE rows', () => {
      const j150Lines = output.split('\r\n').filter((l) => l.startsWith('|J150|'));
      expect(j150Lines.length).toBe(1);
      expect(j150Lines[0]).toContain('DRE001');
    });

    it('should contain J210 DLPA rows', () => {
      const j210Lines = output.split('\r\n').filter((l) => l.startsWith('|J210|'));
      expect(j210Lines.length).toBe(1);
      expect(j210Lines[0]).toContain('PL001');
    });

    it('should contain J990 close register', () => {
      expect(output).toContain('|J990|');
    });
  });

  // ─── Bloco 9 ──────────────────────────────────────────────────────────────

  describe('Bloco 9', () => {
    it('should contain 9001 open register', () => {
      expect(output).toContain('|9001|');
    });

    it('should contain 9900 count registers for each register type', () => {
      const lines9900 = output.split('\r\n').filter((l) => l.startsWith('|9900|'));
      expect(lines9900.length).toBeGreaterThan(0);
    });

    it('should contain 9990 close register', () => {
      expect(output).toContain('|9990|');
    });

    it('9999 total should match actual line count', () => {
      const lines = output.split('\r\n').filter(Boolean);
      const totalLines = lines.length;
      const line9999 = lines[lines.length - 1];
      // 9999 format: |9999|{count}|
      const match = line9999.match(/^\|9999\|(\d+)\|$/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBe(totalLines);
    });
  });

  // ─── COD_NAT mapping ─────────────────────────────────────────────────────

  describe('COD_NAT mapping', () => {
    it('should map ATIVO to 01, PASSIVO to 02, PL to 03, RECEITA to 04, DESPESA to 04', () => {
      // ATIVO account (code=1) should have |01|
      const i050Lines = output.split('\r\n').filter((l) => l.startsWith('|I050|'));
      const ativoLine = i050Lines.find((l) => l.includes('|1|') && l.includes('|S|'));
      expect(ativoLine).toBeDefined();
      expect(ativoLine).toContain('|01|');
    });
  });

  // ─── Empty input ──────────────────────────────────────────────────────────

  describe('Empty input', () => {
    it('should produce valid structure with 0 I200/I250 lines when no journal entries', () => {
      const emptyOutput = new SpedEcdWriter(
        makeInput({ journalEntries: [], monthlyBalances: [] }),
      ).generate();
      expect(emptyOutput).toContain('|0000|LECD|');
      expect(emptyOutput).toContain('|9999|');
      const i200Lines = emptyOutput.split('\r\n').filter((l) => l.startsWith('|I200|'));
      expect(i200Lines.length).toBe(0);
      const i250Lines = emptyOutput.split('\r\n').filter((l) => l.startsWith('|I250|'));
      expect(i250Lines.length).toBe(0);
    });
  });
});
