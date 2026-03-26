// ─── S-2230 Builder — evtAfastTemp ───────────────────────────────────────────
// Afastamento Temporário
// Namespace: http://www.esocial.gov.br/schema/evt/evtAfastTemp/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtAfastTemp/v02_05_00';

// Absence type mapping to eSocial motAfast codes
const ABSENCE_TYPE_MAP: Record<string, string> = {
  MEDICAL_CERTIFICATE: '01', // doença
  INSS_LEAVE: '01', // doença (acidente/doença)
  WORK_ACCIDENT: '03', // acidente trabalho
  MATERNITY: '06', // maternidade
  PATERNITY: '19', // paternidade
  MARRIAGE: '16', // casamento
  BEREAVEMENT: '18', // falecimento
  MILITARY: '25', // serviço militar
  OTHER: '31', // outros
};

export interface S2230Input {
  absence: {
    id: string;
    absenceType: string;
    startDate: Date | string;
    endDate?: Date | string | null;
    catNumber?: string | null;
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

export function buildS2230(data: S2230Input): string {
  const { absence, employee, organization, seq = 1 } = data;
  const orgCnpj = (organization.cnpj ?? '').replace(/\D/g, '');
  const cpf = (employee.cpf ?? '').replace(/\D/g, '');

  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${orgCnpj}${timestamp}${String(seq).padStart(5, '0')}`;
  const startDate = toDate(absence.startDate);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  const evt = root.ele('evtAfastTemp', { Id: eventId });

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

  // infoAfastamento
  const infoAfastamento = evt.ele('infoAfastamento');
  const iniAfastamento = infoAfastamento.ele('iniAfastamento');
  iniAfastamento.ele('dtIniAfast').txt(formatDate(startDate));
  iniAfastamento.ele('codMotAfast').txt(ABSENCE_TYPE_MAP[absence.absenceType] ?? '31');

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
