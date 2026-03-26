// ─── eSocial Events — Unit Tests ─────────────────────────────────────────────
// Tests for XML builders, XSD validator, validators, and service state machine.

import { buildS2200 } from './esocial-builders/s2200-builder';
import { buildS1200 } from './esocial-builders/s1200-builder';
import { buildS1299 } from './esocial-builders/s1299-builder';
import { buildS2220 } from './esocial-builders/s2220-builder';
import { buildS1000 } from './esocial-builders/s1000-builder';
import { buildS1005 } from './esocial-builders/s1005-builder';
import { buildS1010 } from './esocial-builders/s1010-builder';
import { buildS1020 } from './esocial-builders/s1020-builder';
import { buildS2206 } from './esocial-builders/s2206-builder';
import { buildS2230 } from './esocial-builders/s2230-builder';
import { buildS2299 } from './esocial-builders/s2299-builder';
import { buildS1210 } from './esocial-builders/s1210-builder';
import { buildS2210 } from './esocial-builders/s2210-builder';
import { buildS2240 } from './esocial-builders/s2240-builder';
import { getBuilder } from './esocial-builders/index';
import { validateS2200Input, validateS1200Input } from './esocial-validators';
import { validateXmlAgainstXsd } from './esocial-xsd-validator';
import { XSD_CONSTRAINTS } from './xsd-constraints';

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockOrg = {
  id: 'org-001',
  name: 'Fazenda Boa Vista Ltda',
  cnpj: '12345678000195',
  cnae: '0111301',
  state: 'SP',
  city: 'Ribeirão Preto',
};

const mockEmployee = {
  id: 'emp-001',
  name: 'José da Silva',
  cpf: '12345678901',
  pisPassep: '12345678901',
  birthDate: new Date('1985-06-15'),
  admissionDate: new Date('2024-01-02'),
  address: {
    street: 'Rua das Flores',
    number: '123',
    city: 'Ribeirão Preto',
    state: 'SP',
    zipCode: '14000-000',
  },
};

const mockPosition = {
  id: 'pos-001',
  name: 'Operador de Colheitadeira',
  cbo: '612210',
};

const mockContract = {
  id: 'cont-001',
  salary: 3000,
  weeklyHours: 44,
  contractType: 'CLT_INDETERMINATE',
};

const mockPayrollRun = {
  id: 'run-001',
  referenceMonth: new Date('2024-03-01'),
  organization: mockOrg,
};

const mockLineItem = {
  id: 'item-001',
  payrollRunId: 'run-001',
  employeeId: 'emp-001',
  lineItemsJson: JSON.stringify([
    { code: '0001', description: 'Salário Base', type: 'PROVENTO', value: '3000.00', eSocialCode: '1100' },
    { code: '0002', description: 'Hora Extra 50%', type: 'PROVENTO', value: '150.00', eSocialCode: '1010' },
    { code: '0100', description: 'INSS', type: 'DESCONTO', value: '330.00', eSocialCode: null }, // no eSocialCode — should be skipped
  ]),
  employee: mockEmployee,
  payrollRun: mockPayrollRun,
};

const mockMedicalExam = {
  id: 'exam-001',
  employeeId: 'emp-001',
  type: 'ADMISSIONAL',
  date: new Date('2024-01-02'),
  doctorName: 'Dr. Pedro Souza',
  doctorCrm: '123456',
  doctorState: 'SP',
  result: 'APTO',
  employee: mockEmployee,
  organization: mockOrg,
};

const mockAbsence = {
  id: 'abs-001',
  employeeId: 'emp-001',
  absenceType: 'INSS_LEAVE',
  startDate: new Date('2024-02-01'),
  endDate: new Date('2024-02-15'),
  catNumber: null,
  employee: mockEmployee,
  organization: mockOrg,
};

const mockTermination = {
  id: 'term-001',
  employeeId: 'emp-001',
  terminationDate: new Date('2024-12-31'),
  terminationReason: 'PEDIDO_DEMISSAO',
  employee: mockEmployee,
  organization: mockOrg,
};

const mockAmendment = {
  id: 'amend-001',
  employeeId: 'emp-001',
  effectiveAt: new Date('2024-06-01'),
  changes: { salary: { from: 3000, to: 3500 } },
  employee: mockEmployee,
  organization: mockOrg,
};

const mockFarm = {
  id: 'farm-001',
  name: 'Fazenda Boa Vista',
  cnpj: '12345678000195',
  cnae: '0111301',
  state: 'SP',
  city: 'Ribeirão Preto',
  organization: mockOrg,
};

const mockRubrica = {
  id: 'rub-001',
  code: '0001',
  name: 'Salário Base',
  eSocialCode: '1100',
  rubricaType: 'PROVENTO',
  organization: mockOrg,
};

const mockEpiDelivery = {
  id: 'epi-001',
  employeeId: 'emp-001',
  deliveryDate: new Date('2024-01-15'),
  items: [{ description: 'Capacete', quantity: 1, epiCode: '01.001' }],
  employee: mockEmployee,
  organization: mockOrg,
};

// ─── Builder Tests ───────────────────────────────────────────────────────────

describe('eSocial XML Builders', () => {
  describe('buildS2200 (evtAdmissao)', () => {
    it('produces XML with correct S-1.3 namespace', () => {
      const xml = buildS2200({ employee: mockEmployee, contract: mockContract, position: mockPosition, organization: mockOrg });
      expect(xml).toContain('xmlns="http://www.esocial.gov.br/schema/evt/evtAdmissao/v02_05_00"');
    });

    it('contains cpfTrab with digits-only CPF', () => {
      const xml = buildS2200({ employee: mockEmployee, contract: mockContract, position: mockPosition, organization: mockOrg });
      expect(xml).toContain('<cpfTrab>12345678901</cpfTrab>');
    });

    it('contains nisTrab with PIS/PASEP', () => {
      const xml = buildS2200({ employee: mockEmployee, contract: mockContract, position: mockPosition, organization: mockOrg });
      expect(xml).toContain('<nisTrab>');
    });

    it('contains codCBO from Position', () => {
      const xml = buildS2200({ employee: mockEmployee, contract: mockContract, position: mockPosition, organization: mockOrg });
      expect(xml).toContain('<codCBO>612210</codCBO>');
    });

    it('starts with XML declaration and contains eSocial root', () => {
      const xml = buildS2200({ employee: mockEmployee, contract: mockContract, position: mockPosition, organization: mockOrg });
      expect(xml).toMatch(/^<\?xml/);
      expect(xml).toContain('<eSocial');
    });

    it('contains evtAdmissao element', () => {
      const xml = buildS2200({ employee: mockEmployee, contract: mockContract, position: mockPosition, organization: mockOrg });
      expect(xml).toContain('evtAdmissao');
    });
  });

  describe('buildS1200 (evtRemun)', () => {
    it('contains evtRemun and itensRemun elements', () => {
      const xml = buildS1200({ item: mockLineItem, employee: mockEmployee, organization: mockOrg });
      expect(xml).toContain('evtRemun');
      expect(xml).toContain('itensRemun');
    });

    it('contains codRubr for rubricas with eSocialCode', () => {
      const xml = buildS1200({ item: mockLineItem, employee: mockEmployee, organization: mockOrg });
      expect(xml).toContain('codRubr');
    });

    it('skips rubricas without eSocialCode', () => {
      const xml = buildS1200({ item: mockLineItem, employee: mockEmployee, organization: mockOrg });
      // The INSS rubrica (code 0100) has no eSocialCode and should be excluded
      // We verify by checking the item count — only 2 should appear (salario + hora extra)
      const matches = xml.match(/<codRubr>/g);
      expect(matches?.length).toBe(2);
    });

    it('is well-formed XML', () => {
      const xml = buildS1200({ item: mockLineItem, employee: mockEmployee, organization: mockOrg });
      expect(xml).toMatch(/^<\?xml/);
      expect(xml).toContain('<eSocial');
    });
  });

  describe('buildS1299 (evtFechaEvPer)', () => {
    it('produces well-formed XML', () => {
      const xml = buildS1299({ payrollRun: mockPayrollRun, organization: mockOrg });
      expect(xml).toMatch(/^<\?xml/);
      expect(xml).toContain('<eSocial');
    });

    it('contains evtFechaEvPer element', () => {
      const xml = buildS1299({ payrollRun: mockPayrollRun, organization: mockOrg });
      expect(xml).toContain('evtFechaEvPer');
    });

    it('contains correct competencia', () => {
      const xml = buildS1299({ payrollRun: mockPayrollRun, organization: mockOrg });
      // referenceMonth is 2024-03-01, so perApur should be 2024-03
      expect(xml).toContain('2024-03');
    });
  });

  describe('buildS2220 (evtMonit)', () => {
    it('produces well-formed XML', () => {
      const xml = buildS2220({ exam: mockMedicalExam, employee: mockEmployee, organization: mockOrg });
      expect(xml).toMatch(/^<\?xml/);
      expect(xml).toContain('<eSocial');
    });

    it('contains evtMonit element', () => {
      const xml = buildS2220({ exam: mockMedicalExam, employee: mockEmployee, organization: mockOrg });
      expect(xml).toContain('evtMonit');
    });

    it('contains doctor CRM', () => {
      const xml = buildS2220({ exam: mockMedicalExam, employee: mockEmployee, organization: mockOrg });
      expect(xml).toContain('<nrCRM>123456</nrCRM>');
    });
  });

  describe('All 15 builders produce well-formed XML', () => {
    const cases = [
      {
        name: 'S-1000', builder: () => buildS1000({ organization: mockOrg }),
        ns: 'evtInfoEmpregador',
      },
      {
        name: 'S-1005', builder: () => buildS1005({ farm: mockFarm, organization: mockOrg }),
        ns: 'evtTabEstab',
      },
      {
        name: 'S-1010', builder: () => buildS1010({ rubrica: mockRubrica, organization: mockOrg }),
        ns: 'evtTabRubrica',
      },
      {
        name: 'S-1020', builder: () => buildS1020({ position: mockPosition, organization: mockOrg }),
        ns: 'evtTabLotacao',
      },
      {
        name: 'S-2200', builder: () => buildS2200({ employee: mockEmployee, contract: mockContract, position: mockPosition, organization: mockOrg }),
        ns: 'evtAdmissao',
      },
      {
        name: 'S-2206', builder: () => buildS2206({ amendment: mockAmendment, employee: mockEmployee, contract: mockContract, position: mockPosition, organization: mockOrg }),
        ns: 'evtAltContratual',
      },
      {
        name: 'S-2230', builder: () => buildS2230({ absence: mockAbsence, employee: mockEmployee, organization: mockOrg }),
        ns: 'evtAfastTemp',
      },
      {
        name: 'S-2299', builder: () => buildS2299({ termination: mockTermination, employee: mockEmployee, organization: mockOrg }),
        ns: 'evtDeslig',
      },
      {
        name: 'S-1200', builder: () => buildS1200({ item: mockLineItem, employee: mockEmployee, organization: mockOrg }),
        ns: 'evtRemun',
      },
      {
        name: 'S-1210', builder: () => buildS1210({ item: mockLineItem, employee: mockEmployee, organization: mockOrg }),
        ns: 'evtPgtos',
      },
      {
        name: 'S-1299', builder: () => buildS1299({ payrollRun: mockPayrollRun, organization: mockOrg }),
        ns: 'evtFechaEvPer',
      },
      {
        name: 'S-2210', builder: () => buildS2210({ absence: mockAbsence, employee: mockEmployee, organization: mockOrg }),
        ns: 'evtCAT',
      },
      {
        name: 'S-2220', builder: () => buildS2220({ exam: mockMedicalExam, employee: mockEmployee, organization: mockOrg }),
        ns: 'evtMonit',
      },
      {
        name: 'S-2240', builder: () => buildS2240({ epiDelivery: mockEpiDelivery, employee: mockEmployee, organization: mockOrg }),
        ns: 'evtExpRisco',
      },
    ];

    cases.forEach(({ name, builder, ns }) => {
      it(`${name} produces well-formed XML starting with <?xml and containing <eSocial`, () => {
        const xml = builder();
        expect(xml).toMatch(/^<\?xml/);
        expect(xml).toContain('<eSocial');
        expect(xml).toContain(ns);
      });
    });
  });

  describe('getBuilder (index)', () => {
    it('returns builder for known event types', () => {
      expect(getBuilder('S-2200')).toBeDefined();
      expect(getBuilder('S-1200')).toBeDefined();
      expect(getBuilder('S-1299')).toBeDefined();
    });

    it('returns undefined for unknown event types', () => {
      expect(getBuilder('UNKNOWN')).toBeUndefined();
    });
  });
});

// ─── Validator Tests ──────────────────────────────────────────────────────────

describe('eSocial Pre-generation Validators', () => {
  describe('validateS2200Input', () => {
    it('returns empty array for valid input', () => {
      const errors = validateS2200Input(mockEmployee, mockContract, mockPosition);
      expect(errors).toHaveLength(0);
    });

    it('returns error for employee without pisPassep', () => {
      const errors = validateS2200Input({ ...mockEmployee, pisPassep: null }, mockContract, mockPosition);
      expect(errors.some((e) => e.field === 'nisTrab')).toBe(true);
    });

    it('returns error for position without cbo', () => {
      const errors = validateS2200Input(mockEmployee, mockContract, { ...mockPosition, cbo: null });
      expect(errors.some((e) => e.field === 'codCBO')).toBe(true);
    });

    it('returns error for zero salary', () => {
      const errors = validateS2200Input(mockEmployee, { ...mockContract, salary: 0 }, mockPosition);
      expect(errors.some((e) => e.field === 'vrSalFx')).toBe(true);
    });

    it('returns error for missing CPF', () => {
      const errors = validateS2200Input({ ...mockEmployee, cpf: null as unknown as string }, mockContract, mockPosition);
      expect(errors.some((e) => e.field === 'cpfTrab')).toBe(true);
    });

    it('includes employeeName in error objects', () => {
      const errors = validateS2200Input({ ...mockEmployee, pisPassep: null }, mockContract, mockPosition);
      expect(errors[0]?.employeeName).toBe('José da Silva');
    });
  });

  describe('validateS1200Input', () => {
    it('returns empty array for valid input', () => {
      const errors = validateS1200Input(mockLineItem, mockEmployee);
      expect(errors).toHaveLength(0);
    });

    it('returns error for null lineItemsJson', () => {
      const errors = validateS1200Input({ ...mockLineItem, lineItemsJson: null }, mockEmployee);
      expect(errors.some((e) => e.field === 'lineItemsJson')).toBe(true);
    });
  });
});

// ─── XSD Validator Tests ──────────────────────────────────────────────────────

describe('XSD Structural Validator (per D-06)', () => {
  describe('validateXmlAgainstXsd', () => {
    it('returns empty errors for valid S-2200 XML', () => {
      const xml = buildS2200({ employee: mockEmployee, contract: mockContract, position: mockPosition, organization: mockOrg });
      const errors = validateXmlAgainstXsd('S-2200', xml);
      expect(errors).toHaveLength(0);
    });

    it('returns errors with field path for XML missing required cpfTrab', () => {
      const xml = buildS2200({ employee: mockEmployee, contract: mockContract, position: mockPosition, organization: mockOrg });
      // Remove cpfTrab to simulate invalid XML
      const brokenXml = xml.replace(/<cpfTrab>.*?<\/cpfTrab>/, '');
      const errors = validateXmlAgainstXsd('S-2200', brokenXml);
      expect(errors.some((e) => e.field.includes('cpfTrab'))).toBe(true);
    });

    it('returns errors with field path for XML missing required nisTrab', () => {
      const xml = buildS2200({ employee: mockEmployee, contract: mockContract, position: mockPosition, organization: mockOrg });
      const brokenXml = xml.replace(/<nisTrab>.*?<\/nisTrab>/, '');
      const errors = validateXmlAgainstXsd('S-2200', brokenXml);
      expect(errors.some((e) => e.field.includes('nisTrab'))).toBe(true);
    });

    it('returns no errors for unknown event type (skip validation)', () => {
      const errors = validateXmlAgainstXsd('S-UNKNOWN', '<eSocial/>');
      expect(errors).toHaveLength(0);
    });

    it('returns error for malformed XML', () => {
      const errors = validateXmlAgainstXsd('S-2200', '<not-closed>');
      // Either parse error or missing required elements — either way, errors exist
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('XSD_CONSTRAINTS', () => {
    it('contains constraint definitions for all 15 event types', () => {
      const expectedTypes = [
        'S-1000', 'S-1005', 'S-1010', 'S-1020',
        'S-2200', 'S-2206', 'S-2230', 'S-2299',
        'S-1200', 'S-1210', 'S-1299',
        'S-2210', 'S-2220', 'S-2240',
      ];
      expectedTypes.forEach((type) => {
        expect(XSD_CONSTRAINTS[type]).toBeDefined();
        expect(Array.isArray(XSD_CONSTRAINTS[type])).toBe(true);
      });
    });

    it('S-2200 constraints include cpfTrab and nisTrab as required', () => {
      const constraints = XSD_CONSTRAINTS['S-2200'] ?? [];
      const cpf = constraints.find((c) => c.path.includes('cpfTrab'));
      const nis = constraints.find((c) => c.path.includes('nisTrab'));
      expect(cpf?.required).toBe(true);
      expect(nis?.required).toBe(true);
    });
  });
});
