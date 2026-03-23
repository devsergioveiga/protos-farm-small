import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('@/stores/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'user-1', email: 'test@example.com', role: 'OWNER', organizationId: 'org-1' },
    isAuthenticated: true,
    permissions: ['farms:update'],
  }),
}));

vi.mock('@/stores/FarmContext', () => ({
  useFarmContext: () => ({
    selectedFarm: { id: 'farm-1', name: 'Fazenda Santa Helena' },
    selectedFarmId: 'farm-1',
    farms: [{ id: 'farm-1', name: 'Fazenda Santa Helena' }],
    isLoadingFarms: false,
    selectFarm: vi.fn(),
    refreshFarms: vi.fn(),
  }),
}));

// ─── Import component under test ────────────────────────────────────────────

async function importModal() {
  const mod = await import('./CostCenterWizardModal');
  return mod.default;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function renderModal(
  props: { isOpen?: boolean; onClose?: () => void; onSuccess?: () => void } = {},
) {
  const CostCenterWizardModal = await importModal();
  const onClose = props.onClose ?? vi.fn();
  const onSuccess = props.onSuccess ?? vi.fn();
  const result = render(
    <CostCenterWizardModal isOpen={props.isOpen ?? true} onClose={onClose} onSuccess={onSuccess} />,
  );
  return { ...result, onClose, onSuccess };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CostCenterWizardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Renders step 1 with 5 asset-type radio cards when isOpen=true
  it('renders step 1 with 5 asset-type radio cards when isOpen=true', async () => {
    await renderModal();

    // Modal should be visible
    expect(screen.getByRole('dialog')).toBeDefined();

    // Should show 5 radio cards
    expect(screen.getByText('Maquina')).toBeDefined();
    expect(screen.getByText('Veiculo')).toBeDefined();
    expect(screen.getByText('Implemento')).toBeDefined();
    expect(screen.getByText('Benfeitoria')).toBeDefined();
    expect(screen.getByText('Terra')).toBeDefined();
  });

  // Test 2: Clicking a radio card and "Proximo" navigates to step 2
  it('clicking a radio card and Proximo navigates to step 2', async () => {
    const user = userEvent.setup();
    await renderModal();

    // Select MAQUINA radio card
    const maquinaLabel = screen.getByText('Maquina');
    await user.click(maquinaLabel);

    // Click "Proximo"
    await user.click(screen.getByRole('button', { name: /Pr[oó]ximo/i }));

    // Step 2 should be visible (shows code suggestion)
    await waitFor(() => {
      expect(screen.getByText(/Sugest[aã]o de C[oó]digo/i)).toBeDefined();
    });
  });

  // Test 3: Navigating to step 3 shows pre-filled code input with prefix
  it('navigating to step 3 shows pre-filled code input with selected type prefix', async () => {
    const user = userEvent.setup();
    await renderModal();

    // Select MAQUINA and go to step 2
    await user.click(screen.getByText('Maquina'));
    await user.click(screen.getByRole('button', { name: /Pr[oó]ximo/i }));

    // Go to step 3
    await user.click(screen.getByRole('button', { name: /Pr[oó]ximo/i }));

    // Step 3 should have a code input pre-filled with MAQ-
    await waitFor(() => {
      const codeInput = screen.getByLabelText(/C[oó]digo/i);
      expect((codeInput as HTMLInputElement).value).toContain('MAQ');
    });
  });

  // Test 4: Step 4 "Criar Centro de Custo" button fires POST to correct endpoint
  it('step 4 Criar Centro de Custo button fires POST to /api/org/farms/:farmId/cost-centers', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'cc-1', code: 'MAQ-01', name: 'Meu Trator' }),
    });

    await renderModal();

    // Navigate through all steps
    await user.click(screen.getByText('Maquina'));
    await user.click(screen.getByRole('button', { name: /Pr[oó]ximo/i }));
    await user.click(screen.getByRole('button', { name: /Pr[oó]ximo/i }));

    // Fill code and name
    const codeInput = screen.getByLabelText(/C[oó]digo/i);
    await user.clear(codeInput);
    await user.type(codeInput, 'MAQ-01');

    const nameInput = screen.getByLabelText(/Nome/i);
    await user.type(nameInput, 'Meu Trator');

    // Go to step 4
    await user.click(screen.getByRole('button', { name: /Pr[oó]ximo/i }));

    // Click "Criar Centro de Custo"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Criar Centro de Custo/i })).toBeDefined();
    });

    await user.click(screen.getByRole('button', { name: /Criar Centro de Custo/i }));

    // Verify fetch was called with correct URL
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/org/farms/farm-1/cost-centers'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('MAQ-01'),
        }),
      );
    });
  });

  // Test 5: Successful POST calls onSuccess() and onClose()
  it('successful POST calls onSuccess() and onClose()', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'cc-1', code: 'MAQ-01', name: 'Meu Trator' }),
    });

    await renderModal({ onClose, onSuccess });

    // Navigate through all steps
    await user.click(screen.getByText('Maquina'));
    await user.click(screen.getByRole('button', { name: /Pr[oó]ximo/i }));
    await user.click(screen.getByRole('button', { name: /Pr[oó]ximo/i }));

    const codeInput = screen.getByLabelText(/C[oó]digo/i);
    await user.clear(codeInput);
    await user.type(codeInput, 'MAQ-01');

    const nameInput = screen.getByLabelText(/Nome/i);
    await user.type(nameInput, 'Meu Trator');

    await user.click(screen.getByRole('button', { name: /Pr[oó]ximo/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Criar Centro de Custo/i })).toBeDefined();
    });

    await user.click(screen.getByRole('button', { name: /Criar Centro de Custo/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  // Test 6: Failed POST shows error banner with role="alert"
  it('failed POST shows error banner with role="alert"', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Codigo ja existe' }),
    });

    await renderModal();

    // Navigate through all steps
    await user.click(screen.getByText('Maquina'));
    await user.click(screen.getByRole('button', { name: /Pr[oó]ximo/i }));
    await user.click(screen.getByRole('button', { name: /Pr[oó]ximo/i }));

    const codeInput = screen.getByLabelText(/C[oó]digo/i);
    await user.clear(codeInput);
    await user.type(codeInput, 'MAQ-01');

    const nameInput = screen.getByLabelText(/Nome/i);
    await user.type(nameInput, 'Meu Trator');

    await user.click(screen.getByRole('button', { name: /Pr[oó]ximo/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Criar Centro de Custo/i })).toBeDefined();
    });

    await user.click(screen.getByRole('button', { name: /Criar Centro de Custo/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });
});
