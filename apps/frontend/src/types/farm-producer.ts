import type { ProducerType, ProducerStatus } from './producer';

export interface FarmProducerLink {
  id: string;
  farmId: string;
  producerId: string;
  bondType: string;
  participationPct: number | null;
  startDate: string | null;
  endDate: string | null;
  isItrDeclarant: boolean;
  createdAt: string;
  producer: {
    id: string;
    name: string;
    tradeName: string | null;
    type: ProducerType;
    document: string | null;
    status: ProducerStatus;
    stateRegistrations: Array<{
      id: string;
      number: string;
      state: string;
      situation: string | null;
      isDefaultForFarm: boolean;
    }>;
  };
  registrationLinks: Array<{
    id: string;
    farmRegistrationId: string;
    farmRegistration: {
      id: string;
      number: string;
      cartorioName: string;
    };
  }>;
}
