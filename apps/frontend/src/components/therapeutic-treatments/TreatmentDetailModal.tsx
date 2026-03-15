import { useState, useEffect, useCallback } from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Thermometer,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { api } from '@/services/api';
import type { TreatmentItem, ApplicationItem, EvolutionItem } from '@/types/therapeutic-treatment';
import {
  STATUS_CONFIG,
  APPLICATION_STATUS_CONFIG,
  OUTCOME_OPTIONS,
  EVOLUTION_TYPE_OPTIONS,
} from '@/types/therapeutic-treatment';
import './TreatmentDetailModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  treatmentId: string | null;
  farmId: string;
  onSuccess: () => void;
}

type Tab = 'applications' | 'evolutions' | 'close';

export default function TreatmentDetailModal({
  isOpen,
  onClose,
  treatmentId,
  farmId,
  onSuccess,
}: Props) {
  const [treatment, setTreatment] = useState<TreatmentItem | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('applications');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Evolution form
  const [evoDate, setEvoDate] = useState(new Date().toISOString().slice(0, 10));
  const [evoType, setEvoType] = useState('STABLE');
  const [evoTemp, setEvoTemp] = useState('');
  const [evoObs, setEvoObs] = useState('');
  const [evoVet, setEvoVet] = useState('');

  // Close form
  const [closeOutcome, setCloseOutcome] = useState('CURED');
  const [closeNotes, setCloseNotes] = useState('');

  // Application form
  const [appResponsible, setAppResponsible] = useState('');
  const [skipReason, setSkipReason] = useState('');

  // Fetch treatment detail
  const fetchDetail = useCallback(async () => {
    if (!treatmentId || !farmId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<TreatmentItem>(
        `/org/farms/${farmId}/therapeutic-treatments/${treatmentId}`,
      );
      setTreatment(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tratamento');
    } finally {
      setIsLoading(false);
    }
  }, [treatmentId, farmId]);

  useEffect(() => {
    if (isOpen && treatmentId) {
      void fetchDetail();
      setActiveTab('applications');
      setSuccessMsg(null);
    }
  }, [isOpen, treatmentId, fetchDetail]);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }, []);

  // ─── Record application (CA4) ────────────────────────────────────

  const handleRecordApp = useCallback(
    async (app: ApplicationItem) => {
      if (!appResponsible.trim()) {
        setError('Informe o responsável pela aplicação');
        return;
      }
      setError(null);
      try {
        await api.patch(
          `/org/farms/${farmId}/therapeutic-treatments/${treatmentId}/applications/${app.id}/done`,
          {
            applicationDate: new Date().toISOString().slice(0, 10),
            applicationTime: new Date().toTimeString().slice(0, 5),
            responsibleName: appResponsible,
            deductStock: true,
          },
        );
        showSuccess('Aplicação registrada');
        void fetchDetail();
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao registrar aplicação');
      }
    },
    [farmId, treatmentId, appResponsible, fetchDetail, onSuccess, showSuccess],
  );

  // ─── Skip application (CA4) ──────────────────────────────────────

  const handleSkipApp = useCallback(
    async (app: ApplicationItem) => {
      if (!skipReason.trim()) {
        setError('Informe o motivo da não realização');
        return;
      }
      setError(null);
      try {
        await api.patch(
          `/org/farms/${farmId}/therapeutic-treatments/${treatmentId}/applications/${app.id}/skip`,
          { notDoneReason: skipReason },
        );
        showSuccess('Aplicação marcada como não realizada');
        setSkipReason('');
        void fetchDetail();
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao pular aplicação');
      }
    },
    [farmId, treatmentId, skipReason, fetchDetail, onSuccess, showSuccess],
  );

  // ─── Record evolution (CA5) ──────────────────────────────────────

  const handleRecordEvolution = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      try {
        await api.post(`/org/farms/${farmId}/therapeutic-treatments/${treatmentId}/evolutions`, {
          evolutionDate: evoDate,
          evolutionType: evoType,
          temperature: evoTemp ? parseFloat(evoTemp) : null,
          observations: evoObs || null,
          veterinaryName: evoVet || null,
        });
        showSuccess('Evolução clínica registrada');
        setEvoObs('');
        setEvoTemp('');
        void fetchDetail();
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao registrar evolução');
      }
    },
    [
      farmId,
      treatmentId,
      evoDate,
      evoType,
      evoTemp,
      evoObs,
      evoVet,
      fetchDetail,
      onSuccess,
      showSuccess,
    ],
  );

  // ─── Close treatment (CA8) ──────────────────────────────────────

  const handleClose = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      try {
        await api.patch(`/org/farms/${farmId}/therapeutic-treatments/${treatmentId}/close`, {
          outcome: closeOutcome,
          closingNotes: closeNotes || null,
        });
        showSuccess('Tratamento encerrado');
        void fetchDetail();
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao encerrar tratamento');
      }
    },
    [farmId, treatmentId, closeOutcome, closeNotes, fetchDetail, onSuccess, showSuccess],
  );

  if (!isOpen) return null;

  const isClosed = treatment?.status === 'CLOSED';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div
        className="modal__dialog modal__dialog--xl"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do tratamento"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h2>
              {treatment ? `${treatment.animalEarTag} — ${treatment.diseaseName}` : 'Tratamento'}
            </h2>
            {treatment && (
              <div className="tt-detail__status-row">
                <span className={`tt-detail__status ${STATUS_CONFIG[treatment.status].className}`}>
                  {treatment.statusLabel}
                </span>
                {treatment.outcomeLabel && (
                  <span className="tt-detail__outcome">{treatment.outcomeLabel}</span>
                )}
                {treatment.withdrawalEndDate && (
                  <span className="tt-detail__withdrawal">
                    <Lock size={12} aria-hidden="true" />
                    Carência até {new Date(treatment.withdrawalEndDate).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            )}
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="modal__close">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="tt-detail__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'applications'}
            className={activeTab === 'applications' ? 'tt-detail__tab--active' : ''}
            onClick={() => setActiveTab('applications')}
          >
            <Clock size={16} aria-hidden="true" />
            Aplicações
            {treatment && treatment.pendingApplicationsToday > 0 && (
              <span className="tt-detail__badge">{treatment.pendingApplicationsToday}</span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'evolutions'}
            className={activeTab === 'evolutions' ? 'tt-detail__tab--active' : ''}
            onClick={() => setActiveTab('evolutions')}
          >
            <Activity size={16} aria-hidden="true" />
            Evolução clínica
          </button>
          {!isClosed && (
            <button
              role="tab"
              aria-selected={activeTab === 'close'}
              className={activeTab === 'close' ? 'tt-detail__tab--active' : ''}
              onClick={() => setActiveTab('close')}
            >
              <XCircle size={16} aria-hidden="true" />
              Encerrar
            </button>
          )}
        </div>

        <div className="modal__body tt-detail__body">
          {isLoading && <div className="tt-detail__loading">Carregando...</div>}

          {error && (
            <div className="modal__error" role="alert">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="tt-detail__success" role="status">
              <CheckCircle size={14} aria-hidden="true" />
              {successMsg}
            </div>
          )}

          {/* ─── Applications Tab (CA4) ──────────────────────── */}
          {activeTab === 'applications' && treatment && (
            <div className="tt-detail__apps">
              {!isClosed && (
                <div className="tt-detail__app-form">
                  <label htmlFor="app-responsible">Responsável pela aplicação</label>
                  <input
                    id="app-responsible"
                    type="text"
                    value={appResponsible}
                    onChange={(e) => setAppResponsible(e.target.value)}
                    placeholder="Nome do responsável"
                  />
                </div>
              )}

              {treatment.applications.length === 0 && (
                <p className="tt-detail__empty">Nenhuma aplicação programada.</p>
              )}

              {treatment.applications.map((app) => (
                <div
                  key={app.id}
                  className={`tt-detail__app-card ${APPLICATION_STATUS_CONFIG[app.status].className}`}
                >
                  <div className="tt-detail__app-info">
                    <div className="tt-detail__app-product">
                      <strong>{app.productName}</strong>
                      <span className="tt-detail__app-dose">
                        {app.dosage} {app.dosageUnitLabel} — {app.administrationRouteLabel}
                      </span>
                    </div>
                    <div className="tt-detail__app-schedule">
                      <Clock size={14} aria-hidden="true" />
                      {new Date(app.scheduledDate).toLocaleDateString('pt-BR')}
                      {app.scheduledTime && ` ${app.scheduledTime}`}
                    </div>
                    <span
                      className={`tt-detail__app-status-badge ${APPLICATION_STATUS_CONFIG[app.status].className}`}
                    >
                      {app.statusLabel}
                    </span>
                  </div>

                  {app.status === 'DONE' && (
                    <div className="tt-detail__app-done">
                      <CheckCircle size={14} aria-hidden="true" />
                      Realizado em{' '}
                      {app.applicationDate &&
                        new Date(app.applicationDate).toLocaleDateString('pt-BR')}{' '}
                      {app.applicationTime} por {app.responsibleName}
                    </div>
                  )}

                  {app.status === 'NOT_DONE' && app.notDoneReason && (
                    <div className="tt-detail__app-not-done">
                      <AlertTriangle size={14} aria-hidden="true" />
                      {app.notDoneReason}
                    </div>
                  )}

                  {app.status === 'PENDING' && !isClosed && (
                    <div className="tt-detail__app-actions">
                      <button
                        type="button"
                        className="tt-detail__btn-done"
                        onClick={() => void handleRecordApp(app)}
                        disabled={app.scheduledDate > today}
                      >
                        <CheckCircle size={14} aria-hidden="true" />
                        Realizado
                      </button>
                      <div className="tt-detail__skip-group">
                        <input
                          type="text"
                          placeholder="Motivo..."
                          value={skipReason}
                          onChange={(e) => setSkipReason(e.target.value)}
                          className="tt-detail__skip-input"
                        />
                        <button
                          type="button"
                          className="tt-detail__btn-skip"
                          onClick={() => void handleSkipApp(app)}
                        >
                          <XCircle size={14} aria-hidden="true" />
                          Não realizado
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ─── Evolutions Tab (CA5) ────────────────────────── */}
          {activeTab === 'evolutions' && treatment && (
            <div className="tt-detail__evolutions">
              {!isClosed && (
                <form className="tt-detail__evo-form" onSubmit={handleRecordEvolution}>
                  <h3>Registrar evolução</h3>
                  <div className="modal__row">
                    <div className="modal__field">
                      <label htmlFor="evo-date">Data *</label>
                      <input
                        id="evo-date"
                        type="date"
                        value={evoDate}
                        onChange={(e) => setEvoDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="modal__field">
                      <label htmlFor="evo-type">Evolução *</label>
                      <select
                        id="evo-type"
                        value={evoType}
                        onChange={(e) => setEvoType(e.target.value)}
                        required
                      >
                        {EVOLUTION_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="modal__field modal__field--sm">
                      <label htmlFor="evo-temp">Temperatura (°C)</label>
                      <input
                        id="evo-temp"
                        type="number"
                        step="0.1"
                        min="35"
                        max="43"
                        value={evoTemp}
                        onChange={(e) => setEvoTemp(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="modal__row">
                    <div className="modal__field">
                      <label htmlFor="evo-obs">Observações</label>
                      <textarea
                        id="evo-obs"
                        value={evoObs}
                        onChange={(e) => setEvoObs(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="modal__field">
                      <label htmlFor="evo-vet">Veterinário</label>
                      <input
                        id="evo-vet"
                        type="text"
                        value={evoVet}
                        onChange={(e) => setEvoVet(e.target.value)}
                      />
                    </div>
                  </div>
                  <button type="submit" className="tt-detail__btn-evo">
                    Registrar evolução
                  </button>
                </form>
              )}

              {/* Evolution history */}
              {treatment.evolutions.length === 0 && (
                <p className="tt-detail__empty">Nenhuma evolução registrada.</p>
              )}
              {treatment.evolutions.map((evo: EvolutionItem) => (
                <div
                  key={evo.id}
                  className={`tt-detail__evo-card tt-detail__evo--${evo.evolutionType.toLowerCase()}`}
                >
                  <div className="tt-detail__evo-header">
                    <span className="tt-detail__evo-type">{evo.evolutionTypeLabel}</span>
                    <span className="tt-detail__evo-date">
                      {new Date(evo.evolutionDate).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {evo.temperature != null && (
                    <span className="tt-detail__evo-temp">
                      <Thermometer size={14} aria-hidden="true" />
                      {evo.temperature}°C
                    </span>
                  )}
                  {evo.observations && <p className="tt-detail__evo-obs">{evo.observations}</p>}
                  <span className="tt-detail__evo-meta">
                    {evo.veterinaryName && `${evo.veterinaryName} — `}
                    {evo.recorderName}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ─── Close Tab (CA8) ─────────────────────────────── */}
          {activeTab === 'close' && treatment && !isClosed && (
            <form className="tt-detail__close-form" onSubmit={handleClose}>
              <h3>Encerrar tratamento</h3>
              <div className="modal__field">
                <label htmlFor="close-outcome">Resultado *</label>
                <select
                  id="close-outcome"
                  value={closeOutcome}
                  onChange={(e) => setCloseOutcome(e.target.value)}
                  required
                >
                  {OUTCOME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal__field">
                <label htmlFor="close-notes">Observações finais</label>
                <textarea
                  id="close-notes"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <button type="submit" className="tt-detail__btn-close">
                Encerrar tratamento
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
