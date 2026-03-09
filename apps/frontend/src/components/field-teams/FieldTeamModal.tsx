import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import { FIELD_TEAM_TYPES } from '@/types/field-team';
import type { FieldTeamItem, CreateFieldTeamInput } from '@/types/field-team';
import type { OrgUserListItem } from '@/types/org-user';
import './FieldTeamModal.css';

interface FieldTeamModalProps {
  isOpen: boolean;
  team: FieldTeamItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface UsersResponse {
  data: OrgUserListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

function FieldTeamModal({ isOpen, team, onClose, onSuccess }: FieldTeamModalProps) {
  const isEditing = !!team;
  const { selectedFarmId } = useFarmContext();

  const [name, setName] = useState('');
  const [teamType, setTeamType] = useState('');
  const [isTemporary, setIsTemporary] = useState(false);
  const [leaderId, setLeaderId] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [users, setUsers] = useState<OrgUserListItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Load org users filtered by farm when modal opens
  useEffect(() => {
    if (!isOpen || !selectedFarmId) return;

    let cancelled = false;
    setLoadingUsers(true);
    api
      .get<UsersResponse>(`/org/users?limit=100&status=ACTIVE&farmId=${selectedFarmId}`)
      .then((result) => {
        if (!cancelled) setUsers(result.data);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedFarmId]);

  // Reset / populate form
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setTeamType('');
      setIsTemporary(false);
      setLeaderId('');
      setMemberIds([]);
      setNotes('');
      setSubmitError(null);
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    } else if (team) {
      setName(team.name);
      setTeamType(team.teamType);
      setIsTemporary(team.isTemporary);
      setLeaderId(team.leaderId);
      setMemberIds(team.members.map((m) => m.userId));
      setNotes(team.notes ?? '');
    }
  }, [isOpen, team]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const canSubmit = name.trim() !== '' && teamType !== '' && leaderId !== '';

  const handleMemberToggle = useCallback((userId: string) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !selectedFarmId) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateFieldTeamInput = {
        name: name.trim(),
        teamType,
        isTemporary,
        leaderId,
        memberIds: memberIds.length > 0 ? memberIds : undefined,
        notes: notes.trim() || null,
      };

      if (isEditing) {
        await api.patch(`/org/farms/${selectedFarmId}/field-teams/${team!.id}`, payload);
      } else {
        await api.post(`/org/farms/${selectedFarmId}/field-teams`, payload);
      }
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar equipe';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    selectedFarmId,
    name,
    teamType,
    isTemporary,
    leaderId,
    memberIds,
    notes,
    isEditing,
    team,
    onSuccess,
  ]);

  const handleDelete = useCallback(async () => {
    if (!selectedFarmId || !team) return;

    setIsDeleting(true);
    setSubmitError(null);

    try {
      await api.delete(`/org/farms/${selectedFarmId}/field-teams/${team.id}`);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir equipe';
      setSubmitError(message);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedFarmId, team, onSuccess]);

  // Users available as members (excluding leader), filtered to same farm
  const availableMembers = users.filter((u) => u.id !== leaderId);
  const allMembersSelected =
    availableMembers.length > 0 && availableMembers.every((u) => memberIds.includes(u.id));

  const handleSelectAll = useCallback(() => {
    if (allMembersSelected) {
      setMemberIds([]);
    } else {
      setMemberIds(availableMembers.map((u) => u.id));
    }
  }, [allMembersSelected, availableMembers]);

  if (!isOpen) return null;

  return (
    <div className="ft-overlay" onClick={onClose}>
      <div
        className="ft-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Editar equipe de campo' : 'Nova equipe de campo'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ft-modal__header">
          <h2 className="ft-modal__title">
            {isEditing ? 'Editar equipe' : 'Nova equipe de campo'}
          </h2>
          <button type="button" className="ft-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="ft-modal__body">
          <div className="ft-modal__fields">
            {/* Informações básicas */}
            <h3 className="ft-modal__section-title">Informações básicas</h3>

            <div className="ft-modal__row">
              <div className="ft-modal__field">
                <label htmlFor="ft-name" className="ft-modal__label">
                  Nome da equipe *
                </label>
                <input
                  id="ft-name"
                  type="text"
                  className="ft-modal__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Equipe de colheita Norte"
                  aria-required="true"
                />
              </div>
              <div className="ft-modal__field">
                <label htmlFor="ft-type" className="ft-modal__label">
                  Tipo da equipe *
                </label>
                <select
                  id="ft-type"
                  className="ft-modal__select"
                  value={teamType}
                  onChange={(e) => setTeamType(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Selecione o tipo</option>
                  {FIELD_TEAM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ft-modal__row">
              <div className="ft-modal__field">
                <label htmlFor="ft-leader" className="ft-modal__label">
                  Responsável *
                </label>
                <select
                  id="ft-leader"
                  className="ft-modal__select"
                  value={leaderId}
                  onChange={(e) => setLeaderId(e.target.value)}
                  aria-required="true"
                  disabled={loadingUsers}
                >
                  <option value="">
                    {loadingUsers ? 'Carregando usuários...' : 'Selecione o responsável'}
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="ft-modal__field ft-modal__field--checkbox">
                <label className="ft-modal__checkbox-label">
                  <input
                    type="checkbox"
                    checked={isTemporary}
                    onChange={(e) => setIsTemporary(e.target.checked)}
                    className="ft-modal__checkbox"
                  />
                  <span>Equipe temporária</span>
                </label>
              </div>
            </div>

            {/* Membros */}
            {!isEditing && (
              <>
                <h3 className="ft-modal__section-title">Membros</h3>
                <p className="ft-modal__members-farm-hint">
                  Exibindo colaboradores com acesso a esta fazenda.
                </p>
                <div className="ft-modal__members-list">
                  {loadingUsers ? (
                    <p className="ft-modal__members-hint">Carregando usuários...</p>
                  ) : availableMembers.length === 0 ? (
                    <p className="ft-modal__members-hint">
                      {leaderId
                        ? 'Nenhum outro colaborador com acesso a esta fazenda.'
                        : 'Selecione um responsável primeiro.'}
                    </p>
                  ) : (
                    <>
                      <label className="ft-modal__member-item ft-modal__member-item--select-all">
                        <input
                          type="checkbox"
                          checked={allMembersSelected}
                          onChange={handleSelectAll}
                          className="ft-modal__checkbox"
                        />
                        <span className="ft-modal__member-name">Selecionar todos</span>
                        <span className="ft-modal__member-email">
                          {memberIds.length}/{availableMembers.length}
                        </span>
                      </label>
                      {availableMembers.map((u) => (
                        <label key={u.id} className="ft-modal__member-item">
                          <input
                            type="checkbox"
                            checked={memberIds.includes(u.id)}
                            onChange={() => handleMemberToggle(u.id)}
                            className="ft-modal__checkbox"
                          />
                          <span className="ft-modal__member-name">{u.name}</span>
                          <span className="ft-modal__member-email">{u.email}</span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Membros atuais (edição) */}
            {isEditing && team && team.members.length > 0 && (
              <>
                <h3 className="ft-modal__section-title">Membros atuais ({team.memberCount})</h3>
                <div className="ft-modal__members-list">
                  {team.members.map((m) => (
                    <div
                      key={m.id}
                      className="ft-modal__member-item ft-modal__member-item--readonly"
                    >
                      <span className="ft-modal__member-name">{m.userName}</span>
                      <span className="ft-modal__member-email">{m.userEmail}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Observações */}
            <h3 className="ft-modal__section-title">Observações</h3>

            <div className="ft-modal__field">
              <label htmlFor="ft-notes" className="ft-modal__label">
                Observações
              </label>
              <textarea
                id="ft-notes"
                className="ft-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informações adicionais sobre a equipe..."
                rows={3}
              />
            </div>
          </div>

          {submitError && (
            <div className="ft-modal__error" role="alert" aria-live="polite">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ft-modal__footer">
          {isEditing && !showDeleteConfirm && (
            <button
              type="button"
              className="ft-modal__btn ft-modal__btn--danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSubmitting}
            >
              Excluir
            </button>
          )}
          {isEditing && showDeleteConfirm && (
            <div className="ft-modal__delete-confirm">
              <label htmlFor="ft-delete-confirm" className="ft-modal__label">
                Digite &quot;{team!.name}&quot; para confirmar:
              </label>
              <input
                id="ft-delete-confirm"
                type="text"
                className="ft-modal__input ft-modal__input--sm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={team!.name}
              />
              <button
                type="button"
                className="ft-modal__btn ft-modal__btn--danger"
                onClick={handleDelete}
                disabled={deleteConfirmText !== team!.name || isDeleting}
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          )}
          <div className="ft-modal__footer-spacer" />
          <button
            type="button"
            className="ft-modal__btn ft-modal__btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="ft-modal__btn ft-modal__btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar equipe'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FieldTeamModal;
