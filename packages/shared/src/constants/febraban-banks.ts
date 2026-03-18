// Source: BCB/FEBRABAN directory. Verify at https://www.bcb.gov.br/pom/spb/estatistica/port/ASTR003.pdf

/** A bank listed in the FEBRABAN/BCB ISPB directory. */
export interface FebrabanBank {
  /** COMPE/FEBRABAN 3-digit bank code */
  code: string;
  /** Full official name */
  name: string;
  /** Short display name */
  shortName: string;
}

export const FEBRABAN_BANKS: FebrabanBank[] = [
  // Major public/private banks
  { code: '001', name: 'Banco do Brasil S.A.', shortName: 'BB' },
  { code: '033', name: 'Banco Santander (Brasil) S.A.', shortName: 'Santander' },
  { code: '041', name: 'Banco do Estado do Rio Grande do Sul S.A.', shortName: 'Banrisul' },
  { code: '047', name: 'Banco do Estado de Sergipe S.A.', shortName: 'Banese' },
  { code: '070', name: 'BRB - Banco de Brasília S.A.', shortName: 'BRB' },
  { code: '077', name: 'Banco Inter S.A.', shortName: 'Inter' },
  {
    code: '084',
    name: 'Uniprime Norte do Paraná - Coop de Economia e Crédito Mútuo',
    shortName: 'Uniprime Norte PR',
  },
  { code: '085', name: 'Cooperativa Central de Crédito Urbano - CECRED', shortName: 'Cecred' },
  { code: '097', name: 'Credisis - Central das Cooperativas de Crédito', shortName: 'Credisis' },
  { code: '104', name: 'Caixa Econômica Federal', shortName: 'Caixa' },
  { code: '121', name: 'Banco Agibank S.A.', shortName: 'Agibank' },
  { code: '133', name: 'Cresol Confederação', shortName: 'Cresol' },
  { code: '136', name: 'Unicred do Brasil', shortName: 'Unicred' },
  { code: '208', name: 'BTG Pactual S.A.', shortName: 'BTG' },
  { code: '212', name: 'Banco Original S.A.', shortName: 'Original' },
  { code: '237', name: 'Banco Bradesco S.A.', shortName: 'Bradesco' },
  { code: '246', name: 'Banco ABC Brasil S.A.', shortName: 'ABC Brasil' },
  { code: '260', name: 'Nu Pagamentos S.A. (Nubank)', shortName: 'Nubank' },
  { code: '290', name: 'PagBank (PagSeguro Internet S.A.)', shortName: 'PagBank' },
  { code: '318', name: 'Banco BMG S.A.', shortName: 'BMG' },
  { code: '336', name: 'Banco C6 S.A.', shortName: 'C6' },
  { code: '341', name: 'Itaú Unibanco S.A.', shortName: 'Itaú' },
  { code: '364', name: 'Gerencianet Pagamentos do Brasil Ltda (Efí)', shortName: 'Efí' },
  { code: '380', name: 'PicPay Serviços S.A.', shortName: 'PicPay' },
  { code: '384', name: 'Global SCM S.A.', shortName: 'Global SCM' },
  { code: '389', name: 'Banco Mercantil do Brasil S.A.', shortName: 'Mercantil' },
  { code: '422', name: 'Banco Safra S.A.', shortName: 'Safra' },
  { code: '505', name: 'Banco Credit Suisse (Brasil) S.A.', shortName: 'Credit Suisse' },
  { code: '633', name: 'Banco Rendimento S.A.', shortName: 'Rendimento' },
  { code: '655', name: 'Banco Votorantim S.A. (BV)', shortName: 'BV' },
  { code: '707', name: 'Banco Daycoval S.A.', shortName: 'Daycoval' },
  { code: '735', name: 'Banco Neon S.A.', shortName: 'Neon' },
  { code: '741', name: 'Banco Ribeirão Preto S.A.', shortName: 'Ribeirão Preto' },
  { code: '745', name: 'Citibank N.A.', shortName: 'Citi' },
  // Rural cooperatives — critical for agro sector
  { code: '748', name: 'Sicredi - Cooperativa de Crédito', shortName: 'Sicredi' },
  {
    code: '756',
    name: 'Sicoob - Sistema de Cooperativas de Crédito do Brasil',
    shortName: 'Sicoob',
  },
  { code: '136', name: 'Unicred do Brasil Ltda', shortName: 'Unicred Brasil' },
  // Additional digital banks and payment institutions
  { code: '323', name: 'Mercado Pago S.A.', shortName: 'Mercado Pago' },
  { code: '403', name: 'Cora Sociedade de Crédito Direto S.A.', shortName: 'Cora' },
  {
    code: '461',
    name: 'Asaas Gestão Financeira Instituição de Pagamento S.A.',
    shortName: 'Asaas',
  },
  { code: '332', name: 'Acesso Soluções de Pagamento S.A.', shortName: 'Acesso' },
];

// Remove any duplicate codes (defensive — keep last occurrence wins)
const _seen = new Set<string>();
const _unique = FEBRABAN_BANKS.filter((b) => {
  if (_seen.has(b.code)) return false;
  _seen.add(b.code);
  return true;
});

// Re-assign to make FEBRABAN_BANKS deduplicated
(FEBRABAN_BANKS as FebrabanBank[]).splice(0, FEBRABAN_BANKS.length, ..._unique);

export const FEBRABAN_BANK_MAP: Map<string, FebrabanBank> = new Map(
  FEBRABAN_BANKS.map((b) => [b.code, b]),
);
