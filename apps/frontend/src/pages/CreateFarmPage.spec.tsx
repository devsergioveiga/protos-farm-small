import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockApiPost = vi.fn();
vi.mock('@/services/api', () => ({
  api: { post: (...args: unknown[]) => mockApiPost(...args) },
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true, isLoading: false }),
}));

describe('CreateFarmPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderPage() {
    const { default: CreateFarmPage } = await import('./CreateFarmPage');
    return render(
      <MemoryRouter initialEntries={['/farms/new']}>
        <CreateFarmPage />
      </MemoryRouter>,
    );
  }

  it('should render step 1 (Dados Básicos) by default', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: 'Dados Básicos' })).toBeDefined();
    expect(screen.getByLabelText(/Nome da fazenda/)).toBeDefined();
    expect(screen.getByLabelText(/UF/)).toBeDefined();
    expect(screen.getByLabelText(/Área total/)).toBeDefined();
  });

  it('should show validation errors on blur for required fields', async () => {
    const user = userEvent.setup();
    await renderPage();

    const nameInput = screen.getByLabelText(/Nome da fazenda/);
    await user.click(nameInput);
    await user.tab();

    expect(screen.getByText('Nome é obrigatório')).toBeDefined();
  });

  it('should not advance when required fields are empty', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    expect(screen.getByText('Nome é obrigatório')).toBeDefined();
    expect(screen.getByText('UF é obrigatória')).toBeDefined();
    expect(screen.getByText('Área total é obrigatória')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Dados Básicos' })).toBeDefined();
  });

  it('should advance to step 2 with valid fields', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
    await user.type(screen.getByLabelText(/Área total/), '150');

    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    expect(screen.getByRole('heading', { name: 'Identificadores' })).toBeDefined();
    expect(screen.getByLabelText(/CIB/)).toBeDefined();
  });

  it('should preserve data when going back', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'SP');
    await user.type(screen.getByLabelText(/Área total/), '200');

    await user.click(screen.getByRole('button', { name: /Próximo/ }));
    expect(screen.getByRole('heading', { name: 'Identificadores' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(screen.getByRole('heading', { name: 'Dados Básicos' })).toBeDefined();

    expect(screen.getByLabelText(/Nome da fazenda/)).toHaveProperty('value', 'Fazenda Test');
    expect((screen.getByLabelText(/UF/) as HTMLSelectElement).value).toBe('SP');
    expect(screen.getByLabelText(/Área total/)).toHaveProperty('value', '200');
  });

  it('should validate CIB format', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
    await user.type(screen.getByLabelText(/Área total/), '150');
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    const cibInput = screen.getByLabelText(/CIB/);
    await user.type(cibInput, '12345');
    await user.tab();

    expect(screen.getByText('CIB deve ter formato XXX.XXX.XXX-X')).toBeDefined();
  });

  it('should show step indicator with completed steps', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
    await user.type(screen.getByLabelText(/Área total/), '150');
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    const step1Btn = screen.getByRole('button', { name: /Etapa 1.*concluída/ });
    expect(step1Btn).toBeDefined();
  });

  it('should show confirmation summary on step 4', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Step 0
    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
    await user.type(screen.getByLabelText(/Área total/), '150');
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    // Step 1
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    // Step 2
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    // Step 3 — Confirmation
    expect(screen.getByRole('heading', { name: 'Confirmação' })).toBeDefined();
    expect(screen.getByText('Fazenda Test')).toBeDefined();
    expect(screen.getByText('MG')).toBeDefined();
    expect(screen.getByRole('button', { name: /Cadastrar fazenda/ })).toBeDefined();
  });

  it('should submit successfully and redirect', async () => {
    mockApiPost.mockResolvedValue({ id: '1', name: 'Fazenda Test' });
    const user = userEvent.setup();
    await renderPage();

    // Step 0
    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
    await user.type(screen.getByLabelText(/Área total/), '150');
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    // Step 1
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    // Step 2
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    // Step 3
    await user.click(screen.getByRole('button', { name: /Cadastrar fazenda/ }));

    expect(mockApiPost).toHaveBeenCalledWith(
      '/org/farms',
      expect.objectContaining({
        name: 'Fazenda Test',
        state: 'MG',
        totalAreaHa: 150,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/farms', {
      state: { success: 'Fazenda cadastrada com sucesso!' },
    });
  });

  it('should show error message on submit failure', async () => {
    mockApiPost.mockRejectedValue(new Error('Limite de fazendas atingido'));
    const user = userEvent.setup();
    await renderPage();

    // Navigate to confirmation
    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
    await user.type(screen.getByLabelText(/Área total/), '150');
    await user.click(screen.getByRole('button', { name: /Próximo/ }));
    await user.click(screen.getByRole('button', { name: /Próximo/ }));
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    await user.click(screen.getByRole('button', { name: /Cadastrar fazenda/ }));

    expect(await screen.findByText('Limite de fazendas atingido')).toBeDefined();
  });

  it('should render cancel link on step 0 pointing to /farms', async () => {
    await renderPage();

    const cancelLink = screen.getByRole('link', { name: /Cancelar/ });
    expect(cancelLink.getAttribute('href')).toBe('/farms');
  });

  it('should validate utilization degree range (0-100)', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Navigate to step 2
    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
    await user.type(screen.getByLabelText(/Área total/), '150');
    await user.click(screen.getByRole('button', { name: /Próximo/ }));
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    const degreeInput = screen.getByLabelText(/Grau de utilização/);
    await user.type(degreeInput, '150');
    await user.tab();

    expect(screen.getByText('Grau deve estar entre 0 e 100')).toBeDefined();
  });
});
