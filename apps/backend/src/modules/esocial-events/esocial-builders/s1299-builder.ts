// ─── S-1299 Builder — evtFechaEvPer ──────────────────────────────────────────
// Fechamento dos Eventos Periódicos
// Namespace: http://www.esocial.gov.br/schema/evt/evtFechaEvPer/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtFechaEvPer/v02_05_00';

export interface S1299Input {
  payrollRun: {
    id: string;
    referenceMonth: Date | string;
    organization?: {
      cnpj?: string;
    };
  };
  organization: {
    id: string;
    cnpj: string;
    name: string;
  };
  seq?: number;
}

export function buildS1299(data: S1299Input): string {
  const { payrollRun, organization, seq = 1 } = data;
  const orgCnpj = (organization.cnpj ?? '').replace(/\D/g, '');

  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${orgCnpj}${timestamp}${String(seq).padStart(5, '0')}`;

  const refMonth = toDate(payrollRun.referenceMonth);
  const perApur = formatYearMonth(refMonth);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  const evt = root.ele('evtFechaEvPer', { Id: eventId });

  // ideEvento
  const ideEvento = evt.ele('ideEvento');
  ideEvento.ele('indRetif').txt('1');
  ideEvento.ele('perApur').txt(perApur);
  ideEvento.ele('procEmi').txt('1');
  ideEvento.ele('verProc').txt('1.0.0');

  // ideEmpregador
  const ideEmpregador = evt.ele('ideEmpregador');
  ideEmpregador.ele('tpInsc').txt('1');
  ideEmpregador.ele('nrInsc').txt(orgCnpj.substring(0, 8));

  // ideRespInf
  const ideRespInf = evt.ele('ideRespInf');
  ideRespInf.ele('nmResp').txt(organization.name.substring(0, 70));
  ideRespInf.ele('cpfResp').txt(''); // responsável pelo preenchimento
  ideRespInf.ele('telefone').txt('');

  // ideEvtFech
  const ideEvtFech = evt.ele('ideEvtFech');
  ideEvtFech.ele('indApuracao').txt('1'); // 1 = mensal

  return doc.end({ prettyPrint: false });
}

function toDate(val: Date | string): Date {
  return val instanceof Date ? val : new Date(val);
}

function formatYearMonth(d: Date): string {
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${Y}-${M}`;
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
