// ─── S-2299 Builder — evtDeslig ──────────────────────────────────────────────
// Desligamento
// Namespace: http://www.esocial.gov.br/schema/evt/evtDeslig/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtDeslig/v02_05_00';

// Termination reason mapping to eSocial motDeslig codes
const TERMINATION_REASON_MAP: Record<string, string> = {
  PEDIDO_DEMISSAO: '01', // pedido de demissão
  DEMISSAO_SEM_JUSTA_CAUSA: '03', // dispensa sem justa causa
  DEMISSAO_COM_JUSTA_CAUSA: '05', // dispensa com justa causa
  APOSENTADORIA: '21', // aposentadoria
  FALECIMENTO: '26', // falecimento
  TERMINO_CONTRATO: '02', // término de contrato a prazo determinado
  ACORDO_MUTUO: '11', // distrato
  OTHER: '99',
};

export interface S2299Input {
  termination: {
    id: string;
    terminationDate: Date | string;
    terminationReason?: string | null;
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

export function buildS2299(data: S2299Input): string {
  const { termination, employee, organization, seq = 1 } = data;
  const orgCnpj = (organization.cnpj ?? '').replace(/\D/g, '');
  const cpf = (employee.cpf ?? '').replace(/\D/g, '');

  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${orgCnpj}${timestamp}${String(seq).padStart(5, '0')}`;
  const termDate = toDate(termination.terminationDate);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  const evt = root.ele('evtDeslig', { Id: eventId });

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

  // infoDeslig
  const infoDeslig = evt.ele('infoDeslig');
  infoDeslig.ele('modDeslig').txt('1'); // 1 = sem justa causa
  infoDeslig.ele('dtDeslig').txt(formatDate(termDate));
  infoDeslig.ele('mtvDeslig').txt(
    TERMINATION_REASON_MAP[termination.terminationReason ?? ''] ?? '01',
  );

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
