// ─── S-2210 Builder — evtCAT ─────────────────────────────────────────────────
// Comunicação de Acidente de Trabalho (CAT)
// Namespace: http://www.esocial.gov.br/schema/evt/evtCAT/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtCAT/v02_05_00';

export interface S2210Input {
  absence: {
    id: string;
    absenceType: string;
    startDate: Date | string;
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

export function buildS2210(data: S2210Input): string {
  const { absence, employee, organization, seq = 1 } = data;
  const orgCnpj = (organization.cnpj ?? '').replace(/\D/g, '');
  const cpf = (employee.cpf ?? '').replace(/\D/g, '');

  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${orgCnpj}${timestamp}${String(seq).padStart(5, '0')}`;
  const accidentDate = toDate(absence.startDate);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  const evt = root.ele('evtCAT', { Id: eventId });

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

  // cat
  const cat = evt.ele('cat');
  cat.ele('dtAcid').txt(formatDate(accidentDate));
  cat.ele('tpAcid').txt('1'); // 1 = típico
  cat.ele('hrAcid').txt('0800');
  cat.ele('hrsTrabAnteAcid').txt('08');
  cat.ele('tpCat').txt('1'); // 1 = inicial

  const localAcidente = cat.ele('localAcidente');
  localAcidente.ele('tpLocal').txt('1'); // 1 = no estabelecimento
  localAcidente.ele('nrInsc').txt(orgCnpj);
  localAcidente.ele('tpInsc').txt('1');

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
