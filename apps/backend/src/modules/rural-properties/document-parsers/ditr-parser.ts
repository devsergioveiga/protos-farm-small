export interface DitrData {
  cib: string | null;
  denomination: string | null;
  totalAreaHa: number | null;
  incraCode: string | null;
  municipality: string | null;
  state: string | null;
  carCode: string | null;
  // Environmental areas
  appAreaHa: number | null;
  legalReserveHa: number | null;
  taxableAreaHa: number | null;
  usableAreaHa: number | null;
  utilizationDegree: number | null;
  // Condôminos
  owners: Array<{ document: string; name: string; fractionPct: number }>;
}

function parseArea(text: string, label: string): number | null {
  // Match label followed by value like "225,3 ha" or "6,8 ha"
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(escaped + '\\s*\\n?\\s*([\\d.,]+)\\s*ha', 'i'));
  if (match) return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  return null;
}

export function parseDitr(text: string): DitrData {
  const result: DitrData = {
    cib: null,
    denomination: null,
    totalAreaHa: null,
    incraCode: null,
    municipality: null,
    state: null,
    carCode: null,
    appAreaHa: null,
    legalReserveHa: null,
    taxableAreaHa: null,
    usableAreaHa: null,
    utilizationDegree: null,
    owners: [],
  };

  // CIB — "Identificação CIB: 2740520-6" or "CIB: 2740520-6"
  const cibMatch = text.match(/CIB[:\s]+([\d.-]+)/i);
  if (cibMatch) {
    // Normalize to X.XXX.XXX-X format
    const raw = cibMatch[1].replace(/[^0-9]/g, '');
    if (raw.length >= 7) {
      result.cib = `${raw.slice(0, -7).replace(/^0+/, '') || '0'}.${raw.slice(-7, -4)}.${raw.slice(-4, -1)}-${raw.slice(-1)}`;
    } else {
      result.cib = cibMatch[1];
    }
  }

  // Denomination — "Nome do Imóvel Rural:" or "Nome\nFAZENDA LIMEIRA"
  const denomMatch =
    text.match(/Nome\s+do\s+Im[óo]vel\s+Rural[:\s]+([^\n]+)/i) ||
    text.match(/Dados\s+do\s+Im[óo]vel\s+Rural[\s\S]*?Nome\s*\n\s*([A-ZÁÉÍÓÚÃÕÂÊÔÇ][^\n]+)/i);
  if (denomMatch) result.denomination = denomMatch[1].trim();

  // Total area — "Área Total" followed by value
  result.totalAreaHa = parseArea(text, '[ÁA]rea\\s+Total(?:\\s+do\\s+Im[óo]vel)?');

  // INCRA code
  const incraMatch = text.match(/C[óo]digo\s+do\s+im[óo]vel\s+no\s+Incra\s*\n?\s*([\d]+)/i);
  if (incraMatch) result.incraCode = incraMatch[1];

  // Municipality
  const munMatch = text.match(/Munic[íi]pio\s*\n?\s*([A-ZÁÉÍÓÚÃÕÂÊÔÇ][^\n]+)/i);
  if (munMatch) result.municipality = munMatch[1].trim();

  // UF
  const ufMatch = text.match(/\bUF\s*\n?\s*([A-Z]{2})\b/);
  if (ufMatch) result.state = ufMatch[1];

  // CAR — "Número do CAR"
  const carMatch = text.match(/N[úu]mero\s+do\s+CAR\s*\n?\s*([A-Z]{2}-[\w]+)/i);
  if (carMatch) result.carCode = carMatch[1];

  // Environmental areas from DIAT page
  result.appAreaHa = parseArea(text, 'Preserva[çc][ãa]o\\s+permanente');
  result.legalReserveHa = parseArea(text, 'Reserva\\s+legal');
  result.taxableAreaHa = parseArea(text, '[ÁA]rea\\s+Tribut[áa]vel');
  result.usableAreaHa = parseArea(text, '[ÁA]rea\\s+Aproveit[áa]vel');

  // Utilization degree — "Grau de utilização" followed by percentage
  const guMatch = text.match(/Grau\s+de\s+utiliza[çc][ãa]o\s*\n?\s*([\d.,]+)\s*%/i);
  if (guMatch) result.utilizationDegree = parseFloat(guMatch[1].replace(',', '.'));

  // Condôminos — table with CPF/CNPJ, name, percentage
  const condSection = text.match(/Demais\s+Cond[ôo]minos[\s\S]*?(?=\n\s*\n|$)/i);
  if (condSection) {
    const ownerPattern =
      /([\d]{3}\.[\d]{3}\.[\d]{3}-[\d]{2}|[\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4}-[\d]{2})\s+([A-ZÁÉÍÓÚÃÕÂÊÔÇ][A-ZÁÉÍÓÚÃÕÂÊÔÇ\s]+?)\s+([\d.,]+)\s*%/g;
    let match;
    while ((match = ownerPattern.exec(condSection[0])) !== null) {
      result.owners.push({
        document: match[1],
        name: match[2].trim(),
        fractionPct: parseFloat(match[3].replace(',', '.')),
      });
    }
  }

  return result;
}
