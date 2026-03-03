import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, Plus, Shield, AlertCircle, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { api } from '@/services/api';
import './RolesPage.css';

interface CustomRole {
  id: string;
  name: string;
  description?: string;
  baseRole: string;
  permissions: Record<string, Record<string, boolean>>;
}

interface PermissionMatrix {
  modules: string[];
  actions: string[];
  defaults: Record<string, Record<string, Record<string, boolean>>>;
  customRoles: CustomRole[];
}

interface CreateRoleForm {
  name: string;
  baseRole: string;
  description: string;
}

interface EditRoleForm {
  name: string;
  description: string;
  permissions: Record<string, Record<string, boolean>>;
}

const MODULE_LABELS: Record<string, string> = {
  organizations: 'Organizações',
  users: 'Usuários',
  farms: 'Fazendas',
  operations: 'Operações',
  financial: 'Financeiro',
  reports: 'Relatórios',
  settings: 'Configurações',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Criar',
  read: 'Ler',
  update: 'Editar',
  delete: 'Excluir',
};

const ASSIGNABLE_ROLES = ['MANAGER', 'AGRONOMIST', 'FINANCIAL', 'OPERATOR', 'COWBOY', 'CONSULTANT'];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Gerente',
  AGRONOMIST: 'Agrônomo',
  FINANCIAL: 'Financeiro',
  OPERATOR: 'Operador',
  COWBOY: 'Peão',
  CONSULTANT: 'Consultor',
};

function RolesPage() {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('ADMIN');
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateRoleForm>({
    name: '',
    baseRole: 'MANAGER',
    description: '',
  });
  const [creating, setCreating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditRoleForm>({
    name: '',
    description: '',
    permissions: {},
  });
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMessage(null), 3000);
  };

  const fetchMatrix = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<PermissionMatrix>('/org/permissions/matrix');
      setMatrix(data);
    } catch {
      setError('Não foi possível carregar as permissões. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMatrix();
  }, [fetchMatrix]);

  const handleCreateRole = async () => {
    if (!createForm.name.trim()) return;
    try {
      setCreating(true);
      setError(null);
      await api.post('/org/roles', {
        name: createForm.name.trim(),
        baseRole: createForm.baseRole,
        description: createForm.description.trim() || undefined,
      });
      setShowCreateModal(false);
      setCreateForm({ name: '', baseRole: 'MANAGER', description: '' });
      await fetchMatrix();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível criar o papel.';
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const getSelectedCustomRole = (): CustomRole | null => {
    if (!matrix || !selectedCustomRoleId) return null;
    return matrix.customRoles.find((cr) => cr.id === selectedCustomRoleId) ?? null;
  };

  const selectedCustomRole = getSelectedCustomRole();

  const openEditModal = () => {
    if (!selectedCustomRole || !matrix) return;
    const permsCopy: Record<string, Record<string, boolean>> = {};
    for (const mod of matrix.modules) {
      permsCopy[mod] = {};
      for (const action of matrix.actions) {
        permsCopy[mod][action] = selectedCustomRole.permissions[mod]?.[action] ?? false;
      }
    }
    setEditForm({
      name: selectedCustomRole.name,
      description: (selectedCustomRole as CustomRole & { description?: string }).description ?? '',
      permissions: permsCopy,
    });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!selectedCustomRoleId || !matrix) return;
    try {
      setSaving(true);
      setError(null);
      const permissions: { permission: string; allowed: boolean }[] = [];
      for (const mod of matrix.modules) {
        for (const action of matrix.actions) {
          permissions.push({
            permission: `${mod}:${action}`,
            allowed: editForm.permissions[mod]?.[action] ?? false,
          });
        }
      }
      await api.patch(`/org/roles/${selectedCustomRoleId}`, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        permissions,
      });
      setShowEditModal(false);
      await fetchMatrix();
      showSuccess('Papel atualizado com sucesso.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar as alterações.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedCustomRoleId) return;
    try {
      setDeleting(true);
      setError(null);
      await api.delete(`/org/roles/${selectedCustomRoleId}`);
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      setSelectedCustomRoleId(null);
      setSelectedRole('ADMIN');
      await fetchMatrix();
      showSuccess('Papel excluído com sucesso.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível excluir o papel.';
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  const isPermissionAllowedByBase = (mod: string, action: string): boolean => {
    if (!matrix || !selectedCustomRole) return false;
    return matrix.defaults[selectedCustomRole.baseRole]?.[mod]?.[action] ?? false;
  };

  const getPermissions = (): Record<string, Record<string, boolean>> | null => {
    if (!matrix) return null;

    if (selectedCustomRoleId) {
      const custom = matrix.customRoles.find((cr) => cr.id === selectedCustomRoleId);
      return custom?.permissions ?? null;
    }

    return matrix.defaults[selectedRole] ?? null;
  };

  const currentPermissions = getPermissions();

  if (isLoading) {
    return (
      <main className="roles-page" id="main-content">
        <div className="roles-page__loading" aria-live="polite">
          <div
            className="roles-page__skeleton"
            style={{ width: '200px', height: '32px', marginBottom: '24px' }}
          />
          <div className="roles-page__skeleton" style={{ width: '100%', height: '300px' }} />
        </div>
      </main>
    );
  }

  return (
    <main className="roles-page" id="main-content">
      <header className="roles-page__header">
        <div>
          <h1 className="roles-page__title">Papéis e Permissões</h1>
          <p className="roles-page__subtitle">Gerencie os papéis e suas permissões por módulo</p>
        </div>
        <button
          type="button"
          className="roles-page__btn roles-page__btn--primary"
          onClick={() => setShowCreateModal(true)}
          aria-label="Clonar papel"
        >
          <Plus aria-hidden="true" size={20} />
          Clonar papel
        </button>
      </header>

      {error && (
        <div className="roles-page__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Role Selector */}
      <nav className="roles-page__selector" aria-label="Seletor de papéis">
        {Object.keys(matrix?.defaults ?? {}).map((role) => (
          <button
            key={role}
            type="button"
            className={`roles-page__role-btn ${selectedRole === role && !selectedCustomRoleId ? 'roles-page__role-btn--active' : ''}`}
            onClick={() => {
              setSelectedRole(role);
              setSelectedCustomRoleId(null);
            }}
            aria-pressed={selectedRole === role && !selectedCustomRoleId}
          >
            <Shield aria-hidden="true" size={16} />
            {ROLE_LABELS[role] ?? role}
          </button>
        ))}
        {matrix?.customRoles.map((cr) => (
          <button
            key={cr.id}
            type="button"
            className={`roles-page__role-btn roles-page__role-btn--custom ${selectedCustomRoleId === cr.id ? 'roles-page__role-btn--active' : ''}`}
            onClick={() => {
              setSelectedCustomRoleId(cr.id);
              setSelectedRole('');
            }}
            aria-pressed={selectedCustomRoleId === cr.id}
          >
            <Shield aria-hidden="true" size={16} />
            {cr.name}
          </button>
        ))}
      </nav>

      {successMessage && (
        <div className="roles-page__success" role="status" aria-live="polite">
          <CheckCircle aria-hidden="true" size={16} />
          {successMessage}
        </div>
      )}

      {/* Permission Matrix Table */}
      <section className="roles-page__matrix">
        <table className="roles-page__table">
          <caption>
            <span className="roles-page__caption-content">
              <span>
                Permissões de{' '}
                {selectedCustomRoleId
                  ? selectedCustomRole?.name
                  : (ROLE_LABELS[selectedRole] ?? selectedRole)}
              </span>
              {selectedCustomRoleId && (
                <span className="roles-page__caption-actions">
                  <button
                    type="button"
                    className="roles-page__icon-btn"
                    onClick={openEditModal}
                    aria-label="Editar papel"
                  >
                    <Pencil aria-hidden="true" size={20} />
                  </button>
                  <button
                    type="button"
                    className="roles-page__icon-btn roles-page__icon-btn--danger"
                    onClick={() => {
                      setDeleteConfirmText('');
                      setShowDeleteModal(true);
                    }}
                    aria-label="Excluir papel"
                  >
                    <Trash2 aria-hidden="true" size={20} />
                  </button>
                </span>
              )}
            </span>
          </caption>
          <thead>
            <tr>
              <th scope="col">Módulo</th>
              {matrix?.actions.map((action) => (
                <th key={action} scope="col">
                  {ACTION_LABELS[action] ?? action}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix?.modules.map((mod) => (
              <tr key={mod}>
                <td>{MODULE_LABELS[mod] ?? mod}</td>
                {matrix.actions.map((action) => {
                  const allowed = currentPermissions?.[mod]?.[action] ?? false;
                  return (
                    <td key={action}>
                      {allowed ? (
                        <span className="roles-page__check" aria-label="Permitido">
                          <Check aria-hidden="true" size={20} />
                        </span>
                      ) : (
                        <span className="roles-page__deny" aria-label="Negado">
                          <X aria-hidden="true" size={20} />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Create Role Modal */}
      {showCreateModal && (
        <div
          className="roles-page__modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-role-title"
        >
          <div className="roles-page__modal">
            <h2 id="create-role-title" className="roles-page__modal-title">
              Clonar papel
            </h2>

            <div className="roles-page__form-group">
              <label htmlFor="role-name" className="roles-page__label">
                Nome *
              </label>
              <input
                id="role-name"
                type="text"
                className="roles-page__input"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Gerente de Campo"
                aria-required="true"
              />
            </div>

            <div className="roles-page__form-group">
              <label htmlFor="role-base" className="roles-page__label">
                Papel base *
              </label>
              <select
                id="role-base"
                className="roles-page__select"
                value={createForm.baseRole}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, baseRole: e.target.value }))}
                aria-required="true"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] ?? r}
                  </option>
                ))}
              </select>
            </div>

            <div className="roles-page__form-group">
              <label htmlFor="role-description" className="roles-page__label">
                Descrição
              </label>
              <input
                id="role-description"
                type="text"
                className="roles-page__input"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Descrição do papel customizado"
              />
            </div>

            <div className="roles-page__modal-actions">
              <button
                type="button"
                className="roles-page__btn roles-page__btn--secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="roles-page__btn roles-page__btn--primary"
                onClick={() => void handleCreateRole()}
                disabled={creating || !createForm.name.trim()}
              >
                {creating ? 'Criando...' : 'Criar papel'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Role Modal */}
      {showEditModal && matrix && selectedCustomRole && (
        <div
          className="roles-page__modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-role-title"
        >
          <div className="roles-page__modal roles-page__modal--wide">
            <h2 id="edit-role-title" className="roles-page__modal-title">
              Editar papel
            </h2>

            <div className="roles-page__form-group">
              <label htmlFor="edit-role-name" className="roles-page__label">
                Nome *
              </label>
              <input
                id="edit-role-name"
                type="text"
                className="roles-page__input"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                aria-required="true"
              />
            </div>

            <div className="roles-page__form-group">
              <label htmlFor="edit-role-description" className="roles-page__label">
                Descrição
              </label>
              <input
                id="edit-role-description"
                type="text"
                className="roles-page__input"
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição do papel customizado"
              />
            </div>

            <div className="roles-page__form-group">
              <span className="roles-page__label">Permissões</span>
              <div className="roles-page__matrix roles-page__matrix--edit">
                <table className="roles-page__table">
                  <thead>
                    <tr>
                      <th scope="col">Módulo</th>
                      {matrix.actions.map((action) => (
                        <th key={action} scope="col">
                          {ACTION_LABELS[action] ?? action}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.modules.map((mod) => (
                      <tr key={mod}>
                        <td>{MODULE_LABELS[mod] ?? mod}</td>
                        {matrix.actions.map((action) => {
                          const checked = editForm.permissions[mod]?.[action] ?? false;
                          const baseAllowed = isPermissionAllowedByBase(mod, action);
                          const disabled = !baseAllowed;
                          return (
                            <td key={action}>
                              <label
                                className="roles-page__checkbox-cell"
                                title={
                                  disabled
                                    ? `Não disponível no papel base ${ROLE_LABELS[selectedCustomRole.baseRole] ?? selectedCustomRole.baseRole}`
                                    : undefined
                                }
                              >
                                <input
                                  type="checkbox"
                                  className="roles-page__checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={(e) => {
                                    setEditForm((prev) => ({
                                      ...prev,
                                      permissions: {
                                        ...prev.permissions,
                                        [mod]: {
                                          ...prev.permissions[mod],
                                          [action]: e.target.checked,
                                        },
                                      },
                                    }));
                                  }}
                                  aria-label={`${MODULE_LABELS[mod] ?? mod} — ${ACTION_LABELS[action] ?? action}`}
                                />
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="roles-page__modal-actions">
              <button
                type="button"
                className="roles-page__btn roles-page__btn--secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="roles-page__btn roles-page__btn--primary"
                onClick={() => void handleEditSave()}
                disabled={saving || !editForm.name.trim()}
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role Modal */}
      {showDeleteModal && selectedCustomRole && (
        <div
          className="roles-page__modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-role-title"
        >
          <div className="roles-page__modal">
            <h2 id="delete-role-title" className="roles-page__modal-title">
              Excluir papel
            </h2>

            <p className="roles-page__delete-warning">
              Essa ação é irreversível. Usuários com este papel voltarão ao papel base{' '}
              <strong>
                {ROLE_LABELS[selectedCustomRole.baseRole] ?? selectedCustomRole.baseRole}
              </strong>
              .
            </p>

            <div className="roles-page__form-group">
              <label htmlFor="delete-confirm" className="roles-page__label">
                Digite <strong>{selectedCustomRole.name}</strong> para confirmar
              </label>
              <input
                id="delete-confirm"
                type="text"
                className="roles-page__input"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={selectedCustomRole.name}
                aria-required="true"
              />
            </div>

            <div className="roles-page__modal-actions">
              <button
                type="button"
                className="roles-page__btn roles-page__btn--secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="roles-page__btn roles-page__btn--danger"
                onClick={() => void handleDeleteRole()}
                disabled={deleting || deleteConfirmText !== selectedCustomRole.name}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default RolesPage;
