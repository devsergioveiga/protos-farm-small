import { parseNfeXml, calculateRateio } from './nfe-parser';

// ─── Helpers ────────────────────────────────────────────────────────────

function makeNfe(overrides: {
  xNome?: string;
  CNPJ?: string;
  nNF?: string;
  dhEmi?: string;
  vNF?: string;
  vProd?: string;
  vFrete?: string;
  vSeg?: string;
  vOutro?: string;
  items?: Array<{ xProd: string; vProd: string; NCM?: string; qCom: string; uCom: string }>;
} = {}): string {
  const {
    xNome = 'Fornecedor Teste LTDA',
    CNPJ = '12345678000195',
    nNF = '12345',
    dhEmi = '2026-04-26T10:00:00-03:00',
    vNF = '110.00',
    vProd = '100.00',
    vFrete = '5.00',
    vSeg = '3.00',
    vOutro = '2.00',
    items = [
      { xProd: 'Trator Agrícola', vProd: '60.00', NCM: '87019100', qCom: '1', uCom: 'UN' },
      { xProd: 'Grade Aradora', vProd: '40.00', NCM: '84322100', qCom: '2', uCom: 'UN' },
    ],
  } = overrides;

  const detItems = items
    .map(
      (item, i) => `
    <det nItem="${i + 1}">
      <prod>
        <xProd>${item.xProd}</xProd>
        <vProd>${item.vProd}</vProd>
        ${item.NCM ? `<NCM>${item.NCM}</NCM>` : ''}
        <qCom>${item.qCom}</qCom>
        <uCom>${item.uCom}</uCom>
      </prod>
    </det>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe>
    <ide>
      <nNF>${nNF}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
    </ide>
    <emit>
      <CNPJ>${CNPJ}</CNPJ>
      <xNome>${xNome}</xNome>
    </emit>
    ${detItems}
    <total>
      <ICMSTot>
        <vProd>${vProd}</vProd>
        <vFrete>${vFrete}</vFrete>
        <vSeg>${vSeg}</vSeg>
        <vOutro>${vOutro}</vOutro>
        <vNF>${vNF}</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>`;
}

function makeNfeProc(innerNfe: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  ${innerNfe}
</nfeProc>`;
}

// ─── Tests: parseNfeXml ─────────────────────────────────────────────────

describe('parseNfeXml', () => {
  it('Test 1: extracts supplierName from emit/xNome tag', () => {
    const xml = makeNfe({ xNome: 'Agro Máquinas SA' });
    const result = parseNfeXml(xml);
    expect(result.supplierName).toBe('Agro Máquinas SA');
  });

  it('Test 2: extracts invoiceNumber from ide/nNF tag', () => {
    const xml = makeNfe({ nNF: '99887' });
    const result = parseNfeXml(xml);
    expect(result.invoiceNumber).toBe('99887');
  });

  it('Test 3: extracts totalNf from ICMSTot/vNF tag', () => {
    const xml = makeNfe({ vNF: '25000.50' });
    const result = parseNfeXml(xml);
    expect(result.totalNf).toBe('25000.50');
  });

  it('Test 4: extracts issueDate from ide/dhEmi tag (ISO 8601)', () => {
    const xml = makeNfe({ dhEmi: '2026-04-26T10:00:00-03:00' });
    const result = parseNfeXml(xml);
    expect(result.issueDate).toBe('2026-04-26T10:00:00-03:00');
  });

  it('Test 5: extracts N items from det elements (xProd, vProd, NCM, qCom, uCom)', () => {
    const xml = makeNfe({
      items: [
        { xProd: 'Trator', vProd: '80000.00', NCM: '87019100', qCom: '1', uCom: 'UN' },
        { xProd: 'Arado', vProd: '15000.00', NCM: '84321000', qCom: '3', uCom: 'PC' },
        { xProd: 'Enxada', vProd: '500.00', NCM: '82011000', qCom: '10', uCom: 'UN' },
      ],
      vProd: '95500.00',
      vNF: '95500.00',
      vFrete: '0.00',
      vSeg: '0.00',
      vOutro: '0.00',
    });
    const result = parseNfeXml(xml);
    expect(result.items).toHaveLength(3);
    expect(result.items[0].description).toBe('Trator');
    expect(result.items[0].value).toBe(80000);
    expect(result.items[0].ncm).toBe('87019100');
    expect(result.items[0].quantity).toBe(1);
    expect(result.items[0].unit).toBe('UN');
    expect(result.items[1].description).toBe('Arado');
    expect(result.items[2].quantity).toBe(10);
  });

  it('Test 6: extracts freight (vFrete), insurance (vSeg), otherCosts (vOutro)', () => {
    const xml = makeNfe({ vFrete: '350.00', vSeg: '120.50', vOutro: '29.50' });
    const result = parseNfeXml(xml);
    expect(result.freight).toBe('350.00');
    expect(result.insurance).toBe('120.50');
    expect(result.otherCosts).toBe('29.50');
  });

  it('Test 7: returns null for missing tags (graceful degradation)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe>
    <ide>
      <nNF>1</nNF>
    </ide>
    <total>
      <ICMSTot>
        <vNF>100.00</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>`;
    const result = parseNfeXml(xml);
    expect(result.supplierName).toBeNull();
    expect(result.supplierCnpj).toBeNull();
    expect(result.issueDate).toBeNull();
    expect(result.freight).toBeNull();
    expect(result.insurance).toBeNull();
    expect(result.otherCosts).toBeNull();
  });

  it('Test 8a: handles bare NFe root', () => {
    const xml = makeNfe({ xNome: 'Bare Root Test' });
    const result = parseNfeXml(xml);
    expect(result.supplierName).toBe('Bare Root Test');
  });

  it('Test 8b: handles nfeProc wrapper', () => {
    const inner = makeNfe({ xNome: 'Wrapped Supplier' });
    const xml = makeNfeProc(inner);
    const result = parseNfeXml(xml);
    expect(result.supplierName).toBe('Wrapped Supplier');
  });
});

// ─── Tests: calculateRateio ────────────────────────────────────────────

describe('calculateRateio', () => {
  it('Test 9: allocates accessory expenses proportionally to each item vProd', () => {
    // 2 items: 60 + 40 = 100. Accessories: freight=5, insurance=3, other=2 = 10 total
    // Item 0 (60%): 6.00 → total 66.00
    // Item 1 (40%): 4.00 → total 44.00
    const items = [
      { description: 'Trator', value: 60, ncm: null, quantity: 1, unit: null },
      { description: 'Grade', value: 40, ncm: null, quantity: 1, unit: null },
    ];
    const result = calculateRateio(items, 5, 3, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(66, 2);
    expect(result[1]).toBeCloseTo(44, 2);
    // Sum must equal vNF = 110
    const sum = result.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 110)).toBeLessThan(0.001);
  });

  it('Test 10: assigns cent residual to first item (sum equals total NF exactly)', () => {
    // 3 items of equal value: 10 + 10 + 10 = 30. Accessories: freight = 0.01 (1 cent)
    // Base: 0.01 / 3 = 0.003... Each gets 0.00 (rounded down)
    // Residual 0.01 goes to item 0
    const items = [
      { description: 'A', value: 10, ncm: null, quantity: 1, unit: null },
      { description: 'B', value: 10, ncm: null, quantity: 1, unit: null },
      { description: 'C', value: 10, ncm: null, quantity: 1, unit: null },
    ];
    const result = calculateRateio(items, 0.01, 0, 0);
    expect(result).toHaveLength(3);
    // Sum must equal 30.01 exactly
    const total = result.reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 30.01)).toBeLessThan(0.0001);
    // Residual cent goes to item 0: it should have the highest value
    expect(result[0]).toBeGreaterThan(result[1]);
    expect(result[1]).toBeCloseTo(result[2], 5);
  });
});
