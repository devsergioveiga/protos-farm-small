import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Calendar,
  Clock,
  UsersRound,
  MapPin,
  TrendingUp,
  DollarSign,
  UserCheck,
  FileText,
  UserPlus,
  UserMinus,
  AlertCircle,
  Pencil,
  Check,
  Trash2,
} from 'lucide-react';
import { PRODUCTIVITY_UNITS } from '@/types/team-operation';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import PermissionGate from '@/components/auth/PermissionGate';
import type { TeamOperationItem } from '@/types/team-operation';
import type { FieldTeamItem } from '@/types/field-team';
import './TeamOperationDetailModal.css';

interface TeamOperationDetailModalProps {
  operation: TeamOperationItem;
  onClose: () => void;
  onUpdated?: (updated: TeamOperationItem) => void;
  onDeleted?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

function TeamOperationDetailModal({
  operation,
  onClose,
  onUpdated,
  onDeleted,
}: TeamOperationDetailModalProps) {
  const { selectedFarmId } = useFarmContext();
  const [op, setOp] = useState(operation);

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addJustification, setAddJustification] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [teamMembers, setTeamMembers] = useState<
    Array<{ userId: string; userName: string; userEmail: string }>
  >([]);

  // Remove member state
  const [removingEntryId, setRemovingEntryId] = useState<string | null>(null);
  const [removeJustification, setRemoveJustification] = useState('');
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Edit entry state (CA4 hours + CA5 productivity)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editProductivity, setEditProductivity] = useState('');
  const [editProductivityUnit, setEditProductivityUnit] = useState('');
  const [editJustification, setEditJustification] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete operation state (CA6)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load team members for add-member dropdown
  useEffect(() => {
    if (!showAddMember || !selectedFarmId || !op.teamId) return;
    let cancelled = false;
    api
      .get<FieldTeamItem>(`/org/farms/${selectedFarmId}/field-teams/${op.teamId}`)
      .then((team) => {
        if (!cancelled) {
          setTeamMembers(
            team.members
              .filter((m) => !m.leftAt)
              .map((m) => ({ userId: m.userId, userName: m.userName, userEmail: m.userEmail })),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showAddMember, selectedFarmId, op.teamId]);

  const existingUserIds = new Set(op.entries.map((e) => e.userId));
  const availableMembers = teamMembers.filter((m) => !existingUserIds.has(m.userId));

  const handleUpdate = useCallback(
    (updated: TeamOperationItem) => {
      setOp(updated);
      onUpdated?.(updated);
    },
    [onUpdated],
  );

  const handleAddMember = useCallback(async () => {
    if (!selectedFarmId || !addUserId || !addJustification.trim()) return;
    setIsAdding(true);
    setAddError(null);
    try {
      const result = await api.post<TeamOperationItem>(
        `/org/farms/${selectedFarmId}/team-operations/${op.id}/entries`,
        { userId: addUserId, justification: addJustification.trim() },
      );
      handleUpdate(result);
      setShowAddMember(false);
      setAddUserId('');
      setAddJustification('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Erro ao adicionar membro');
    } finally {
      setIsAdding(false);
    }
  }, [selectedFarmId, op.id, addUserId, addJustification, handleUpdate]);

  const handleRemoveMember = useCallback(async () => {
    if (!selectedFarmId || !removingEntryId || !removeJustification.trim()) return;
    setIsRemoving(true);
    setRemoveError(null);
    try {
      const result = await api.deleteWithBody<TeamOperationItem>(
        `/org/farms/${selectedFarmId}/team-operations/${op.id}/entries/${removingEntryId}`,
        { justification: removeJustification.trim() },
      );
      handleUpdate(result);
      setRemovingEntryId(null);
      setRemoveJustification('');
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Erro ao remover membro');
    } finally {
      setIsRemoving(false);
    }
  }, [selectedFarmId, op.id, removingEntryId, removeJustification, handleUpdate]);

  const startEditEntry = useCallback(
    (entryId: string) => {
      const entry = op.entries.find((e) => e.id === entryId);
      if (!entry) return;
      setEditingEntryId(entryId);
      setEditHours(entry.hoursWorked != null ? String(entry.hoursWorked) : '');
      setEditProductivity(entry.productivity != null ? String(entry.productivity) : '');
      setEditProductivityUnit(entry.productivityUnit ?? '');
      setEditJustification('');
      setEditError(null);
    },
    [op.entries],
  );

  const cancelEdit = useCallback(() => {
    setEditingEntryId(null);
    setEditError(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!selectedFarmId || !editingEntryId || !editJustification.trim()) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const body: Record<string, unknown> = { justification: editJustification.trim() };
      const hours = editHours.trim() ? parseFloat(editHours) : null;
      const prod = editProductivity.trim() ? parseFloat(editProductivity) : null;
      body.hoursWorked = hours;
      body.productivity = prod;
      body.productivityUnit = prod != null ? editProductivityUnit || null : null;

      const result = await api.patch<TeamOperationItem>(
        `/org/farms/${selectedFarmId}/team-operations/${op.id}/entries/${editingEntryId}`,
        body,
      );
      handleUpdate(result);
      setEditingEntryId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Erro ao salvar alterações');
    } finally {
      setIsSavingEdit(false);
    }
  }, [
    selectedFarmId,
    op.id,
    editingEntryId,
    editHours,
    editProductivity,
    editProductivityUnit,
    editJustification,
    handleUpdate,
  ]);

  const CONFIRM_WORD = 'EXCLUIR';

  const handleDeleteOperation = useCallback(async () => {
    if (!selectedFarmId || deleteConfirmText !== CONFIRM_WORD) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/org/farms/${selectedFarmId}/team-operations/${op.id}`);
      onDeleted?.();
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir operação');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedFarmId, op.id, deleteConfirmText, onDeleted, onClose]);

  return (
    <div className="to-detail__overlay" onClick={onClose}>
      <div
        className="to-detail"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes da operação ${op.operationTypeLabel}`}
      >
        {/* Header */}
        <div className="to-detail__header">
          <div>
            <h2 className="to-detail__title">{op.operationTypeLabel}</h2>
            <p className="to-detail__subtitle">
              {formatDate(op.performedAt)} — {op.teamName}
            </p>
          </div>
          <button type="button" className="to-detail__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="to-detail__body">
          {/* General info */}
          <section className="to-detail__section">
            <h3 className="to-detail__section-title">Dados gerais</h3>
            <dl className="to-detail__dl">
              <div className="to-detail__row">
                <dt>
                  <MapPin size={14} aria-hidden="true" />
                  Talhão
                </dt>
                <dd>{op.fieldPlotName}</dd>
              </div>
              <div className="to-detail__row">
                <dt>
                  <UsersRound size={14} aria-hidden="true" />
                  Equipe
                </dt>
                <dd>{op.teamName}</dd>
              </div>
              <div className="to-detail__row">
                <dt>
                  <Calendar size={14} aria-hidden="true" />
                  Data
                </dt>
                <dd>{formatDate(op.performedAt)}</dd>
              </div>
              <div className="to-detail__row">
                <dt>
                  <Clock size={14} aria-hidden="true" />
                  Horário
                </dt>
                <dd>
                  {formatTime(op.timeStart)} — {formatTime(op.timeEnd)} ({op.durationHours}h)
                </dd>
              </div>
              {op.totalProductivity != null && op.productivityUnit && (
                <div className="to-detail__row">
                  <dt>
                    <TrendingUp size={14} aria-hidden="true" />
                    Produção total
                  </dt>
                  <dd className="to-detail__mono">
                    {formatNumber(op.totalProductivity)} {op.productivityUnit}
                  </dd>
                </div>
              )}
              {op.totalLaborCost != null && (
                <div className="to-detail__row">
                  <dt>
                    <DollarSign size={14} aria-hidden="true" />
                    Custo MO
                  </dt>
                  <dd className="to-detail__mono">{formatCurrency(op.totalLaborCost)}</dd>
                </div>
              )}
              {op.notes && (
                <div className="to-detail__row">
                  <dt>
                    <FileText size={14} aria-hidden="true" />
                    Observações
                  </dt>
                  <dd>{op.notes}</dd>
                </div>
              )}
              <div className="to-detail__row">
                <dt>
                  <UserCheck size={14} aria-hidden="true" />
                  Registrado por
                </dt>
                <dd>{op.recorderName}</dd>
              </div>
            </dl>
          </section>

          {/* Members table */}
          <section className="to-detail__section">
            <div className="to-detail__section-header">
              <h3 className="to-detail__section-title">Membros presentes ({op.entryCount})</h3>
              <PermissionGate permission="farms:update">
                <button
                  type="button"
                  className="to-detail__btn to-detail__btn--sm"
                  onClick={() => setShowAddMember(!showAddMember)}
                >
                  <UserPlus size={16} aria-hidden="true" />
                  Adicionar
                </button>
              </PermissionGate>
            </div>

            {/* Add member form */}
            {showAddMember && (
              <div className="to-detail__action-form">
                <div className="to-detail__action-form-fields">
                  <div className="to-detail__field">
                    <label htmlFor="add-member-user" className="to-detail__label">
                      Membro *
                    </label>
                    <select
                      id="add-member-user"
                      className="to-detail__select"
                      value={addUserId}
                      onChange={(e) => setAddUserId(e.target.value)}
                    >
                      <option value="">Selecione um membro</option>
                      {availableMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.userName} ({m.userEmail})
                        </option>
                      ))}
                    </select>
                    {availableMembers.length === 0 && teamMembers.length > 0 && (
                      <p className="to-detail__hint">Todos os membros da equipe já participam.</p>
                    )}
                  </div>
                  <div className="to-detail__field">
                    <label htmlFor="add-member-justification" className="to-detail__label">
                      Justificativa *
                    </label>
                    <input
                      id="add-member-justification"
                      type="text"
                      className="to-detail__input"
                      placeholder="Ex.: Membro estava presente mas não foi incluído"
                      value={addJustification}
                      onChange={(e) => setAddJustification(e.target.value)}
                    />
                  </div>
                </div>
                {addError && (
                  <p className="to-detail__form-error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {addError}
                  </p>
                )}
                <div className="to-detail__action-form-actions">
                  <button
                    type="button"
                    className="to-detail__btn to-detail__btn--ghost"
                    onClick={() => {
                      setShowAddMember(false);
                      setAddUserId('');
                      setAddJustification('');
                      setAddError(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="to-detail__btn to-detail__btn--primary"
                    disabled={!addUserId || !addJustification.trim() || isAdding}
                    onClick={handleAddMember}
                  >
                    {isAdding ? 'Adicionando…' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}

            {/* Desktop table */}
            <div className="to-detail__table-wrapper">
              <table className="to-detail__table">
                <thead>
                  <tr>
                    <th scope="col">Membro</th>
                    <th scope="col">Horas</th>
                    <th scope="col">Produtividade</th>
                    <th scope="col">Custo MO</th>
                    <th scope="col">Observações</th>
                    <PermissionGate permission="farms:update">
                      <th scope="col" className="to-detail__th-actions">
                        Ações
                      </th>
                    </PermissionGate>
                  </tr>
                </thead>
                <tbody>
                  {op.entries.map((entry) => {
                    const isEditing = editingEntryId === entry.id;
                    return (
                      <tr key={entry.id}>
                        <td>
                          <div className="to-detail__member-cell">
                            <span className="to-detail__member-name">{entry.userName}</span>
                            <span className="to-detail__member-email">{entry.userEmail}</span>
                          </div>
                        </td>
                        <td className="to-detail__mono-cell">
                          {isEditing ? (
                            <input
                              type="number"
                              className="to-detail__inline-input"
                              value={editHours}
                              onChange={(e) => setEditHours(e.target.value)}
                              placeholder={String(op.durationHours)}
                              min="0"
                              step="0.25"
                              aria-label="Horas trabalhadas"
                            />
                          ) : entry.hoursWorked != null ? (
                            `${formatNumber(entry.hoursWorked)}h`
                          ) : (
                            `${op.durationHours}h`
                          )}
                        </td>
                        <td className="to-detail__mono-cell">
                          {isEditing ? (
                            <div className="to-detail__inline-group">
                              <input
                                type="number"
                                className="to-detail__inline-input"
                                value={editProductivity}
                                onChange={(e) => setEditProductivity(e.target.value)}
                                placeholder="0"
                                min="0"
                                step="0.01"
                                aria-label="Produtividade"
                              />
                              <select
                                className="to-detail__inline-select"
                                value={editProductivityUnit}
                                onChange={(e) => setEditProductivityUnit(e.target.value)}
                                aria-label="Unidade de produtividade"
                              >
                                <option value="">—</option>
                                {PRODUCTIVITY_UNITS.map((u) => (
                                  <option key={u.value} value={u.value}>
                                    {u.value}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : entry.productivity != null && entry.productivityUnit ? (
                            `${formatNumber(entry.productivity)} ${entry.productivityUnit}`
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="to-detail__mono-cell">
                          {entry.laborCost != null ? formatCurrency(entry.laborCost) : '—'}
                        </td>
                        <td className="to-detail__notes-cell">{entry.notes || '—'}</td>
                        <PermissionGate permission="farms:update">
                          <td className="to-detail__actions-cell">
                            {isEditing ? (
                              <button
                                type="button"
                                className="to-detail__icon-btn"
                                onClick={cancelEdit}
                                aria-label="Cancelar edição"
                                title="Cancelar edição"
                              >
                                <X size={16} aria-hidden="true" />
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="to-detail__icon-btn"
                                  onClick={() => startEditEntry(entry.id)}
                                  aria-label={`Editar ${entry.userName}`}
                                  title="Editar horas e produtividade"
                                >
                                  <Pencil size={16} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="to-detail__icon-btn to-detail__icon-btn--danger"
                                  onClick={() => {
                                    setRemovingEntryId(entry.id);
                                    setRemoveJustification('');
                                    setRemoveError(null);
                                  }}
                                  aria-label={`Remover ${entry.userName}`}
                                  disabled={op.entries.length <= 1}
                                  title={
                                    op.entries.length <= 1
                                      ? 'Não é possível remover o último membro'
                                      : 'Remover membro'
                                  }
                                >
                                  <UserMinus size={16} aria-hidden="true" />
                                </button>
                              </>
                            )}
                          </td>
                        </PermissionGate>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Edit justification form */}
            {editingEntryId && (
              <div className="to-detail__action-form">
                <p className="to-detail__action-form-title">
                  <Pencil size={16} aria-hidden="true" />
                  Editando {op.entries.find((e) => e.id === editingEntryId)?.userName}
                </p>
                <div className="to-detail__field">
                  <label htmlFor="edit-justification" className="to-detail__label">
                    Justificativa da alteração *
                  </label>
                  <input
                    id="edit-justification"
                    type="text"
                    className="to-detail__input"
                    placeholder="Ex.: Correção de horas registradas incorretamente"
                    value={editJustification}
                    onChange={(e) => setEditJustification(e.target.value)}
                  />
                </div>
                {editError && (
                  <p className="to-detail__form-error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {editError}
                  </p>
                )}
                <div className="to-detail__action-form-actions">
                  <button
                    type="button"
                    className="to-detail__btn to-detail__btn--ghost"
                    onClick={cancelEdit}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="to-detail__btn to-detail__btn--primary"
                    disabled={!editJustification.trim() || isSavingEdit}
                    onClick={handleSaveEdit}
                  >
                    <Check size={16} aria-hidden="true" />
                    {isSavingEdit ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                </div>
              </div>
            )}

            {/* Mobile cards */}
            <ul className="to-detail__member-cards">
              {op.entries.map((entry) => (
                <li key={entry.id} className="to-detail__member-card">
                  <div className="to-detail__member-card-header">
                    <div>
                      <span className="to-detail__member-name">{entry.userName}</span>
                      <span className="to-detail__member-email">{entry.userEmail}</span>
                    </div>
                    <PermissionGate permission="farms:update">
                      <div className="to-detail__member-card-actions">
                        <button
                          type="button"
                          className="to-detail__icon-btn"
                          onClick={() => startEditEntry(entry.id)}
                          aria-label={`Editar ${entry.userName}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="to-detail__icon-btn to-detail__icon-btn--danger"
                          onClick={() => {
                            setRemovingEntryId(entry.id);
                            setRemoveJustification('');
                            setRemoveError(null);
                          }}
                          aria-label={`Remover ${entry.userName}`}
                          disabled={op.entries.length <= 1}
                        >
                          <UserMinus size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </PermissionGate>
                  </div>
                  <div className="to-detail__member-card-body">
                    <div className="to-detail__member-card-stat">
                      <span className="to-detail__member-card-label">Horas</span>
                      <span className="to-detail__mono">
                        {entry.hoursWorked != null
                          ? `${formatNumber(entry.hoursWorked)}h`
                          : `${op.durationHours}h`}
                      </span>
                    </div>
                    <div className="to-detail__member-card-stat">
                      <span className="to-detail__member-card-label">Produtividade</span>
                      <span className="to-detail__mono">
                        {entry.productivity != null && entry.productivityUnit
                          ? `${formatNumber(entry.productivity)} ${entry.productivityUnit}`
                          : '—'}
                      </span>
                    </div>
                    <div className="to-detail__member-card-stat">
                      <span className="to-detail__member-card-label">Custo MO</span>
                      <span className="to-detail__mono">
                        {entry.laborCost != null ? formatCurrency(entry.laborCost) : '—'}
                      </span>
                    </div>
                    {entry.notes && (
                      <div className="to-detail__member-card-stat to-detail__member-card-stat--full">
                        <span className="to-detail__member-card-label">Observações</span>
                        <span>{entry.notes}</span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/* Remove member confirmation */}
            {removingEntryId && (
              <div className="to-detail__action-form to-detail__action-form--danger">
                <p className="to-detail__action-form-title">
                  <UserMinus size={16} aria-hidden="true" />
                  Remover {op.entries.find((e) => e.id === removingEntryId)?.userName}?
                </p>
                <div className="to-detail__field">
                  <label htmlFor="remove-justification" className="to-detail__label">
                    Justificativa *
                  </label>
                  <input
                    id="remove-justification"
                    type="text"
                    className="to-detail__input"
                    placeholder="Ex.: Membro não estava presente no dia"
                    value={removeJustification}
                    onChange={(e) => setRemoveJustification(e.target.value)}
                  />
                </div>
                {removeError && (
                  <p className="to-detail__form-error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {removeError}
                  </p>
                )}
                <div className="to-detail__action-form-actions">
                  <button
                    type="button"
                    className="to-detail__btn to-detail__btn--ghost"
                    onClick={() => {
                      setRemovingEntryId(null);
                      setRemoveJustification('');
                      setRemoveError(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="to-detail__btn to-detail__btn--danger"
                    disabled={!removeJustification.trim() || isRemoving}
                    onClick={handleRemoveMember}
                  >
                    {isRemoving ? 'Removendo…' : 'Confirmar remoção'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* CA6: Delete operation */}
          <PermissionGate permission="farms:update">
            <section className="to-detail__section">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  className="to-detail__btn to-detail__btn--ghost to-detail__btn--danger-text"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Excluir operação
                </button>
              ) : (
                <div className="to-detail__action-form to-detail__action-form--danger">
                  <p className="to-detail__action-form-title">
                    <Trash2 size={16} aria-hidden="true" />
                    Excluir operação para todos os {op.entryCount} membros?
                  </p>
                  <p className="to-detail__hint">
                    Esta ação não pode ser desfeita. Digite <strong>{CONFIRM_WORD}</strong> para
                    confirmar.
                  </p>
                  <div className="to-detail__field">
                    <label htmlFor="delete-confirm" className="to-detail__label">
                      Confirmação *
                    </label>
                    <input
                      id="delete-confirm"
                      type="text"
                      className="to-detail__input"
                      placeholder={CONFIRM_WORD}
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  {deleteError && (
                    <p className="to-detail__form-error" role="alert">
                      <AlertCircle size={14} aria-hidden="true" />
                      {deleteError}
                    </p>
                  )}
                  <div className="to-detail__action-form-actions">
                    <button
                      type="button"
                      className="to-detail__btn to-detail__btn--ghost"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                        setDeleteError(null);
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="to-detail__btn to-detail__btn--danger"
                      disabled={deleteConfirmText !== CONFIRM_WORD || isDeleting}
                      onClick={handleDeleteOperation}
                    >
                      {isDeleting ? 'Excluindo…' : 'Confirmar exclusão'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}

export default TeamOperationDetailModal;
