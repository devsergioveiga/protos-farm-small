import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReproductiveRecordItem, ReproductiveStats } from '@/types/animal';

const FARM_ID = 'farm-1';
const ANIMAL_ID = 'animal-1';

const MOCK_RECORDS: ReproductiveRecordItem[] = [
  {
    id: 'r1',
    animalId: ANIMAL_ID,
    farmId: FARM_ID,
    type: 'HEAT',
    eventDate: '2026-01-15',
    notes: null,
    recordedBy: 'user-1',
    recorderName: 'Admin',
    approvedBy: null,
    criteriaDetails: null,
    heatIntensity: 'MODERATE',
    intervalDays: 21,
    plannedSireId: null,
    plannedSireName: null,
    breedingMethod: null,
    plannedDate: null,
    sireId: null,
    sireName: null,
    semenBatch: null,
    technicianName: null,
    confirmationMethod: null,
    confirmationDate: null,
    expectedDueDate: null,
    calvingType: null,
    calvingComplications: null,
    calfId: null,
    calfEarTag: null,
    calfSex: null,
    calfWeightKg: null,
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'r2',
    animalId: ANIMAL_ID,
    farmId: FARM_ID,
    type: 'AI',
    eventDate: '2026-02-01',
    notes: 'IA realizada no período ideal',
    recordedBy: 'user-1',
    recorderName: 'Admin',
    approvedBy: null,
    criteriaDetails: null,
    heatIntensity: null,
    intervalDays: null,
    plannedSireId: null,
    plannedSireName: null,
    breedingMethod: 'AI',
    plannedDate: null,
    sireId: null,
    sireName: 'Trovão FIV',
    semenBatch: 'LOT-2026-01',
    technicianName: 'João Técnico',
    confirmationMethod: null,
    confirmationDate: null,
    expectedDueDate: null,
    calvingType: null,
    calvingComplications: null,
    calfId: null,
    calfEarTag: null,
    calfSex: null,
    calfWeightKg: null,
    createdAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: 'r3',
    animalId: ANIMAL_ID,
    farmId: FARM_ID,
    type: 'PREGNANCY',
    eventDate: '2026-02-20',
    notes: null,
    recordedBy: 'user-1',
    recorderName: 'Admin',
    approvedBy: null,
    criteriaDetails: null,
    heatIntensity: null,
    intervalDays: null,
    plannedSireId: null,
    plannedSireName: null,
    breedingMethod: null,
    plannedDate: null,
    sireId: null,
    sireName: 'Trovão FIV',
    semenBatch: null,
    technicianName: null,
    confirmationMethod: 'ULTRASOUND',
    confirmationDate: '2026-02-20',
    expectedDueDate: '2026-11-01',
    calvingType: null,
    calvingComplications: null,
    calfId: null,
    calfEarTag: null,
    calfSex: null,
    calfWeightKg: null,
    createdAt: '2026-02-20T10:00:00.000Z',
  },
];

const MOCK_STATS: ReproductiveStats = {
  totalRecords: 3,
  clearances: 0,
  heats: 1,
  breedingPlans: 0,
  ais: 1,
  pregnancies: 1,
  calvings: 0,
  lastHeatDate: '2026-01-15',
  lastAiDate: '2026-02-01',
  lastCalvingDate: null,
  isPregnant: true,
  averageHeatIntervalDays: 21,
};

const mockUseAnimalReproductive = vi.fn();

vi.mock('@/hooks/useAnimalReproductive', () => ({
  useAnimalReproductive: (...args: unknown[]) => mockUseAnimalReproductive(...args),
}));

vi.mock('@/services/api', () => ({
  api: {
    getBlob: vi.fn().mockResolvedValue(new Blob(['test'])),
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

import ReproductiveTab from './ReproductiveTab';

function defaultHookReturn() {
  return {
    records: MOCK_RECORDS,
    stats: MOCK_STATS,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    createRecord: vi.fn().mockResolvedValue(MOCK_RECORDS[0]),
    updateRecord: vi.fn().mockResolvedValue(MOCK_RECORDS[0]),
    deleteRecord: vi.fn().mockResolvedValue(undefined),
  };
}

function renderComponent() {
  return render(<ReproductiveTab farmId={FARM_ID} animalId={ANIMAL_ID} animalEarTag="SH-001" />);
}

describe('ReproductiveTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders skeleton while loading', () => {
    mockUseAnimalReproductive.mockReturnValue({
      ...defaultHookReturn(),
      records: [],
      stats: null,
      isLoading: true,
    });
    renderComponent();
    expect(document.querySelector('.repro-tab__skeleton-card')).toBeTruthy();
  });

  it('renders error state with retry button', async () => {
    const refetch = vi.fn();
    mockUseAnimalReproductive.mockReturnValue({
      ...defaultHookReturn(),
      records: [],
      stats: null,
      error: 'Erro ao carregar histórico reprodutivo',
      refetch,
    });
    renderComponent();

    expect(screen.getByText('Erro ao carregar histórico reprodutivo')).toBeTruthy();
    await userEvent.click(screen.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders empty state when no records', () => {
    mockUseAnimalReproductive.mockReturnValue({
      ...defaultHookReturn(),
      records: [],
      stats: { ...MOCK_STATS, totalRecords: 0 },
    });
    renderComponent();

    expect(screen.getByText('Nenhum registro reprodutivo')).toBeTruthy();
    expect(screen.getByText('Registrar evento')).toBeTruthy();
  });

  it('renders stats cards with correct labels', () => {
    mockUseAnimalReproductive.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByText('CIOS')).toBeTruthy();
    expect(screen.getByText('INSEMINAÇÕES')).toBeTruthy();
    expect(screen.getByText('GESTAÇÕES')).toBeTruthy();
    expect(screen.getByText('PARTOS')).toBeTruthy();
  });

  it('shows pregnant badge when isPregnant is true', () => {
    mockUseAnimalReproductive.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByText('Gestante')).toBeTruthy();
  });

  it('shows average heat interval in stats', () => {
    mockUseAnimalReproductive.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByText('Intervalo médio: 21d')).toBeTruthy();
  });

  it('renders records list with type badges', () => {
    mockUseAnimalReproductive.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByText('Registros reprodutivos')).toBeTruthy();
    expect(screen.getAllByText('Cio').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inseminação').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gestação').length).toBeGreaterThan(0);
  });

  it('renders record details correctly', () => {
    mockUseAnimalReproductive.mockReturnValue(defaultHookReturn());
    renderComponent();

    // AI record details
    expect(screen.getAllByText(/Trovão FIV/).length).toBeGreaterThan(0);
    // Heat details
    expect(screen.getAllByText(/21d intervalo/).length).toBeGreaterThan(0);
  });

  it('opens create modal when clicking add button', async () => {
    mockUseAnimalReproductive.mockReturnValue(defaultHookReturn());
    renderComponent();

    await userEvent.click(screen.getByText('Registrar evento'));
    expect(screen.getByText('Novo registro reprodutivo')).toBeTruthy();
    expect(screen.getByLabelText(/Tipo/)).toBeTruthy();
  });

  it('opens edit modal when clicking edit on a record', async () => {
    mockUseAnimalReproductive.mockReturnValue(defaultHookReturn());
    renderComponent();

    const editButtons = screen.getAllByLabelText(/Editar registro/);
    await userEvent.click(editButtons[0]);
    expect(screen.getByText('Editar registro reprodutivo')).toBeTruthy();
  });

  it('calls deleteRecord when confirming deletion', async () => {
    const deleteRecord = vi.fn().mockResolvedValue(undefined);
    mockUseAnimalReproductive.mockReturnValue({
      ...defaultHookReturn(),
      deleteRecord,
    });
    renderComponent();

    const deleteButtons = screen.getAllByLabelText(/Excluir registro/);
    await userEvent.click(deleteButtons[0]);
    expect(deleteRecord).toHaveBeenCalledWith('r1');
  });

  it('shows export button when there are records', () => {
    mockUseAnimalReproductive.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByLabelText('Exportar histórico reprodutivo em CSV')).toBeTruthy();
  });
});
