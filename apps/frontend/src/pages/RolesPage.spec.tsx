import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
vi.mock('@/services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn(),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

const MOCK_MATRIX = {
  modules: ['farms', 'users'],
  actions: ['create', 'read', 'update', 'delete'],
  defaults: {
    ADMIN: {
      farms: { create: true, read: true, update: true, delete: true },
      users: { create: true, read: true, update: true, delete: true },
    },
    MANAGER: {
      farms: { create: true, read: true, update: true, delete: false },
      users: { create: false, read: true, update: false, delete: false },
    },
  },
  customRoles: [
    {
      id: 'cr1',
      name: 'Gerente de Campo',
      description: 'Gerente personalizado',
      baseRole: 'MANAGER',
      permissions: {
        farms: { create: true, read: true, update: false, delete: false },
        users: { create: false, read: true, update: false, delete: false },
      },
    },
  ],
};

describe('RolesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(MOCK_MATRIX);
  });

  async function renderPage() {
    const { default: RolesPage } = await import('./RolesPage');
    render(<RolesPage />);
    await screen.findByText('Papéis e Permissões');
  }

  it('renders the permission matrix correctly', async () => {
    await renderPage();
    expect(screen.getByText('Fazendas')).toBeDefined();
    expect(screen.getByText('Usuários')).toBeDefined();
    expect(screen.getAllByLabelText('Permitido').length).toBeGreaterThan(0);
  });

  it('shows edit and delete buttons only for custom roles', async () => {
    await renderPage();

    // Default role selected — no edit/delete buttons
    expect(screen.queryByLabelText('Editar papel')).toBeNull();
    expect(screen.queryByLabelText('Excluir papel')).toBeNull();

    // Select custom role
    const user = userEvent.setup();
    await user.click(screen.getByText('Gerente de Campo'));

    expect(screen.getByLabelText('Editar papel')).toBeDefined();
    expect(screen.getByLabelText('Excluir papel')).toBeDefined();
  });

  it('edit modal: fields pre-filled and checkboxes reflect current permissions', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByText('Gerente de Campo'));
    await user.click(screen.getByLabelText('Editar papel'));

    const dialog = screen.getByRole('dialog');
    const nameInput = within(dialog).getByLabelText('Nome *') as HTMLInputElement;
    const descInput = within(dialog).getByLabelText('Descrição') as HTMLInputElement;
    expect(nameInput.value).toBe('Gerente de Campo');
    expect(descInput.value).toBe('Gerente personalizado');

    // farms:create is checked (allowed in current permissions)
    const farmsCreate = within(dialog).getByLabelText('Fazendas — Criar') as HTMLInputElement;
    expect(farmsCreate.checked).toBe(true);

    // farms:update is unchecked
    const farmsUpdate = within(dialog).getByLabelText('Fazendas — Editar') as HTMLInputElement;
    expect(farmsUpdate.checked).toBe(false);

    // farms:delete is disabled (baseRole MANAGER doesn't have it)
    const farmsDelete = within(dialog).getByLabelText('Fazendas — Excluir') as HTMLInputElement;
    expect(farmsDelete.disabled).toBe(true);
  });

  it('edit modal: save calls PATCH with correct permissions', async () => {
    mockPatch.mockResolvedValue({});
    mockGet.mockResolvedValue(MOCK_MATRIX);
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByText('Gerente de Campo'));
    await user.click(screen.getByLabelText('Editar papel'));

    const dialog = screen.getByRole('dialog');

    // Toggle farms:update on
    await user.click(within(dialog).getByLabelText('Fazendas — Editar'));

    await user.click(within(dialog).getByText('Salvar alterações'));

    expect(mockPatch).toHaveBeenCalledWith(
      '/org/roles/cr1',
      expect.objectContaining({
        name: 'Gerente de Campo',
        permissions: expect.arrayContaining([{ permission: 'farms:update', allowed: true }]),
      }),
    );
  });

  it('delete modal: button disabled until name is typed correctly', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByText('Gerente de Campo'));
    await user.click(screen.getByLabelText('Excluir papel'));

    const dialog = screen.getByRole('dialog');
    const deleteBtn = within(dialog).getByText('Excluir') as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);

    // Type partial name
    await user.type(within(dialog).getByLabelText(/Digite/), 'Gerente');
    expect(deleteBtn.disabled).toBe(true);

    // Type full name
    await user.clear(within(dialog).getByLabelText(/Digite/));
    await user.type(within(dialog).getByLabelText(/Digite/), 'Gerente de Campo');
    expect(deleteBtn.disabled).toBe(false);
  });

  it('delete modal: confirm calls DELETE', async () => {
    mockDelete.mockResolvedValue({});
    mockGet.mockResolvedValue(MOCK_MATRIX);
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByText('Gerente de Campo'));
    await user.click(screen.getByLabelText('Excluir papel'));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Digite/), 'Gerente de Campo');
    await user.click(within(dialog).getByText('Excluir'));

    expect(mockDelete).toHaveBeenCalledWith('/org/roles/cr1');
  });
});
