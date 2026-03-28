import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, UsersRound, Link2 } from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';
import { api } from '@/services/api';
import type { TimeEntry } from '@/types/attendance';

interface FieldTeam {
  id: string;
  name: string;
  memberCount: number;
  costCenterId?: string;
}

interface TeamLinkingTabProps {
  farmId: string;
  dateFrom: string;
  dateTo: string;
  timeEntries: TimeEntry[];
  onLinkIndividual: (entry: TimeEntry) => void;
  onSuccess: (message: string) => void;
}

interface FormErrors {
  teamId?: string;
  date?: string;
  operationType?: string;
  minutes?: string;
}

const OPERATION_TYPES = [
  { value: 'COLHEITA', label: 'Colheita' },
  { value: 'PLANTIO', label: 'Plantio' },
  { value: 'PULVERIZACAO', label: 'Pulverização' },
  { value: 'ADUBACAO', label: 'Adubação' },
  { value: 'MANUTENCAO', label: 'Manutenção' },
  { value: 'IRRIGACAO', label: 'Irrigação' },
  { value: 'OUTROS', label: 'Outros' },
];

export default function TeamLinkingTab({
  farmId,
  dateFrom,
  timeEntries,
  onLinkIndividual,
  onSuccess,
}: TeamLinkingTabProps) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [teams, setTeams] = useState<FieldTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const [teamId, setTeamId] = useState('');
  const [date, setDate] = useState(dateFrom || new Date().toISOString().split('T')[0]);
  const [operationType, setOperationType] = useState('');
  const [fieldPlotId, setFieldPlotId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    created: number;
    total: number;
    skipped: number;
  } | null>(null);

  const fetchTeams = useCallback(async () => {
    if (!orgId) return;
    setTeamsLoading(true);
    try {
      const params = new URLSearchParams();
      if (farmId) params.set('farmId', farmId);
      const qs = params.toString();
      const result = await api.get<FieldTeam[] | { data: FieldTeam[] }>(
        `/org/${orgId}/field-teams${qs ? `?${qs}` : ''}`,
      );
      const items = Array.isArray(result) ? result : (result as { data: FieldTeam[] }).data;
      setTeams(items);
    } catch {
      setTeams([]);
    } finally {
      setTeamsLoading(false);
    }
  }, [orgId, farmId]);

  useEffect(() => {
    void fetchTeams();
  }, [fetchTeams]);

  // Pre-fill cost center from team
  useEffect(() => {
    const team = teams.find((t) => t.id === teamId);
    if (team?.costCenterId) {
      setCostCenterId(team.costCenterId);
    }
  }, [teamId, teams]);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!teamId) errs.teamId = 'Selecione uma equipe';
    if (!date) errs.date = 'Informe a data';
    if (!operationType) errs.operationType = 'Selecione o tipo de operação';
    if (!minutes) errs.minutes = 'Informe os minutos';
    const mins = parseInt(minutes, 10);
    if (isNaN(mins) || mins <= 0) errs.minutes = 'Informe um valor maior que zero';
    return errs;
  }

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate();
    setErrors(errs);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ teamId: true, date: true, operationType: true, minutes: true });
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (!orgId) return;
    setIsSubmitting(true);
    setSubmitResult(null);
    try {
      const payload: Record<string, unknown> = {
        date,
        operationType,
        minutes: parseInt(minutes, 10),
        notes: notes || undefined,
        fieldPlotId: fieldPlotId || undefined,
        costCenterId: costCenterId || undefined,
      };

      const result = await api.post<{
        created: number;
        total: number;
        skipped: number;
        skippedMembers?: string[];
      }>(`/org/${orgId}/time-entries/team/${teamId}/activities`, payload);

      setSubmitResult({ created: result.created, total: result.total, skipped: result.skipped });
      const msg = `Vinculado para ${result.created} de ${result.total} membros da equipe`;
      onSuccess(msg);

      // Reset form
      setMinutes('');
      setNotes('');
      setTouched({});
      setErrors({});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao vincular equipe';
      setErrors({ teamId: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedTeam = teams.find((t) => t.id === teamId);

  return (
    <div className="team-linking-tab">
      {/* Section: Bulk team link */}
      <section className="team-linking-tab__section">
        <h2 className="team-linking-tab__section-title">
          <UsersRound size={20} aria-hidden="true" />
          Por Equipe
        </h2>
        <p className="team-linking-tab__section-desc">
          Vincule horas de todos os membros de uma equipe a uma operação de uma vez.
        </p>

        {teamsLoading && <p className="team-linking-tab__loading">Carregando equipes...</p>}

        {!teamsLoading && teams.length === 0 && (
          <div className="team-linking-tab__empty" role="status">
            <UsersRound size={32} aria-hidden="true" />
            <p>
              Nenhuma equipe cadastrada para esta fazenda. Cadastre equipes em Operacoes {'>'}{' '}
              Equipes de Campo.
            </p>
          </div>
        )}

        {!teamsLoading && teams.length > 0 && (
          <form
            className="team-linking-tab__form"
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            noValidate
          >
            <div className="team-linking-tab__fields">
              {/* Team select */}
              <div className="team-linking-tab__field">
                <label htmlFor="team-select" className="team-linking-tab__label">
                  Equipe <span aria-hidden="true">*</span>
                </label>
                <select
                  id="team-select"
                  className={`team-linking-tab__select ${touched.teamId && errors.teamId ? 'team-linking-tab__select--error' : ''}`}
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  onBlur={() => handleBlur('teamId')}
                  aria-required="true"
                  aria-describedby={
                    touched.teamId && errors.teamId ? 'team-select-error' : undefined
                  }
                >
                  <option value="">Selecione a equipe...</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.memberCount} membros)
                    </option>
                  ))}
                </select>
                {touched.teamId && errors.teamId && (
                  <span id="team-select-error" className="team-linking-tab__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.teamId}
                  </span>
                )}
              </div>

              {/* Date */}
              <div className="team-linking-tab__field">
                <label htmlFor="team-date" className="team-linking-tab__label">
                  Data <span aria-hidden="true">*</span>
                </label>
                <input
                  id="team-date"
                  type="date"
                  className={`team-linking-tab__input ${touched.date && errors.date ? 'team-linking-tab__input--error' : ''}`}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onBlur={() => handleBlur('date')}
                  aria-required="true"
                />
                {touched.date && errors.date && (
                  <span className="team-linking-tab__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.date}
                  </span>
                )}
              </div>

              {/* Operation type */}
              <div className="team-linking-tab__field">
                <label htmlFor="team-op-type" className="team-linking-tab__label">
                  Operação <span aria-hidden="true">*</span>
                </label>
                <select
                  id="team-op-type"
                  className={`team-linking-tab__select ${touched.operationType && errors.operationType ? 'team-linking-tab__select--error' : ''}`}
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  onBlur={() => handleBlur('operationType')}
                  aria-required="true"
                >
                  <option value="">Selecione a operação...</option>
                  {OPERATION_TYPES.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                {touched.operationType && errors.operationType && (
                  <span className="team-linking-tab__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.operationType}
                  </span>
                )}
              </div>

              {/* Field plot */}
              <div className="team-linking-tab__field">
                <label htmlFor="team-plot" className="team-linking-tab__label">
                  Talhao / Pasto
                </label>
                <input
                  id="team-plot"
                  type="text"
                  className="team-linking-tab__input"
                  value={fieldPlotId}
                  onChange={(e) => setFieldPlotId(e.target.value)}
                  placeholder="ID do talhão ou pasto"
                />
              </div>

              {/* Cost center */}
              <div className="team-linking-tab__field">
                <label htmlFor="team-cc" className="team-linking-tab__label">
                  Centro de Custo
                </label>
                <input
                  id="team-cc"
                  type="text"
                  className="team-linking-tab__input"
                  value={costCenterId}
                  onChange={(e) => setCostCenterId(e.target.value)}
                  placeholder={
                    selectedTeam?.costCenterId
                      ? 'Pré-preenchido da equipe'
                      : 'ID do centro de custo'
                  }
                />
              </div>

              {/* Minutes */}
              <div className="team-linking-tab__field">
                <label htmlFor="team-minutes" className="team-linking-tab__label">
                  Minutos <span aria-hidden="true">*</span>
                </label>
                <input
                  id="team-minutes"
                  type="number"
                  min="1"
                  className={`team-linking-tab__input team-linking-tab__input--mono ${touched.minutes && errors.minutes ? 'team-linking-tab__input--error' : ''}`}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  onBlur={() => handleBlur('minutes')}
                  placeholder="Ex: 480"
                  aria-required="true"
                />
                {minutes && !isNaN(parseInt(minutes, 10)) && (
                  <span className="team-linking-tab__hint">
                    {(parseInt(minutes, 10) / 60).toFixed(1)}h por colaborador
                  </span>
                )}
                {touched.minutes && errors.minutes && (
                  <span className="team-linking-tab__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.minutes}
                  </span>
                )}
              </div>

              {/* Notes */}
              <div className="team-linking-tab__field team-linking-tab__field--full">
                <label htmlFor="team-notes" className="team-linking-tab__label">
                  Observacoes
                </label>
                <textarea
                  id="team-notes"
                  className="team-linking-tab__textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Informações adicionais sobre esta operação"
                />
              </div>
            </div>

            {/* Submit result summary */}
            {submitResult && (
              <div className="team-linking-tab__result" role="status" aria-live="polite">
                <span className="team-linking-tab__result-text">
                  Vinculado para <strong>{submitResult.created}</strong> de{' '}
                  <strong>{submitResult.total}</strong> membros
                  {submitResult.skipped > 0 && (
                    <span className="team-linking-tab__result-skipped">
                      {' '}
                      ({submitResult.skipped} sem ponto na data)
                    </span>
                  )}
                </span>
              </div>
            )}

            <div className="team-linking-tab__actions">
              <button
                type="submit"
                className="team-linking-tab__btn team-linking-tab__btn--primary"
                disabled={isSubmitting}
                aria-label="Vincular horas da equipe a operacao"
              >
                {isSubmitting ? 'Vinculando...' : 'Vincular para Equipe'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Section: Individual linking */}
      <section className="team-linking-tab__section">
        <h2 className="team-linking-tab__section-title">
          <Link2 size={20} aria-hidden="true" />
          Individual
        </h2>
        <p className="team-linking-tab__section-desc">
          Vincule horas de um apontamento específico a uma operação.
        </p>

        {timeEntries.length === 0 ? (
          <div className="team-linking-tab__empty" role="status">
            <p>Nenhum apontamento disponível para o período selecionado.</p>
          </div>
        ) : (
          <div className="team-linking-tab__table-wrapper">
            <table
              className="team-linking-tab__table"
              aria-label="Apontamentos para vincular individualmente"
            >
              <thead>
                <tr>
                  <th scope="col">DATA</th>
                  <th scope="col">COLABORADOR</th>
                  <th scope="col">HORAS</th>
                  <th scope="col">ATIVIDADES</th>
                  <th scope="col">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.map((entry) => (
                  <tr key={entry.id} className="team-linking-tab__row">
                    <td>{new Date(entry.date).toLocaleDateString('pt-BR')}</td>
                    <td>{entry.employeeName}</td>
                    <td className="team-linking-tab__cell-mono">
                      {entry.workedMinutes !== null
                        ? `${Math.floor(entry.workedMinutes / 60)}h${entry.workedMinutes % 60 > 0 ? `${String(entry.workedMinutes % 60).padStart(2, '0')}m` : ''}`
                        : '—'}
                    </td>
                    <td>
                      {entry.activities.length > 0 ? (
                        <span className="team-linking-tab__activity-count">
                          {entry.activities.length} vinculada
                          {entry.activities.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="team-linking-tab__activity-none">Nenhuma</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="team-linking-tab__link-btn"
                        onClick={() => onLinkIndividual(entry)}
                        aria-label={`Vincular operação ao ponto de ${entry.employeeName}`}
                      >
                        <Link2 size={14} aria-hidden="true" />
                        Vincular
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
