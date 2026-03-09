import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import { TEAM_OPERATION_TYPES } from '@/types/team-operation';
import type { CreateTeamOperationInput } from '@/types/team-operation';
import type { FieldPlot } from '@/types/farm';
import type { FieldTeamItem } from '@/types/field-team';
import './TeamOperationModal.css';

interface TeamOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TeamsResponse {
  data: FieldTeamItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const STEPS = ['Operação', 'Equipe e membros', 'Confirmar'] as const;

function TeamOperationModal({ isOpen, onClose, onSuccess }: TeamOperationModalProps) {
  const { selectedFarmId } = useFarmContext();

  const [step, setStep] = useState(0);

  // Step 1 — Operation data
  const [operationType, setOperationType] = useState('');
  const [fieldPlotId, setFieldPlotId] = useState('');
  const [performedAt, setPerformedAt] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [notes, setNotes] = useState('');

  // Step 2 — Team & members
  const [teamId, setTeamId] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  // Data
  const [plots, setPlots] = useState<FieldPlot[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(false);
  const [teams, setTeams] = useState<FieldTeamItem[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load field plots
  useEffect(() => {
    if (!isOpen || !selectedFarmId) return;
    let cancelled = false;
    setLoadingPlots(true);
    api
      .get<FieldPlot[]>(`/org/farms/${selectedFarmId}/plots`)
      .then((result) => {
        if (!cancelled) setPlots(result);
      })
      .catch(() => {
        if (!cancelled) setPlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedFarmId]);

  // Load teams
  useEffect(() => {
    if (!isOpen || !selectedFarmId) return;
    let cancelled = false;
    setLoadingTeams(true);
    api
      .get<TeamsResponse>(`/org/farms/${selectedFarmId}/field-teams?limit=100`)
      .then((result) => {
        if (!cancelled) setTeams(result.data);
      })
      .catch(() => {
        if (!cancelled) setTeams([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTeams(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedFarmId]);

  // Reset form
  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setOperationType('');
      setFieldPlotId('');
      setPerformedAt('');
      setTimeStart('');
      setTimeEnd('');
      setNotes('');
      setTeamId('');
      setMemberIds([]);
      setSubmitError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // When team changes, pre-select all active members
  useEffect(() => {
    if (!teamId) {
      setMemberIds([]);
      return;
    }
    const team = teams.find((t) => t.id === teamId);
    if (team) {
      setMemberIds(team.members.map((m) => m.userId));
    }
  }, [teamId, teams]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const selectedTeam = teams.find((t) => t.id === teamId);

  const canStep1 =
    operationType !== '' &&
    fieldPlotId !== '' &&
    performedAt !== '' &&
    timeStart !== '' &&
    timeEnd !== '';
  const canStep2 = teamId !== '' && memberIds.length > 0;

  const handleMemberToggle = useCallback((userId: string) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }, []);

  const allMembersSelected =
    selectedTeam &&
    selectedTeam.members.length > 0 &&
    selectedTeam.members.every((m) => memberIds.includes(m.userId));

  const handleSelectAll = useCallback(() => {
    if (!selectedTeam) return;
    if (allMembersSelected) {
      setMemberIds([]);
    } else {
      setMemberIds(selectedTeam.members.map((m) => m.userId));
    }
  }, [allMembersSelected, selectedTeam]);

  const handleSubmit = useCallback(async () => {
    if (!selectedFarmId || !canStep1 || !canStep2) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateTeamOperationInput = {
        fieldPlotId,
        teamId,
        operationType,
        performedAt,
        timeStart: `${performedAt}T${timeStart}:00`,
        timeEnd: `${performedAt}T${timeEnd}:00`,
        memberIds,
        notes: notes.trim() || null,
      };

      await api.post(`/org/farms/${selectedFarmId}/team-operations`, payload);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar operação';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedFarmId,
    canStep1,
    canStep2,
    fieldPlotId,
    teamId,
    operationType,
    performedAt,
    timeStart,
    timeEnd,
    memberIds,
    notes,
    onSuccess,
  ]);

  const selectedPlot = plots.find((p) => p.id === fieldPlotId);
  const selectedOpLabel = TEAM_OPERATION_TYPES.find((t) => t.value === operationType)?.label ?? '';

  if (!isOpen) return null;

  return (
    <div className="to-overlay" onClick={onClose}>
      <div
        className="to-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Nova operação em bloco"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="to-modal__header">
          <h2 className="to-modal__title">Nova operação em bloco</h2>
          <button type="button" className="to-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Stepper */}
        <div className="to-modal__stepper" role="navigation" aria-label="Etapas do formulário">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`to-modal__step ${i === step ? 'to-modal__step--active' : ''} ${i < step ? 'to-modal__step--done' : ''}`}
            >
              <span className="to-modal__step-num">{i < step ? '✓' : i + 1}</span>
              <span className="to-modal__step-label">{label}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="to-modal__body">
          {/* Step 1 — Operation data */}
          {step === 0 && (
            <div className="to-modal__fields">
              <div className="to-modal__row">
                <div className="to-modal__field">
                  <label htmlFor="to-type" className="to-modal__label">
                    Tipo de operação *
                  </label>
                  <select
                    id="to-type"
                    className="to-modal__select"
                    value={operationType}
                    onChange={(e) => setOperationType(e.target.value)}
                    aria-required="true"
                  >
                    <option value="">Selecione o tipo</option>
                    {TEAM_OPERATION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="to-modal__field">
                  <label htmlFor="to-plot" className="to-modal__label">
                    Talhão *
                  </label>
                  <select
                    id="to-plot"
                    className="to-modal__select"
                    value={fieldPlotId}
                    onChange={(e) => setFieldPlotId(e.target.value)}
                    aria-required="true"
                    disabled={loadingPlots}
                  >
                    <option value="">
                      {loadingPlots ? 'Carregando talhões...' : 'Selecione o talhão'}
                    </option>
                    {plots.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="to-modal__row">
                <div className="to-modal__field">
                  <label htmlFor="to-date" className="to-modal__label">
                    Data *
                  </label>
                  <input
                    id="to-date"
                    type="date"
                    className="to-modal__input"
                    value={performedAt}
                    onChange={(e) => setPerformedAt(e.target.value)}
                    aria-required="true"
                  />
                </div>
                <div className="to-modal__field">
                  <label htmlFor="to-start" className="to-modal__label">
                    Hora início *
                  </label>
                  <input
                    id="to-start"
                    type="time"
                    className="to-modal__input"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    aria-required="true"
                  />
                </div>
                <div className="to-modal__field">
                  <label htmlFor="to-end" className="to-modal__label">
                    Hora fim *
                  </label>
                  <input
                    id="to-end"
                    type="time"
                    className="to-modal__input"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    aria-required="true"
                  />
                </div>
              </div>

              <div className="to-modal__field">
                <label htmlFor="to-notes" className="to-modal__label">
                  Observações
                </label>
                <textarea
                  id="to-notes"
                  className="to-modal__textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais sobre a operação..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 2 — Team & members */}
          {step === 1 && (
            <div className="to-modal__fields">
              <div className="to-modal__field">
                <label htmlFor="to-team" className="to-modal__label">
                  Equipe *
                </label>
                <select
                  id="to-team"
                  className="to-modal__select"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  aria-required="true"
                  disabled={loadingTeams}
                >
                  <option value="">
                    {loadingTeams ? 'Carregando equipes...' : 'Selecione a equipe'}
                  </option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.memberCount} {t.memberCount === 1 ? 'membro' : 'membros'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedTeam && (
                <>
                  <h3 className="to-modal__section-title">
                    Membros participantes ({memberIds.length}/{selectedTeam.members.length})
                  </h3>
                  <p className="to-modal__hint">
                    Desmarque os membros que não participaram desta operação.
                  </p>
                  <div className="to-modal__members-list">
                    {selectedTeam.members.length === 0 ? (
                      <p className="to-modal__members-hint">
                        Esta equipe não possui membros cadastrados.
                      </p>
                    ) : (
                      <>
                        <label className="to-modal__member-item to-modal__member-item--select-all">
                          <input
                            type="checkbox"
                            checked={!!allMembersSelected}
                            onChange={handleSelectAll}
                            className="to-modal__checkbox"
                          />
                          <span className="to-modal__member-name">Selecionar todos</span>
                          <span className="to-modal__member-count">
                            {memberIds.length}/{selectedTeam.members.length}
                          </span>
                        </label>
                        {selectedTeam.members.map((m) => (
                          <label key={m.id} className="to-modal__member-item">
                            <input
                              type="checkbox"
                              checked={memberIds.includes(m.userId)}
                              onChange={() => handleMemberToggle(m.userId)}
                              className="to-modal__checkbox"
                            />
                            <span className="to-modal__member-name">{m.userName}</span>
                            <span className="to-modal__member-email">{m.userEmail}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3 — Confirm */}
          {step === 2 && (
            <div className="to-modal__confirm">
              <h3 className="to-modal__section-title">Resumo da operação</h3>
              <dl className="to-modal__summary">
                <div className="to-modal__summary-row">
                  <dt>Tipo</dt>
                  <dd>{selectedOpLabel}</dd>
                </div>
                <div className="to-modal__summary-row">
                  <dt>Talhão</dt>
                  <dd>{selectedPlot?.name ?? '—'}</dd>
                </div>
                <div className="to-modal__summary-row">
                  <dt>Data</dt>
                  <dd>{performedAt}</dd>
                </div>
                <div className="to-modal__summary-row">
                  <dt>Horário</dt>
                  <dd>
                    {timeStart} — {timeEnd}
                  </dd>
                </div>
                <div className="to-modal__summary-row">
                  <dt>Equipe</dt>
                  <dd>{selectedTeam?.name ?? '—'}</dd>
                </div>
                <div className="to-modal__summary-row">
                  <dt>Membros</dt>
                  <dd>{memberIds.length} selecionados</dd>
                </div>
                {notes.trim() && (
                  <div className="to-modal__summary-row">
                    <dt>Observações</dt>
                    <dd>{notes}</dd>
                  </div>
                )}
              </dl>

              <p className="to-modal__confirm-msg">
                Será criado um apontamento para cada membro selecionado.
              </p>
            </div>
          )}

          {submitError && (
            <div className="to-modal__error" role="alert" aria-live="polite">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="to-modal__footer">
          {step > 0 && (
            <button
              type="button"
              className="to-modal__btn to-modal__btn--ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={isSubmitting}
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Voltar
            </button>
          )}
          <div className="to-modal__footer-spacer" />
          <button
            type="button"
            className="to-modal__btn to-modal__btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          {step < 2 && (
            <button
              type="button"
              className="to-modal__btn to-modal__btn--primary"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 ? !canStep1 : !canStep2}
            >
              Próximo
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              className="to-modal__btn to-modal__btn--primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Confirmar'}
              {!isSubmitting && <Check size={16} aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeamOperationModal;
