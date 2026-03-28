import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPost = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    get: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/hooks/useBreeds', () => ({
  useBreeds: () => ({
    breeds: [
      {
        id: 'b1',
        name: 'Holandesa',
        code: 'HOL',
        species: 'BOVINO',
        category: 'LEITEIRA',
        isDefault: true,
        organizationId: null,
      },
      {
        id: 'b2',
        name: 'Gir Leiteiro',
        code: 'GIR',
        species: 'BOVINO',
        category: 'LEITEIRA',
        isDefault: true,
        organizationId: null,
      },
      {
        id: 'b3',
        name: 'Nelore',
        code: 'NEL',
        species: 'BOVINO',
        category: 'CORTE',
        isDefault: true,
        organizationId: null,
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

async function renderModal(props = {}) {
  const { default: CreateAnimalModal } = await import('./CreateAnimalModal');
  const defaultProps = {
    isOpen: true,
    farmId: 'farm-1',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    ...props,
  };
  return render(<CreateAnimalModal {...defaultProps} />);
}

describe('CreateAnimalModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when closed', async () => {
    const { default: CreateAnimalModal } = await import('./CreateAnimalModal');
    const { container } = render(
      <CreateAnimalModal isOpen={false} farmId="farm-1" onClose={vi.fn()} onSuccess={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render step 1 by default', async () => {
    await renderModal();
    expect(screen.getByText('Cadastrar animal')).toBeTruthy();
    expect(screen.getByLabelText(/Brinco/)).toBeTruthy();
    expect(screen.getByLabelText(/Sexo/)).toBeTruthy();
  });

  it('should disable Próximo when earTag and sex are empty', async () => {
    await renderModal();
    const nextBtn = screen.getByText('Próximo');
    expect(nextBtn).toHaveProperty('disabled', true);
  });

  it('should enable Próximo when earTag and sex are filled', async () => {
    await renderModal();
    const earTagInput = screen.getByLabelText(/Brinco/);
    const sexSelect = screen.getByLabelText(/Sexo/);

    await userEvent.type(earTagInput, 'BR-001');
    await userEvent.selectOptions(sexSelect, 'FEMALE');

    const nextBtn = screen.getByText('Próximo');
    expect(nextBtn).toHaveProperty('disabled', false);
  });

  it('should navigate to step 2', async () => {
    await renderModal();

    await userEvent.type(screen.getByLabelText(/Brinco/), 'BR-001');
    await userEvent.selectOptions(screen.getByLabelText(/Sexo/), 'MALE');
    await userEvent.click(screen.getByText('Próximo'));

    expect(screen.getByText(/composição racial/)).toBeTruthy();
    expect(screen.getByText('Adicionar raça')).toBeTruthy();
  });

  it('should navigate to step 3', async () => {
    await renderModal();

    await userEvent.type(screen.getByLabelText(/Brinco/), 'BR-001');
    await userEvent.selectOptions(screen.getByLabelText(/Sexo/), 'FEMALE');
    await userEvent.click(screen.getByText('Próximo'));
    await userEvent.click(screen.getByText('Próximo'));

    expect(screen.getByText(/Registros genealógicos/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cadastrar animal' })).toBeTruthy();
  });

  it('should go back from step 2 to step 1', async () => {
    await renderModal();

    await userEvent.type(screen.getByLabelText(/Brinco/), 'BR-001');
    await userEvent.selectOptions(screen.getByLabelText(/Sexo/), 'MALE');
    await userEvent.click(screen.getByText('Próximo'));
    await userEvent.click(screen.getByText('Voltar'));

    expect(screen.getByLabelText(/Brinco/)).toBeTruthy();
  });

  it('should submit on step 3', async () => {
    mockPost.mockResolvedValue({ id: 'new-animal' });
    const onSuccess = vi.fn();
    await renderModal({ onSuccess });

    await userEvent.type(screen.getByLabelText(/Brinco/), 'BR-001');
    await userEvent.selectOptions(screen.getByLabelText(/Sexo/), 'FEMALE');
    await userEvent.click(screen.getByText('Próximo'));
    await userEvent.click(screen.getByText('Próximo'));

    const submitBtn = screen.getByRole('button', { name: 'Cadastrar animal' });
    await userEvent.click(submitBtn);

    expect(mockPost).toHaveBeenCalledWith(
      '/org/farms/farm-1/animals',
      expect.objectContaining({ earTag: 'BR-001', sex: 'FEMALE' }),
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('should show error on submit failure', async () => {
    mockPost.mockRejectedValue(new Error('Brinco duplicado'));
    await renderModal();

    await userEvent.type(screen.getByLabelText(/Brinco/), 'BR-001');
    await userEvent.selectOptions(screen.getByLabelText(/Sexo/), 'MALE');
    await userEvent.click(screen.getByText('Próximo'));
    await userEvent.click(screen.getByText('Próximo'));
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar animal' }));

    expect(await screen.findByText('Brinco duplicado')).toBeTruthy();
  });

  it('should close on Escape', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('should render stepper with 3 steps', async () => {
    await renderModal();

    expect(screen.getByText('Dados básicos')).toBeTruthy();
    expect(screen.getByText('Composição racial')).toBeTruthy();
    expect(screen.getByText('Genealogia')).toBeTruthy();
  });

  it('should show Girolando badge for 50/50 Holandesa/Gir', async () => {
    await renderModal();

    // Go to step 2
    await userEvent.type(screen.getByLabelText(/Brinco/), 'BR-001');
    await userEvent.selectOptions(screen.getByLabelText(/Sexo/), 'FEMALE');
    await userEvent.click(screen.getByText('Próximo'));

    // Add two breeds
    await userEvent.click(screen.getByText('Adicionar raça'));
    await userEvent.click(screen.getByText('Adicionar raça'));

    // Select Holandesa 50%
    const breedSelects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(breedSelects[0], 'b1'); // Holandesa
    await userEvent.selectOptions(breedSelects[1], 'b2'); // Gir Leiteiro

    const pctInputs = screen.getAllByLabelText('%');
    await userEvent.clear(pctInputs[0]);
    await userEvent.type(pctInputs[0], '50');
    await userEvent.clear(pctInputs[1]);
    await userEvent.type(pctInputs[1], '50');

    expect(screen.getByText('Girolando F1')).toBeTruthy();
  });
});
