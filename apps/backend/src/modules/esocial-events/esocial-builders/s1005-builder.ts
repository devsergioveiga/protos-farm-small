// ─── S-1005 Builder — evtTabEstab ────────────────────────────────────────────
// Tabela de Estabelecimentos, Obras ou Unidades de Órgãos Públicos
// Namespace: http://www.esocial.gov.br/schema/evt/evtTabEstab/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtTabEstab/v02_05_00';

export interface S1005Input {
  farm: {
    id: string;
    name: string;
    cnpj?: string;
    cnae?: string;
    state?: string;
    city?: string;
  };
  organization: {
    id: string;
    cnpj: string;
    name: string;
  };
  seq?: number;
}

export function buildS1005(data: S1005Input): string {
  const { farm, organization, seq = 1 } = data;
  const orgCnpj = (organization.cnpj ?? '').replace(/\D/g, '');
  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${orgCnpj}${timestamp}${String(seq).padStart(5, '0')}`;

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  const evt = root.ele('evtTabEstab', { Id: eventId });

  // ideEvento
  const ideEvento = evt.ele('ideEvento');
  ideEvento.ele('indRetif').txt('1');
  ideEvento.ele('procEmi').txt('1');
  ideEvento.ele('verProc').txt('1.0.0');

  // ideEmpregador
  const ideEmpregador = evt.ele('ideEmpregador');
  ideEmpregador.ele('tpInsc').txt('1');
  ideEmpregador.ele('nrInsc').txt(orgCnpj.substring(0, 8));

  // infoEstab
  const infoEstab = evt.ele('infoEstab');
  const inclusao = infoEstab.ele('inclusao');

  const ideEstab = inclusao.ele('ideEstab');
  ideEstab.ele('tpInsc').txt('1');
  ideEstab.ele('nrInsc').txt(farm.cnpj ? farm.cnpj.replace(/\D/g, '') : orgCnpj);

  const dadosEstab = inclusao.ele('dadosEstab');
  dadosEstab.ele('cnaePrep').txt(farm.cnae ?? '0111301');
  dadosEstab.ele('aliqRat').txt('3.00'); // RAT default 3%
  dadosEstab.ele('aliqRatAjust').txt('3.00');

  return doc.end({ prettyPrint: false });
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
