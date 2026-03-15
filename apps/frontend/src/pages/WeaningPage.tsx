import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Trash2,
  CupSoda,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Calendar,
  Settings,
  Baby,
  Scale,
  Activity,
  ClipboardList,
  Milk,
  Save,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import {
  useSeparations,
  useWeaningCandidates,
  useWeanings,
  useWeaningIndicators,
  useWeaningCriteria,
} from '@/hooks/useWeaning';
import type { SeparationItem, WeaningCandidateItem, WeaningCriteria } from '@/types/weaning';
import SeparationModal from '@/components/weaning/SeparationModal';
import FeedingProtocolModal from '@/components/weaning/FeedingProtocolModal';
import WeaningModal from '@/components/weaning/WeaningModal';
import { api } from '@/services/api';
import './WeaningPage.css';

type TabId = 'separations' | 'candidates' | 'weanings' | 'config';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'separations', label: 'Separações', icon: Baby },
  { id: 'candidates', label: 'Candidatos', icon: Scale },
  { id: 'weanings', label: 'Desmamas', icon: CupSoda },
  { id: 'config', label: 'Configuração', icon: Settings },
];

export default function WeaningPage() {
  const { selectedFarm } = useFarmContext();
  const farmId = selectedFarm?.id ?? null;

  const [activeTab, setActiveTab] = useState<TabId>('separations');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Separations state
  const [sepSearch, setSepSearch] = useState('');
  const [sepSearchDebounced, setSepSearchDebounced] = useState('');
  const [sepPage, setSepPage] = useState(1);
  const [showSepModal, setShowSepModal] = useState(false);
  const [feedingProtocolTarget, setFeedingProtocolTarget] = useState<SeparationItem | null>(null);

  // Weanings state
  const [weanPage, setWeanPage] = useState(1);
  const [weanSearch, setWeanSearch] = useState('');
  const [weanSearchDebounced, setWeanSearchDebounced] = useState('');
  const [weaningCandidate, setWeaningCandidate] = useState<WeaningCandidateItem | null>(null);
  const [showWeaningModal, setShowWeaningModal] = useState(false);

  // Criteria form state
  const [criteriaForm, setCriteriaForm] = useState<WeaningCriteria>({
    minAgeDays: null,
    minWeightKg: null,
    minConcentrateGrams: null,
    consecutiveDays: null,
    targetLotId: null,
  });
  const [criteriaSaving, setCriteriaSaving] = useState(false);

  // Debounce separations search
  useEffect(() => {
    const t = setTimeout(() => {
      setSepSearchDebounced(sepSearch);
      setSepPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [sepSearch]);

  // Debounce weanings search
  useEffect(() => {
    const t = setTimeout(() => {
      setWeanSearchDebounced(weanSearch);
      setWeanPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [weanSearch]);

  // Data hooks
  const {
    separations,
    meta: sepMeta,
    isLoading: sepLoading,
    error: sepError,
    refetch: refetchSep,
  } = useSeparations({ farmId, page: sepPage, search: sepSearchDebounced || undefined });

  const {
    candidates,
    isLoading: candLoading,
    error: candError,
    refetch: refetchCandidates,
  } = useWeaningCandidates({ farmId });

  const {
    weanings,
    meta: weanMeta,
    isLoading: weanLoading,
    error: weanError,
    refetch: refetchWean,
  } = useWeanings({ farmId, page: weanPage, search: weanSearchDebounced || undefined });

  const { indicators, refetch: refetchIndicators } = useWeaningIndicators({ farmId });

  const { criteria, refetch: refetchCriteria } = useWeaningCriteria();

  // Sync criteria form when criteria loads
  useEffect(() => {
    if (criteria) {
      setCriteriaForm({ ...criteria });
    }
  }, [criteria]);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }, []);

  const handleSepSuccess = useCallback(() => {
    setShowSepModal(false);
    showSuccess('Separação registrada com sucesso');
    void refetchSep();
  }, [refetchSep, showSuccess]);

  const handleFeedingSuccess = useCallback(() => {
    setFeedingProtocolTarget(null);
    showSuccess('Protocolo alimentar salvo com sucesso');
    void refetchSep();
  }, [refetchSep, showSuccess]);

  const handleWeaningSuccess = useCallback(() => {
    setShowWeaningModal(false);
    setWeaningCandidate(null);
    showSuccess('Desmama registrada com sucesso');
    void refetchWean();
    void refetchCandidates();
    void refetchIndicators();
  }, [refetchWean, refetchCandidates, refetchIndicators, showSuccess]);

  const handleDeleteSeparation = useCallback(
    async (sep: SeparationItem) => {
      if (!window.confirm('Excluir esta separação? Esta ação não pode ser desfeita.')) return;
      try {
        await api.delete(`/org/farms/${farmId}/calf-separations/${sep.id}`);
        showSuccess('Separação excluída com sucesso');
        void refetchSep();
      } catch (err: unknown) {
        setGlobalError(err instanceof Error ? err.message : 'Erro ao excluir separação.');
      }
    },
    [farmId, refetchSep, showSuccess],
  );

  const handleDeleteWeaning = useCallback(
    async (weaningId: string) => {
      if (!window.confirm('Excluir este registro de desmama? Esta ação não pode ser desfeita.'))
        return;
      try {
        await api.delete(`/org/farms/${farmId}/weanings/${weaningId}`);
        showSuccess('Desmama excluída com sucesso');
        void refetchWean();
        void refetchIndicators();
      } catch (err: unknown) {
        setGlobalError(err instanceof Error ? err.message : 'Erro ao excluir desmama.');
      }
    },
    [farmId, refetchWean, refetchIndicators, showSuccess],
  );

  const handleSaveCriteria = useCallback(async () => {
    setCriteriaSaving(true);
    setGlobalError(null);
    try {
      await api.put('/org/weaning-criteria', criteriaForm);
      showSuccess('Critérios de desmama salvos com sucesso');
      void refetchCriteria();
      void refetchCandidates();
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Erro ao salvar critérios.');
    } finally {
      setCriteriaSaving(false);
    }
  }, [criteriaForm, refetchCriteria, refetchCandidates, showSuccess]);

  const handleWeanCandidate = useCallback((c: WeaningCandidateItem) => {
    setWeaningCandidate(c);
    setShowWeaningModal(true);
  }, []);

  if (!selectedFarm) {
    return (
      <section className="weaning-page">
        <div className="weaning-page__empty">
          <CupSoda size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para gerenciar desmama e desaleitamento.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="weaning-page">
      <header className="weaning-page__header">
        <div>
          <h1>Desmama e desaleitamento</h1>
          <p>Controle de separação, alimentação e desmama de {selectedFarm.name}</p>
        </div>
        {activeTab === 'separations' && (
          <div className="weaning-page__actions">
            <button
              type="button"
              className="weaning-page__btn-primary"
              onClick={() => setShowSepModal(true)}
            >
              <Plus size={20} aria-hidden="true" />
              Nova separação
            </button>
          </div>
        )}
      </header>

      {successMsg && (
        <div className="weaning-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}
      {(globalError || sepError || candError || weanError) && (
        <div className="weaning-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {globalError || sepError || candError || weanError}
        </div>
      )}

      {/* ─── Tabs ──────────────────────────────────────────────── */}
      <nav className="weaning-page__tabs" aria-label="Abas de desmama">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`weaning-page__tab ${activeTab === tab.id ? 'weaning-page__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <Icon size={16} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ─── Tab: Separações ───────────────────────────────────── */}
      {activeTab === 'separations' && (
        <div className="weaning-page__tab-content">
          <div className="weaning-page__toolbar">
            <div className="weaning-page__search">
              <Search size={16} aria-hidden="true" className="weaning-page__search-icon" />
              <input
                type="text"
                placeholder="Buscar por brinco ou nome..."
                value={sepSearch}
                onChange={(e) => setSepSearch(e.target.value)}
                aria-label="Buscar separações"
              />
            </div>
          </div>

          {sepLoading && <div className="weaning-page__loading">Carregando separações...</div>}

          {!sepLoading && separations.length === 0 && (
            <div className="weaning-page__empty">
              <Baby size={48} aria-hidden="true" />
              <h2>Nenhuma separação registrada</h2>
              <p>Registre a separação de bezerros usando o botão acima.</p>
            </div>
          )}

          {!sepLoading && separations.length > 0 && (
            <div className="weaning-page__grid">
              {separations.map((sep) => (
                <div key={sep.id} className="weaning-page__card">
                  <div className="weaning-page__card-header">
                    <div>
                      <h3 className="weaning-page__card-title">
                        <span className="weaning-page__card-ear-tag">{sep.calfEarTag}</span>
                        {sep.calfName && <span> — {sep.calfName}</span>}
                      </h3>
                      <p className="weaning-page__card-subtitle">
                        Mãe: {sep.motherEarTag}
                        {sep.motherName ? ` — ${sep.motherName}` : ''}
                      </p>
                    </div>
                    <div className="weaning-page__card-actions">
                      <button
                        type="button"
                        className="weaning-page__card-btn"
                        onClick={() => setFeedingProtocolTarget(sep)}
                        aria-label={`${sep.feedingProtocol ? 'Editar' : 'Definir'} protocolo alimentar de ${sep.calfEarTag}`}
                      >
                        <ClipboardList size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="weaning-page__card-btn weaning-page__card-btn--delete"
                        onClick={() => void handleDeleteSeparation(sep)}
                        aria-label={`Excluir separação de ${sep.calfEarTag}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="weaning-page__card-details">
                    <span className="weaning-page__detail">
                      <Calendar size={14} aria-hidden="true" />
                      {new Date(sep.separationDate).toLocaleDateString('pt-BR')}
                    </span>
                    {sep.destination && (
                      <span className="weaning-page__detail">Destino: {sep.destination}</span>
                    )}
                    {sep.reason && (
                      <span className="weaning-page__detail">Motivo: {sep.reason}</span>
                    )}
                  </div>

                  {sep.feedingProtocol && (
                    <div className="weaning-page__protocol-card">
                      <h4 className="weaning-page__protocol-title">
                        <Milk size={14} aria-hidden="true" />
                        Protocolo alimentar
                      </h4>
                      <div className="weaning-page__protocol-details">
                        <span>{sep.feedingProtocol.feedTypeLabel}</span>
                        <span className="weaning-page__protocol-mono">
                          {sep.feedingProtocol.dailyVolumeLiters} L/dia
                        </span>
                        <span className="weaning-page__protocol-mono">
                          {sep.feedingProtocol.frequencyPerDay}x/dia
                        </span>
                        <span>{sep.feedingProtocol.feedingMethodLabel}</span>
                      </div>
                      {sep.feedingProtocol.concentrateGramsPerDay !== null && (
                        <div className="weaning-page__protocol-extra">
                          Concentrado: <strong>{sep.feedingProtocol.concentrateGramsPerDay}</strong>{' '}
                          g/dia
                          {sep.feedingProtocol.targetWeaningWeightKg !== null && (
                            <span>
                              {' '}
                              | Peso alvo:{' '}
                              <strong>{sep.feedingProtocol.targetWeaningWeightKg}</strong> kg
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!sep.feedingProtocol && (
                    <button
                      type="button"
                      className="weaning-page__protocol-cta"
                      onClick={() => setFeedingProtocolTarget(sep)}
                    >
                      <ClipboardList size={16} aria-hidden="true" />
                      Definir protocolo alimentar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {sepMeta && sepMeta.totalPages > 1 && (
            <nav className="weaning-page__pagination" aria-label="Paginação separações">
              <button
                type="button"
                onClick={() => setSepPage((p) => Math.max(1, p - 1))}
                disabled={sepPage <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <span>
                {sepPage} de {sepMeta.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setSepPage((p) => p + 1)}
                disabled={sepPage >= sepMeta.totalPages}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      )}

      {/* ─── Tab: Candidatos ───────────────────────────────────── */}
      {activeTab === 'candidates' && (
        <div className="weaning-page__tab-content">
          {!criteria?.minAgeDays && !criteria?.minWeightKg && (
            <div className="weaning-page__criteria-warning">
              <Settings size={20} aria-hidden="true" />
              <div>
                <h3>Critérios de desmama não configurados</h3>
                <p>
                  Configure os critérios na aba &quot;Configuração&quot; para identificar
                  automaticamente os bezerros aptos à desmama.
                </p>
              </div>
              <button
                type="button"
                className="weaning-page__btn-secondary"
                onClick={() => setActiveTab('config')}
              >
                Configurar
              </button>
            </div>
          )}

          {candLoading && <div className="weaning-page__loading">Carregando candidatos...</div>}

          {!candLoading &&
            candidates.length === 0 &&
            (criteria?.minAgeDays || criteria?.minWeightKg) && (
              <div className="weaning-page__empty">
                <Scale size={48} aria-hidden="true" />
                <h2>Nenhum candidato à desmama</h2>
                <p>Nenhum bezerro atende aos critérios configurados no momento.</p>
              </div>
            )}

          {!candLoading && candidates.length > 0 && (
            <>
              <div className="weaning-page__table-container">
                <table className="weaning-page__table">
                  <caption className="sr-only">Candidatos à desmama</caption>
                  <thead>
                    <tr>
                      <th scope="col">Brinco</th>
                      <th scope="col">Nome</th>
                      <th scope="col">Idade (dias)</th>
                      <th scope="col">Peso (kg)</th>
                      <th scope="col">Idade OK</th>
                      <th scope="col">Peso OK</th>
                      <th scope="col">Apto</th>
                      <th scope="col">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <tr key={c.calfId} className={c.meetsAll ? 'weaning-page__row--ready' : ''}>
                        <td className="weaning-page__cell-mono">{c.earTag}</td>
                        <td>{c.calfName || '—'}</td>
                        <td className="weaning-page__cell-mono">
                          {c.ageDays !== null ? c.ageDays : '—'}
                        </td>
                        <td className="weaning-page__cell-mono">
                          {c.lastWeightKg !== null ? c.lastWeightKg : '—'}
                        </td>
                        <td>
                          {c.meetsAge ? (
                            <CheckCircle
                              size={18}
                              className="weaning-page__check--ok"
                              aria-label="Atende critério de idade"
                            />
                          ) : (
                            <XCircle
                              size={18}
                              className="weaning-page__check--no"
                              aria-label="Não atende critério de idade"
                            />
                          )}
                        </td>
                        <td>
                          {c.meetsWeight ? (
                            <CheckCircle
                              size={18}
                              className="weaning-page__check--ok"
                              aria-label="Atende critério de peso"
                            />
                          ) : (
                            <XCircle
                              size={18}
                              className="weaning-page__check--no"
                              aria-label="Não atende critério de peso"
                            />
                          )}
                        </td>
                        <td>
                          {c.meetsAll ? (
                            <span className="weaning-page__badge weaning-page__badge--ready">
                              <CheckCircle size={14} aria-hidden="true" />
                              Apto
                            </span>
                          ) : (
                            <span className="weaning-page__badge weaning-page__badge--pending">
                              Pendente
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="weaning-page__btn-wean"
                            onClick={() => handleWeanCandidate(c)}
                            disabled={!c.meetsAll}
                            aria-label={`Desmamar ${c.earTag}`}
                          >
                            Desmamar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards for candidates */}
              <div className="weaning-page__candidate-cards">
                {candidates.map((c) => (
                  <div
                    key={c.calfId}
                    className={`weaning-page__candidate-card ${c.meetsAll ? 'weaning-page__candidate-card--ready' : ''}`}
                  >
                    <div className="weaning-page__candidate-card-header">
                      <div>
                        <span className="weaning-page__card-ear-tag">{c.earTag}</span>
                        {c.calfName && (
                          <span className="weaning-page__candidate-card-name">{c.calfName}</span>
                        )}
                      </div>
                      {c.meetsAll ? (
                        <span className="weaning-page__badge weaning-page__badge--ready">
                          <CheckCircle size={14} aria-hidden="true" />
                          Apto
                        </span>
                      ) : (
                        <span className="weaning-page__badge weaning-page__badge--pending">
                          Pendente
                        </span>
                      )}
                    </div>
                    <div className="weaning-page__candidate-card-details">
                      <span>
                        Idade: <strong className="weaning-page__mono">{c.ageDays ?? '—'}</strong>{' '}
                        dias
                        {c.meetsAge ? (
                          <CheckCircle
                            size={14}
                            className="weaning-page__check--ok"
                            aria-label="OK"
                          />
                        ) : (
                          <XCircle size={14} className="weaning-page__check--no" aria-label="Não" />
                        )}
                      </span>
                      <span>
                        Peso:{' '}
                        <strong className="weaning-page__mono">{c.lastWeightKg ?? '—'}</strong> kg
                        {c.meetsWeight ? (
                          <CheckCircle
                            size={14}
                            className="weaning-page__check--ok"
                            aria-label="OK"
                          />
                        ) : (
                          <XCircle size={14} className="weaning-page__check--no" aria-label="Não" />
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="weaning-page__btn-wean weaning-page__btn-wean--full"
                      onClick={() => handleWeanCandidate(c)}
                      disabled={!c.meetsAll}
                    >
                      Desmamar
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Tab: Desmamas ─────────────────────────────────────── */}
      {activeTab === 'weanings' && (
        <div className="weaning-page__tab-content">
          <div className="weaning-page__toolbar">
            <div className="weaning-page__search">
              <Search size={16} aria-hidden="true" className="weaning-page__search-icon" />
              <input
                type="text"
                placeholder="Buscar por brinco ou nome..."
                value={weanSearch}
                onChange={(e) => setWeanSearch(e.target.value)}
                aria-label="Buscar desmamas"
              />
            </div>
          </div>

          {weanLoading && <div className="weaning-page__loading">Carregando desmamas...</div>}

          {!weanLoading && weanings.length === 0 && (
            <div className="weaning-page__empty">
              <CupSoda size={48} aria-hidden="true" />
              <h2>Nenhuma desmama registrada</h2>
              <p>Desmame bezerros a partir da aba &quot;Candidatos&quot;.</p>
            </div>
          )}

          {!weanLoading && weanings.length > 0 && (
            <div className="weaning-page__grid">
              {weanings.map((w) => (
                <div key={w.id} className="weaning-page__card">
                  <div className="weaning-page__card-header">
                    <div>
                      <h3 className="weaning-page__card-title">
                        <span className="weaning-page__card-ear-tag">{w.calfEarTag}</span>
                        {w.calfName && <span> — {w.calfName}</span>}
                      </h3>
                    </div>
                    <div className="weaning-page__card-actions">
                      <button
                        type="button"
                        className="weaning-page__card-btn weaning-page__card-btn--delete"
                        onClick={() => void handleDeleteWeaning(w.id)}
                        aria-label={`Excluir desmama de ${w.calfEarTag}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="weaning-page__card-details">
                    <span className="weaning-page__detail">
                      <Calendar size={14} aria-hidden="true" />
                      {new Date(w.weaningDate).toLocaleDateString('pt-BR')}
                    </span>
                    {w.weightKg !== null && (
                      <span className="weaning-page__detail weaning-page__detail--mono">
                        {w.weightKg} kg
                      </span>
                    )}
                    {w.ageMonths !== null && (
                      <span className="weaning-page__detail weaning-page__detail--mono">
                        {w.ageMonths} meses
                      </span>
                    )}
                  </div>

                  {w.concentrateConsumptionGrams !== null && (
                    <div className="weaning-page__card-extra">
                      Concentrado: <strong>{w.concentrateConsumptionGrams}</strong> g/dia
                    </div>
                  )}

                  {w.observations && <div className="weaning-page__card-obs">{w.observations}</div>}

                  <div className="weaning-page__card-footer-info">
                    {w.recorderName} — {new Date(w.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {weanMeta && weanMeta.totalPages > 1 && (
            <nav className="weaning-page__pagination" aria-label="Paginação desmamas">
              <button
                type="button"
                onClick={() => setWeanPage((p) => Math.max(1, p - 1))}
                disabled={weanPage <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <span>
                {weanPage} de {weanMeta.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setWeanPage((p) => p + 1)}
                disabled={weanPage >= weanMeta.totalPages}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      )}

      {/* ─── Tab: Configuração ─────────────────────────────────── */}
      {activeTab === 'config' && (
        <div className="weaning-page__tab-content">
          {/* Criteria Form */}
          <div className="weaning-page__config-section">
            <h2 className="weaning-page__config-title">
              <Settings size={20} aria-hidden="true" />
              Critérios de desmama
            </h2>
            <p className="weaning-page__config-desc">
              Defina os critérios para identificar bezerros aptos à desmama automaticamente.
            </p>

            <div className="weaning-page__config-form">
              <div className="weaning-page__config-row">
                <div className="weaning-page__config-field">
                  <label htmlFor="crit-age">Idade mínima (dias)</label>
                  <input
                    id="crit-age"
                    type="number"
                    min="0"
                    value={criteriaForm.minAgeDays ?? ''}
                    onChange={(e) =>
                      setCriteriaForm({
                        ...criteriaForm,
                        minAgeDays: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Ex: 60"
                  />
                </div>
                <div className="weaning-page__config-field">
                  <label htmlFor="crit-weight">Peso mínimo (kg)</label>
                  <input
                    id="crit-weight"
                    type="number"
                    min="0"
                    step="0.5"
                    value={criteriaForm.minWeightKg ?? ''}
                    onChange={(e) =>
                      setCriteriaForm({
                        ...criteriaForm,
                        minWeightKg: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Ex: 70"
                  />
                </div>
              </div>

              <div className="weaning-page__config-row">
                <div className="weaning-page__config-field">
                  <label htmlFor="crit-concentrate">Concentrado mínimo (g/dia)</label>
                  <input
                    id="crit-concentrate"
                    type="number"
                    min="0"
                    step="10"
                    value={criteriaForm.minConcentrateGrams ?? ''}
                    onChange={(e) =>
                      setCriteriaForm({
                        ...criteriaForm,
                        minConcentrateGrams: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Ex: 800"
                  />
                </div>
                <div className="weaning-page__config-field">
                  <label htmlFor="crit-days">Dias consecutivos</label>
                  <input
                    id="crit-days"
                    type="number"
                    min="0"
                    value={criteriaForm.consecutiveDays ?? ''}
                    onChange={(e) =>
                      setCriteriaForm({
                        ...criteriaForm,
                        consecutiveDays: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Ex: 3"
                  />
                </div>
              </div>

              <div className="weaning-page__config-field">
                <label htmlFor="crit-lot">ID do lote de destino</label>
                <input
                  id="crit-lot"
                  type="text"
                  value={criteriaForm.targetLotId ?? ''}
                  onChange={(e) =>
                    setCriteriaForm({
                      ...criteriaForm,
                      targetLotId: e.target.value || null,
                    })
                  }
                  placeholder="UUID do lote de destino (opcional)"
                />
              </div>

              <button
                type="button"
                className="weaning-page__btn-primary"
                onClick={() => void handleSaveCriteria()}
                disabled={criteriaSaving}
              >
                <Save size={20} aria-hidden="true" />
                {criteriaSaving ? 'Salvando...' : 'Salvar critérios'}
              </button>
            </div>
          </div>

          {/* Indicators */}
          <div className="weaning-page__config-section">
            <h2 className="weaning-page__config-title">
              <Activity size={20} aria-hidden="true" />
              Indicadores de desmama
            </h2>

            <div className="weaning-page__indicators">
              <div className="weaning-page__indicator-card">
                <span className="weaning-page__indicator-label">TOTAL DESMAMADOS</span>
                <span className="weaning-page__indicator-value">
                  {indicators?.totalWeaned ?? '—'}
                </span>
              </div>
              <div className="weaning-page__indicator-card">
                <span className="weaning-page__indicator-label">PESO MÉDIO</span>
                <span className="weaning-page__indicator-value">
                  {indicators?.avgWeightKg !== null && indicators?.avgWeightKg !== undefined
                    ? `${indicators.avgWeightKg} kg`
                    : '—'}
                </span>
              </div>
              <div className="weaning-page__indicator-card">
                <span className="weaning-page__indicator-label">IDADE MÉDIA</span>
                <span className="weaning-page__indicator-value">
                  {indicators?.avgAgeMonths !== null && indicators?.avgAgeMonths !== undefined
                    ? `${indicators.avgAgeMonths} meses`
                    : '—'}
                </span>
              </div>
              <div className="weaning-page__indicator-card">
                <span className="weaning-page__indicator-label">TAXA DE MORTALIDADE</span>
                <span className="weaning-page__indicator-value">
                  {indicators?.mortalityRate !== null && indicators?.mortalityRate !== undefined
                    ? `${indicators.mortalityRate}%`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modals ────────────────────────────────────────────── */}
      <SeparationModal
        isOpen={showSepModal}
        onClose={() => setShowSepModal(false)}
        farmId={selectedFarm.id}
        onSuccess={handleSepSuccess}
      />

      {feedingProtocolTarget && (
        <FeedingProtocolModal
          isOpen={!!feedingProtocolTarget}
          onClose={() => setFeedingProtocolTarget(null)}
          farmId={selectedFarm.id}
          separationId={feedingProtocolTarget.id}
          existingProtocol={feedingProtocolTarget.feedingProtocol}
          onSuccess={handleFeedingSuccess}
        />
      )}

      <WeaningModal
        isOpen={showWeaningModal}
        onClose={() => {
          setShowWeaningModal(false);
          setWeaningCandidate(null);
        }}
        farmId={selectedFarm.id}
        candidate={weaningCandidate}
        onSuccess={handleWeaningSuccess}
      />
    </section>
  );
}
