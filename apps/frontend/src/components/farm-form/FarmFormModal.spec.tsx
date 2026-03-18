import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiGet = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true, isLoading: false }),
}));

async function importModal() {
  const mod = await import('./FarmFormModal');
  return mod.default;
}

const mockFarmDetail = {
  id: 'farm-1',
  name: 'Fazenda Santa Helena',
  nickname: 'Santa Helena',
  address: 'Rodovia BR-050 KM 100',
  city: 'Uberlândia',
  state: 'MG',
  zipCode: '38400-000',
  totalAreaHa: 250,
  boundaryAreaHa: null,
  latitude: null,
  longitude: null,
  status: 'ACTIVE' as const,
  registrations: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('FarmFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Create Mode ──────────────────────────────────────────────────

  describe('create mode', () => {
    async function renderCreateModal(props?: { onClose?: () => void; onSuccess?: () => void }) {
      const FarmFormModal = await importModal();
      const onClose = props?.onClose ?? vi.fn();
      const onSuccess = props?.onSuccess ?? vi.fn();
      const result = render(
        <MemoryRouter>
          <FarmFormModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />
        </MemoryRouter>,
      );
      return { ...result, onClose, onSuccess };
    }

    it('should render with "Nova fazenda" title', async () => {
      await renderCreateModal();

      expect(screen.getByRole('heading', { name: 'Nova fazenda' })).toBeDefined();
    });

    it('should show "Cadastrar fazenda" button on last step', async () => {
      const user = userEvent.setup();
      await renderCreateModal();

      await user.type(screen.getByLabelText(/Nome da fazenda/), 'Test');
      await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
      await user.type(screen.getByLabelText(/Área total/), '150');
      await user.click(screen.getByRole('button', { name: /Próximo/ }));

      expect(screen.getByRole('button', { name: /Cadastrar fazenda/ })).toBeDefined();
    });

    it('should submit with POST /org/farms', async () => {
      mockApiPost.mockResolvedValue({ id: '1', name: 'Test' });
      const user = userEvent.setup();
      const { onSuccess } = await renderCreateModal();

      await user.type(screen.getByLabelText(/Nome da fazenda/), 'Test');
      await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
      await user.type(screen.getByLabelText(/Área total/), '150');
      await user.click(screen.getByRole('button', { name: /Próximo/ }));
      await user.click(screen.getByRole('button', { name: /Cadastrar fazenda/ }));

      expect(mockApiPost).toHaveBeenCalledWith(
        '/org/farms',
        expect.objectContaining({ name: 'Test', state: 'MG' }),
      );
      expect(onSuccess).toHaveBeenCalled();
    });

    it('should not render when isOpen is false', async () => {
      const FarmFormModal = await importModal();
      render(
        <MemoryRouter>
          <FarmFormModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />
        </MemoryRouter>,
      );

      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  // ─── Edit Mode ────────────────────────────────────────────────────

  describe('edit mode', () => {
    async function renderEditModal(props?: { onClose?: () => void; onSuccess?: () => void }) {
      mockApiGet.mockResolvedValue(mockFarmDetail);
      const FarmFormModal = await importModal();
      const onClose = props?.onClose ?? vi.fn();
      const onSuccess = props?.onSuccess ?? vi.fn();
      const result = render(
        <MemoryRouter>
          <FarmFormModal isOpen={true} farmId="farm-1" onClose={onClose} onSuccess={onSuccess} />
        </MemoryRouter>,
      );
      return { ...result, onClose, onSuccess };
    }

    it('should render with "Editar fazenda" title', async () => {
      await renderEditModal();

      expect(screen.getByRole('heading', { name: 'Editar fazenda' })).toBeDefined();
    });

    it('should fetch farm details on mount', async () => {
      await renderEditModal();

      expect(mockApiGet).toHaveBeenCalledWith('/org/farms/farm-1');
    });

    it('should pre-fill form fields with farm data', async () => {
      await renderEditModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/Nome da fazenda/)).toHaveProperty(
          'value',
          'Fazenda Santa Helena',
        );
      });

      expect((screen.getByLabelText(/UF/) as HTMLSelectElement).value).toBe('MG');
    });

    it('should show "Salvar alterações" button on last step', async () => {
      const user = userEvent.setup();
      await renderEditModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/Nome da fazenda/)).toHaveProperty(
          'value',
          'Fazenda Santa Helena',
        );
      });

      await user.click(screen.getByRole('button', { name: /Próximo/ }));

      expect(screen.getByRole('button', { name: /Salvar alterações/ })).toBeDefined();
    });

    it('should submit with PATCH /org/farms/:farmId', async () => {
      mockApiPatch.mockResolvedValue({ ...mockFarmDetail, name: 'Updated' });
      const user = userEvent.setup();
      const { onSuccess } = await renderEditModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/Nome da fazenda/)).toHaveProperty(
          'value',
          'Fazenda Santa Helena',
        );
      });

      await user.click(screen.getByRole('button', { name: /Próximo/ }));
      await user.click(screen.getByRole('button', { name: /Salvar alterações/ }));

      expect(mockApiPatch).toHaveBeenCalledWith(
        '/org/farms/farm-1',
        expect.objectContaining({
          name: 'Fazenda Santa Helena',
          state: 'MG',
        }),
      );
      expect(onSuccess).toHaveBeenCalled();
    });

    it('should show loading skeleton while fetching farm', async () => {
      // Make the API call never resolve immediately
      mockApiGet.mockReturnValue(new Promise(() => {}));
      const FarmFormModal = await importModal();

      render(
        <MemoryRouter>
          <FarmFormModal isOpen={true} farmId="farm-1" onClose={vi.fn()} onSuccess={vi.fn()} />
        </MemoryRouter>,
      );

      expect(screen.getByLabelText('Carregando dados da fazenda')).toBeDefined();
    });

    it('should show error when farm fetch fails', async () => {
      mockApiGet.mockRejectedValue(new Error('Fazenda não encontrada'));
      const FarmFormModal = await importModal();

      render(
        <MemoryRouter>
          <FarmFormModal isOpen={true} farmId="farm-1" onClose={vi.fn()} onSuccess={vi.fn()} />
        </MemoryRouter>,
      );

      expect(await screen.findByText('Fazenda não encontrada')).toBeDefined();
    });

    it('should allow navigating to confirmation step in edit mode (all visited)', async () => {
      const user = userEvent.setup();
      await renderEditModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/Nome da fazenda/)).toHaveProperty(
          'value',
          'Fazenda Santa Helena',
        );
      });

      // Click step 2 directly (Confirmação)
      const step2Btn = screen.getByRole('button', { name: /Etapa 2/ });
      expect((step2Btn as HTMLButtonElement).disabled).toBe(false);
      await user.click(step2Btn);

      expect(screen.getByRole('heading', { name: 'Confirmação' })).toBeDefined();
    });
  });
});
