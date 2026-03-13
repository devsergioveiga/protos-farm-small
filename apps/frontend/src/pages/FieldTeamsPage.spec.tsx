import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { FieldTeamItem } from '@/types/field-team';

const MOCK_TEAMS: FieldTeamItem[] = [
  {
    id: 'ft-1',
    farmId: 'farm-1',
    name: 'Equipe Colheita Norte',
    teamType: 'COLHEITA_MANUAL',
    teamTypeLabel: 'Colheita manual',
    isTemporary: false,
    leaderId: 'user-1',
    leaderName: 'João Silva',
    notes: 'Colheita na área norte da fazenda',
    memberCount: 3,
    members: [
      {
        id: 'ftm-1',
        userId: 'user-2',
        userName: 'Maria Santos',
        userEmail: 'maria@test.com',
        joinedAt: '2026-03-01T00:00:00.000Z',
        leftAt: null,
      },
      {
        id: 'ftm-2',
        userId: 'user-3',
        userName: 'Pedro Oliveira',
        userEmail: 'pedro@test.com',
        joinedAt: '2026-03-01T00:00:00.000Z',
        leftAt: null,
      },
      {
        id: 'ftm-3',
        userId: 'user-4',
        userName: 'Ana Costa',
        userEmail: 'ana@test.com',
        joinedAt: '2026-03-01T00:00:00.000Z',
        leftAt: null,
      },
    ],
    costCenterId: null,
    costCenterName: null,
    costCenterCode: null,
    createdBy: 'user-1',
    creatorName: 'João Silva',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
  },
  {
    id: 'ft-2',
    farmId: 'farm-1',
    name: 'Equipe Defensivos',
    teamType: 'APLICACAO_DEFENSIVOS',
    teamTypeLabel: 'Aplicação de defensivos',
    isTemporary: true,
    leaderId: 'user-5',
    leaderName: 'Carlos Souza',
    notes: null,
    costCenterId: null,
    costCenterName: null,
    costCenterCode: null,
    memberCount: 1,
    members: [
      {
        id: 'ftm-4',
        userId: 'user-6',
        userName: 'Fernanda Lima',
        userEmail: 'fernanda@test.com',
        joinedAt: '2026-03-02T00:00:00.000Z',
        leftAt: null,
      },
    ],
    createdBy: 'user-5',
    creatorName: 'Carlos Souza',
    createdAt: '2026-03-02T08:00:00.000Z',
    updatedAt: '2026-03-02T08:00:00.000Z',
  },
];

const mockUseFieldTeams = vi.fn();

vi.mock('@/hooks/useFieldTeams', () => ({
  useFieldTeams: (...args: unknown[]) => mockUseFieldTeams(...args),
}));

vi.mock('@/stores/FarmContext', () => ({
  useFarmContext: () => ({
    selectedFarm: { id: 'farm-1', name: 'Fazenda Santa Helena' },
    farms: [],
    isLoadingFarms: false,
    selectedFarmId: 'farm-1',
    selectFarm: vi.fn(),
    refreshFarms: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('@/components/auth/PermissionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/field-teams/FieldTeamModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="field-team-modal">Modal</div> : null,
}));

import FieldTeamsPage from './FieldTeamsPage';

describe('FieldTeamsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render title and subtitle', () => {
    mockUseFieldTeams.mockReturnValue({
      teams: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    expect(screen.getByText('Equipes de campo')).toBeTruthy();
    expect(screen.getByText(/Equipes de trabalho.*Fazenda Santa Helena/)).toBeTruthy();
  });

  it('should show empty state when no teams', () => {
    mockUseFieldTeams.mockReturnValue({
      teams: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    expect(screen.getByText('Nenhuma equipe cadastrada')).toBeTruthy();
  });

  it('should show skeleton while loading', () => {
    mockUseFieldTeams.mockReturnValue({
      teams: [],
      meta: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<FieldTeamsPage />);
    const skeletons = container.querySelectorAll('.field-teams__skeleton--card');
    expect(skeletons.length).toBe(6);
  });

  it('should show error message', () => {
    mockUseFieldTeams.mockReturnValue({
      teams: [],
      meta: null,
      isLoading: false,
      error: 'Erro ao carregar equipes',
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    expect(screen.getByText('Erro ao carregar equipes')).toBeTruthy();
  });

  it('should render team cards with names and type badges', () => {
    mockUseFieldTeams.mockReturnValue({
      teams: MOCK_TEAMS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    expect(screen.getByText('Equipe Colheita Norte')).toBeTruthy();
    expect(screen.getByText('Equipe Defensivos')).toBeTruthy();
    expect(screen.getAllByText('Colheita manual').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aplicação de defensivos').length).toBeGreaterThan(0);
  });

  it('should display leader name on cards', () => {
    mockUseFieldTeams.mockReturnValue({
      teams: MOCK_TEAMS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    expect(screen.getByText('João Silva')).toBeTruthy();
    expect(screen.getByText('Carlos Souza')).toBeTruthy();
  });

  it('should display member count on cards', () => {
    mockUseFieldTeams.mockReturnValue({
      teams: MOCK_TEAMS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    expect(screen.getByText('3 membros')).toBeTruthy();
    expect(screen.getByText('1 membro')).toBeTruthy();
  });

  it('should display temporary badge when team is temporary', () => {
    mockUseFieldTeams.mockReturnValue({
      teams: MOCK_TEAMS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    expect(screen.getByText('Equipe temporária')).toBeTruthy();
  });

  it('should display notes on cards when present', () => {
    mockUseFieldTeams.mockReturnValue({
      teams: MOCK_TEAMS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    expect(screen.getByText('Colheita na área norte da fazenda')).toBeTruthy();
  });

  it('should open modal when clicking "Nova equipe"', async () => {
    const user = userEvent.setup();
    mockUseFieldTeams.mockReturnValue({
      teams: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    await user.click(screen.getByText('Nova equipe'));
    expect(screen.getByTestId('field-team-modal')).toBeTruthy();
  });

  it('should open modal when clicking a card', async () => {
    const user = userEvent.setup();
    mockUseFieldTeams.mockReturnValue({
      teams: MOCK_TEAMS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    const card = screen.getByLabelText(/Ver detalhes da equipe Equipe Colheita Norte/);
    await user.click(card);
    expect(screen.getByTestId('field-team-modal')).toBeTruthy();
  });

  it('should have search and filter controls', () => {
    mockUseFieldTeams.mockReturnValue({
      teams: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    expect(screen.getByLabelText('Buscar equipes')).toBeTruthy();
    expect(screen.getByLabelText('Filtrar por tipo de equipe')).toBeTruthy();
  });

  it('should show all 9 team types in filter', () => {
    mockUseFieldTeams.mockReturnValue({
      teams: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    const select = screen.getByLabelText('Filtrar por tipo de equipe');
    const options = select.querySelectorAll('option');
    // "Todos os tipos" + 9 types = 10
    expect(options.length).toBe(10);
  });

  it('should show pagination when multiple pages', () => {
    mockUseFieldTeams.mockReturnValue({
      teams: MOCK_TEAMS,
      meta: { page: 1, limit: 20, total: 40, totalPages: 2 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FieldTeamsPage />);
    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
  });
});
