// ─── eSocial S-1.3 XSD Constraints ───────────────────────────────────────────
// Translated from official S-1.3 XSD definitions for runtime structural validation.
// Each constraint defines an element path and its validation rules.
// Only required (minOccurs=1) elements from the official XSD are listed here.

export interface XsdElementConstraint {
  path: string; // XPath-like: 'eSocial/evtAdmissao/trabalhador/cpfTrab'
  required: boolean;
  type?: 'string' | 'date' | 'decimal' | 'integer';
  minLength?: number;
  maxLength?: number;
  pattern?: string; // regex for format validation
}

export const XSD_CONSTRAINTS: Record<string, XsdElementConstraint[]> = {
  // ─── S-1000 evtInfoEmpregador ────────────────────────────────────────────
  'S-1000': [
    { path: 'eSocial/evtInfoEmpregador/ideEvento/indRetif', required: true, type: 'integer' },
    { path: 'eSocial/evtInfoEmpregador/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtInfoEmpregador/ideEvento/verProc', required: true },
    { path: 'eSocial/evtInfoEmpregador/ideEmpregador/tpInsc', required: true, type: 'integer' },
    {
      path: 'eSocial/evtInfoEmpregador/ideEmpregador/nrInsc',
      required: true,
      minLength: 8,
      maxLength: 14,
    },
  ],

  // ─── S-1005 evtTabEstab ───────────────────────────────────────────────────
  'S-1005': [
    { path: 'eSocial/evtTabEstab/ideEvento/indRetif', required: true, type: 'integer' },
    { path: 'eSocial/evtTabEstab/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtTabEstab/ideEvento/verProc', required: true },
    { path: 'eSocial/evtTabEstab/ideEmpregador/tpInsc', required: true, type: 'integer' },
    {
      path: 'eSocial/evtTabEstab/ideEmpregador/nrInsc',
      required: true,
      minLength: 8,
      maxLength: 14,
    },
  ],

  // ─── S-1010 evtTabRubrica ─────────────────────────────────────────────────
  'S-1010': [
    { path: 'eSocial/evtTabRubrica/ideEvento/indRetif', required: true, type: 'integer' },
    { path: 'eSocial/evtTabRubrica/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtTabRubrica/ideEvento/verProc', required: true },
    { path: 'eSocial/evtTabRubrica/ideEmpregador/tpInsc', required: true, type: 'integer' },
    {
      path: 'eSocial/evtTabRubrica/ideEmpregador/nrInsc',
      required: true,
      minLength: 8,
      maxLength: 14,
    },
  ],

  // ─── S-1020 evtTabLotacao ─────────────────────────────────────────────────
  'S-1020': [
    { path: 'eSocial/evtTabLotacao/ideEvento/indRetif', required: true, type: 'integer' },
    { path: 'eSocial/evtTabLotacao/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtTabLotacao/ideEvento/verProc', required: true },
    { path: 'eSocial/evtTabLotacao/ideEmpregador/tpInsc', required: true, type: 'integer' },
    {
      path: 'eSocial/evtTabLotacao/ideEmpregador/nrInsc',
      required: true,
      minLength: 8,
      maxLength: 14,
    },
  ],

  // ─── S-2200 evtAdmissao ───────────────────────────────────────────────────
  'S-2200': [
    { path: 'eSocial/evtAdmissao/ideEvento/indRetif', required: true, type: 'integer' },
    { path: 'eSocial/evtAdmissao/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtAdmissao/ideEvento/verProc', required: true },
    { path: 'eSocial/evtAdmissao/ideEmpregador/tpInsc', required: true, type: 'integer' },
    {
      path: 'eSocial/evtAdmissao/ideEmpregador/nrInsc',
      required: true,
      minLength: 8,
      maxLength: 14,
    },
    {
      path: 'eSocial/evtAdmissao/trabalhador/cpfTrab',
      required: true,
      minLength: 11,
      maxLength: 11,
      pattern: '^\\d{11}$',
    },
    {
      path: 'eSocial/evtAdmissao/trabalhador/nisTrab',
      required: true,
      minLength: 11,
      maxLength: 11,
    },
    { path: 'eSocial/evtAdmissao/trabalhador/nmTrab', required: true, minLength: 2, maxLength: 70 },
    { path: 'eSocial/evtAdmissao/vinculo/dtAdm', required: true, type: 'date' },
    { path: 'eSocial/evtAdmissao/vinculo/codCBO', required: true, minLength: 6, maxLength: 6 },
    { path: 'eSocial/evtAdmissao/vinculo/remuneracao/vrSalFx', required: true, type: 'decimal' },
    { path: 'eSocial/evtAdmissao/vinculo/remuneracao/undSalFixo', required: true, type: 'integer' },
  ],

  // ─── S-2206 evtAltContratual ──────────────────────────────────────────────
  'S-2206': [
    { path: 'eSocial/evtAltContratual/ideEvento/indRetif', required: true, type: 'integer' },
    { path: 'eSocial/evtAltContratual/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtAltContratual/ideEvento/verProc', required: true },
    { path: 'eSocial/evtAltContratual/ideEmpregador/tpInsc', required: true, type: 'integer' },
    {
      path: 'eSocial/evtAltContratual/ideEmpregador/nrInsc',
      required: true,
      minLength: 8,
      maxLength: 14,
    },
    {
      path: 'eSocial/evtAltContratual/ideTrabalhador/cpfTrab',
      required: true,
      minLength: 11,
      maxLength: 11,
      pattern: '^\\d{11}$',
    },
    { path: 'eSocial/evtAltContratual/altContratual/dtAlt', required: true, type: 'date' },
  ],

  // ─── S-2230 evtAfastTemp ──────────────────────────────────────────────────
  'S-2230': [
    { path: 'eSocial/evtAfastTemp/ideEvento/indRetif', required: true, type: 'integer' },
    { path: 'eSocial/evtAfastTemp/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtAfastTemp/ideEvento/verProc', required: true },
    { path: 'eSocial/evtAfastTemp/ideEmpregador/tpInsc', required: true, type: 'integer' },
    {
      path: 'eSocial/evtAfastTemp/ideEmpregador/nrInsc',
      required: true,
      minLength: 8,
      maxLength: 14,
    },
    {
      path: 'eSocial/evtAfastTemp/ideTrabalhador/cpfTrab',
      required: true,
      minLength: 11,
      maxLength: 11,
      pattern: '^\\d{11}$',
    },
    {
      path: 'eSocial/evtAfastTemp/infoAfastamento/iniAfastamento/dtIniAfast',
      required: true,
      type: 'date',
    },
    { path: 'eSocial/evtAfastTemp/infoAfastamento/iniAfastamento/codMotAfast', required: true },
  ],

  // ─── S-2299 evtDeslig ─────────────────────────────────────────────────────
  'S-2299': [
    { path: 'eSocial/evtDeslig/ideEvento/indRetif', required: true, type: 'integer' },
    { path: 'eSocial/evtDeslig/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtDeslig/ideEvento/verProc', required: true },
    { path: 'eSocial/evtDeslig/ideEmpregador/tpInsc', required: true, type: 'integer' },
    { path: 'eSocial/evtDeslig/ideEmpregador/nrInsc', required: true, minLength: 8, maxLength: 14 },
    {
      path: 'eSocial/evtDeslig/ideTrabalhador/cpfTrab',
      required: true,
      minLength: 11,
      maxLength: 11,
      pattern: '^\\d{11}$',
    },
    { path: 'eSocial/evtDeslig/infoDeslig/dtDeslig', required: true, type: 'date' },
    { path: 'eSocial/evtDeslig/infoDeslig/mtvDeslig', required: true },
  ],

  // ─── S-1200 evtRemun ──────────────────────────────────────────────────────
  'S-1200': [
    { path: 'eSocial/evtRemun/ideEvento/indRetif', required: true, type: 'integer' },
    {
      path: 'eSocial/evtRemun/ideEvento/perApur',
      required: true,
      minLength: 7,
      maxLength: 7,
      pattern: '^\\d{4}-\\d{2}$',
    },
    { path: 'eSocial/evtRemun/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtRemun/ideEvento/verProc', required: true },
    { path: 'eSocial/evtRemun/ideEmpregador/tpInsc', required: true, type: 'integer' },
    { path: 'eSocial/evtRemun/ideEmpregador/nrInsc', required: true, minLength: 8, maxLength: 14 },
    {
      path: 'eSocial/evtRemun/ideTrabalhador/cpfTrab',
      required: true,
      minLength: 11,
      maxLength: 11,
      pattern: '^\\d{11}$',
    },
    { path: 'eSocial/evtRemun/dmDev/ideDmDev', required: true },
    { path: 'eSocial/evtRemun/dmDev/codCateg', required: true },
  ],

  // ─── S-1210 evtPgtos ──────────────────────────────────────────────────────
  'S-1210': [
    { path: 'eSocial/evtPgtos/ideEvento/indRetif', required: true, type: 'integer' },
    {
      path: 'eSocial/evtPgtos/ideEvento/perApur',
      required: true,
      minLength: 7,
      maxLength: 7,
      pattern: '^\\d{4}-\\d{2}$',
    },
    { path: 'eSocial/evtPgtos/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtPgtos/ideEvento/verProc', required: true },
    { path: 'eSocial/evtPgtos/ideEmpregador/tpInsc', required: true, type: 'integer' },
    { path: 'eSocial/evtPgtos/ideEmpregador/nrInsc', required: true, minLength: 8, maxLength: 14 },
    {
      path: 'eSocial/evtPgtos/ideTrabalhador/cpfTrab',
      required: true,
      minLength: 11,
      maxLength: 11,
      pattern: '^\\d{11}$',
    },
    { path: 'eSocial/evtPgtos/infoPgto/ideDmDev', required: true },
    { path: 'eSocial/evtPgtos/infoPgto/dtPgto', required: true, type: 'date' },
  ],

  // ─── S-1299 evtFechaEvPer ─────────────────────────────────────────────────
  'S-1299': [
    { path: 'eSocial/evtFechaEvPer/ideEvento/indRetif', required: true, type: 'integer' },
    {
      path: 'eSocial/evtFechaEvPer/ideEvento/perApur',
      required: true,
      minLength: 7,
      maxLength: 7,
      pattern: '^\\d{4}-\\d{2}$',
    },
    { path: 'eSocial/evtFechaEvPer/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtFechaEvPer/ideEvento/verProc', required: true },
    { path: 'eSocial/evtFechaEvPer/ideEmpregador/tpInsc', required: true, type: 'integer' },
    {
      path: 'eSocial/evtFechaEvPer/ideEmpregador/nrInsc',
      required: true,
      minLength: 8,
      maxLength: 14,
    },
    {
      path: 'eSocial/evtFechaEvPer/ideRespInf/nmResp',
      required: true,
      minLength: 2,
      maxLength: 70,
    },
    { path: 'eSocial/evtFechaEvPer/ideEvtFech/indApuracao', required: true, type: 'integer' },
  ],

  // ─── S-2210 evtCAT ────────────────────────────────────────────────────────
  'S-2210': [
    { path: 'eSocial/evtCAT/ideEvento/indRetif', required: true, type: 'integer' },
    { path: 'eSocial/evtCAT/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtCAT/ideEvento/verProc', required: true },
    { path: 'eSocial/evtCAT/ideEmpregador/tpInsc', required: true, type: 'integer' },
    { path: 'eSocial/evtCAT/ideEmpregador/nrInsc', required: true, minLength: 8, maxLength: 14 },
    {
      path: 'eSocial/evtCAT/ideTrabalhador/cpfTrab',
      required: true,
      minLength: 11,
      maxLength: 11,
      pattern: '^\\d{11}$',
    },
    { path: 'eSocial/evtCAT/cat/dtAcid', required: true, type: 'date' },
    { path: 'eSocial/evtCAT/cat/tpAcid', required: true },
  ],

  // ─── S-2220 evtMonit ──────────────────────────────────────────────────────
  'S-2220': [
    { path: 'eSocial/evtMonit/ideEvento/indRetif', required: true, type: 'integer' },
    { path: 'eSocial/evtMonit/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtMonit/ideEvento/verProc', required: true },
    { path: 'eSocial/evtMonit/ideEmpregador/tpInsc', required: true, type: 'integer' },
    { path: 'eSocial/evtMonit/ideEmpregador/nrInsc', required: true, minLength: 8, maxLength: 14 },
    {
      path: 'eSocial/evtMonit/ideTrabalhador/cpfTrab',
      required: true,
      minLength: 11,
      maxLength: 11,
      pattern: '^\\d{11}$',
    },
    { path: 'eSocial/evtMonit/exMedOcup/tpExameOcup', required: true },
    { path: 'eSocial/evtMonit/exMedOcup/dtAso', required: true, type: 'date' },
    { path: 'eSocial/evtMonit/exMedOcup/medico/nrCRM', required: true },
    { path: 'eSocial/evtMonit/exMedOcup/medico/ufCRM', required: true, minLength: 2, maxLength: 2 },
    { path: 'eSocial/evtMonit/exMedOcup/resAso', required: true },
  ],

  // ─── S-2240 evtExpRisco ───────────────────────────────────────────────────
  'S-2240': [
    { path: 'eSocial/evtExpRisco/ideEvento/indRetif', required: true, type: 'integer' },
    { path: 'eSocial/evtExpRisco/ideEvento/procEmi', required: true, type: 'integer' },
    { path: 'eSocial/evtExpRisco/ideEvento/verProc', required: true },
    { path: 'eSocial/evtExpRisco/ideEmpregador/tpInsc', required: true, type: 'integer' },
    {
      path: 'eSocial/evtExpRisco/ideEmpregador/nrInsc',
      required: true,
      minLength: 8,
      maxLength: 14,
    },
    {
      path: 'eSocial/evtExpRisco/ideTrabalhador/cpfTrab',
      required: true,
      minLength: 11,
      maxLength: 11,
      pattern: '^\\d{11}$',
    },
    { path: 'eSocial/evtExpRisco/infoExpRisco/dtIniCondicao', required: true, type: 'date' },
  ],
};
