// ─── Error ──────────────────────────────────────────────────────────

export class OperationTypeError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'OperationTypeError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const MAX_LEVELS = 3;

export const LEVEL_1_CATEGORIES = [
  'Preparo de Solo',
  'Plantio',
  'Tratos Culturais',
  'Colheita',
  'Pós-Colheita',
  'Manejo de Pastagem',
] as const;

export const ALL_CROPS = [
  'Soja',
  'Milho',
  'Algodão',
  'Feijão',
  'Trigo',
  'Arroz',
  'Café',
  'Cana-de-açúcar',
  'Laranja',
  'Sorgo',
  'Girassol',
  'Amendoim',
  'Pastagem',
  'Todas',
] as const;

// ─── Field Configuration ────────────────────────────────────────────

export type FieldVisibility = 'required' | 'optional' | 'hidden';

export const OPERATION_FIELD_KEYS = [
  'product',
  'dose',
  'volume',
  'machine',
  'implement',
  'operator',
  'depth',
  'spacing',
  'seedRate',
  'plantPopulation',
  'weather',
  'soilMoisture',
  'notes',
  'photos',
  'litersPerPerson',
  'harvestWeight',
  'area',
] as const;

export type OperationFieldKey = (typeof OPERATION_FIELD_KEYS)[number];

export const OPERATION_FIELD_LABELS: Record<OperationFieldKey, string> = {
  product: 'Produto/Insumo',
  dose: 'Dose (kg/ha ou L/ha)',
  volume: 'Volume de calda (L/ha)',
  machine: 'Máquina',
  implement: 'Implemento',
  operator: 'Operador',
  depth: 'Profundidade (cm)',
  spacing: 'Espaçamento (cm)',
  seedRate: 'Taxa de semeadura (kg/ha)',
  plantPopulation: 'População de plantas',
  weather: 'Condições climáticas',
  soilMoisture: 'Umidade do solo',
  notes: 'Observações',
  photos: 'Fotos',
  litersPerPerson: 'Litros por pessoa',
  harvestWeight: 'Peso da colheita',
  area: 'Área trabalhada',
};

export interface FieldConfig {
  fieldKey: OperationFieldKey;
  visibility: FieldVisibility;
  sortOrder: number;
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateOperationTypeInput {
  name: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  crops?: string[];
  fields?: FieldConfig[];
}

export type UpdateOperationTypeInput = Partial<CreateOperationTypeInput>;

export interface ListOperationTypesQuery {
  parentId?: string | null;
  level?: number;
  search?: string;
  includeInactive?: boolean;
  crop?: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface OperationTypeItem {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  childCount: number;
  crops: string[];
  fields: FieldConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface OperationTypeTreeNode extends OperationTypeItem {
  children: OperationTypeTreeNode[];
}

// ─── CA6: Crop Operation Sequence Types ─────────────────────────────

export interface CropOperationSequenceItem {
  id: string;
  organizationId: string;
  crop: string;
  operationTypeId: string;
  operationTypeName: string;
  sequenceOrder: number;
  notes: string | null;
}

export interface SetCropSequenceInput {
  crop: string;
  items: Array<{
    operationTypeId: string;
    notes?: string | null;
  }>;
}

// ─── CA7: Operation Schedule Types ──────────────────────────────────

export type ScheduleType = 'fixed_date' | 'phenological';

export interface OperationScheduleItem {
  id: string;
  organizationId: string;
  operationTypeId: string;
  operationTypeName: string;
  crop: string;
  scheduleType: ScheduleType;
  startDay: number | null;
  startMonth: number | null;
  endDay: number | null;
  endMonth: number | null;
  phenoStage: string | null;
  offsetDays: number | null;
  notes: string | null;
}

export interface SetScheduleInput {
  operationTypeId: string;
  crop: string;
  scheduleType: ScheduleType;
  startDay?: number | null;
  startMonth?: number | null;
  endDay?: number | null;
  endMonth?: number | null;
  phenoStage?: string | null;
  offsetDays?: number | null;
  notes?: string | null;
}

export interface ListSchedulesQuery {
  crop?: string;
  operationTypeId?: string;
  scheduleType?: ScheduleType;
}

// ─── CA8: Phenological Stages ───────────────────────────────────────

export interface PhenologicalStageItem {
  id: string;
  organizationId: string;
  crop: string;
  code: string;
  name: string;
  description: string | null;
  stageOrder: number;
  isSystem: boolean;
}

export interface CreatePhenologicalStageInput {
  crop: string;
  code: string;
  name: string;
  description?: string | null;
  stageOrder: number;
}

export interface UpdatePhenologicalStageInput {
  code?: string;
  name?: string;
  description?: string | null;
  stageOrder?: number;
}

interface DefaultStage {
  code: string;
  name: string;
  description?: string;
}

interface DefaultCropStages {
  crop: string;
  stages: DefaultStage[];
}

export const DEFAULT_CROP_PHENOLOGICAL_STAGES: DefaultCropStages[] = [
  {
    crop: 'Milho',
    stages: [
      { code: 'VE', name: 'Emergência', description: 'Coleóptilo visível na superfície' },
      { code: 'V1', name: 'Primeira folha', description: '1 folha com colar visível' },
      { code: 'V2', name: 'Segunda folha', description: '2 folhas com colar visível' },
      { code: 'V3', name: 'Terceira folha', description: '3 folhas com colar visível' },
      { code: 'V4', name: 'Quarta folha', description: '4 folhas com colar visível' },
      {
        code: 'V6',
        name: 'Sexta folha',
        description: '6 folhas — ponto de crescimento acima do solo',
      },
      { code: 'V8', name: 'Oitava folha', description: '8 folhas — início definição espigas' },
      { code: 'V10', name: 'Décima folha', description: '10 folhas — rápido crescimento' },
      {
        code: 'V12',
        name: 'Décima segunda folha',
        description: '12 folhas — determinação de fileiras',
      },
      { code: 'V15', name: 'Décima quinta folha', description: '15 folhas — pré-pendoamento' },
      {
        code: 'V18',
        name: 'Décima oitava folha',
        description: '18 folhas — última fase vegetativa',
      },
      { code: 'VT', name: 'Pendoamento', description: 'Última ramificação do pendão visível' },
      { code: 'R1', name: 'Espigamento', description: 'Estilo-estigma (cabelo) visível' },
      { code: 'R2', name: "Bolha d'água", description: 'Grãos com líquido claro (bolha)' },
      { code: 'R3', name: 'Leitoso', description: 'Grãos com líquido leitoso' },
      { code: 'R4', name: 'Pastoso', description: 'Grãos com consistência pastosa' },
      { code: 'R5', name: 'Formação de dente', description: 'Início da formação do dente' },
      {
        code: 'R6',
        name: 'Maturação fisiológica',
        description: 'Camada preta formada — máximo acúmulo de MS',
      },
    ],
  },
  {
    crop: 'Soja',
    stages: [
      { code: 'VE', name: 'Emergência', description: 'Cotilédones acima do solo' },
      { code: 'VC', name: 'Cotilédone', description: 'Folhas unifolioladas abertas' },
      { code: 'V1', name: 'Primeiro nó', description: 'Primeira folha trifoliolada aberta' },
      { code: 'V2', name: 'Segundo nó', description: 'Segunda folha trifoliolada aberta' },
      { code: 'V3', name: 'Terceiro nó', description: 'Terceira folha trifoliolada aberta' },
      { code: 'V4', name: 'Quarto nó', description: 'Quarta folha trifoliolada aberta' },
      { code: 'V5', name: 'Quinto nó', description: 'Quinta folha trifoliolada aberta' },
      { code: 'V6', name: 'Sexto nó', description: 'Sexta folha trifoliolada aberta' },
      { code: 'R1', name: 'Início florescimento', description: 'Uma flor aberta em qualquer nó' },
      { code: 'R2', name: 'Florescimento pleno', description: 'Flor aberta nos 2 últimos nós' },
      { code: 'R3', name: 'Início formação vagens', description: 'Vagem com 5mm em nó superior' },
      { code: 'R4', name: 'Vagem completa', description: 'Vagem com 2cm em nó superior' },
      { code: 'R5', name: 'Início enchimento', description: 'Grão de 3mm em vagem superior' },
      { code: 'R6', name: 'Grão cheio', description: 'Vagem com grãos verdes preenchidos' },
      { code: 'R7', name: 'Início maturação', description: 'Uma vagem com cor de madura' },
      { code: 'R8', name: 'Maturação plena', description: '95% das vagens com cor de madura' },
    ],
  },
  {
    crop: 'Café',
    stages: [
      { code: 'VEG', name: 'Vegetativo', description: 'Crescimento de ramos e folhas' },
      { code: 'FLO', name: 'Florada', description: 'Abertura das flores' },
      { code: 'CHU', name: 'Chumbinho', description: 'Frutos recém-formados, muito pequenos' },
      { code: 'EXP', name: 'Expansão', description: 'Crescimento rápido dos frutos' },
      { code: 'GRA', name: 'Granação', description: 'Formação do grão dentro do fruto' },
      { code: 'MAT', name: 'Maturação', description: 'Frutos mudando de cor (verde → cereja)' },
      { code: 'REP', name: 'Repouso', description: 'Dormência pós-colheita' },
    ],
  },
  {
    crop: 'Laranja',
    stages: [
      { code: 'DOR', name: 'Dormência', description: 'Repouso vegetativo (inverno/seca)' },
      { code: 'BRO', name: 'Brotação', description: 'Início do crescimento vegetativo' },
      { code: 'FLO', name: 'Floração', description: 'Abertura das flores' },
      { code: 'FRU', name: 'Fixação de frutos', description: 'Queda fisiológica e fixação' },
      { code: 'CRE', name: 'Crescimento dos frutos', description: 'Expansão celular dos frutos' },
      { code: 'MAT', name: 'Maturação', description: 'Acúmulo de açúcares e mudança de cor' },
      { code: 'COL', name: 'Colheita', description: 'Frutos maduros prontos para colheita' },
    ],
  },
  {
    crop: 'Pastagem',
    stages: [
      {
        code: 'BRO',
        name: 'Brotação/Rebrota',
        description: 'Início do crescimento após corte ou seca',
      },
      { code: 'PER', name: 'Perfilhamento', description: 'Formação de novos perfilhos' },
      { code: 'ELO', name: 'Elongação', description: 'Crescimento dos colmos' },
      { code: 'FLO', name: 'Florescimento', description: 'Emissão de inflorescência' },
      { code: 'SEN', name: 'Senescência', description: 'Envelhecimento e morte das folhas' },
    ],
  },
  {
    crop: 'Feijão',
    stages: [
      { code: 'V0', name: 'Germinação', description: 'Semente absorvendo água' },
      { code: 'V1', name: 'Emergência', description: 'Cotilédones acima do solo' },
      { code: 'V2', name: 'Folhas primárias', description: 'Folhas primárias abertas' },
      {
        code: 'V3',
        name: 'Primeira trifoliolada',
        description: 'Primeira folha trifoliolada aberta',
      },
      {
        code: 'V4',
        name: 'Terceira trifoliolada',
        description: 'Terceira folha trifoliolada aberta',
      },
      { code: 'R5', name: 'Pré-floração', description: 'Primeiro botão floral' },
      { code: 'R6', name: 'Floração', description: 'Primeira flor aberta' },
      {
        code: 'R7',
        name: 'Formação de vagens',
        description: 'Primeira vagem com comprimento máximo',
      },
      { code: 'R8', name: 'Enchimento de vagens', description: 'Primeira vagem com grão cheio' },
      { code: 'R9', name: 'Maturação', description: 'Mudança de cor das vagens' },
    ],
  },
  {
    crop: 'Trigo',
    stages: [
      { code: 'GS10', name: 'Emergência', description: 'Primeira folha visível' },
      { code: 'GS13', name: 'Três folhas', description: 'Três folhas abertas' },
      { code: 'GS21', name: 'Perfilhamento', description: 'Início do perfilhamento' },
      { code: 'GS30', name: 'Elongação', description: 'Início da elongação do colmo' },
      {
        code: 'GS39',
        name: 'Folha bandeira',
        description: 'Folha bandeira completamente expandida',
      },
      { code: 'GS50', name: 'Espigamento', description: 'Espiga começando a emergir' },
      { code: 'GS61', name: 'Antese', description: 'Florescimento/polinização' },
      { code: 'GS71', name: 'Grão leitoso', description: 'Grão com conteúdo leitoso' },
      { code: 'GS85', name: 'Grão pastoso', description: 'Grão com massa pastosa' },
      { code: 'GS92', name: 'Maturação', description: 'Grão duro, ponto de colheita' },
    ],
  },
];

// ─── CA6: Default Crop Sequences ────────────────────────────────────

interface DefaultSequenceItem {
  operationName: string;
  notes?: string;
}

interface DefaultCropSequence {
  crop: string;
  items: DefaultSequenceItem[];
}

export const DEFAULT_CROP_SEQUENCES: DefaultCropSequence[] = [
  {
    crop: 'Café',
    items: [
      { operationName: 'Poda', notes: 'Após colheita ou no inverno' },
      { operationName: 'Calagem', notes: 'Correção de solo' },
      { operationName: 'Adubação de cobertura', notes: 'Início das chuvas' },
      { operationName: 'Pulverização', notes: 'Controle fitossanitário' },
      { operationName: 'Capina manual', notes: 'Manutenção das ruas' },
      { operationName: 'Roçada', notes: 'Entrelinhas' },
      { operationName: 'Arruação', notes: 'Preparo para colheita' },
      { operationName: 'Derriça', notes: 'Colheita dos frutos' },
      { operationName: 'Varrição', notes: 'Recolhimento do café do chão' },
      { operationName: 'Lavagem', notes: 'Pós-colheita' },
      { operationName: 'Secagem', notes: 'Terreiro ou secador' },
      { operationName: 'Beneficiamento', notes: 'Descascamento/classificação' },
    ],
  },
  {
    crop: 'Soja',
    items: [
      { operationName: 'Calagem', notes: 'Correção 60-90 dias antes do plantio' },
      { operationName: 'Gessagem', notes: 'Se necessário, junto com calagem' },
      { operationName: 'Dessecação', notes: '10-15 dias pré-plantio' },
      { operationName: 'Tratamento de sementes', notes: 'Inoculação + fungicida' },
      { operationName: 'Plantio mecanizado', notes: 'Início da janela de plantio' },
      { operationName: 'Adubação de cobertura', notes: 'Se necessário, V3-V4' },
      { operationName: 'Pulverização', notes: 'Herbicida pós-emergente' },
      { operationName: 'Pulverização', notes: 'Fungicida preventivo' },
      { operationName: 'Colheita mecanizada', notes: 'Maturação fisiológica' },
      { operationName: 'Secagem', notes: 'Se umidade acima de 14%' },
      { operationName: 'Armazenagem', notes: 'Grãos secos e limpos' },
    ],
  },
  {
    crop: 'Milho',
    items: [
      { operationName: 'Calagem', notes: 'Correção de solo' },
      { operationName: 'Gradagem pesada', notes: 'Incorporação de corretivos' },
      { operationName: 'Gradagem leve', notes: 'Nivelamento' },
      { operationName: 'Tratamento de sementes', notes: 'Inseticida + fungicida' },
      { operationName: 'Plantio mecanizado', notes: 'Com adubação de base' },
      { operationName: 'Pulverização', notes: 'Herbicida pré/pós-emergente' },
      { operationName: 'Adubação de cobertura', notes: 'Nitrogênio em V4-V6' },
      { operationName: 'Pulverização', notes: 'Inseticida se necessário' },
      { operationName: 'Colheita mecanizada', notes: 'Grão seco no campo' },
      { operationName: 'Secagem', notes: 'Se necessário' },
      { operationName: 'Armazenagem', notes: 'Grãos secos' },
    ],
  },
  {
    crop: 'Pastagem',
    items: [
      { operationName: 'Roçada de pastagem', notes: 'Uniformização' },
      { operationName: 'Calagem', notes: 'Correção de solo se necessário' },
      { operationName: 'Adubação de pastagem', notes: 'Início das chuvas' },
      { operationName: 'Controle de invasoras', notes: 'Herbicida seletivo' },
      { operationName: 'Vedação de piquete', notes: 'Descanso para recuperação' },
      { operationName: 'Reforma de pastagem', notes: 'Quando degradação severa' },
    ],
  },
  {
    crop: 'Laranja',
    items: [
      { operationName: 'Poda', notes: 'Limpeza e condução' },
      { operationName: 'Calagem', notes: 'Correção de solo' },
      { operationName: 'Adubação de cobertura', notes: 'Parcelada 3-4x/ano' },
      { operationName: 'Pulverização', notes: 'Controle fitossanitário' },
      { operationName: 'Roçada', notes: 'Entrelinhas' },
      { operationName: 'Desbrota', notes: 'Remoção de brotações indesejadas' },
      { operationName: 'Irrigação', notes: 'Se necessário na seca' },
      { operationName: 'Colheita manual', notes: 'Frutos maduros' },
    ],
  },
];

// ─── Seed Data ──────────────────────────────────────────────────────

interface SeedChild {
  name: string;
  crops: string[];
  sortOrder: number;
  children?: SeedChild[];
}

interface SeedCategory {
  name: string;
  crops: string[];
  sortOrder: number;
  children: SeedChild[];
}

export const DEFAULT_OPERATION_TYPES: SeedCategory[] = [
  {
    name: 'Preparo de Solo',
    crops: ['Todas'],
    sortOrder: 1,
    children: [
      { name: 'Aração', crops: ['Todas'], sortOrder: 1 },
      { name: 'Gradagem leve', crops: ['Todas'], sortOrder: 2 },
      { name: 'Gradagem pesada', crops: ['Todas'], sortOrder: 3 },
      { name: 'Subsolagem', crops: ['Todas'], sortOrder: 4 },
      { name: 'Escarificação', crops: ['Todas'], sortOrder: 5 },
      { name: 'Calagem', crops: ['Todas'], sortOrder: 6 },
      { name: 'Gessagem', crops: ['Todas'], sortOrder: 7 },
      { name: 'Dessecação', crops: ['Soja', 'Milho', 'Feijão', 'Algodão'], sortOrder: 8 },
    ],
  },
  {
    name: 'Plantio',
    crops: ['Todas'],
    sortOrder: 2,
    children: [
      { name: 'Plantio mecanizado', crops: ['Todas'], sortOrder: 1 },
      { name: 'Plantio manual', crops: ['Café', 'Laranja'], sortOrder: 2 },
      { name: 'Replantio', crops: ['Todas'], sortOrder: 3 },
      {
        name: 'Tratamento de sementes',
        crops: ['Soja', 'Milho', 'Feijão', 'Algodão', 'Trigo', 'Arroz'],
        sortOrder: 4,
      },
    ],
  },
  {
    name: 'Tratos Culturais',
    crops: ['Todas'],
    sortOrder: 3,
    children: [
      {
        name: 'Adubação',
        crops: ['Todas'],
        sortOrder: 1,
        children: [
          { name: 'Adubação de cobertura', crops: ['Todas'], sortOrder: 1 },
          { name: 'Adubação foliar', crops: ['Todas'], sortOrder: 2 },
          { name: 'Fertirrigação', crops: ['Café', 'Laranja', 'Cana-de-açúcar'], sortOrder: 3 },
        ],
      },
      { name: 'Pulverização', crops: ['Todas'], sortOrder: 2 },
      { name: 'Capina manual', crops: ['Café', 'Laranja'], sortOrder: 3 },
      { name: 'Roçada', crops: ['Café', 'Pastagem', 'Laranja'], sortOrder: 4 },
      { name: 'Irrigação', crops: ['Todas'], sortOrder: 5 },
      { name: 'Poda', crops: ['Café', 'Laranja'], sortOrder: 6 },
      { name: 'Desbrota', crops: ['Café', 'Laranja'], sortOrder: 7 },
    ],
  },
  {
    name: 'Colheita',
    crops: ['Todas'],
    sortOrder: 4,
    children: [
      {
        name: 'Colheita mecanizada',
        crops: ['Soja', 'Milho', 'Algodão', 'Feijão', 'Trigo', 'Arroz', 'Cana-de-açúcar', 'Sorgo'],
        sortOrder: 1,
      },
      { name: 'Colheita manual', crops: ['Café', 'Laranja'], sortOrder: 2 },
      { name: 'Derriça', crops: ['Café'], sortOrder: 3 },
      { name: 'Varrição', crops: ['Café'], sortOrder: 4 },
      { name: 'Arruação', crops: ['Café'], sortOrder: 5 },
    ],
  },
  {
    name: 'Pós-Colheita',
    crops: ['Todas'],
    sortOrder: 5,
    children: [
      {
        name: 'Secagem',
        crops: ['Soja', 'Milho', 'Café', 'Feijão', 'Trigo', 'Arroz'],
        sortOrder: 1,
      },
      { name: 'Beneficiamento', crops: ['Café', 'Arroz'], sortOrder: 2 },
      { name: 'Armazenagem', crops: ['Todas'], sortOrder: 3 },
      { name: 'Lavagem', crops: ['Café'], sortOrder: 4 },
    ],
  },
  {
    name: 'Manejo de Pastagem',
    crops: ['Pastagem'],
    sortOrder: 6,
    children: [
      { name: 'Roçada de pastagem', crops: ['Pastagem'], sortOrder: 1 },
      { name: 'Adubação de pastagem', crops: ['Pastagem'], sortOrder: 2 },
      { name: 'Vedação de piquete', crops: ['Pastagem'], sortOrder: 3 },
      { name: 'Reforma de pastagem', crops: ['Pastagem'], sortOrder: 4 },
      { name: 'Controle de invasoras', crops: ['Pastagem'], sortOrder: 5 },
    ],
  },
];
