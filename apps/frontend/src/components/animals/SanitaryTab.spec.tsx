import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { HealthRecordItem, HealthStats } from '@/types/animal';

const FARM_ID = 'farm-1';
const ANIMAL_ID = 'animal-1';

const MOCK_RECORDS: HealthRecordItem[] = [
  {
    id: 'h1',
    animalId: ANIMAL_ID,
    farmId: FARM_ID,
    type: 'VACCINATION',
    eventDate: '2026-03-01',
    productName: 'Aftosa Bivalente',
    dosage: '5ml',
    applicationMethod: 'INJECTABLE',
    batchNumber: 'LOT-2026-A',
    diagnosis: null,
    durationDays: null,
    examResult: null,
    labName: null,
    isFieldExam: null,
    veterinaryName: 'Dr. Silva',
    notes: 'Campanha vacinação',
    recordedBy: 'user-1',
    recorderName: 'Admin',
    createdAt: '2026-03-01T10:00:00.000Z',
  },
  {
    id: 'h2',
    animalId: ANIMAL_ID,
    farmId: FARM_ID,
    type: 'DEWORMING',
    eventDate: '2026-02-15',
    productName: 'Ivomec Gold',
    dosage: '1ml/50kg',
    applicationMethod: 'INJECTABLE',
    batchNumber: null,
    diagnosis: null,
    durationDays: null,
    examResult: null,
    labName: null,
    isFieldExam: null,
    veterinaryName: null,
    notes: null,
    recordedBy: 'user-1',
    recorderName: 'Admin',
    createdAt: '2026-02-15T10:00:00.000Z',
  },
  {
    id: 'h3',
    animalId: ANIMAL_ID,
    farmId: FARM_ID,
    type: 'TREATMENT',
    eventDate: '2026-01-20',
    productName: 'Terramicina LA',
    dosage: '10ml',
    applicationMethod: 'INJECTABLE',
    batchNumber: null,
    diagnosis: 'Mastite clínica',
    durationDays: 5,
    examResult: null,
    labName: null,
    isFieldExam: null,
    veterinaryName: 'Dr. Santos',
    notes: null,
    recordedBy: 'user-1',
    recorderName: 'Admin',
    createdAt: '2026-01-20T10:00:00.000Z',
  },
];

const MOCK_STATS: HealthStats = {
  totalRecords: 3,
  vaccinations: 1,
  dewormings: 1,
  treatments: 1,
  exams: 0,
  lastVaccinationDate: '2026-03-01',
  lastDewormingDate: '2026-02-15',
  lastTreatmentDate: '2026-01-20',
  lastExamDate: null,
};

const mockUseAnimalHealth = vi.fn();

vi.mock('@/hooks/useAnimalHealth', () => ({
  useAnimalHealth: (...args: unknown[]) => mockUseAnimalHealth(...args),
}));

vi.mock('@/services/api', () => ({
  api: {
    getBlob: vi.fn().mockResolvedValue(new Blob(['test'])),
  },
}));

import SanitaryTab from './SanitaryTab';

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
  return render(<SanitaryTab farmId={FARM_ID} animalId={ANIMAL_ID} animalEarTag="BR-001" />);
}

describe('SanitaryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders skeleton while loading', () => {
    mockUseAnimalHealth.mockReturnValue({
      ...defaultHookReturn(),
      records: [],
      stats: null,
      isLoading: true,
    });
    renderComponent();
    expect(document.querySelector('.sanitary-tab__skeleton-card')).toBeTruthy();
  });

  it('renders error state with retry button', async () => {
    const refetch = vi.fn();
    mockUseAnimalHealth.mockReturnValue({
      ...defaultHookReturn(),
      records: [],
      stats: null,
      error: 'Erro ao carregar histórico sanitário',
      refetch,
    });
    renderComponent();

    expect(screen.getByText('Erro ao carregar histórico sanitário')).toBeTruthy();
    await userEvent.click(screen.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders empty state when no records', () => {
    mockUseAnimalHealth.mockReturnValue({
      ...defaultHookReturn(),
      records: [],
      stats: { ...MOCK_STATS, totalRecords: 0 },
    });
    renderComponent();

    expect(screen.getByText('Nenhum registro sanitário')).toBeTruthy();
    expect(screen.getByText('Registrar evento')).toBeTruthy();
  });

  it('renders stats cards with correct values', () => {
    mockUseAnimalHealth.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByText('VACINAÇÕES')).toBeTruthy();
    expect(screen.getByText('VERMIFUGAÇÕES')).toBeTruthy();
    expect(screen.getByText('TRATAMENTOS')).toBeTruthy();
    expect(screen.getByText('EXAMES')).toBeTruthy();
  });

  it('renders records list with health data', () => {
    mockUseAnimalHealth.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByText('Registros sanitários')).toBeTruthy();
    expect(screen.getByText('Aftosa Bivalente')).toBeTruthy();
    expect(screen.getByText('Ivomec Gold')).toBeTruthy();
  });

  it('renders type badges in records', () => {
    mockUseAnimalHealth.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getAllByText('Vacinação').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vermifugação').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tratamento').length).toBeGreaterThan(0);
  });

  it('opens create modal when clicking add button', async () => {
    mockUseAnimalHealth.mockReturnValue(defaultHookReturn());
    renderComponent();

    await userEvent.click(screen.getByText('Registrar evento'));
    expect(screen.getByText('Novo registro sanitário')).toBeTruthy();
    expect(screen.getByLabelText(/Tipo/)).toBeTruthy();
  });

  it('opens edit modal when clicking edit on a record', async () => {
    mockUseAnimalHealth.mockReturnValue(defaultHookReturn());
    renderComponent();

    const editButtons = screen.getAllByLabelText(/Editar registro/);
    await userEvent.click(editButtons[0]);
    expect(screen.getByText('Editar registro sanitário')).toBeTruthy();
  });

  it('calls deleteRecord when confirming deletion', async () => {
    const deleteRecord = vi.fn().mockResolvedValue(undefined);
    mockUseAnimalHealth.mockReturnValue({
      ...defaultHookReturn(),
      deleteRecord,
    });
    renderComponent();

    const deleteButtons = screen.getAllByLabelText(/Excluir registro/);
    await userEvent.click(deleteButtons[0]);
    expect(deleteRecord).toHaveBeenCalledWith('h1');
  });

  it('shows export button when there are records', () => {
    mockUseAnimalHealth.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByLabelText('Exportar histórico sanitário em CSV')).toBeTruthy();
  });

  it('shows filter select with all types', () => {
    mockUseAnimalHealth.mockReturnValue(defaultHookReturn());
    renderComponent();

    const select =
      screen.getByRole('combobox', { hidden: true }) || screen.getByLabelText('Filtrar por tipo');
    expect(select).toBeTruthy();
  });

  it('shows conditional fields based on type in modal', async () => {
    mockUseAnimalHealth.mockReturnValue(defaultHookReturn());
    renderComponent();

    await userEvent.click(screen.getByText('Registrar evento'));

    // VACCINATION shows batch number field
    expect(screen.getByLabelText(/Lote\/Série/)).toBeTruthy();
  });
});
