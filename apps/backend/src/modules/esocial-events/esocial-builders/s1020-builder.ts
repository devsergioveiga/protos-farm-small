// ─── S-1020 Builder — evtTabLotacao ──────────────────────────────────────────
// Tabela de Lotações Tributárias
// Namespace: http://www.esocial.gov.br/schema/evt/evtTabLotacao/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtTabLotacao/v02_05_00';

export interface S1020Input {
  position: {
    id: string;
    name: string;
    cbo?: string | null;
  };
  organization: {
    id: string;
    cnpj: string;
    name: string;
    cnae?: string;
  };
  seq?: number;
}

export function buildS1020(data: S1020Input): string {
  const { position, organization, seq = 1 } = data;
  const orgCnpj = (organization.cnpj ?? '').replace(/\D/g, '');
  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${orgCnpj}${timestamp}${String(seq).padStart(5, '0')}`;

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  const evt = root.ele('evtTabLotacao', { Id: eventId });

  // ideEvento
  const ideEvento = evt.ele('ideEvento');
  ideEvento.ele('indRetif').txt('1');
  ideEvento.ele('procEmi').txt('1');
  ideEvento.ele('verProc').txt('1.0.0');

  // ideEmpregador
  const ideEmpregador = evt.ele('ideEmpregador');
  ideEmpregador.ele('tpInsc').txt('1');
  ideEmpregador.ele('nrInsc').txt(orgCnpj.substring(0, 8));

  // infoLotacao
  const infoLotacao = evt.ele('infoLotacao');
  const inclusao = infoLotacao.ele('inclusao');

  const ideLotacao = inclusao.ele('ideLotacao');
  ideLotacao.ele('codLotacao').txt(position.id.substring(0, 30));

  const dadosLotacao = inclusao.ele('dadosLotacao');
  dadosLotacao.ele('tpLotacao').txt('01'); // 01 = sem cessão/sem ajuste
  dadosLotacao.ele('tpInsc').txt('1');
  dadosLotacao.ele('nrInsc').txt(orgCnpj);

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
