// ─── S-1200 Builder — evtRemun ───────────────────────────────────────────────
// Remuneração do Trabalhador
// Namespace: http://www.esocial.gov.br/schema/evt/evtRemun/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtRemun/v02_05_00';

export interface LineItem {
  code: string;
  description: string;
  type: string;
  value: string | number;
  eSocialCode?: string | null;
}

export interface S1200Input {
  item: {
    id: string;
    payrollRunId: string;
    lineItemsJson: string | null;
    employee: {
      id: string;
      name: string;
      cpf: string;
      pisPassep?: string | null;
    };
    payrollRun?: {
      referenceMonth: Date | string;
    };
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

export function buildS1200(data: S1200Input): string {
  const { item, employee, organization, seq = 1 } = data;
  const orgCnpj = (organization.cnpj ?? '').replace(/\D/g, '');
  const cpf = (employee.cpf ?? '').replace(/\D/g, '');

  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${orgCnpj}${timestamp}${String(seq).padStart(5, '0')}`;

  // Parse line items and filter those with eSocialCode
  const allItems: LineItem[] = item.lineItemsJson ? JSON.parse(item.lineItemsJson) : [];
  const esocialItems = allItems.filter((li) => li.eSocialCode != null && li.eSocialCode !== '');

  // Get reference month (perApur)
  const refMonth = item.payrollRun?.referenceMonth
    ? toDate(item.payrollRun.referenceMonth)
    : new Date();
  const perApur = formatYearMonth(refMonth);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  const evt = root.ele('evtRemun', { Id: eventId });

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

  // ideTrabalhador
  const ideTrabalhador = evt.ele('ideTrabalhador');
  ideTrabalhador.ele('cpfTrab').txt(cpf);

  // dmDev (demonstrativo de devoluções)
  const dmDev = evt.ele('dmDev');
  dmDev.ele('ideDmDev').txt('1');
  dmDev.ele('codCateg').txt('101'); // 101 = empregado geral

  // itensRemun — one per rubrica with eSocialCode
  esocialItems.forEach((li) => {
    const item = dmDev.ele('itensRemun');
    item.ele('codRubr').txt(li.code);
    item.ele('ideTabRubr').txt('S'); // S = própria
    item.ele('qtdRubr').txt('1');
    item.ele('fatorRubr').txt('1.00');
    item.ele('vrRubr').txt(Number(li.value).toFixed(2));
    item.ele('indApurIR').txt('0'); // 0 = normal
  });

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
