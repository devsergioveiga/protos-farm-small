import { parseAnimalFile, MAX_BULK_ANIMAL_ROWS } from './animal-file-parser';

function makeCsv(headers: string, ...rows: string[]): Buffer {
  return Buffer.from([headers, ...rows].join('\n'), 'utf-8');
}

function makeCsvBom(headers: string, ...rows: string[]): Buffer {
  return Buffer.from('\uFEFF' + [headers, ...rows].join('\n'), 'utf-8');
}

function makeCsvSemicolon(headers: string, ...rows: string[]): Buffer {
  return Buffer.from([headers, ...rows].join('\n'), 'utf-8');
}

describe('parseAnimalFile', () => {
  it('should parse a basic CSV with comma separator', async () => {
    const csv = makeCsv('Brinco,Sexo,Nome', 'BR001,Macho,Touro1', 'BR002,Fêmea,Vaca1');
    const result = await parseAnimalFile(csv, 'animals.csv');

    expect(result.columnHeaders).toEqual(['Brinco', 'Sexo', 'Nome']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].raw['Brinco']).toBe('BR001');
    expect(result.rows[0].raw['Sexo']).toBe('Macho');
    expect(result.rows[1].raw['Nome']).toBe('Vaca1');
  });

  it('should parse CSV with semicolon separator', async () => {
    const csv = makeCsvSemicolon('Brinco;Sexo;Nome', 'BR001;Macho;Touro1');
    const result = await parseAnimalFile(csv, 'animals.csv');

    expect(result.columnHeaders).toEqual(['Brinco', 'Sexo', 'Nome']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].raw['Brinco']).toBe('BR001');
  });

  it('should handle BOM character', async () => {
    const csv = makeCsvBom('Brinco;Sexo', 'BR001;M');
    const result = await parseAnimalFile(csv, 'test.csv');

    expect(result.columnHeaders[0]).toBe('Brinco');
    expect(result.rows).toHaveLength(1);
  });

  it('should skip empty rows', async () => {
    const csv = makeCsv('Brinco,Sexo', 'BR001,M', ',,', 'BR002,F');
    const result = await parseAnimalFile(csv, 'test.csv');

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].raw['Brinco']).toBe('BR001');
    expect(result.rows[1].raw['Brinco']).toBe('BR002');
  });

  it('should handle accented headers', async () => {
    const csv = makeCsv('Raça;Mãe;Observação', 'Holandesa;BR001;Nota');
    const result = await parseAnimalFile(csv, 'test.csv');

    expect(result.columnHeaders).toContain('Raça');
    expect(result.columnHeaders).toContain('Mãe');
    expect(result.columnHeaders).toContain('Observação');
  });

  it('should throw for empty file (no data rows)', async () => {
    const csv = makeCsv('Brinco,Sexo');
    await expect(parseAnimalFile(csv, 'test.csv')).rejects.toThrow('pelo menos');
  });

  it('should throw for unsupported extension', async () => {
    const buf = Buffer.from('test');
    await expect(parseAnimalFile(buf, 'test.txt')).rejects.toThrow('não suportado');
  });

  it('should throw when exceeding max rows', async () => {
    const rows = Array.from({ length: MAX_BULK_ANIMAL_ROWS + 1 }, (_, i) => `BR${i},M`);
    const csv = makeCsv('Brinco,Sexo', ...rows);
    await expect(parseAnimalFile(csv, 'test.csv')).rejects.toThrow('Limite máximo');
  });
});
