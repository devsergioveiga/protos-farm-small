import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CostCenterWizardModal from './CostCenterWizardModal';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/stores/FarmContext', () => ({
  useFarm: () => ({
    selectedFarm: { id: 'farm-1', name: 'Fazenda Teste' },
    selectedFarmId: 'farm-1',
    farms: [{ id: 'farm-1', name: 'Fazenda Teste' }],
  }),
}));

vi.mock('@/stores/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'user-1', organizationId: 'org-1' },
    isAuthenticated: true,
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Helpers ───────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

function renderWizard(props = defaultProps) {
  return render(<CostCenterWizardModal {...props} />);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('CostCenterWizardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step 1 with 5 asset-type radio cards when isOpen=true', () => {
    renderWizard();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Maquina')).toBeTruthy();
    expect(screen.getByText('Veiculo')).toBeTruthy();
    expect(screen.getByText('Implemento')).toBeTruthy();
    expect(screen.getByText('Benfeitoria')).toBeTruthy();
    expect(screen.getByText('Terra')).toBeTruthy();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
  });

  it('does not render when isOpen=false', () => {
    render(<CostCenterWizardModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking a radio card and Proximo navigates to step 2', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByLabelText('Maquina'));
    await user.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));

    // Step 2 step-label should be visible
    expect(screen.getByText(/sugest[aã]o de c[oó]digo/i)).toBeTruthy();
    // Code badge should render the prefix
    const badge = document.querySelector('.cc-wizard__code-badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('MAQ');
  });

  it('navigating to step 3 shows pre-filled code input with selected type prefix', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByLabelText('Veiculo'));
    await user.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));
    await user.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));

    const codeInput = screen.getByLabelText(/c[oó]digo/i) as HTMLInputElement;
    expect(codeInput.value).toBe('VEI-');
  });

  it('step 4 Criar Centro de Custo fires POST to correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'cc-1', code: 'VEI-CAMINHAO', name: 'Caminhao Teste' }),
    });

    const user = userEvent.setup();
    renderWizard();

    // Step 1: select type
    await user.click(screen.getByLabelText('Veiculo'));
    await user.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));

    // Step 2: next
    await user.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));

    // Step 3: fill form — code is pre-filled with VEI-, type more
    const codeInput = screen.getByLabelText(/c[oó]digo/i) as HTMLInputElement;
    await user.clear(codeInput);
    await user.type(codeInput, 'VEI-CAMINHAO');

    const nameInput = screen.getByLabelText(/^nome/i) as HTMLInputElement;
    await user.type(nameInput, 'Caminhao Teste');

    await user.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));

    // Step 4: confirm
    await user.click(screen.getByRole('button', { name: /criar centro de custo/i }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/orgs/org-1/farms/farm-1/cost-centers');
    const body = JSON.parse(options.body as string) as { code: string; name: string };
    expect(body.code).toBe('VEI-CAMINHAO');
    expect(body.name).toBe('Caminhao Teste');
  });

  it('successful POST calls onSuccess and onClose', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'cc-1', code: 'MAQ-01', name: 'Trator' }),
    });

    const user = userEvent.setup();
    render(<CostCenterWizardModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />);

    await user.click(screen.getByLabelText('Maquina'));
    await user.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));
    await user.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));

    const codeInput = screen.getByLabelText(/c[oó]digo/i) as HTMLInputElement;
    await user.clear(codeInput);
    await user.type(codeInput, 'MAQ-01');

    const nameInput = screen.getByLabelText(/^nome/i) as HTMLInputElement;
    await user.type(nameInput, 'Trator');

    await user.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));
    await user.click(screen.getByRole('button', { name: /criar centro de custo/i }));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('failed POST shows error banner with role=alert', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Erro interno' }),
    });

    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByLabelText('Implemento'));
    await user.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));
    await user.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));

    const codeInput = screen.getByLabelText(/c[oó]digo/i) as HTMLInputElement;
    await user.clear(codeInput);
    await user.type(codeInput, 'IMP-01');

    const nameInput = screen.getByLabelText(/^nome/i) as HTMLInputElement;
    await user.type(nameInput, 'Grade Niveladora');

    await user.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));
    await user.click(screen.getByRole('button', { name: /criar centro de custo/i }));

    const errorBanner = await screen.findByRole('alert');
    expect(errorBanner).toBeTruthy();
    expect(errorBanner.textContent).toMatch(/n[aã]o foi poss[ií]vel/i);
  });

  it('navigating between steps does not use CSS transitions (display:none/block pattern)', () => {
    const { container } = renderWizard();

    // Step 1 should be visible, steps 2-4 hidden via display:none
    const steps = container.querySelectorAll('[data-step]');
    expect(steps).toHaveLength(4);

    const step1 = container.querySelector('[data-step="1"]') as HTMLElement;
    const step2 = container.querySelector('[data-step="2"]') as HTMLElement;
    expect(step1.style.display).not.toBe('none');
    expect(step2.style.display).toBe('none');
  });
});
