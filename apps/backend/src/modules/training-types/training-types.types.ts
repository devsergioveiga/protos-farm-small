export class TrainingTypeError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'TrainingTypeError';
  }
}

export const INSTRUCTOR_TYPES = ['INTERNO', 'EXTERNO'] as const;
export type InstructorType = (typeof INSTRUCTOR_TYPES)[number];

export interface CreateTrainingTypeInput {
  name: string;
  description?: string;
  minHours: number;
  defaultValidityMonths: number;
  nrReference?: string;
  isGlobal?: boolean;
}

export interface UpdateTrainingTypeInput {
  name?: string;
  description?: string;
  minHours?: number;
  defaultValidityMonths?: number;
  nrReference?: string;
  isGlobal?: boolean;
}

export interface TrainingTypeOutput {
  id: string;
  name: string;
  description: string | null;
  minHours: number;
  defaultValidityMonths: number;
  nrReference: string | null;
  isSystem: boolean;
  isGlobal: boolean;
  organizationId: string | null;
  createdAt: string;
}

export interface CreatePositionTrainingRequirementInput {
  positionId: string;
  trainingTypeId: string;
}

export interface PositionTrainingRequirementOutput {
  id: string;
  positionId: string;
  positionName: string;
  trainingTypeId: string;
  trainingTypeName: string;
}

// NR-31 seed data constant
export const NR31_TRAINING_TYPES = [
  {
    name: 'Integração',
    nrReference: 'NR-31.7',
    minHours: 8,
    defaultValidityMonths: 12,
    isSystem: true,
    isGlobal: true,
  },
  {
    name: 'Agrotóxicos',
    nrReference: 'NR-31.8',
    minHours: 20,
    defaultValidityMonths: 12,
    isSystem: true,
    isGlobal: false,
  },
  {
    name: 'Máquinas e Implementos',
    nrReference: 'NR-31.12',
    minHours: 16,
    defaultValidityMonths: 24,
    isSystem: true,
    isGlobal: false,
  },
  {
    name: 'Instalações Elétricas',
    nrReference: 'NR-31.9',
    minHours: 40,
    defaultValidityMonths: 24,
    isSystem: true,
    isGlobal: false,
  },
  {
    name: 'Transporte de Trabalhadores',
    nrReference: 'NR-31.13',
    minHours: 8,
    defaultValidityMonths: 12,
    isSystem: true,
    isGlobal: false,
  },
  {
    name: 'Trabalho em Altura',
    nrReference: 'NR-35',
    minHours: 8,
    defaultValidityMonths: 24,
    isSystem: true,
    isGlobal: false,
  },
  {
    name: 'CIPA Rural',
    nrReference: 'NR-31.7.3',
    minHours: 20,
    defaultValidityMonths: 12,
    isSystem: true,
    isGlobal: false,
  },
] as const;
