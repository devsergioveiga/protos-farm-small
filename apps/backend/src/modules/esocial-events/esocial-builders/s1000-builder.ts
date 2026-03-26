// ─── S-1000 Builder — evtInfoEmpregador ──────────────────────────────────────
// Informações do Empregador/Contribuinte/Órgão Público
// Namespace: http://www.esocial.gov.br/schema/evt/evtInfoEmpregador/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtInfoEmpregador/v02_05_00';

export interface S1000Input {
  organization: {
    id: string;
    name: string;
    cnpj: string;
    cnae?: string;
    state?: string;
    city?: string;
  };
  seq?: number;
}

export function buildS1000(data: S1000Input): string {
  const { organization, seq = 1 } = data;
  const cnpj = (organization.cnpj ?? '').replace(/\D/g, '');
  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${cnpj}${timestamp}${String(seq).padStart(5, '0')}`;

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  // evtInfoEmpregador
  const evt = root.ele('evtInfoEmpregador', { Id: eventId });

  // ideEvento
  const ideEvento = evt.ele('ideEvento');
  ideEvento.ele('indRetif').txt('1'); // 1 = original
  ideEvento.ele('procEmi').txt('1'); // 1 = app do contribuinte
  ideEvento.ele('verProc').txt('1.0.0');

  // ideEmpregador
  const ideEmpregador = evt.ele('ideEmpregador');
  ideEmpregador.ele('tpInsc').txt('1'); // 1 = CNPJ
  ideEmpregador.ele('nrInsc').txt(cnpj.substring(0, 8)); // CNPJ raiz (8 digits)

  // infoEmpregador
  const infoEmpregador = evt.ele('infoEmpregador');
  const inclusao = infoEmpregador.ele('inclusao');
  const ideEmpregadorInc = inclusao.ele('ideEmpregador');
  ideEmpregadorInc.ele('tpInsc').txt('1');
  ideEmpregadorInc.ele('nrInsc').txt(cnpj);

  const dadosEmpregador = inclusao.ele('dadosEmpregador');
  dadosEmpregador.ele('nmRazao').txt(organization.name);
  dadosEmpregador.ele('classTrib').txt('99'); // 99 = outros (default)
  dadosEmpregador.ele('natJurid').txt('2143'); // S.A. aberta (default)

  if (organization.cnae) {
    dadosEmpregador.ele('cnaePrep').txt(organization.cnae);
  }

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
