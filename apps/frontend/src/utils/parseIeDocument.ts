// ─── State name → UF code mapping ──────────────────────────────────
const STATE_NAME_TO_UF: Record<string, string> = {
  ACRE: 'AC',
  ALAGOAS: 'AL',
  AMAZONAS: 'AM',
  AMAPA: 'AP',
  AMAPÁ: 'AP',
  BAHIA: 'BA',
  CEARA: 'CE',
  CEARÁ: 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES',
  'ESPÍRITO SANTO': 'ES',
  GOIAS: 'GO',
  GOIÁS: 'GO',
  MARANHAO: 'MA',
  MARANHÃO: 'MA',
  'MINAS GERAIS': 'MG',
  'MATO GROSSO DO SUL': 'MS',
  'MATO GROSSO': 'MT',
  PARA: 'PA',
  PARÁ: 'PA',
  PARAIBA: 'PB',
  PARAÍBA: 'PB',
  PERNAMBUCO: 'PE',
  PIAUI: 'PI',
  PIAUÍ: 'PI',
  PARANA: 'PR',
  PARANÁ: 'PR',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  RONDONIA: 'RO',
  RONDÔNIA: 'RO',
  RORAIMA: 'RR',
  'RIO GRANDE DO SUL': 'RS',
  'SANTA CATARINA': 'SC',
  SERGIPE: 'SE',
  'SAO PAULO': 'SP',
  'SÃO PAULO': 'SP',
  TOCANTINS: 'TO',
};

function resolveUF(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return STATE_NAME_TO_UF[upper] ?? '';
}

// ─── Date parsing: DD/MM/YYYY → YYYY-MM-DD ─────────────────────────
function parseBrDate(raw: string): string {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// ─── Category mapping ──────────────────────────────────────────────
function mapCategory(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (upper.includes('PRIMEIRO')) return 'PRIMEIRO_ESTABELECIMENTO';
  if (upper.includes('UNICO') || upper.includes('ÚNICO')) return 'UNICO';
  if (upper.includes('DEMAIS')) return 'DEMAIS';
  return '';
}

// ─── Situation mapping ─────────────────────────────────────────────
function mapSituation(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (upper === 'ATIVO' || upper === 'ATIVA') return 'ACTIVE';
  if (upper.startsWith('SUSPEND') || upper.startsWith('SUSPENS')) return 'SUSPENDED';
  if (upper.startsWith('CANCEL')) return 'CANCELLED';
  return '';
}

// ─── Parsed result types ───────────────────────────────────────────

export interface ParsedProducerData {
  name: string;
  cpf: string;
  tradeName: string;
  street: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  district: string;
  locationReference: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface ParsedParticipant {
  cpf: string;
  name: string;
}

export interface ParsedIeData {
  number: string;
  state: string;
  situation: string;
  category: string;
  inscriptionDate: string;
  contractEndDate: string;
  cnaeActivity: string;
  assessmentRegime: string;
  milkProgramOptIn: boolean;
}

export interface ParsedIeDocument {
  producer: ParsedProducerData;
  ie: ParsedIeData;
  participants: ParsedParticipant[];
  isSociedadeEmComum: boolean;
}

// ─── Position-based text item ──────────────────────────────────────

interface TextItem {
  str: string;
  x: number;
  y: number;
}

// ─── Text extraction with positions ────────────────────────────────

async function extractTextItems(file: File): Promise<TextItem[]> {
  const pdfjsLib = await import('pdfjs-dist');
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const items: TextItem[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const str = item.str.trim();
      if (!str) continue;
      // transform[4] = x, transform[5] = y
      const tx = item.transform as number[];
      items.push({ str, x: tx[4], y: tx[5] });
    }
  }

  return items;
}

// ─── Position-based field extraction ───────────────────────────────

/**
 * In SEFAZ IE PDFs, labels and values are at different y-coordinates.
 * A label at y=720 has its value at y≈705 (about 15 units below).
 * We find a label by text, then look for the value item(s) that are:
 *   - ~15 units below the label (lower y value since PDF y goes bottom-up)
 *   - In the same x region
 */

function findItemByText(items: TextItem[], text: string): TextItem | undefined {
  const upper = text.toUpperCase();
  // Prefer exact match first
  const exact = items.find((it) => it.str.trim().toUpperCase() === upper);
  if (exact) return exact;
  // Then startsWith
  const starts = items.find((it) => it.str.trim().toUpperCase().startsWith(upper));
  if (starts) return starts;
  // Fallback to includes
  return items.find((it) => it.str.toUpperCase().includes(upper));
}

function findItemExact(items: TextItem[], text: string): TextItem | undefined {
  return items.find((it) => it.str.trim().toUpperCase() === text.toUpperCase());
}

function findValueBelow(
  items: TextItem[],
  labelY: number,
  labelX: number,
  maxDeltaY = 20,
  xTolerance = 80,
): string {
  // Value is below the label: lower y value (PDF coords), same x region
  const candidates = items.filter((it) => {
    const dy = labelY - it.y;
    const dx = Math.abs(it.x - labelX);
    return dy > 2 && dy < maxDeltaY && dx < xTolerance;
  });

  if (candidates.length === 0) return '';

  // Sort by proximity (closest y first)
  candidates.sort((a, b) => labelY - a.y - (labelY - b.y));
  return candidates[0].str.trim();
}

function findValueRight(
  items: TextItem[],
  labelY: number,
  labelX: number,
  labelWidth: number,
  yTolerance = 5,
): string {
  // Value is to the right of label, same y line
  const candidates = items.filter((it) => {
    const dy = Math.abs(it.y - labelY);
    return dy < yTolerance && it.x > labelX + labelWidth * 0.5;
  });

  if (candidates.length === 0) return '';
  candidates.sort((a, b) => a.x - b.x);
  return candidates[0].str.trim();
}

// ─── Main parser ───────────────────────────────────────────────────

export async function parseIeDocument(file: File): Promise<ParsedIeDocument> {
  const items = await extractTextItems(file);

  // Separate known labels from values
  const fullText = items.map((it) => it.str).join('\n');
  const isSociedadeEmComum = fullText.includes('PARTICIPANTES DA SOCIEDADE EM COMUM');

  // Helper to find label then its value below
  function getValueForLabel(labelText: string): string {
    const label = findItemByText(items, labelText);
    if (!label) return '';
    return findValueBelow(items, label.y, label.x);
  }

  // ─── Dados Cadastrais ─────────────────────────────────────────

  // IE Number: exact match "INSCRIÇÃO ESTADUAL" (not "COMPROVANTE DE INSCRIÇÃO...")
  const ieLabel = findItemExact(items, 'INSCRIÇÃO ESTADUAL');
  const ieNumber = ieLabel ? findValueBelow(items, ieLabel.y, ieLabel.x) : '';

  // CPF: label "CPF" in the dados cadastrais section (y > 700)
  const cpfLabel = items.find((it) => it.str.trim() === 'CPF' && it.y > 650);
  const cpf = cpfLabel ? findValueBelow(items, cpfLabel.y, cpfLabel.x) : '';

  // Nome do Responsável
  const name = getValueForLabel('NOME DO RESPONSÁVEL') || getValueForLabel('NOME DO RESPONSAVEL');

  // Nome do Estabelecimento
  const tradeName =
    getValueForLabel('NOME DO ESTABELECIMENTO / PROPRIEDADE RURAL') ||
    getValueForLabel('NOME DO ESTABELECIMENTO');

  // CNAE - value is below the label
  const cnaeLabel = findItemByText(items, 'CNAE/DESCRI');
  const cnaeActivity = cnaeLabel ? findValueBelow(items, cnaeLabel.y, cnaeLabel.x, 20, 400) : '';

  // Regime de Apuração - value is below
  const regimeLabel = findItemByText(items, 'REGIME DE APURA');
  const assessmentRegime = regimeLabel
    ? findValueBelow(items, regimeLabel.y, regimeLabel.x, 20, 200)
    : '';

  // Categoria - value is below
  const catLabel = items.find((it) => it.str.trim() === 'CATEGORIA');
  const categoryRaw = catLabel ? findValueBelow(items, catLabel.y, catLabel.x, 20, 200) : '';
  const category = mapCategory(categoryRaw);

  // Data da Inscrição
  const insDateLabel =
    findItemByText(items, 'DATA DA INSCRIÇÃO') || findItemByText(items, 'DATA DA INSCRICAO');
  const inscriptionDateRaw = insDateLabel
    ? findValueBelow(items, insDateLabel.y, insDateLabel.x)
    : '';
  const inscriptionDate = parseBrDate(inscriptionDateRaw);

  // Data do Fim do Contrato
  const contractLabel = findItemByText(items, 'DATA DO FIM DO CONTRATO');
  const contractEndRaw = contractLabel
    ? findValueBelow(items, contractLabel.y, contractLabel.x)
    : '';
  const contractEndDate = parseBrDate(contractEndRaw);

  // Situação da Inscrição (exact match to avoid "DATA DA SITUAÇÃO DA INSCRIÇÃO")
  const sitLabel =
    findItemExact(items, 'SITUAÇÃO DA INSCRIÇÃO') || findItemExact(items, 'SITUACAO DA INSCRICAO');
  const situationRaw = sitLabel ? findValueBelow(items, sitLabel.y, sitLabel.x) : '';
  const situation = mapSituation(situationRaw);

  // Milk program: "OPTANTE PELO PROGRAMA DE LEITE :" followed by "Sim"/"Não" on same line
  const milkLabel = findItemByText(items, 'OPTANTE PELO PROGRAMA DE LEITE');
  let milkProgramOptIn = false;
  if (milkLabel) {
    const milkVal = findValueRight(items, milkLabel.y, milkLabel.x, 250);
    milkProgramOptIn = milkVal.toUpperCase() === 'SIM';
  }

  // ─── Endereço ─────────────────────────────────────────────────

  const cepLabel = items.find((it) => it.str.trim() === 'CEP');
  const zipCode = cepLabel ? findValueBelow(items, cepLabel.y, cepLabel.x) : '';

  const ufLabel = items.find((it) => it.str.trim() === 'UF');
  const ufRaw = ufLabel ? findValueBelow(items, ufLabel.y, ufLabel.x, 20, 150) : '';
  const state = resolveUF(ufRaw);

  const munLabel = findItemByText(items, 'MUNICÍPIO') || findItemByText(items, 'MUNICIPIO');
  const city = munLabel ? findValueBelow(items, munLabel.y, munLabel.x) : '';

  const distLabel = findItemByText(items, 'DISTRITO/POVOADO');
  const districtRaw = distLabel ? findValueBelow(items, distLabel.y, distLabel.x) : '';
  const district = districtRaw === '--' ? '' : districtRaw;

  const bairroLabel = findItemByText(items, 'BAIRRO');
  const neighborhood = bairroLabel ? findValueBelow(items, bairroLabel.y, bairroLabel.x) : '';

  const logLabel = findItemByText(items, 'LOGRADOURO');
  const street = logLabel ? findValueBelow(items, logLabel.y, logLabel.x) : '';

  const numLabel = items.find((it) => it.str.trim() === 'NÚMERO' || it.str.trim() === 'NUMERO');
  const addressNumber = numLabel ? findValueBelow(items, numLabel.y, numLabel.x) : '';

  const compLabel = items.find((it) => it.str.trim() === 'COMPLEMENTO');
  const complement = compLabel ? findValueBelow(items, compLabel.y, compLabel.x) : '';

  const refLabel =
    findItemByText(items, 'REFERÊNCIA DE LOCALIZAÇÃO') ||
    findItemByText(items, 'REFERENCIA DE LOCALIZACAO');
  const locationReference = refLabel ? findValueBelow(items, refLabel.y, refLabel.x, 30, 400) : '';

  // ─── Participantes ────────────────────────────────────────────

  const participants: ParsedParticipant[] = [];
  if (isSociedadeEmComum) {
    // Participant rows are below the PARTICIPANTES header.
    // Each row has CPF (x≈62) and Name (x≈185) at the same y.
    const partHeader = findItemByText(items, 'PARTICIPANTES DA SOCIEDADE EM COMUM');
    if (partHeader) {
      // Find CPF items below the header with CPF pattern
      const cpfPattern = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
      const partCpfs = items.filter(
        (it) => cpfPattern.test(it.str.trim()) && it.y < partHeader.y && it.y > 50,
      );

      for (const cpfItem of partCpfs) {
        // Find name on same y line, to the right
        const nameItem = items.find(
          (it) =>
            Math.abs(it.y - cpfItem.y) < 3 &&
            it.x > cpfItem.x + 50 &&
            !cpfPattern.test(it.str.trim()) &&
            it.str.trim().length > 1,
        );
        if (nameItem) {
          participants.push({
            cpf: cpfItem.str.trim(),
            name: nameItem.str.trim(),
          });
        }
      }
    }
  }

  return {
    producer: {
      name,
      cpf,
      tradeName,
      street,
      addressNumber,
      complement,
      neighborhood,
      district,
      locationReference,
      city,
      state,
      zipCode,
    },
    ie: {
      number: ieNumber,
      state,
      situation,
      category,
      inscriptionDate,
      contractEndDate,
      cnaeActivity,
      assessmentRegime,
      milkProgramOptIn,
    },
    participants,
    isSociedadeEmComum,
  };
}
