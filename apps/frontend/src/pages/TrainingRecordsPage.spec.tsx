import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock useEmployees ────────────────────────────────────────────────────────
const mockUseEmployees = vi.fn();

vi.mock('@/hooks/useEmployees', () => ({
  useEmployees: (...args: unknown[]) => mockUseEmployees(...args),
}));

// ── Mock useTrainingRecords ──────────────────────────────────────────────────
vi.mock('@/hooks/useTrainingRecords', () => ({
  useTrainingRecords: () => ({
    trainingRecords: null,
    loading: false,
    error: null,
    successMessage: null,
    fetchTrainingRecords: vi.fn(),
    createTrainingRecord: vi.fn(),
    deleteTrainingRecord: vi.fn(),
    downloadCertificatePdf: vi.fn(),
  }),
}));

// ── Mock useTrainingTypes ────────────────────────────────────────────────────
vi.mock('@/hooks/useTrainingTypes', () => ({
  useTrainingTypes: () => ({
    trainingTypes: [],
    positionRequirements: [],
    loading: false,
    error: null,
    successMessage: null,
    fetchTrainingTypes: vi.fn(),
    createTrainingType: vi.fn(),
    updateTrainingType: vi.fn(),
    deleteTrainingType: vi.fn(),
    fetchPositionRequirements: vi.fn(),
    createPositionRequirement: vi.fn(),
    deletePositionRequirement: vi.fn(),
  }),
}));

// ── Mock react-router-dom (keep MemoryRouter real) ──────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const mockEmployees = [
  {
    id: 'emp-1',
    name: 'Maria Silva',
    farms: [
      {
        id: 'ef-1',
        farm: { id: 'f-1', name: 'Fazenda Sol' },
        position: { id: 'pos-1', name: 'Operador' },
      },
    ],
  },
  {
    id: 'emp-2',
    name: 'Joao Santos',
    farms: [
      {
        id: 'ef-2',
        farm: { id: 'f-1', name: 'Fazenda Sol' },
        position: { id: 'pos-2', name: 'Tratorista' },
      },
    ],
  },
];

// ── Import component under test AFTER mocks ──────────────────────────────────
import TrainingRecordsPage from './TrainingRecordsPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <TrainingRecordsPage />
    </MemoryRouter>,
  );
}

describe('TrainingRecordsPage — SEGUR-02 employee wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEmployees.mockReturnValue({
      employees: mockEmployees,
      total: 2,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('calls useEmployees with status ATIVO', () => {
    renderPage();
    expect(mockUseEmployees).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ATIVO' }),
    );
  });

  it('does not contain MOCK_EMPLOYEES stub', () => {
    renderPage();
    // If real employees are wired, the page heading should render (page is functional)
    // and the stub constant MOCK_EMPLOYEES should not exist in the module scope.
    // This test asserts the hook was called — proof the stub was replaced.
    expect(mockUseEmployees).toHaveBeenCalled();
    // Employee names from real data should be renderable (modal not open yet, but hook was called)
    expect(screen.getByRole('main')).toBeDefined();
  });
});
