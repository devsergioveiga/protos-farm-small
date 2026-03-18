import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockApiPost = vi.fn();
vi.mock('@/services/api', () => ({
  api: { post: (...args: unknown[]) => mockApiPost(...args) },
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true, isLoading: false }),
}));

async function importModal() {
  const mod = await import('@/components/create-farm/CreateFarmModal');
  return mod.default;
}

describe('CreateFarmModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderModal(props?: { onClose?: () => void; onSuccess?: () => void }) {
    const CreateFarmModal = await importModal();
    const onClose = props?.onClose ?? vi.fn();
    const onSuccess = props?.onSuccess ?? vi.fn();
    const result = render(
      <MemoryRouter>
        <CreateFarmModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />
      </MemoryRouter>,
    );
    return { ...result, onClose, onSuccess };
  }

  it('should render step 1 (Dados Básicos) by default', async () => {
    await renderModal();

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Nova fazenda' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Dados Básicos' })).toBeDefined();
    expect(screen.getByLabelText(/Nome da fazenda/)).toBeDefined();
    expect(screen.getByLabelText(/UF/)).toBeDefined();
    expect(screen.getByLabelText(/Área total/)).toBeDefined();
  });

  it('should not render when isOpen is false', async () => {
    const CreateFarmModal = await importModal();
    render(
      <MemoryRouter>
        <CreateFarmModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should show validation errors on blur for required fields', async () => {
    const user = userEvent.setup();
    await renderModal();

    const nameInput = screen.getByLabelText(/Nome da fazenda/);
    await user.click(nameInput);
    await user.tab();

    expect(screen.getByText('Nome é obrigatório')).toBeDefined();
  });

  it('should not advance when required fields are empty', async () => {
    const user = userEvent.setup();
    await renderModal();

    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    expect(screen.getByText('Nome é obrigatório')).toBeDefined();
    expect(screen.getByText('UF é obrigatória')).toBeDefined();
    expect(screen.getByText('Área total é obrigatória')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Dados Básicos' })).toBeDefined();
  });

  it('should advance to confirmation with valid fields', async () => {
    const user = userEvent.setup();
    await renderModal();

    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
    await user.type(screen.getByLabelText(/Área total/), '150');

    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    expect(screen.getByRole('heading', { name: 'Confirmação' })).toBeDefined();
    expect(screen.getByText('Fazenda Test')).toBeDefined();
  });

  it('should preserve data when going back', async () => {
    const user = userEvent.setup();
    await renderModal();

    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'SP');
    await user.type(screen.getByLabelText(/Área total/), '200');

    await user.click(screen.getByRole('button', { name: /Próximo/ }));
    expect(screen.getByRole('heading', { name: 'Confirmação' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(screen.getByRole('heading', { name: 'Dados Básicos' })).toBeDefined();

    expect(screen.getByLabelText(/Nome da fazenda/)).toHaveProperty('value', 'Fazenda Test');
    expect((screen.getByLabelText(/UF/) as HTMLSelectElement).value).toBe('SP');
  });

  it('should show step indicator with completed steps', async () => {
    const user = userEvent.setup();
    await renderModal();

    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
    await user.type(screen.getByLabelText(/Área total/), '150');
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    const step1Btn = screen.getByRole('button', { name: /Etapa 1.*concluída/ });
    expect(step1Btn).toBeDefined();
  });

  it('should show confirmation summary on last step', async () => {
    const user = userEvent.setup();
    await renderModal();

    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
    await user.type(screen.getByLabelText(/Área total/), '150');
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    expect(screen.getByRole('heading', { name: 'Confirmação' })).toBeDefined();
    expect(screen.getByText('Fazenda Test')).toBeDefined();
    expect(screen.getByText('MG')).toBeDefined();
    expect(screen.getByRole('button', { name: /Cadastrar fazenda/ })).toBeDefined();
  });

  it('should submit successfully and call onSuccess', async () => {
    mockApiPost.mockResolvedValue({ id: '1', name: 'Fazenda Test' });
    const user = userEvent.setup();
    const { onSuccess } = await renderModal();

    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
    await user.type(screen.getByLabelText(/Área total/), '150');
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    await user.click(screen.getByRole('button', { name: /Cadastrar fazenda/ }));

    expect(mockApiPost).toHaveBeenCalledWith(
      '/org/farms',
      expect.objectContaining({
        name: 'Fazenda Test',
        state: 'MG',
      }),
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('should show error message on submit failure', async () => {
    mockApiPost.mockRejectedValue(new Error('Limite de fazendas atingido'));
    const user = userEvent.setup();
    await renderModal();

    await user.type(screen.getByLabelText(/Nome da fazenda/), 'Fazenda Test');
    await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
    await user.type(screen.getByLabelText(/Área total/), '150');
    await user.click(screen.getByRole('button', { name: /Próximo/ }));

    await user.click(screen.getByRole('button', { name: /Cadastrar fazenda/ }));

    expect(await screen.findByText('Limite de fazendas atingido')).toBeDefined();
  });

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = await renderModal();

    await user.click(screen.getByRole('button', { name: /Cancelar/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when X button is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = await renderModal();

    await user.click(screen.getByRole('button', { name: /Fechar/ }));
    expect(onClose).toHaveBeenCalled();
  });
});
