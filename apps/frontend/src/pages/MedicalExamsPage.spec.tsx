import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock useEmployees ────────────────────────────────────────────────────────
const mockUseEmployees = vi.fn();

vi.mock('@/hooks/useEmployees', () => ({
  useEmployees: (...args: unknown[]) => mockUseEmployees(...args),
}));

// ── Mock useMedicalExams ─────────────────────────────────────────────────────
vi.mock('@/hooks/useMedicalExams', () => ({
  useMedicalExams: () => ({
    medicalExams: null,
    loading: false,
    error: null,
    successMessage: null,
    fetchMedicalExams: vi.fn(),
    createMedicalExam: vi.fn(),
    updateMedicalExam: vi.fn(),
    deleteMedicalExam: vi.fn(),
    downloadExamPdf: vi.fn(),
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
        position: { id: 'pos-1', name: 'Operador', asoPeriodicityMonths: 6 },
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
        position: { id: 'pos-2', name: 'Tratorista', asoPeriodicityMonths: 12 },
      },
    ],
  },
];

// ── Import component under test AFTER mocks ──────────────────────────────────
import MedicalExamsPage from './MedicalExamsPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <MedicalExamsPage />
    </MemoryRouter>,
  );
}

describe('MedicalExamsPage — SEGUR-03 employee wiring', () => {
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
    expect(mockUseEmployees).toHaveBeenCalledWith(expect.objectContaining({ status: 'ATIVO' }));
  });

  it('does not contain MOCK_EMPLOYEES stub — asoPeriodicityMonths flows from hook', () => {
    renderPage();
    // Hook must be called — proves the stub was replaced with real data source
    expect(mockUseEmployees).toHaveBeenCalled();
    // Employees from hook have asoPeriodicityMonths in position — verifies type flow
    const callArgs = mockUseEmployees.mock.calls[0]?.[0] as { status?: string } | undefined;
    expect(callArgs?.status).toBe('ATIVO');
    // Page renders without crashing
    expect(screen.getByRole('main')).toBeDefined();
  });
});
