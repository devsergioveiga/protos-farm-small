import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockApiPost = vi.fn();
const mockApiGet = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    post: (...args: unknown[]) => mockApiPost(...args),
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

vi.mock('@/stores/FarmContext', () => ({
  useFarmContext: () => ({ selectedFarmId: 'farm-1' }),
}));

async function importModal() {
  const mod = await import('./TeamOperationModal');
  return mod.default;
}

const mockPlots = [
  { id: 'plot-1', name: 'Talhão 01', farmId: 'farm-1', areaHa: 50 },
  { id: 'plot-2', name: 'Talhão 02', farmId: 'farm-1', areaHa: 30 },
];

const mockTeams = {
  data: [
    {
      id: 'team-1',
      name: 'Equipe Alpha',
      farmId: 'farm-1',
      type: 'PULVERIZACAO',
      isPermanent: true,
      memberCount: 2,
      members: [
        { id: 'm1', userId: 'user-1', userName: 'João Silva', userEmail: 'joao@test.com' },
        { id: 'm2', userId: 'user-2', userName: 'Maria Santos', userEmail: 'maria@test.com' },
      ],
    },
  ],
  meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
};

function setupApiMocks() {
  mockApiGet.mockImplementation((url: string) => {
    if (url.includes('/plots')) return Promise.resolve(mockPlots);
    if (url.includes('/field-teams')) return Promise.resolve(mockTeams);
    return Promise.resolve([]);
  });
}

async function renderAndGoToStep2() {
  const user = userEvent.setup();
  const Modal = await importModal();
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  render(<Modal isOpen onClose={onClose} onSuccess={onSuccess} />);

  // Wait for data to load
  await waitFor(() => {
    expect(screen.getByLabelText(/Tipo de operação/)).toBeDefined();
  });

  // Fill step 1
  await user.selectOptions(screen.getByLabelText(/Tipo de operação/), 'PLANTIO');
  await user.selectOptions(screen.getByLabelText(/Talhão/), 'plot-1');
  await user.type(screen.getByLabelText(/^Data/), '2026-03-09');
  await user.type(screen.getByLabelText(/Hora início/), '08:00');
  await user.type(screen.getByLabelText(/Hora fim/), '16:00');

  // Go to step 2
  await user.click(screen.getByRole('button', { name: /Próximo/ }));

  await waitFor(() => {
    expect(screen.getByLabelText(/Equipe/)).toBeDefined();
  });

  // Select team
  await user.selectOptions(screen.getByLabelText(/Equipe/), 'team-1');

  await waitFor(() => {
    expect(screen.getByText('João Silva')).toBeDefined();
  });

  return { user, onClose, onSuccess };
}

describe('TeamOperationModal — CA4+CA6 Individual data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it('shows individual data toggle when members are selected', async () => {
    await renderAndGoToStep2();

    expect(screen.getByRole('button', { name: /Dados individuais/ })).toBeDefined();
  });

  it('expands individual data section on toggle click', async () => {
    const { user } = await renderAndGoToStep2();

    const toggle = screen.getByRole('button', { name: /Dados individuais/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await user.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/Preencha produtividade e horas/)).toBeDefined();
    // Shows default duration hint (8h = 16:00 - 08:00)
    expect(screen.getByText(/Duração padrão: 8\.0h/)).toBeDefined();
  });

  it('shows input fields for each selected member', async () => {
    const { user } = await renderAndGoToStep2();

    await user.click(screen.getByRole('button', { name: /Dados individuais/ }));

    // Should show fieldsets for both members
    const legends = screen.getAllByText(/João Silva|Maria Santos/, { selector: 'legend' });
    expect(legends).toHaveLength(2);

    // Each member has hours, productivity, unit, notes fields
    expect(screen.getAllByLabelText(/Horas/)).toHaveLength(2);
    expect(screen.getAllByLabelText(/Produtividade/)).toHaveLength(2);
    expect(screen.getAllByLabelText(/Unidade/)).toHaveLength(2);
    expect(screen.getAllByLabelText(/Obs\./)).toHaveLength(2);
  });

  it('fills individual data and includes entries in payload', async () => {
    const { user, onSuccess } = await renderAndGoToStep2();
    mockApiPost.mockResolvedValue({ id: 'op-1' });

    // Expand individual section
    await user.click(screen.getByRole('button', { name: /Dados individuais/ }));

    // Fill data for João
    const joaoFieldset = screen
      .getByText('João Silva', { selector: 'legend' })
      .closest('fieldset')!;
    const joaoFields = within(joaoFieldset);
    await user.type(joaoFields.getByLabelText(/Horas/), '7.5');
    await user.type(joaoFields.getByLabelText(/Produtividade/), '120');
    await user.selectOptions(joaoFields.getByLabelText(/Unidade/), 'kg');

    // Go to step 3
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    // Verify summary shows individual data
    await waitFor(() => {
      expect(screen.getByText(/7\.5h/)).toBeDefined();
    });

    // Submit
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledTimes(1);
    });

    const payload = mockApiPost.mock.calls[0][1];
    expect(payload.entries).toBeDefined();
    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0]).toEqual({
      userId: 'user-1',
      hoursWorked: 7.5,
      productivity: 120,
      productivityUnit: 'kg',
      notes: undefined,
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('omits entries when no individual data is filled', async () => {
    const { user, onSuccess } = await renderAndGoToStep2();
    mockApiPost.mockResolvedValue({ id: 'op-1' });

    // Go to step 3 without filling individual data
    await user.click(screen.getByRole('button', { name: /Próximo/ }));
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledTimes(1);
    });

    const payload = mockApiPost.mock.calls[0][1];
    expect(payload.entries).toBeUndefined();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('does not show deselected members in individual section', async () => {
    const { user } = await renderAndGoToStep2();

    // Deselect Maria
    const mariaLabel = screen.getByText('Maria Santos').closest('label')!;
    const mariaCheckbox = within(mariaLabel).getByRole('checkbox');
    await user.click(mariaCheckbox);

    // Expand individual section
    await user.click(screen.getByRole('button', { name: /Dados individuais/ }));

    // Only João should appear
    expect(screen.getByText('João Silva', { selector: 'legend' })).toBeDefined();
    expect(screen.queryByText('Maria Santos', { selector: 'legend' })).toBeNull();
  });

  it('collapses individual section on second toggle click', async () => {
    const { user } = await renderAndGoToStep2();

    const toggle = screen.getByRole('button', { name: /Dados individuais/ });
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/Preencha produtividade/)).toBeNull();
  });

  it('resets individual data when modal closes and reopens', async () => {
    const Modal = await importModal();
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    const { rerender } = render(<Modal isOpen onClose={onClose} onSuccess={onSuccess} />);

    // Close modal
    rerender(<Modal isOpen={false} onClose={onClose} onSuccess={onSuccess} />);
    // Reopen
    rerender(<Modal isOpen onClose={onClose} onSuccess={onSuccess} />);

    // Should be back on step 1
    await waitFor(() => {
      expect(screen.getByLabelText(/Tipo de operação/)).toBeDefined();
    });
  });
});
