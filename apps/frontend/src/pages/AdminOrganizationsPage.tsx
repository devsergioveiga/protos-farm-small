import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2,
  Plus,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  X,
  UserX,
  Trash2,
  RotateCcw,
  KeyRound,
} from 'lucide-react';
import { api } from '@/services/api';
import { useAdminOrganizations } from '@/hooks/useAdminOrganizations';
import type {
  Organization,
  CreateOrganizationPayload,
  CreateOrgAdminPayload,
  OrgUser,
} from '@/types/admin';
import './AdminOrganizationsPage.css';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  CANCELLED: 'Cancelada',
};

const PLAN_LABELS: Record<string, string> = {
  basic: 'Básico',
  professional: 'Profissional',
  enterprise: 'Enterprise',
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ['SUSPENDED', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [],
};

function formatDocument(doc: string | null, type: string): string {
  if (!doc) return '—';
  const digits = doc.replace(/\D/g, '');
  if (type === 'PJ' && digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return doc;
}

function AdminOrganizationsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { organizations, meta, isLoading, error, refetch } = useAdminOrganizations({
    page,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create org form
  const [createForm, setCreateForm] = useState<CreateOrganizationPayload>({
    name: '',
    type: 'PJ',
    document: '',
    plan: 'basic',
    maxUsers: 10,
    maxFarms: 5,
  });

  // Detail modal states
  const [newStatus, setNewStatus] = useState('');
  const [newPlan, setNewPlan] = useState('');
  const [newMaxUsers, setNewMaxUsers] = useState(0);
  const [newMaxFarms, setNewMaxFarms] = useState(0);

  // Create admin form
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState<CreateOrgAdminPayload>({
    name: '',
    email: '',
    phone: '',
  });
  const [adminFormError, setAdminFormError] = useState<string | null>(null);

  const resetCreateForm = () => {
    setCreateForm({ name: '', type: 'PJ', document: '', plan: 'basic', maxUsers: 10, maxFarms: 5 });
    setModalError(null);
    setModalSuccess(null);
  };

  const openDetailModal = useCallback(async (org: Organization) => {
    setSelectedOrg(org);
    setNewStatus(org.status);
    setNewPlan(org.plan);
    setNewMaxUsers(org.maxUsers);
    setNewMaxFarms(org.maxFarms);
    setModalError(null);
    setModalSuccess(null);
    setShowAdminForm(false);
    setAdminForm({ name: '', email: '', phone: '' });
    setAdminFormError(null);
    try {
      const detail = await api.get<Organization>(`/admin/organizations/${org.id}`);
      setSelectedOrg(detail);
    } catch {
      // keep list data if detail fetch fails
    }
  }, []);

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.document.trim()) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.post('/admin/organizations', {
        ...createForm,
        name: createForm.name.trim(),
        document: createForm.document.trim(),
      });
      setShowCreateModal(false);
      resetCreateForm();
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível criar a organização.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedOrg || newStatus === selectedOrg.status) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.patch(`/admin/organizations/${selectedOrg.id}/status`, { status: newStatus });
      setModalSuccess('Status atualizado com sucesso.');
      await refetch();
      // Refresh selected org
      const updated = await api.get<Organization>(`/admin/organizations/${selectedOrg.id}`);
      setSelectedOrg(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível alterar o status.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePlanChange = async () => {
    if (!selectedOrg) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.patch(`/admin/organizations/${selectedOrg.id}/plan`, {
        plan: newPlan,
        maxUsers: newMaxUsers,
        maxFarms: newMaxFarms,
      });
      setModalSuccess('Plano atualizado com sucesso.');
      await refetch();
      const updated = await api.get<Organization>(`/admin/organizations/${selectedOrg.id}`);
      setSelectedOrg(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível alterar o plano.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSessionPolicy = async () => {
    if (!selectedOrg) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.patch(`/admin/organizations/${selectedOrg.id}/session-policy`, {
        allowMultipleSessions: !selectedOrg.allowMultipleSessions,
      });
      setModalSuccess('Política de sessão atualizada.');
      await refetch();
      const updated = await api.get<Organization>(`/admin/organizations/${selectedOrg.id}`);
      setSelectedOrg(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao alterar política de sessão.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSocialLogin = async () => {
    if (!selectedOrg) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.patch(`/admin/organizations/${selectedOrg.id}/social-login-policy`, {
        allowSocialLogin: !selectedOrg.allowSocialLogin,
      });
      setModalSuccess('Política de login social atualizada.');
      await refetch();
      const updated = await api.get<Organization>(`/admin/organizations/${selectedOrg.id}`);
      setSelectedOrg(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao alterar login social.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!selectedOrg || !adminForm.name.trim() || !adminForm.email.trim()) return;
    try {
      setSubmitting(true);
      setAdminFormError(null);
      await api.post<OrgUser>(`/admin/organizations/${selectedOrg.id}/users`, {
        name: adminForm.name.trim(),
        email: adminForm.email.trim(),
        phone: adminForm.phone?.trim() || undefined,
      });
      setModalSuccess('Admin criado com sucesso. Um email de convite foi enviado.');
      setShowAdminForm(false);
      setAdminForm({ name: '', email: '', phone: '' });
      setAdminFormError(null);
      const updated = await api.get<Organization>(`/admin/organizations/${selectedOrg.id}`);
      setSelectedOrg(updated);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível criar o admin.';
      setAdminFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete confirmation
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  const handleDeactivateUser = async (userId: string) => {
    if (!selectedOrg) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.patch(`/admin/organizations/${selectedOrg.id}/users/${userId}/deactivate`);
      setModalSuccess('Usuário inativado com sucesso.');
      const updated = await api.get<Organization>(`/admin/organizations/${selectedOrg.id}`);
      setSelectedOrg(updated);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao inativar usuário.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!selectedOrg) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.delete(`/admin/organizations/${selectedOrg.id}/users/${userId}`);
      setModalSuccess('Usuário removido com sucesso.');
      setDeleteConfirmUser(null);
      setDeleteConfirmInput('');
      const updated = await api.get<Organization>(`/admin/organizations/${selectedOrg.id}`);
      setSelectedOrg(updated);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover usuário.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!selectedOrg) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.post(`/admin/organizations/${selectedOrg.id}/users/${userId}/reset-password`);
      setModalSuccess('Email de redefinição de senha enviado.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao resetar senha.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlock = async (userId: string) => {
    if (!selectedOrg) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.patch(`/admin/organizations/${selectedOrg.id}/users/${userId}/unlock`);
      setModalSuccess('Usuário desbloqueado com sucesso.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao desbloquear usuário.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading
  if (isLoading && organizations.length === 0) {
    return (
      <section className="admin-orgs" aria-live="polite">
        <div
          className="admin-orgs__skeleton"
          style={{ width: '200px', height: '32px', marginBottom: '24px' }}
        />
        <div
          className="admin-orgs__skeleton"
          style={{ width: '100%', height: '48px', marginBottom: '16px' }}
        />
        <div className="admin-orgs__skeleton" style={{ width: '100%', height: '300px' }} />
      </section>
    );
  }

  return (
    <section className="admin-orgs">
      <header className="admin-orgs__header">
        <div>
          <h1 className="admin-orgs__title">Organizações</h1>
          <p className="admin-orgs__subtitle">Gerencie as organizações do sistema</p>
        </div>
        <button
          type="button"
          className="admin-orgs__btn admin-orgs__btn--primary"
          onClick={() => {
            resetCreateForm();
            setShowCreateModal(true);
          }}
        >
          <Plus aria-hidden="true" size={20} />
          Nova organização
        </button>
      </header>

      {error && (
        <div className="admin-orgs__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="admin-orgs__toolbar">
        <label htmlFor="org-search" className="sr-only">
          Buscar organizações
        </label>
        <input
          id="org-search"
          type="text"
          className="admin-orgs__search"
          placeholder="Buscar por nome ou documento..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <label htmlFor="org-status-filter" className="sr-only">
          Filtrar por status
        </label>
        <select
          id="org-status-filter"
          className="admin-orgs__filter-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativas</option>
          <option value="SUSPENDED">Suspensas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
      </div>

      {/* Content */}
      {organizations.length === 0 && !isLoading ? (
        <div className="admin-orgs__empty">
          <Building2 size={48} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="admin-orgs__empty-title">Nenhuma organização encontrada</h2>
          <p className="admin-orgs__empty-desc">
            {search || statusFilter
              ? 'Tente ajustar os filtros de busca.'
              : 'Cadastre a primeira organização para começar.'}
          </p>
          {!search && !statusFilter && (
            <button
              type="button"
              className="admin-orgs__btn admin-orgs__btn--primary"
              onClick={() => {
                resetCreateForm();
                setShowCreateModal(true);
              }}
            >
              <Plus aria-hidden="true" size={20} />
              Nova organização
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="admin-orgs__table-wrapper">
            <table className="admin-orgs__table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Documento</th>
                  <th scope="col">Plano</th>
                  <th scope="col">Status</th>
                  <th scope="col">Usuários</th>
                  <th scope="col">Fazendas</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr
                    key={org.id}
                    className="admin-orgs__table-row"
                    onClick={() => openDetailModal(org)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver detalhes de ${org.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetailModal(org);
                      }
                    }}
                  >
                    <td>
                      <span className="admin-orgs__org-name">{org.name}</span>
                    </td>
                    <td>{org.type}</td>
                    <td>
                      <span className="admin-orgs__org-doc">
                        {formatDocument(org.document, org.type)}
                      </span>
                    </td>
                    <td>{PLAN_LABELS[org.plan] ?? org.plan}</td>
                    <td>
                      <span
                        className={`admin-orgs__badge admin-orgs__badge--${org.status.toLowerCase()}`}
                      >
                        {STATUS_LABELS[org.status] ?? org.status}
                      </span>
                    </td>
                    <td>{org._count.users}</td>
                    <td>{org._count.farms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="admin-orgs__cards">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="admin-orgs__card"
                onClick={() => openDetailModal(org)}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalhes de ${org.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetailModal(org);
                  }
                }}
              >
                <div className="admin-orgs__card-header">
                  <h3 className="admin-orgs__card-name">{org.name}</h3>
                  <span
                    className={`admin-orgs__badge admin-orgs__badge--${org.status.toLowerCase()}`}
                  >
                    {STATUS_LABELS[org.status] ?? org.status}
                  </span>
                </div>
                <div className="admin-orgs__card-row">
                  <span className="admin-orgs__card-label">Documento</span>
                  <span className="admin-orgs__card-value">
                    {formatDocument(org.document, org.type)}
                  </span>
                </div>
                <div className="admin-orgs__card-row">
                  <span className="admin-orgs__card-label">Plano</span>
                  <span className="admin-orgs__card-value">
                    {PLAN_LABELS[org.plan] ?? org.plan}
                  </span>
                </div>
                <div className="admin-orgs__card-row">
                  <span className="admin-orgs__card-label">Usuários / Fazendas</span>
                  <span className="admin-orgs__card-value">
                    {org._count.users} / {org._count.farms}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="admin-orgs__pagination" aria-label="Paginação de organizações">
              <button
                type="button"
                className="admin-orgs__pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft aria-hidden="true" size={16} />
                Anterior
              </button>
              <span>
                Página {meta.page} de {meta.totalPages}
              </span>
              <button
                type="button"
                className="admin-orgs__pagination-btn"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </nav>
          )}
        </>
      )}

      {/* ─── Create Organization Modal ─────────────────────────── */}
      {showCreateModal && (
        <div
          className="admin-orgs__modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-org-title"
        >
          <div className="admin-orgs__modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2
                id="create-org-title"
                className="admin-orgs__modal-title"
                style={{ marginBottom: 0 }}
              >
                Nova organização
              </h2>
              <button
                type="button"
                className="admin-orgs__btn admin-orgs__btn--secondary admin-orgs__btn--small"
                onClick={() => setShowCreateModal(false)}
                aria-label="Fechar"
                style={{ padding: '8px' }}
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            {modalError && (
              <div
                className="admin-orgs__error"
                role="alert"
                aria-live="polite"
                style={{ marginTop: '16px' }}
              >
                <AlertCircle aria-hidden="true" size={16} />
                {modalError}
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <div className="admin-orgs__form-group">
                <label htmlFor="create-name" className="admin-orgs__label">
                  Nome *
                </label>
                <input
                  id="create-name"
                  type="text"
                  className="admin-orgs__input"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome da organização"
                  aria-required="true"
                />
              </div>

              <div className="admin-orgs__form-row">
                <div className="admin-orgs__form-group">
                  <label htmlFor="create-type" className="admin-orgs__label">
                    Tipo *
                  </label>
                  <select
                    id="create-type"
                    className="admin-orgs__select"
                    value={createForm.type}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, type: e.target.value as 'PF' | 'PJ' }))
                    }
                    aria-required="true"
                  >
                    <option value="PJ">Pessoa Jurídica</option>
                    <option value="PF">Pessoa Física</option>
                  </select>
                </div>
                <div className="admin-orgs__form-group">
                  <label htmlFor="create-document" className="admin-orgs__label">
                    Documento *
                  </label>
                  <input
                    id="create-document"
                    type="text"
                    className="admin-orgs__input"
                    value={createForm.document}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, document: e.target.value }))
                    }
                    placeholder={createForm.type === 'PJ' ? 'CNPJ' : 'CPF'}
                    aria-required="true"
                  />
                </div>
              </div>

              <div className="admin-orgs__form-group">
                <label htmlFor="create-plan" className="admin-orgs__label">
                  Plano
                </label>
                <select
                  id="create-plan"
                  className="admin-orgs__select"
                  value={createForm.plan}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, plan: e.target.value }))}
                >
                  <option value="basic">Básico</option>
                  <option value="professional">Profissional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div className="admin-orgs__form-row">
                <div className="admin-orgs__form-group">
                  <label htmlFor="create-max-users" className="admin-orgs__label">
                    Máx. usuários
                  </label>
                  <input
                    id="create-max-users"
                    type="number"
                    className="admin-orgs__input"
                    value={createForm.maxUsers}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, maxUsers: Number(e.target.value) }))
                    }
                    min={1}
                  />
                </div>
                <div className="admin-orgs__form-group">
                  <label htmlFor="create-max-farms" className="admin-orgs__label">
                    Máx. fazendas
                  </label>
                  <input
                    id="create-max-farms"
                    type="number"
                    className="admin-orgs__input"
                    value={createForm.maxFarms}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, maxFarms: Number(e.target.value) }))
                    }
                    min={1}
                  />
                </div>
              </div>
            </div>

            <div className="admin-orgs__modal-actions">
              <button
                type="button"
                className="admin-orgs__btn admin-orgs__btn--secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="admin-orgs__btn admin-orgs__btn--primary"
                onClick={() => void handleCreate()}
                disabled={submitting || !createForm.name.trim() || !createForm.document.trim()}
              >
                {submitting ? 'Criando...' : 'Criar organização'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail / Edit Organization Modal ─────────────────── */}
      {selectedOrg && (
        <div
          className="admin-orgs__modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOrg(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-org-title"
        >
          <div className="admin-orgs__modal admin-orgs__modal--wide">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2
                id="detail-org-title"
                className="admin-orgs__modal-title"
                style={{ marginBottom: 0 }}
              >
                {selectedOrg.name}
              </h2>
              <button
                type="button"
                className="admin-orgs__btn admin-orgs__btn--secondary admin-orgs__btn--small"
                onClick={() => setSelectedOrg(null)}
                aria-label="Fechar"
                style={{ padding: '8px' }}
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            {modalError && (
              <div
                className="admin-orgs__error"
                role="alert"
                aria-live="polite"
                style={{ marginTop: '16px' }}
              >
                <AlertCircle aria-hidden="true" size={16} />
                {modalError}
              </div>
            )}
            {modalSuccess && (
              <div
                className="admin-orgs__success"
                role="status"
                aria-live="polite"
                style={{ marginTop: '16px' }}
              >
                <CheckCircle aria-hidden="true" size={16} />
                {modalSuccess}
              </div>
            )}

            {/* Org Info */}
            <div className="admin-orgs__info-grid" style={{ marginTop: '24px' }}>
              <div>
                <p className="admin-orgs__info-label">Tipo</p>
                <p className="admin-orgs__info-value">
                  {selectedOrg.type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                </p>
              </div>
              <div>
                <p className="admin-orgs__info-label">Documento</p>
                <p
                  className="admin-orgs__info-value"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {formatDocument(selectedOrg.document, selectedOrg.type)}
                </p>
              </div>
              <div>
                <p className="admin-orgs__info-label">Plano</p>
                <p className="admin-orgs__info-value">
                  {PLAN_LABELS[selectedOrg.plan] ?? selectedOrg.plan}
                </p>
              </div>
              <div>
                <p className="admin-orgs__info-label">Status</p>
                <p className="admin-orgs__info-value">
                  <span
                    className={`admin-orgs__badge admin-orgs__badge--${selectedOrg.status.toLowerCase()}`}
                  >
                    {STATUS_LABELS[selectedOrg.status] ?? selectedOrg.status}
                  </span>
                </p>
              </div>
              <div>
                <p className="admin-orgs__info-label">Usuários</p>
                <p className="admin-orgs__info-value">
                  {selectedOrg._count.users} / {selectedOrg.maxUsers}
                </p>
              </div>
              <div>
                <p className="admin-orgs__info-label">Fazendas</p>
                <p className="admin-orgs__info-value">
                  {selectedOrg._count.farms} / {selectedOrg.maxFarms}
                </p>
              </div>
            </div>

            {/* Actions: Status */}
            <div className="admin-orgs__modal-section">
              <h3 className="admin-orgs__modal-section-title">Alterar status</h3>
              {STATUS_TRANSITIONS[selectedOrg.status]?.length === 0 ? (
                <p
                  style={{
                    fontFamily: "'Source Sans 3', system-ui, sans-serif",
                    fontSize: '0.875rem',
                    color: 'var(--color-neutral-500)',
                  }}
                >
                  Organizações canceladas não podem mudar de status.
                </p>
              ) : (
                <div className="admin-orgs__action-row">
                  <label htmlFor="detail-status" className="sr-only">
                    Novo status
                  </label>
                  <select
                    id="detail-status"
                    className="admin-orgs__select"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    <option value={selectedOrg.status}>
                      {STATUS_LABELS[selectedOrg.status]} (atual)
                    </option>
                    {STATUS_TRANSITIONS[selectedOrg.status]?.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="admin-orgs__btn admin-orgs__btn--secondary admin-orgs__btn--small"
                    onClick={() => void handleStatusChange()}
                    disabled={submitting || newStatus === selectedOrg.status}
                  >
                    {submitting ? 'Salvando...' : 'Confirmar'}
                  </button>
                </div>
              )}
            </div>

            {/* Actions: Plan */}
            <div className="admin-orgs__modal-section">
              <h3 className="admin-orgs__modal-section-title">Alterar plano</h3>
              <div className="admin-orgs__plan-row">
                <div className="admin-orgs__form-group" style={{ flex: 2 }}>
                  <label htmlFor="detail-plan" className="admin-orgs__label">
                    Plano
                  </label>
                  <select
                    id="detail-plan"
                    className="admin-orgs__select"
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                  >
                    <option value="basic">Básico</option>
                    <option value="professional">Profissional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className="admin-orgs__form-group" style={{ flex: 1 }}>
                  <label htmlFor="detail-max-users" className="admin-orgs__label">
                    Máx. usuários
                  </label>
                  <input
                    id="detail-max-users"
                    type="number"
                    className="admin-orgs__input"
                    value={newMaxUsers}
                    onChange={(e) => setNewMaxUsers(Number(e.target.value))}
                    min={1}
                  />
                </div>
                <div className="admin-orgs__form-group" style={{ flex: 1 }}>
                  <label htmlFor="detail-max-farms" className="admin-orgs__label">
                    Máx. fazendas
                  </label>
                  <input
                    id="detail-max-farms"
                    type="number"
                    className="admin-orgs__input"
                    value={newMaxFarms}
                    onChange={(e) => setNewMaxFarms(Number(e.target.value))}
                    min={1}
                  />
                </div>
                <div
                  className="admin-orgs__form-group"
                  style={{ flex: 'none', alignSelf: 'flex-end' }}
                >
                  <button
                    type="button"
                    className="admin-orgs__btn admin-orgs__btn--secondary admin-orgs__btn--small"
                    onClick={() => void handlePlanChange()}
                    disabled={submitting}
                  >
                    {submitting ? 'Salvando...' : 'Atualizar'}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions: Toggles */}
            <div className="admin-orgs__modal-section">
              <h3 className="admin-orgs__modal-section-title">Políticas</h3>
              <div className="admin-orgs__toggle-row">
                <span className="admin-orgs__toggle-label">Sessão múltipla</span>
                <button
                  type="button"
                  className={`admin-orgs__toggle ${selectedOrg.allowMultipleSessions ? 'admin-orgs__toggle--active' : ''}`}
                  onClick={() => void handleToggleSessionPolicy()}
                  disabled={submitting}
                  role="switch"
                  aria-checked={selectedOrg.allowMultipleSessions}
                  aria-label="Permitir sessão múltipla"
                />
              </div>
              <div className="admin-orgs__toggle-row">
                <span className="admin-orgs__toggle-label">Login social (Google)</span>
                <button
                  type="button"
                  className={`admin-orgs__toggle ${selectedOrg.allowSocialLogin ? 'admin-orgs__toggle--active' : ''}`}
                  onClick={() => void handleToggleSocialLogin()}
                  disabled={submitting}
                  role="switch"
                  aria-checked={selectedOrg.allowSocialLogin}
                  aria-label="Permitir login social"
                />
              </div>
            </div>

            {/* Actions: Admin User */}
            <div className="admin-orgs__modal-section">
              <h3 className="admin-orgs__modal-section-title">Admin da organização</h3>

              {selectedOrg.users && selectedOrg.users.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <table className="admin-orgs__table" style={{ width: '100%', fontSize: '14px' }}>
                    <thead>
                      <tr>
                        <th scope="col" style={{ textAlign: 'left', padding: '8px 12px' }}>
                          Nome
                        </th>
                        <th scope="col" style={{ textAlign: 'left', padding: '8px 12px' }}>
                          Email
                        </th>
                        <th scope="col" style={{ textAlign: 'left', padding: '8px 12px' }}>
                          Status
                        </th>
                        <th scope="col" style={{ textAlign: 'right', padding: '8px 12px' }}>
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrg.users.map((u) => (
                        <tr key={u.id}>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ fontWeight: 600 }}>{u.name}</span>
                            <br />
                            <span
                              style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500)' }}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>{u.email}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span
                              className={`admin-orgs__badge admin-orgs__badge--${u.status === 'ACTIVE' ? 'active' : 'cancelled'}`}
                            >
                              {u.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <div className="admin-orgs__user-actions">
                              <button
                                type="button"
                                className="admin-orgs__icon-btn"
                                onClick={() => void handleResetPassword(u.id)}
                                disabled={submitting}
                                aria-label={`Resetar senha de ${u.name}`}
                                title="Resetar senha"
                              >
                                <KeyRound aria-hidden="true" size={16} />
                              </button>
                              {u.status === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  className="admin-orgs__icon-btn admin-orgs__icon-btn--warn"
                                  onClick={() => void handleDeactivateUser(u.id)}
                                  disabled={submitting}
                                  aria-label={`Inativar ${u.name}`}
                                  title="Inativar"
                                >
                                  <UserX aria-hidden="true" size={16} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-orgs__icon-btn"
                                  onClick={() => void handleUnlock(u.id)}
                                  disabled={submitting}
                                  aria-label={`Reativar ${u.name}`}
                                  title="Reativar"
                                >
                                  <RotateCcw aria-hidden="true" size={16} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="admin-orgs__icon-btn admin-orgs__icon-btn--danger"
                                onClick={() => setDeleteConfirmUser({ id: u.id, name: u.name })}
                                disabled={submitting}
                                aria-label={`Excluir ${u.name}`}
                                title="Excluir"
                              >
                                <Trash2 aria-hidden="true" size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!showAdminForm ? (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="admin-orgs__btn admin-orgs__btn--secondary admin-orgs__btn--small"
                    onClick={() => setShowAdminForm(true)}
                  >
                    <Plus aria-hidden="true" size={16} />
                    Criar admin
                  </button>
                </div>
              ) : (
                <div>
                  <div className="admin-orgs__form-group">
                    <label htmlFor="admin-name" className="admin-orgs__label">
                      Nome *
                    </label>
                    <input
                      id="admin-name"
                      type="text"
                      className="admin-orgs__input"
                      value={adminForm.name}
                      onChange={(e) => setAdminForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome completo"
                      aria-required="true"
                    />
                  </div>
                  <div className="admin-orgs__form-row">
                    <div className="admin-orgs__form-group">
                      <label htmlFor="admin-email" className="admin-orgs__label">
                        Email *
                      </label>
                      <input
                        id="admin-email"
                        type="email"
                        className={`admin-orgs__input${adminFormError ? ' admin-orgs__input--error' : ''}`}
                        value={adminForm.email}
                        onChange={(e) => {
                          setAdminForm((prev) => ({ ...prev, email: e.target.value }));
                          if (adminFormError) setAdminFormError(null);
                        }}
                        placeholder="email@exemplo.com"
                        aria-required="true"
                        aria-invalid={!!adminFormError}
                        aria-describedby={adminFormError ? 'admin-email-error' : undefined}
                      />
                      {adminFormError && (
                        <span
                          id="admin-email-error"
                          className="admin-orgs__field-error"
                          role="alert"
                          aria-live="polite"
                        >
                          <AlertCircle aria-hidden="true" size={14} />
                          {adminFormError}
                        </span>
                      )}
                    </div>
                    <div className="admin-orgs__form-group">
                      <label htmlFor="admin-phone" className="admin-orgs__label">
                        Telefone
                      </label>
                      <input
                        id="admin-phone"
                        type="tel"
                        className="admin-orgs__input"
                        value={adminForm.phone}
                        onChange={(e) =>
                          setAdminForm((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="admin-orgs__btn admin-orgs__btn--secondary admin-orgs__btn--small"
                      onClick={() => setShowAdminForm(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="admin-orgs__btn admin-orgs__btn--primary admin-orgs__btn--small"
                      onClick={() => void handleCreateAdmin()}
                      disabled={submitting || !adminForm.name.trim() || !adminForm.email.trim()}
                    >
                      {submitting ? 'Criando...' : 'Criar admin'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete User Confirmation Modal ────────────────────── */}
      {deleteConfirmUser && (
        <div
          className="admin-orgs__modal-overlay"
          style={{ zIndex: 60 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeleteConfirmUser(null);
              setDeleteConfirmInput('');
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
        >
          <div className="admin-orgs__modal" style={{ maxWidth: '480px' }}>
            <h2
              id="delete-user-title"
              className="admin-orgs__modal-title"
              style={{ color: 'var(--color-error-500)' }}
            >
              <Trash2
                aria-hidden="true"
                size={20}
                style={{ marginRight: '8px', verticalAlign: 'text-bottom' }}
              />
              Excluir usuário
            </h2>
            <p
              style={{
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
                fontSize: '0.9375rem',
                color: 'var(--color-neutral-700)',
                marginBottom: '16px',
                lineHeight: 1.5,
              }}
            >
              Esta ação é irreversível. Para confirmar, digite o nome do usuário:{' '}
              <strong>{deleteConfirmUser.name}</strong>
            </p>
            <div className="admin-orgs__form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="delete-confirm-input" className="admin-orgs__label">
                Nome do usuário
              </label>
              <input
                id="delete-confirm-input"
                type="text"
                className="admin-orgs__input"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={deleteConfirmUser.name}
                autoFocus
              />
            </div>
            <div className="admin-orgs__modal-actions">
              <button
                type="button"
                className="admin-orgs__btn admin-orgs__btn--secondary"
                onClick={() => {
                  setDeleteConfirmUser(null);
                  setDeleteConfirmInput('');
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="admin-orgs__btn admin-orgs__btn--danger"
                onClick={() => void handleDeleteUser(deleteConfirmUser.id)}
                disabled={submitting || deleteConfirmInput !== deleteConfirmUser.name}
              >
                {submitting ? 'Excluindo...' : 'Excluir usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default AdminOrganizationsPage;
