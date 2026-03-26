// ─── S-2206 Builder — evtAltContratual ───────────────────────────────────────
// Alteração de Contrato de Trabalho
// Namespace: http://www.esocial.gov.br/schema/evt/evtAltContratual/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtAltContratual/v02_05_00';

export interface S2206Input {
  amendment: {
    id: string;
    effectiveAt: Date | string;
    changes: Record<string, { from: unknown; to: unknown }>;
  };
  employee: {
    id: string;
    name: string;
    cpf: string;
    pisPassep?: string | null;
  };
  contract: {
    salary?: number;
    weeklyHours?: number;
  };
  position: {
    id: string;
    name: string;
    cbo?: string | null;
  };
  organization: {
    id: string;
    cnpj: string;
    name: string;
  };
  seq?: number;
}

export function buildS2206(data: S2206Input): string {
  const { amendment, employee, contract, position, organization, seq = 1 } = data;
  const orgCnpj = (organization.cnpj ?? '').replace(/\D/g, '');
  const cpf = (employee.cpf ?? '').replace(/\D/g, '');

  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${orgCnpj}${timestamp}${String(seq).padStart(5, '0')}`;
  const effectiveAt = toDate(amendment.effectiveAt);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  const evt = root.ele('evtAltContratual', { Id: eventId });

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

  // altContratual
  const altContratual = evt.ele('altContratual');
  altContratual.ele('dtAlt').txt(formatDate(effectiveAt));

  // Remuneração
  if (contract.salary !== undefined) {
    const remuneracao = altContratual.ele('remuneracao');
    remuneracao.ele('vrSalFx').txt(Number(contract.salary).toFixed(2));
    remuneracao.ele('undSalFixo').txt('5'); // mensalista
  }

  // Cargo
  if (position.cbo) {
    const cargo = altContratual.ele('cargo');
    cargo.ele('nmCargo').txt(position.name);
    cargo.ele('codCBO').txt(position.cbo);
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
