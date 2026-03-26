// ─── S-2220 Builder — evtMonit ───────────────────────────────────────────────
// Monitoramento da Saúde do Trabalhador (ASO)
// Namespace: http://www.esocial.gov.br/schema/evt/evtMonit/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtMonit/v02_05_00';

// ASO type mapping to eSocial tpExameOcup codes
const ASO_TYPE_MAP: Record<string, string> = {
  ADMISSIONAL: '0', // admissional
  PERIODICO: '1', // periódico
  RETORNO_TRABALHO: '2', // retorno ao trabalho
  MUDANCA_RISCO: '3', // mudança de função
  DEMISSIONAL: '4', // demissional
  // Legacy keys
  ADMISSION: '0',
  PERIODIC: '1',
  RETURN: '2',
  ROLE_CHANGE: '3',
  DISMISSAL: '4',
};

// ASO result mapping
const ASO_RESULT_MAP: Record<string, string> = {
  APTO: '1', // apto
  INAPTO: '0', // inapto
  APTO_COM_RESTRICAO: '2', // apto com restrição
};

export interface S2220Input {
  exam: {
    id: string;
    type: string;
    date: Date | string;
    doctorName: string;
    doctorCrm: string;
    doctorState?: string;
    result: string;
    restrictions?: string | null;
  };
  employee: {
    id: string;
    name: string;
    cpf: string;
    pisPassep?: string | null;
  };
  organization: {
    id: string;
    cnpj: string;
    name: string;
  };
  seq?: number;
}

export function buildS2220(data: S2220Input): string {
  const { exam, employee, organization, seq = 1 } = data;
  const orgCnpj = (organization.cnpj ?? '').replace(/\D/g, '');
  const cpf = (employee.cpf ?? '').replace(/\D/g, '');

  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${orgCnpj}${timestamp}${String(seq).padStart(5, '0')}`;
  const examDate = toDate(exam.date);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  const evt = root.ele('evtMonit', { Id: eventId });

  // ideEvento
  const ideEvento = evt.ele('ideEvento');
  ideEvento.ele('indRetif').txt('1');
  ideEvento.ele('procEmi').txt('1');
  ideEvento.ele('verProc').txt('1.0.0');

  // ideEmpregador
  const ideEmpregador = evt.ele('ideEmpregador');
  ideEmpregador.ele('tpInsc').txt('1');
  ideEmpregador.ele('nrInsc').txt(orgCnpj.substring(0, 8));

  // ideTrabalhador
  const ideTrabalhador = evt.ele('ideTrabalhador');
  ideTrabalhador.ele('cpfTrab').txt(cpf);

  // exMedOcup
  const exMedOcup = evt.ele('exMedOcup');
  exMedOcup.ele('tpExameOcup').txt(ASO_TYPE_MAP[exam.type] ?? '0');
  exMedOcup.ele('dtAso').txt(formatDate(examDate));

  // medico responsável pelo ASO
  const medico = exMedOcup.ele('medico');
  medico.ele('nmMed').txt(exam.doctorName);
  medico.ele('nrCRM').txt(exam.doctorCrm);
  medico.ele('ufCRM').txt(exam.doctorState ?? 'SP');

  // resultado do ASO
  exMedOcup.ele('resAso').txt(ASO_RESULT_MAP[exam.result] ?? '1');

  return doc.end({ prettyPrint: false });
}

function toDate(val: Date | string): Date {
  return val instanceof Date ? val : new Date(val);
}

function formatDate(d: Date): string {
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, '0');
  const D = String(d.getUTCDate()).padStart(2, '0');
  return `${Y}-${M}-${D}`;
}

function formatTimestamp(d: Date): string {
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, '0');
  const D = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${Y}${M}${D}${h}${m}${s}`;
}
