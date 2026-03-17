export interface CcirRegistration {
  cartorio: string | null;
  registrationDate: string | null;
  cnsCode: string | null;
  number: string;
  registro: string | null;
  livro: string | null;
  areaHa: number;
}

export interface CcirOwner {
  document: string;
  name: string;
  condition: string | null;
  fractionPct: number | null;
}

export interface CcirDeclarant {
  name: string;
  document: string;
  nationality: string | null;
}

export interface CcirData {
  incraCode: string | null;
  denomination: string | null;
  totalAreaHa: number | null;
  certifiedAreaHa: number | null;
  landClassification: string | null;
  municipality: string | null;
  state: string | null;
  locationDirections: string | null;
  ruralModuleHa: number | null;
  ruralModulesCount: number | null;
  fiscalModuleHa: number | null;
  fiscalModulesCount: number | null;
  minPartitionFraction: number | null;
  ccirNumber: string | null;
  ccirIssuedAt: string | null;
  ccirGeneratedAt: string | null;
  ccirValidUntil: string | null;
  ccirPaymentStatus: string | null;
  lastProcessingDate: string | null;
  declarant: CcirDeclarant | null;
  registrations: CcirRegistration[];
  owners: CcirOwner[];
  registeredAreaHa: number | null;
  possessionByTitleHa: number | null;
  possessionByOccupationHa: number | null;
  measuredAreaHa: number | null;
}

function parseDecimal(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'));
}

export function parseCcir(text: string): CcirData {
  const result: CcirData = {
    incraCode: null,
    denomination: null,
    totalAreaHa: null,
    certifiedAreaHa: null,
    landClassification: null,
    municipality: null,
    state: null,
    locationDirections: null,
    ruralModuleHa: null,
    ruralModulesCount: null,
    fiscalModuleHa: null,
    fiscalModulesCount: null,
    minPartitionFraction: null,
    ccirNumber: null,
    ccirIssuedAt: null,
    ccirGeneratedAt: null,
    ccirValidUntil: null,
    ccirPaymentStatus: null,
    lastProcessingDate: null,
    declarant: null,
    registrations: [],
    owners: [],
    registeredAreaHa: null,
    possessionByTitleHa: null,
    possessionByOccupationHa: null,
    measuredAreaHa: null,
  };

  // INCRA code + Denomination on same line: "434.205.014.320-4FAZENDA LIMEIRA"
  // Stop before "ÁREA", "AREA", digits, or newline to avoid capturing "ÁREA TOTAL"
  const incraNameMatch = text.match(
    /([\d]{3}\.[\d]{3}\.[\d]{3}\.[\d]{3}-\d)([A-ZÁÉÍÓÚÃÕÂÊÔÇ][A-ZÁÉÍÓÚÃÕÂÊÔÇ\s]*?)(?=\s*(?:[ÁA]REA|TOTAL|\d|\n))/,
  );
  if (incraNameMatch) {
    result.incraCode = incraNameMatch[1];
    result.denomination = incraNameMatch[2].trim();
  }

  // Total area + classification + processing date + certified area on same line:
  // "225,2910Média Propriedade Produtiva16/08/20210,0000"
  const areaClassDateMatch = text.match(
    /\n([\d]+[.,][\d]{4})([\wéêãõáíóúÉÊÃÕÁÍÓÚ\s]+(?:Produtiva|Improdutiva))(\d{2}\/\d{2}\/\d{4})([\d]+[.,][\d]{4})/,
  );
  if (areaClassDateMatch) {
    result.totalAreaHa = parseDecimal(areaClassDateMatch[1]);
    const classification = areaClassDateMatch[2].trim();
    if (/m[ée]dia/i.test(classification)) result.landClassification = 'MEDIA';
    else if (/pequena/i.test(classification)) result.landClassification = 'PEQUENA';
    else if (/grande/i.test(classification)) result.landClassification = 'GRANDE';
    else if (/minif[úu]ndio/i.test(classification)) result.landClassification = 'MINIFUNDIO';
    result.lastProcessingDate = areaClassDateMatch[3].split('/').reverse().join('-');
    result.certifiedAreaHa = parseDecimal(areaClassDateMatch[4]);
  } else {
    // Fallback without date/certified area
    const areaClassMatch = text.match(
      /\n([\d]+[.,][\d]{4})([\wéêãõáíóúÉÊÃÕÁÍÓÚ\s]+(?:Produtiva|Improdutiva)?)/,
    );
    if (areaClassMatch) {
      result.totalAreaHa = parseDecimal(areaClassMatch[1]);
      const classification = areaClassMatch[2].trim();
      if (/m[ée]dia/i.test(classification)) result.landClassification = 'MEDIA';
      else if (/pequena/i.test(classification)) result.landClassification = 'PEQUENA';
      else if (/grande/i.test(classification)) result.landClassification = 'GRANDE';
      else if (/minif[úu]ndio/i.test(classification)) result.landClassification = 'MINIFUNDIO';
    }
  }

  // Location directions — typically after "INDICAÇÕES PARA LOCALIZAÇÃO" or road/km info
  // Pattern: look for road/highway + km + municipality info
  const locMatch = text.match(/(?:LOCALIZA[ÇC][ÃA]O[^\n]*\n)([^\n]+)/i);
  if (locMatch) {
    result.locationDirections = locMatch[1].trim();
  } else {
    // Try pattern with road info: "RODOVIA...", "ESTRADA...", "BR-...", "MG-..."
    const roadMatch = text.match(
      /((?:RODOVIA|ESTRADA|BR-|MG-|SP-|GO-|MT-|MS-|PR-|RJ-|BA-|ES-)[^\n]+)/i,
    );
    if (roadMatch) result.locationDirections = roadMatch[1].trim();
  }

  // Municipality + UF — "NEPOMUCENOMG" at end of location line
  const munUfMatch = text.match(/KM\s+\d+([A-ZÁÉÍÓÚÃÕÂÊÔÇ]+)([A-Z]{2})\n/);
  if (munUfMatch) {
    result.municipality = munUfMatch[1];
    result.state = munUfMatch[2];
    // Remove municipality+UF from locationDirections if it was captured there
    if (result.locationDirections) {
      result.locationDirections = result.locationDirections
        .replace(new RegExp(munUfMatch[1] + munUfMatch[2] + '$'), '')
        .trim();
    }
  } else {
    // Try separate pattern
    const munMatch = text.match(
      /MUNIC[ÍI]PIO\s+SEDE[^\n]*\n[^\n]*?([A-ZÁÉÍÓÚÃÕÂÊÔÇ]{3,})([A-Z]{2})\n/i,
    );
    if (munMatch) {
      result.municipality = munMatch[1];
      result.state = munMatch[2];
      if (result.locationDirections) {
        result.locationDirections = result.locationDirections
          .replace(new RegExp(munMatch[1] + munMatch[2] + '$'), '')
          .trim();
      }
    }
  }

  // Módulos — 5 numbers concatenated on same line:
  // "13,895113,3526,00008,66502,00"
  // Pattern: ruralModule(4dec) + ruralCount(2dec) + fiscalModule(4dec) + fiscalCount(4dec) + minFraction(2dec)
  const modulosMatch = text.match(
    /([\d]+,[\d]{4})([\d]+,[\d]{2})([\d]+,[\d]{4})([\d]+,[\d]{4})([\d]+,[\d]{2})\n/,
  );
  if (modulosMatch) {
    result.ruralModuleHa = parseDecimal(modulosMatch[1]);
    result.ruralModulesCount = parseDecimal(modulosMatch[2]);
    result.fiscalModuleHa = parseDecimal(modulosMatch[3]);
    result.fiscalModulesCount = parseDecimal(modulosMatch[4]);
    result.minPartitionFraction = parseDecimal(modulosMatch[5]);
  }

  // Last processing date fallback (if not already extracted from area/classification line)
  if (!result.lastProcessingDate) {
    const procDateMatch =
      text.match(/[ÚU]LTIM[OA]\s*PROCESSAMENTO[^\d]*(\d{2}\/\d{2}\/\d{4})/i) ||
      text.match(/PROCESSAMENTO[^\d]*(\d{2}\/\d{2}\/\d{4})/i);
    if (procDateMatch) {
      result.lastProcessingDate = procDateMatch[1].split('/').reverse().join('-');
    } else {
      const emissaoMatch = text.match(/EMISS[ÃA]O[^\d]*(\d{2}\/\d{2}\/\d{4})/i);
      if (emissaoMatch) result.lastProcessingDate = emissaoMatch[1].split('/').reverse().join('-');
    }
  }

  // Registrations — pattern: "5,50102MG/NEPOMUCENO19/06/1990461695310R-02"
  const regPattern =
    /([\d]+[.,][\d]{4})(\d)([A-Z]{2}\/[A-ZÁÉÍÓÚÃÕÂÊÔÇ]+)(\d{2}\/\d{2}\/\d{4})(\d+)(\d{4,})([\w.-]+)/g;
  let regMatch;
  while ((regMatch = regPattern.exec(text)) !== null) {
    const [, area, livro, cartorio, date, cns, number, registro] = regMatch;
    result.registrations.push({
      areaHa: parseDecimal(area),
      livro: livro,
      cartorio: cartorio,
      registrationDate: date.split('/').reverse().join('-'),
      cnsCode: cns,
      number: number,
      registro: registro,
    });
  }

  // Area breakdown — "REGISTRADAPOSSE A JUSTO TÍTULO...ÁREA MEDIDA\n225,29100,0000-0,0000"
  // Values concatenated: registrada(4dec) + posseTitulo(4dec) + [-]? + posseOcupacao(4dec)?
  const areaBreakdownMatch = text.match(
    /REGISTRADA[A-ZÁÉÍÓÚÃÕÂÊÔÇ\s]+\n([\d]+[.,][\d]{4})([\d]+[.,][\d]{4})([^,\d]*)([\d]+[.,][\d]{4})?/i,
  );
  if (areaBreakdownMatch) {
    result.registeredAreaHa = parseDecimal(areaBreakdownMatch[1]);
    result.possessionByTitleHa = parseDecimal(areaBreakdownMatch[2]);
    const midToken = areaBreakdownMatch[3]?.trim();
    if (midToken === '-') {
      // "-" means area medida is unavailable, next value is posse por ocupação
      result.measuredAreaHa = null;
      if (areaBreakdownMatch[4])
        result.possessionByOccupationHa = parseDecimal(areaBreakdownMatch[4]);
    } else if (areaBreakdownMatch[4]) {
      result.possessionByOccupationHa = parseDecimal(
        areaBreakdownMatch[3] ? areaBreakdownMatch[3].match(/[\d]+[.,][\d]{4}/)?.[0] || '0' : '0',
      );
      result.measuredAreaHa = parseDecimal(areaBreakdownMatch[4]);
    }
  }

  // Declarant — "DADOS DO DECLARANTE\nNOMECPF/CNPJ\nLUCAS PIMENTA VEIGA222.283.066-49\nNACIONALIDADE...\nBRASILEIRA2"
  const declarantMatch = text.match(
    /DADOS\s+DO\s+DECLARANTE\n[^\n]*\n([A-ZÁÉÍÓÚÃÕÂÊÔÇ][A-ZÁÉÍÓÚÃÕÂÊÔÇ\s]+?)([\d]{3}\.[\d]{3}\.[\d]{3}-[\d]{2}|[\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4}-[\d]{2})\nNACIONALIDADE[^\n]*\n([A-ZÁÉÍÓÚÃÕÂÊÔÇ]+)/i,
  );
  if (declarantMatch) {
    result.declarant = {
      name: declarantMatch[1].trim(),
      document: declarantMatch[2],
      nationality: declarantMatch[3].trim(),
    };
  }

  // Owners — "222.283.066-49LUCAS PIMENTA VEIGAProprietario...50,00"
  const ownerPattern =
    /([\d]{3}\.[\d]{3}\.[\d]{3}-[\d]{2}|[\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4}-[\d]{2})([A-ZÁÉÍÓÚÃÕÂÊÔÇ][A-ZÁÉÍÓÚÃÕÂÊÔÇ\s]+?)(Propriet[áa]rio[^\d]+?)([\d]+[.,][\d]+)/g;
  let ownerMatch;
  while ((ownerMatch = ownerPattern.exec(text)) !== null) {
    result.owners.push({
      document: ownerMatch[1],
      name: ownerMatch[2].trim(),
      condition: ownerMatch[3].trim(),
      fractionPct: parseDecimal(ownerMatch[4]),
    });
  }

  // CCIR control data — "16/06/20257089675825821/07/2025"
  // Pattern: issuedAt(dd/mm/yyyy) + ccirNumber(11 digits) + generatedAt(dd/mm/yyyy)
  const controlMatch = text.match(
    /CONTROLE[\s\S]*?(\d{2}\/\d{2}\/\d{4})(\d{11})(\d{2}\/\d{2}\/\d{4})/i,
  );
  if (controlMatch) {
    result.ccirIssuedAt = controlMatch[1].split('/').reverse().join('-');
    result.ccirNumber = controlMatch[2];
    result.ccirGeneratedAt = controlMatch[3].split('/').reverse().join('-');
  } else {
    // Fallback for CCIR number only
    const ccirMatch = text.match(
      /N[ÚU]MERO\s+(?:DO\s+)?CCIR[^\n]*\n[^\n]*?\d{2}\/\d{2}\/\d{4}(\d{11})/i,
    );
    if (ccirMatch) result.ccirNumber = ccirMatch[1];
  }

  // CCIR validity — "VENCIMENTO:DD/MM/YYYY" or "VENCIMENTO:**/**/****" (expired/unknown)
  const validMatch = text.match(/VENCIMENTO[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
  if (validMatch) {
    result.ccirValidUntil = validMatch[1].split('/').reverse().join('-');
  }

  // Payment status — "*** QUITADO ***" or pending
  if (/QUITADO/i.test(text)) {
    result.ccirPaymentStatus = 'QUITADO';
  } else if (result.ccirValidUntil) {
    result.ccirPaymentStatus = 'PENDENTE';
  }

  return result;
}
