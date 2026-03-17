import { parseSupplierFile } from './supplier-file-parser';

// ─── Helpers ─────────────────────────────────────────────────────────

function makeCsv(rows: string[]): Buffer {
  const header =
    'Tipo;Nome/Razão Social;Nome Fantasia;CNPJ/CPF;IE;Endereço;Cidade;UF;CEP;Contato Nome;Contato Telefone;Contato Email;Condição Pagamento;Frete;Categorias';
  return Buffer.from([header, ...rows].join('\n'), 'utf-8');
}

const VALID_CNPJ = '11222333000181'; // validated CNPJ
const VALID_CPF = '12345678909'; // validated CPF

describe('parseSupplierFile — CSV', () => {
  it('parses a valid PJ row correctly', async () => {
    const csv = makeCsv([
      `PJ;Fazenda Boa Vista Ltda;Boa Vista;${VALID_CNPJ};;Rua Principal 100;Ribeirão Preto;SP;14000-000;João Silva;(16) 99999-0000;joao@example.com;30 dias;CIF;Insumo Agrícola`,
    ]);
    const result = await parseSupplierFile(csv, 'text/csv');
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(0);
    expect(result.valid[0].name).toBe('Fazenda Boa Vista Ltda');
    expect(result.valid[0].type).toBe('PJ');
    expect(result.valid[0].document).toBe(VALID_CNPJ);
    expect(result.valid[0].categories).toEqual(['INSUMO_AGRICOLA']);
  });

  it('parses a valid PF row correctly', async () => {
    const csv = makeCsv([
      `PF;Maria Santos;;${VALID_CPF};;;São Paulo;SP;01000-000;Maria Santos;(11) 98888-0000;maria@example.com;À vista;FOB;Serviços`,
    ]);
    const result = await parseSupplierFile(csv, 'text/csv');
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].type).toBe('PF');
    expect(result.valid[0].categories).toEqual(['SERVICOS']);
  });

  it('returns invalid row for bad CNPJ', async () => {
    const csv = makeCsv([`PJ;Empresa Teste;;;bad-cnpj;;;SP;;;;;;INSUMO_AGRICOLA`]);
    const result = await parseSupplierFile(csv, 'text/csv');
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors.some((e) => e.includes('CNPJ'))).toBe(true);
  });

  it('returns invalid row for missing name', async () => {
    const csv = makeCsv([`PJ;;Boa Vista;${VALID_CNPJ};;;;;;;;;;INSUMO_AGRICOLA`]);
    const result = await parseSupplierFile(csv, 'text/csv');
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors.some((e) => e.includes('Nome'))).toBe(true);
  });

  it('infers PJ type from 14-digit CNPJ when Tipo is empty', async () => {
    // 15 fields: Tipo(empty);Nome;NomeFantasia;CNPJ;IE;End;Cidade;UF;CEP;ContNome;ContTel;ContEmail;CondPag;Frete;Categorias
    const csv = makeCsv([`;Empresa Sem Tipo;;${VALID_CNPJ};;;;;;;;;;;OUTROS`]);
    const result = await parseSupplierFile(csv, 'text/csv');
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].type).toBe('PJ');
  });

  it('infers PF type from 11-digit CPF when Tipo is empty', async () => {
    const csv = makeCsv([`;Maria Sem Tipo;;${VALID_CPF};;;;;;;;;;;OUTROS`]);
    const result = await parseSupplierFile(csv, 'text/csv');
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].type).toBe('PF');
  });

  it('maps multiple pipe-separated category labels to enum values', async () => {
    const csv = makeCsv([
      `PJ;Empresa Multi;Multi;${VALID_CNPJ};;;;;;;;;;;Insumo Agrícola|Pecuário|Serviços`,
    ]);
    const result = await parseSupplierFile(csv, 'text/csv');
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].categories).toEqual(['INSUMO_AGRICOLA', 'PECUARIO', 'SERVICOS']);
  });

  it('defaults categories to OUTROS when empty', async () => {
    const csv = makeCsv([`PJ;Empresa Sem Cat;Cat;${VALID_CNPJ};;;;;;;;;;`]);
    const result = await parseSupplierFile(csv, 'text/csv');
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].categories).toEqual(['OUTROS']);
  });

  it('returns invalid row for invalid UF', async () => {
    const csv = makeCsv([
      `PJ;Empresa UF Ruim;;${VALID_CNPJ};;Rua X;Cidade X;ZZ;;;;;30 dias;CIF;OUTROS`,
    ]);
    const result = await parseSupplierFile(csv, 'text/csv');
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors.some((e) => e.includes('UF'))).toBe(true);
  });

  it('returns invalid row for bad freight value', async () => {
    const csv = makeCsv([
      `PJ;Empresa Frete Ruim;;${VALID_CNPJ};;Rua X;Cidade;SP;;;;;30 dias;INVALIDO;OUTROS`,
    ]);
    const result = await parseSupplierFile(csv, 'text/csv');
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors.some((e) => e.includes('Frete'))).toBe(true);
  });

  it('returns mixed valid and invalid rows', async () => {
    // Each row must have 14 semicolons (15 fields)
    const csv = makeCsv([
      `PJ;Empresa Valida;;${VALID_CNPJ};;;;;;;;;;;OUTROS`,
      `PJ;Empresa Invalida;;12345678000100;;;;;;;;;;;OUTROS`,
    ]);
    const result = await parseSupplierFile(csv, 'text/csv');
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(1);
  });

  it('throws error when file has no data rows', async () => {
    const header =
      'Tipo;Nome/Razão Social;Nome Fantasia;CNPJ/CPF;IE;Endereço;Cidade;UF;CEP;Contato Nome;Contato Telefone;Contato Email;Condição Pagamento;Frete;Categorias';
    const csv = Buffer.from(header, 'utf-8');
    await expect(parseSupplierFile(csv, 'text/csv')).rejects.toThrow();
  });
});

describe('parseSupplierFile — XLSX', () => {
  it('parses a valid XLSX file correctly', async () => {
    // Build a minimal XLSX using ExcelJS
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    sheet.addRow([
      'Tipo',
      'Nome/Razão Social',
      'Nome Fantasia',
      'CNPJ/CPF',
      'IE',
      'Endereço',
      'Cidade',
      'UF',
      'CEP',
      'Contato Nome',
      'Contato Telefone',
      'Contato Email',
      'Condição Pagamento',
      'Frete',
      'Categorias',
    ]);
    sheet.addRow([
      'PJ',
      'Empresa XLSX Ltda',
      'Empresa XLSX',
      VALID_CNPJ,
      '',
      'Rua Teste 1',
      'São Paulo',
      'SP',
      '01000-000',
      'Contato',
      '(11) 9999-9999',
      'contact@xlsx.com',
      '30 dias',
      'CIF',
      'PECUARIO',
    ]);

    const xlsxBuffer = Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
    const result = await parseSupplierFile(
      xlsxBuffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].name).toBe('Empresa XLSX Ltda');
    expect(result.valid[0].categories).toEqual(['PECUARIO']);
  });
});
