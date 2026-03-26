// ─── S-1010 Builder — evtTabRubrica ──────────────────────────────────────────
// Tabela de Rubricas
// Namespace: http://www.esocial.gov.br/schema/evt/evtTabRubrica/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtTabRubrica/v02_05_00';

export interface S1010Input {
  rubrica: {
    id: string;
    code: string;
    name: string;
    eSocialCode?: string | null;
    rubricaType: string;
  };
  organization: {
    id: string;
    cnpj: string;
    name: string;
  };
  seq?: number;
}

export function buildS1010(data: S1010Input): string {
  const { rubrica, organization, seq = 1 } = data;
  const orgCnpj = (organization.cnpj ?? '').replace(/\D/g, '');
  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${orgCnpj}${timestamp}${String(seq).padStart(5, '0')}`;

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  const evt = root.ele('evtTabRubrica', { Id: eventId });

  // ideEvento
  const ideEvento = evt.ele('ideEvento');
  ideEvento.ele('indRetif').txt('1');
  ideEvento.ele('procEmi').txt('1');
  ideEvento.ele('verProc').txt('1.0.0');

  // ideEmpregador
  const ideEmpregador = evt.ele('ideEmpregador');
  ideEmpregador.ele('tpInsc').txt('1');
  ideEmpregador.ele('nrInsc').txt(orgCnpj.substring(0, 8));

  // infoRubrica
  const infoRubrica = evt.ele('infoRubrica');
  const inclusao = infoRubrica.ele('inclusao');

  const ideRubrica = inclusao.ele('ideRubrica');
  ideRubrica.ele('codRubr').txt(rubrica.code);
  ideRubrica.ele('ideTabRubr').txt('S'); // S = própria

  const dadosRubrica = inclusao.ele('dadosRubrica');
  dadosRubrica.ele('dscRubr').txt(rubrica.name);
  dadosRubrica.ele('natRubr').txt(rubrica.eSocialCode ?? '9999');

  // Map rubricaType to tpRubr
  const tpRubr = rubrica.rubricaType === 'DESCONTO' ? '2' : '1'; // 1=provento, 2=desconto
  dadosRubrica.ele('tpRubr').txt(tpRubr);

  dadosRubrica.ele('codIncCP').txt('00'); // não incide
  dadosRubrica.ele('codIncIRRF').txt('00');
  dadosRubrica.ele('codIncFGTS').txt('00');

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
