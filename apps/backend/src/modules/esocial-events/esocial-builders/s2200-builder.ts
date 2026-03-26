// ─── S-2200 Builder — evtAdmissao ────────────────────────────────────────────
// Admissão de Trabalhador
// Namespace: http://www.esocial.gov.br/schema/evt/evtAdmissao/v02_05_00

import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtAdmissao/v02_05_00';

export interface S2200Input {
  employee: {
    id: string;
    name: string;
    cpf: string;
    pisPassep?: string | null;
    birthDate: Date | string;
    admissionDate: Date | string;
    address?: {
      street?: string;
      number?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    } | null;
  };
  contract: {
    id?: string;
    salary: number;
    weeklyHours?: number;
    contractType?: string;
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
    cnae?: string;
  };
  seq?: number;
}

export function buildS2200(data: S2200Input): string {
  const { employee, contract, position, organization, seq = 1 } = data;
  const orgCnpj = (organization.cnpj ?? '').replace(/\D/g, '');
  const cpf = (employee.cpf ?? '').replace(/\D/g, '');
  const nis = (employee.pisPassep ?? '').replace(/\D/g, '');

  const now = new Date();
  const timestamp = formatTimestamp(now);
  const eventId = `ID1${orgCnpj}${timestamp}${String(seq).padStart(5, '0')}`;

  const admDate = toDate(employee.admissionDate);
  const birthDate = toDate(employee.birthDate);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', { xmlns: NS });

  const evt = root.ele('evtAdmissao', { Id: eventId });

  // ─── ideEvento ───────────────────────────────────────────────────────────
  const ideEvento = evt.ele('ideEvento');
  ideEvento.ele('indRetif').txt('1'); // 1 = original
  ideEvento.ele('procEmi').txt('1'); // 1 = app do contribuinte
  ideEvento.ele('verProc').txt('1.0.0');

  // ─── ideEmpregador ───────────────────────────────────────────────────────
  const ideEmpregador = evt.ele('ideEmpregador');
  ideEmpregador.ele('tpInsc').txt('1'); // 1 = CNPJ
  ideEmpregador.ele('nrInsc').txt(orgCnpj.substring(0, 8)); // CNPJ raiz

  // ─── trabalhador ─────────────────────────────────────────────────────────
  const trabalhador = evt.ele('trabalhador');
  trabalhador.ele('cpfTrab').txt(cpf);
  trabalhador.ele('nisTrab').txt(nis);
  trabalhador.ele('nmTrab').txt(employee.name);
  trabalhador.ele('sexo').txt('M'); // default M (would need gender field)
  trabalhador.ele('racaCor').txt('0'); // 0 = não informado
  trabalhador.ele('estCiv').txt('0'); // 0 = não informado
  trabalhador.ele('grauInstr').txt('01'); // 01 = sem instrução (default)
  trabalhador.ele('nmSoc').txt(''); // nome social (optional)

  const nascimento = trabalhador.ele('nascimento');
  nascimento.ele('dtNascimento').txt(formatDate(birthDate));
  nascimento.ele('codMunic').txt(''); // município de nascimento
  nascimento.ele('paisNasc').txt('105'); // 105 = Brasil

  trabalhador.ele('paisNac').txt('105'); // 105 = Brasil

  const endereco = trabalhador.ele('endereco');
  const brasil = endereco.ele('brasil');
  brasil.ele('tpLograd').txt('R'); // R = Rua
  brasil.ele('dscLograd').txt(employee.address?.street ?? 'Endereço não informado');
  brasil.ele('nrLograd').txt(employee.address?.number ?? 'SN');
  brasil.ele('bairro').txt(''); // bairro
  brasil.ele('cep').txt((employee.address?.zipCode ?? '00000000').replace(/\D/g, ''));
  brasil.ele('codMunic').txt(''); // código IBGE do município
  brasil.ele('uf').txt(employee.address?.state ?? 'SP');

  // ─── vinculo ─────────────────────────────────────────────────────────────
  const vinculo = evt.ele('vinculo');

  const matricula = vinculo.ele('matRegJMT');
  matricula.txt(employee.id.substring(0, 30));

  const tpRegTrab = vinculo.ele('tpRegTrab');
  tpRegTrab.txt('1'); // 1 = CLT

  const tpRegPrev = vinculo.ele('tpRegPrev');
  tpRegPrev.txt('1'); // 1 = RGPS

  const dtAdm = vinculo.ele('dtAdm');
  dtAdm.txt(formatDate(admDate));

  vinculo.ele('indAdmissao').txt('1'); // 1 = normal

  // Cargo / CBO
  const cargo = vinculo.ele('cargo');
  cargo.ele('nmCargo').txt(position.name);
  cargo.ele('codCBO').txt(position.cbo ?? '999999');

  // Remuneração
  const remuneracao = vinculo.ele('remuneracao');
  remuneracao.ele('vrSalFx').txt(Number(contract.salary).toFixed(2));
  remuneracao.ele('undSalFixo').txt('5'); // 5 = mensalista
  remuneracao.ele('dscSalVar').txt('');

  // Duração do contrato
  const duracao = vinculo.ele('duracao');
  duracao.ele('tpContr').txt('1'); // 1 = prazo indeterminado

  // Horário de trabalho
  const horContratual = vinculo.ele('horContratual');
  horContratual.ele('qtdHrsSem').txt(String(contract.weeklyHours ?? 44));
  horContratual.ele('tpJornada').txt('2'); // 2 = jornada parcial
  horContratual.ele('dscJorn').txt('');

  // Categoria do trabalhador
  vinculo.ele('codCateg').txt('101'); // 101 = empregado em geral

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
