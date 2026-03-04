import { CROP_COLORS } from '@/components/map/FarmMap';

export const SOIL_TYPE_OPTIONS = [
  { value: 'LATOSSOLO_VERMELHO', label: 'Latossolo Vermelho' },
  { value: 'LATOSSOLO_AMARELO', label: 'Latossolo Amarelo' },
  { value: 'ARGISSOLO', label: 'Argissolo' },
  { value: 'NEOSSOLO', label: 'Neossolo' },
  { value: 'CAMBISSOLO', label: 'Cambissolo' },
  { value: 'GLEISSOLO', label: 'Gleissolo' },
  { value: 'PLANOSSOLO', label: 'Planossolo' },
  { value: 'NITOSSOLO', label: 'Nitossolo' },
  { value: 'OUTRO', label: 'Outro' },
];

export const CROP_SUGGESTIONS = Object.keys(CROP_COLORS).filter((k) => k !== 'Sem cultura');

export const SEASON_TYPE_OPTIONS = [
  { value: 'SAFRA', label: 'Safra' },
  { value: 'SAFRINHA', label: 'Safrinha' },
  { value: 'INVERNO', label: 'Inverno' },
];
