export interface CafirData {
  cib: string | null;
  denomination: string | null;
  totalAreaHa: number | null;
  municipality: string | null;
  state: string | null;
  incraCode: string | null;
  location: string | null;
  zipCode: string | null;
  status: string | null;
}

export function parseCafir(text: string): CafirData {
  const result: CafirData = {
    cib: null,
    denomination: null,
    totalAreaHa: null,
    municipality: null,
    state: null,
    incraCode: null,
    location: null,
    zipCode: null,
    status: null,
  };

  // CIB from footer "[ CIB: 2740520-6 ]"
  const cibFooter = text.match(/\[\s*CIB:\s*([\d-]+)\s*\]/);
  if (cibFooter) {
    const raw = cibFooter[1].replace(/-/g, '');
    if (raw.length >= 7) {
      const digits = raw.padStart(8, '0');
      result.cib = `${parseInt(digits.slice(0, -7), 10)}.${digits.slice(-7, -4)}.${digits.slice(-4, -1)}-${digits.slice(-1)}`;
    }
  }

  // CIB value line: "2.740.520-6FAZENDA LIMEIRA" — CIB is before the farm name
  const cibNameLine = text.match(/([\d.]+[-]\d)([A-ZÁÉÍÓÚÃÕÂÊÔÇ][A-ZÁÉÍÓÚÃÕÂÊÔÇ\s]+)/);
  if (cibNameLine) {
    if (!result.cib) {
      const raw = cibNameLine[1].replace(/[^0-9]/g, '');
      if (raw.length >= 7) {
        const digits = raw.padStart(8, '0');
        result.cib = `${parseInt(digits.slice(0, -7), 10)}.${digits.slice(-7, -4)}.${digits.slice(-4, -1)}-${digits.slice(-1)}`;
      }
    }
    result.denomination = cibNameLine[2].trim();
  }

  // Area — "225,2 ha"
  const areaMatch = text.match(/([\d]+[.,]\d+)\s*ha/i);
  if (areaMatch) {
    result.totalAreaHa = parseFloat(areaMatch[1].replace('.', '').replace(',', '.'));
  }

  // Municipality — appears after CEP line, before UF. Pattern: CEP\nMUNICIPIO\nUF
  // In the extracted text: "37250-000\nCEP\nNEPOMUCENO\nUF\nMG"
  const munMatch = text.match(/CEP\n([A-ZÁÉÍÓÚÃÕÂÊÔÇ][A-ZÁÉÍÓÚÃÕÂÊÔÇ\s]+)\nUF/i);
  if (munMatch) result.municipality = munMatch[1].trim();

  // UF — after "UF\n"
  const ufMatch = text.match(/\nUF\n([A-Z]{2})\n/);
  if (ufMatch) result.state = ufMatch[1];

  // INCRA code — line after the CIB+name, before CADEIA
  const incraMatch = text.match(/\n([\d]{9,}[-]?\d?)\n/);
  if (incraMatch) result.incraCode = incraMatch[1];

  // Location — line after "NOME DO IMÓVEL\n"
  // Actually: "NOME DO IMÓVEL\nESTRADA PORTO DO FARIA - KM 20"
  const locMatch = text.match(/NOME DO IM[ÓO]VEL\n([^\n]+)/i);
  if (locMatch) result.location = locMatch[1].trim();

  // ZIP code
  const cepMatch = text.match(/(\d{5}-\d{3})/);
  if (cepMatch) result.zipCode = cepMatch[1];

  // Status — "ATIVO" appears in the text
  if (/\bATIVO\b/.test(text)) result.status = 'ATIVO';
  else if (/\bCANCELADO\b/.test(text)) result.status = 'CANCELADO';
  else if (/\bSUSPENSO\b/.test(text)) result.status = 'SUSPENSO';

  return result;
}
