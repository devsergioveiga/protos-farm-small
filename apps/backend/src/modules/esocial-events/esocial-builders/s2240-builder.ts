// ─── S-2240 Builder — evtExpRisco ────────────────────────────────────────────
// Condições Ambientais do Trabalho — Agentes Nocivos
// Namespace: http://www.esocial.gov.br/schema/evt/evtExpRisco/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtExpRisco/v02_05_00';

export interface EpiItem {
  description: string;
  quantity?: number;
  epiCode?: string;
}

export interface S2240Input {
  epiDelivery: {
    id: string;
    deliveryDate: Date | string;
    items?: EpiItem[];
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

export function buildS2240(data: S2240Input): string {
  const { epiDelivery, employee, organization, seq = 1 } = data;
  const orgCnpj = (organization.cnpj ?? '').replace(/\D/g, '');
  const cpf = (employee.cpf ?? '').replace(/\D/g, '');

  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${orgCnpj}${timestamp}${String(seq).padStart(5, '0')}`;
  const deliveryDate = toDate(epiDelivery.deliveryDate);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  const evt = root.ele('evtExpRisco', { Id: eventId });

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

  // infoExpRisco
  const infoExpRisco = evt.ele('infoExpRisco');
  infoExpRisco.ele('dtIniCondicao').txt(formatDate(deliveryDate));

  // ambienteTrabalho — default values for rural environment
  const ambienteTrabalho = infoExpRisco.ele('ambienteTrabalho');
  ambienteTrabalho.ele('localAmb').txt('1'); // 1 = no estabelecimento do empregador
  ambienteTrabalho.ele('tpInsc').txt('1');
  ambienteTrabalho.ele('nrInsc').txt(orgCnpj);
  ambienteTrabalho.ele('codSetor').txt('01');

  // EPI entries
  const items = epiDelivery.items ?? [];
  if (items.length > 0) {
    items.forEach((item) => {
      const epiNode = infoExpRisco.ele('epc');
      epiNode.ele('dscEpc').txt(item.description.substring(0, 255));
    });
  }

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
