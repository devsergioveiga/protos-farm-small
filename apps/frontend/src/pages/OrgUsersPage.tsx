import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  Plus,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCw,
  UserX,
  UserCheck,
  KeyRound,
  Mail,
  Link2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/services/api';
import { useOrgUsers } from '@/hooks/useOrgUsers';
import { useUserLimit } from '@/hooks/useUserLimit';
import { useFarms } from '@/hooks/useFarms';
import PermissionGate from '@/components/auth/PermissionGate';
import type { OrgUserListItem, OrgUserDetail, CreateOrgUserPayload } from '@/types/org-user';
import './OrgUsersPage.css';

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

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
};

const ASSIGNABLE_ROLES = ['MANAGER', 'AGRONOMIST', 'FINANCIAL', 'OPERATOR', 'COWBOY', 'CONSULTANT'];

function OrgUsersPage() {
  // ─── List state ────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { users, meta, isLoading, error, refetch } = useOrgUsers({
    page,
    search: search || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
  });

  const { limit, refetch: refetchLimit } = useUserLimit();
  const { farms: allFarms } = useFarms();

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

  // ─── Create Modal ──────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateOrgUserPayload>({
    name: '',
    email: '',
    phone: '',
    role: 'OPERATOR',
    farmIds: [],
  });

  // ─── Detail Modal ──────────────────────────────────────────────
  const [selectedUser, setSelectedUser] = useState<OrgUserDetail | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editFarmIds, setEditFarmIds] = useState<string[]>([]);

  // ─── Modal feedback ────────────────────────────────────────────
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetCreateForm = () => {
    setCreateForm({ name: '', email: '', phone: '', role: 'OPERATOR', farmIds: [] });
    setModalError(null);
    setModalSuccess(null);
  };

  const openDetailModal = useCallback(async (user: OrgUserListItem) => {
    setModalError(null);
    setModalSuccess(null);
    setEditMode(false);
    try {
      const detail = await api.get<OrgUserDetail>(`/org/users/${user.id}`);
      setSelectedUser(detail);
      setEditName(detail.name);
      setEditPhone(detail.phone ?? '');
      setEditRole(detail.role);
      setEditFarmIds(detail.farmAccess.map((fa) => fa.farm.id));
    } catch {
      setSelectedUser(null);
    }
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.role) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.post('/org/users', {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone?.trim() || undefined,
        role: createForm.role,
        farmIds: createForm.farmIds?.length ? createForm.farmIds : undefined,
      });
      setShowCreateModal(false);
      resetCreateForm();
      await refetch();
      await refetchLimit();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível criar o usuário.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.patch(`/org/users/${selectedUser.id}`, {
        name: editName.trim() || undefined,
        phone: editPhone.trim() || undefined,
        role: editRole !== selectedUser.role ? editRole : undefined,
        farmIds: editFarmIds,
      });
      setModalSuccess('Usuário atualizado com sucesso.');
      const updated = await api.get<OrgUserDetail>(`/org/users/${selectedUser.id}`);
      setSelectedUser(updated);
      setEditMode(false);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível atualizar o usuário.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedUser) return;
    const newStatus = selectedUser.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      setSubmitting(true);
      setModalError(null);
      await api.patch(`/org/users/${selectedUser.id}/status`, { status: newStatus });
      setModalSuccess(
        newStatus === 'ACTIVE' ? 'Usuário ativado com sucesso.' : 'Usuário desativado com sucesso.',
      );
      const updated = await api.get<OrgUserDetail>(`/org/users/${selectedUser.id}`);
      setSelectedUser(updated);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível alterar o status.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.post(`/org/users/${selectedUser.id}/reset-password`);
      setModalSuccess('Email de redefinição de senha enviado.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível enviar email de reset.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendInvite = async () => {
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      setModalError(null);
      await api.post(`/org/users/${selectedUser.id}/resend-invite`);
      setModalSuccess('Convite reenviado com sucesso.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível reenviar o convite.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInviteLink = async () => {
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      setModalError(null);
      const result = await api.post<{ inviteUrl: string }>(
        `/org/users/${selectedUser.id}/invite-link`,
      );
      await navigator.clipboard.writeText(result.inviteUrl);
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
        `Você foi convidado para o Protos Farm! Acesse: ${result.inviteUrl}`,
      )}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      setModalSuccess('Link copiado para a área de transferência.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível gerar o link.';
      setModalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCreateFarm = (farmId: string) => {
    setCreateForm((prev) => ({
      ...prev,
      farmIds: prev.farmIds?.includes(farmId)
        ? prev.farmIds.filter((id) => id !== farmId)
        : [...(prev.farmIds ?? []), farmId],
    }));
  };

  const toggleEditFarm = (farmId: string) => {
    setEditFarmIds((prev) =>
      prev.includes(farmId) ? prev.filter((id) => id !== farmId) : [...prev, farmId],
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isNewUser = (user: OrgUserListItem | OrgUserDetail) => !user.lastLoginAt;

  // ─── Limit bar helper ─────────────────────────────────────────
  const getLimitClass = () => {
    if (!limit) return '';
    if (limit.blocked) return 'org-users__limit-fill--blocked';
    if (limit.warning) return 'org-users__limit-fill--warning';
    return 'org-users__limit-fill--ok';
  };

  const getLimitTextClass = () => {
    if (!limit) return '';
    if (limit.blocked) return 'org-users__limit-text--blocked';
    if (limit.warning) return 'org-users__limit-text--warning';
    return '';
  };

  // ─── Loading ───────────────────────────────────────────────────
  if (isLoading && users.length === 0) {
    return (
      <section className="org-users" aria-live="polite">
        <div
          className="org-users__skeleton"
          style={{ width: '200px', height: '32px', marginBottom: '24px' }}
        />
        <div
          className="org-users__skeleton"
          style={{ width: '100%', height: '48px', marginBottom: '16px' }}
        />
        <div className="org-users__skeleton" style={{ width: '100%', height: '300px' }} />
      </section>
    );
  }

  return (
    <section className="org-users">
      <header className="org-users__header">
        <div>
          <h1 className="org-users__title">Usuários</h1>
          <p className="org-users__subtitle">Gerencie os usuários da organização</p>
        </div>
        <PermissionGate permission="users:create">
          <button
            type="button"
            className="org-users__btn org-users__btn--primary"
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
          >
            <Plus aria-hidden="true" size={20} />
            Novo usuário
          </button>
        </PermissionGate>
      </header>

      {error && (
        <div className="org-users__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Limit bar */}
      {limit && (
        <div className="org-users__limit-bar" role="status">
          <span className={`org-users__limit-text ${getLimitTextClass()}`}>
            {limit.current} de {limit.max} usuários
          </span>
          <div className="org-users__limit-track" aria-hidden="true">
            <div
              className={`org-users__limit-fill ${getLimitClass()}`}
              style={{ width: `${Math.min(limit.percentage, 100)}%` }}
            />
          </div>
          {limit.blocked && (
            <>
              <AlertTriangle aria-hidden="true" size={16} />
              <span>Limite atingido</span>
            </>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="org-users__toolbar">
        <label htmlFor="user-search" className="sr-only">
          Buscar usuários
        </label>
        <input
          id="user-search"
          type="text"
          className="org-users__search"
          placeholder="Buscar por nome ou email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <label htmlFor="user-role-filter" className="sr-only">
          Filtrar por papel
        </label>
        <select
          id="user-role-filter"
          className="org-users__filter-select"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os papéis</option>
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor="user-status-filter" className="sr-only">
          Filtrar por status
        </label>
        <select
          id="user-status-filter"
          className="org-users__filter-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="INACTIVE">Inativos</option>
        </select>
      </div>

      {/* Content */}
      {users.length === 0 && !isLoading ? (
        <div className="org-users__empty">
          <Users size={48} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="org-users__empty-title">Nenhum usuário encontrado</h2>
          <p className="org-users__empty-desc">
            {search || roleFilter || statusFilter
              ? 'Tente ajustar os filtros de busca.'
              : 'Cadastre o primeiro usuário para começar.'}
          </p>
          {!search && !roleFilter && !statusFilter && (
            <PermissionGate permission="users:create">
              <button
                type="button"
                className="org-users__btn org-users__btn--primary"
                onClick={() => {
                  resetCreateForm();
                  setShowCreateModal(true);
                }}
              >
                <Plus aria-hidden="true" size={20} />
                Novo usuário
              </button>
            </PermissionGate>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="org-users__table-wrapper">
            <table className="org-users__table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Email</th>
                  <th scope="col">Papel</th>
                  <th scope="col">Fazendas</th>
                  <th scope="col">Status</th>
                  <th scope="col">Último acesso</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="org-users__table-row"
                    onClick={() => void openDetailModal(user)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver detalhes de ${user.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void openDetailModal(user);
                      }
                    }}
                  >
                    <td>
                      <span className="org-users__user-name">{user.name}</span>
                    </td>
                    <td>
                      <span className="org-users__user-email">{user.email}</span>
                    </td>
                    <td>
                      <span className="org-users__badge org-users__badge--role">
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td>
                      <div className="org-users__farm-chips">
                        {user.farmAccess.slice(0, 2).map((fa) => (
                          <span key={fa.farm.id} className="org-users__farm-chip">
                            {fa.farm.name}
                          </span>
                        ))}
                        {user.farmAccess.length > 2 && (
                          <span className="org-users__farm-chip org-users__farm-chip--more">
                            +{user.farmAccess.length - 2}
                          </span>
                        )}
                        {user.farmAccess.length === 0 && (
                          <span
                            style={{ color: 'var(--color-neutral-400)', fontSize: '0.8125rem' }}
                          >
                            —
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`org-users__badge org-users__badge--${user.status.toLowerCase()}`}
                      >
                        {STATUS_LABELS[user.status] ?? user.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500)' }}>
                      {formatDate(user.lastLoginAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="org-users__cards">
            {users.map((user) => (
              <div
                key={user.id}
                className="org-users__card"
                onClick={() => void openDetailModal(user)}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalhes de ${user.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void openDetailModal(user);
                  }
                }}
              >
                <div className="org-users__card-header">
                  <h3 className="org-users__card-name">{user.name}</h3>
                  <span
                    className={`org-users__badge org-users__badge--${user.status.toLowerCase()}`}
                  >
                    {STATUS_LABELS[user.status] ?? user.status}
                  </span>
                </div>
                <div className="org-users__card-row">
                  <span className="org-users__card-label">Email</span>
                  <span className="org-users__card-value">{user.email}</span>
                </div>
                <div className="org-users__card-row">
                  <span className="org-users__card-label">Papel</span>
                  <span className="org-users__card-value">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </div>
                <div className="org-users__card-row">
                  <span className="org-users__card-label">Fazendas</span>
                  <span className="org-users__card-value">
                    {user.farmAccess.length > 0
                      ? user.farmAccess.map((fa) => fa.farm.name).join(', ')
                      : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="org-users__pagination" aria-label="Paginação de usuários">
              <button
                type="button"
                className="org-users__pagination-btn"
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
                className="org-users__pagination-btn"
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

      {/* ─── Create User Modal ──────────────────────────────────── */}
      {showCreateModal && (
        <div
          className="org-users__modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-title"
        >
          <div className="org-users__modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2
                id="create-user-title"
                className="org-users__modal-title"
                style={{ marginBottom: 0 }}
              >
                Novo usuário
              </h2>
              <button
                type="button"
                className="org-users__btn org-users__btn--secondary org-users__btn--small"
                onClick={() => setShowCreateModal(false)}
                aria-label="Fechar"
                style={{ padding: '8px' }}
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            {limit?.blocked && (
              <div className="org-users__warning" role="alert" style={{ marginTop: '16px' }}>
                <AlertTriangle aria-hidden="true" size={16} />
                Limite de usuários atingido. Não é possível criar novos usuários.
              </div>
            )}

            {modalError && (
              <div
                className="org-users__error"
                role="alert"
                aria-live="polite"
                style={{ marginTop: '16px' }}
              >
                <AlertCircle aria-hidden="true" size={16} />
                {modalError}
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <div className="org-users__form-group">
                <label htmlFor="create-user-name" className="org-users__label">
                  Nome *
                </label>
                <input
                  id="create-user-name"
                  type="text"
                  className="org-users__input"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome completo"
                  aria-required="true"
                />
              </div>

              <div className="org-users__form-row">
                <div className="org-users__form-group">
                  <label htmlFor="create-user-email" className="org-users__label">
                    Email *
                  </label>
                  <input
                    id="create-user-email"
                    type="email"
                    className="org-users__input"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                    aria-required="true"
                  />
                </div>
                <div className="org-users__form-group">
                  <label htmlFor="create-user-phone" className="org-users__label">
                    Telefone
                  </label>
                  <input
                    id="create-user-phone"
                    type="tel"
                    className="org-users__input"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="org-users__form-group">
                <label htmlFor="create-user-role" className="org-users__label">
                  Papel *
                </label>
                <select
                  id="create-user-role"
                  className="org-users__select"
                  value={createForm.role}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value }))}
                  aria-required="true"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role] ?? role}
                    </option>
                  ))}
                </select>
              </div>

              {allFarms.length > 0 && (
                <div className="org-users__form-group">
                  <span className="org-users__label">Fazendas</span>
                  <div
                    className="org-users__checkbox-list"
                    role="group"
                    aria-label="Selecionar fazendas"
                  >
                    {allFarms.map((farm) => (
                      <label key={farm.id} className="org-users__checkbox-item">
                        <input
                          type="checkbox"
                          checked={createForm.farmIds?.includes(farm.id) ?? false}
                          onChange={() => toggleCreateFarm(farm.id)}
                        />
                        {farm.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="org-users__modal-actions">
              <button
                type="button"
                className="org-users__btn org-users__btn--secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="org-users__btn org-users__btn--primary"
                onClick={() => void handleCreate()}
                disabled={
                  submitting ||
                  !createForm.name.trim() ||
                  !createForm.email.trim() ||
                  !createForm.role ||
                  limit?.blocked
                }
              >
                {submitting ? 'Criando...' : 'Criar usuário'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail / Edit User Modal ───────────────────────────── */}
      {selectedUser && (
        <div
          className="org-users__modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedUser(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-user-title"
        >
          <div className="org-users__modal org-users__modal--wide">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2
                id="detail-user-title"
                className="org-users__modal-title"
                style={{ marginBottom: 0 }}
              >
                {selectedUser.name}
              </h2>
              <button
                type="button"
                className="org-users__btn org-users__btn--secondary org-users__btn--small"
                onClick={() => setSelectedUser(null)}
                aria-label="Fechar"
                style={{ padding: '8px' }}
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            {modalError && (
              <div
                className="org-users__error"
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
                className="org-users__success"
                role="status"
                aria-live="polite"
                style={{ marginTop: '16px' }}
              >
                <CheckCircle aria-hidden="true" size={16} />
                {modalSuccess}
              </div>
            )}

            {/* User Info */}
            <div className="org-users__info-grid" style={{ marginTop: '24px' }}>
              <div>
                <p className="org-users__info-label">Email</p>
                <p className="org-users__info-value">{selectedUser.email}</p>
              </div>
              <div>
                <p className="org-users__info-label">Telefone</p>
                <p className="org-users__info-value">{selectedUser.phone ?? '—'}</p>
              </div>
              <div>
                <p className="org-users__info-label">Papel</p>
                <p className="org-users__info-value">
                  <span className="org-users__badge org-users__badge--role">
                    {ROLE_LABELS[selectedUser.role] ?? selectedUser.role}
                  </span>
                </p>
              </div>
              <div>
                <p className="org-users__info-label">Status</p>
                <p className="org-users__info-value">
                  <span
                    className={`org-users__badge org-users__badge--${selectedUser.status.toLowerCase()}`}
                  >
                    {STATUS_LABELS[selectedUser.status] ?? selectedUser.status}
                  </span>
                </p>
              </div>
              <div>
                <p className="org-users__info-label">Fazendas</p>
                <p className="org-users__info-value">
                  {selectedUser.farmAccess.length > 0
                    ? selectedUser.farmAccess.map((fa) => fa.farm.name).join(', ')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="org-users__info-label">Criado em</p>
                <p className="org-users__info-value">{formatDate(selectedUser.createdAt)}</p>
              </div>
              <div>
                <p className="org-users__info-label">Último acesso</p>
                <p className="org-users__info-value">{formatDate(selectedUser.lastLoginAt)}</p>
              </div>
            </div>

            {/* Edit Section */}
            <PermissionGate permission="users:update">
              <div className="org-users__modal-section">
                <h3 className="org-users__modal-section-title">
                  {editMode ? 'Editar usuário' : 'Ações'}
                </h3>

                {editMode ? (
                  <div>
                    <div className="org-users__form-group">
                      <label htmlFor="edit-user-name" className="org-users__label">
                        Nome
                      </label>
                      <input
                        id="edit-user-name"
                        type="text"
                        className="org-users__input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>

                    <div className="org-users__form-row">
                      <div className="org-users__form-group">
                        <label htmlFor="edit-user-phone" className="org-users__label">
                          Telefone
                        </label>
                        <input
                          id="edit-user-phone"
                          type="tel"
                          className="org-users__input"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div className="org-users__form-group">
                        <label htmlFor="edit-user-role" className="org-users__label">
                          Papel
                        </label>
                        <select
                          id="edit-user-role"
                          className="org-users__select"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                        >
                          {ASSIGNABLE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role] ?? role}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {allFarms.length > 0 && (
                      <div className="org-users__form-group">
                        <span className="org-users__label">Fazendas</span>
                        <div
                          className="org-users__checkbox-list"
                          role="group"
                          aria-label="Selecionar fazendas"
                        >
                          {allFarms.map((farm) => (
                            <label key={farm.id} className="org-users__checkbox-item">
                              <input
                                type="checkbox"
                                checked={editFarmIds.includes(farm.id)}
                                onChange={() => toggleEditFarm(farm.id)}
                              />
                              {farm.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="org-users__btn org-users__btn--secondary org-users__btn--small"
                        onClick={() => setEditMode(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="org-users__btn org-users__btn--primary org-users__btn--small"
                        onClick={() => void handleEdit()}
                        disabled={submitting}
                      >
                        {submitting ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="org-users__detail-actions">
                    <button
                      type="button"
                      className="org-users__btn org-users__btn--secondary org-users__btn--small"
                      onClick={() => {
                        setEditMode(true);
                        setModalError(null);
                        setModalSuccess(null);
                      }}
                    >
                      <RotateCw aria-hidden="true" size={16} />
                      Editar
                    </button>

                    <button
                      type="button"
                      className={`org-users__btn org-users__btn--small ${
                        selectedUser.status === 'ACTIVE'
                          ? 'org-users__btn--danger'
                          : 'org-users__btn--secondary'
                      }`}
                      onClick={() => void handleToggleStatus()}
                      disabled={submitting}
                    >
                      {selectedUser.status === 'ACTIVE' ? (
                        <>
                          <UserX aria-hidden="true" size={16} />
                          Desativar
                        </>
                      ) : (
                        <>
                          <UserCheck aria-hidden="true" size={16} />
                          Ativar
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="org-users__btn org-users__btn--secondary org-users__btn--small"
                      onClick={() => void handleResetPassword()}
                      disabled={submitting}
                    >
                      <KeyRound aria-hidden="true" size={16} />
                      Resetar senha
                    </button>

                    {isNewUser(selectedUser) && (
                      <>
                        <button
                          type="button"
                          className="org-users__btn org-users__btn--secondary org-users__btn--small"
                          onClick={() => void handleResendInvite()}
                          disabled={submitting}
                        >
                          <Mail aria-hidden="true" size={16} />
                          Reenviar convite
                        </button>

                        <button
                          type="button"
                          className="org-users__btn org-users__btn--secondary org-users__btn--small"
                          onClick={() => void handleInviteLink()}
                          disabled={submitting}
                        >
                          <Link2 aria-hidden="true" size={16} />
                          Link WhatsApp
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </PermissionGate>
          </div>
        </div>
      )}
    </section>
  );
}

export default OrgUsersPage;
