import { useState, useCallback, useEffect } from 'react';
import {
  Baby,
  Search,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  XCircle,
  Calendar,
  Scale,
  Clock,
  Users,
  Settings,
  List,
  LayoutGrid,
  Save,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useReproductiveReleases } from '@/hooks/useReproductiveReleases';
import { api } from '@/services/api';
import type {
  CandidateItem,
  CriteriaItem,
  ReleaseIndicators,
  SetCriteriaInput,
} from '@/types/reproductive-release';
import type { LotListItem } from '@/types/lot';
import ReleaseModal from '@/components/reproductive-releases/ReleaseModal';
import BulkReleaseModal from '@/components/reproductive-releases/BulkReleaseModal';
import './ReproductiveReleasesPage.css';

type TabKey = 'candidates' | 'releases' | 'config';

export default function ReproductiveReleasesPage() {
  const { selectedFarm } = useFarmContext();

  // ─── Tab state ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('candidates');

  // ─── Candidates tab ────────────────────────────────────
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [minAgeFilter, setMinAgeFilter] = useState<string>('');

  // ─── Releases tab ─────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // ─── Config tab ───────────────────────────────────────
  const [criteria, setCriteria] = useState<CriteriaItem>({
    minWeightKg: null,
    minAgeMonths: null,
    minBodyScore: null,
    targetLotId: null,
  });
  const [criteriaForm, setCriteriaForm] = useState<SetCriteriaInput>({});
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [criteriaSaving, setCriteriaSaving] = useState(false);
  const [criteriaError, setCriteriaError] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<ReleaseIndicators | null>(null);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);
  const [lots, setLots] = useState<LotListItem[]>([]);

  // ─── Modal state ──────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [preselectedAnimalId, setPreselectedAnimalId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ─── Bulk release state ───────────────────────────────
  const [showBulkModal, setShowBulkModal] = useState(false);

  // ─── Debounced search ─────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── Data: releases ───────────────────────────────────
  const { releases, meta, isLoading, error, refetch } = useReproductiveReleases({
    farmId: selectedFarm?.id ?? null,
    page,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  // ─── Fetch candidates ─────────────────────────────────
  const fetchCandidates = useCallback(async () => {
    if (!selectedFarm) return;
    setCandidatesLoading(true);
    setCandidatesError(null);
    try {
      const result = await api.get<CandidateItem[]>(
        `/org/farms/${selectedFarm.id}/reproductive-releases/candidates`,
      );
      setCandidates(result);
    } catch (err) {
      setCandidatesError(err instanceof Error ? err.message : 'Erro ao carregar candidatas');
      setCandidates([]);
    } finally {
      setCandidatesLoading(false);
    }
  }, [selectedFarm]);

  // ─── Fetch criteria ────────────────────────────────────
  const fetchCriteria = useCallback(async () => {
    if (!selectedFarm) return;
    setCriteriaLoading(true);
    setCriteriaError(null);
    try {
      const result = await api.get<CriteriaItem>('/org/reproductive-criteria');
      const safe = result ?? {
        minWeightKg: null,
        minAgeMonths: null,
        minBodyScore: null,
        targetLotId: null,
      };
      setCriteria(safe);
      setCriteriaForm({
        minWeightKg: safe.minWeightKg,
        minAgeMonths: safe.minAgeMonths,
        minBodyScore: safe.minBodyScore,
        targetLotId: safe.targetLotId,
      });
    } catch (err) {
      // If criteria not set yet, that's OK
      if (err instanceof Error && err.message.includes('404')) {
        setCriteria({
          minWeightKg: null,
          minAgeMonths: null,
          minBodyScore: null,
          targetLotId: null,
        });
      } else {
        setCriteriaError(err instanceof Error ? err.message : 'Erro ao carregar critérios');
      }
    } finally {
      setCriteriaLoading(false);
    }
  }, [selectedFarm]);

  // ─── Fetch indicators ─────────────────────────────────
  const fetchIndicators = useCallback(async () => {
    if (!selectedFarm) return;
    setIndicatorsLoading(true);
    try {
      const result = await api.get<ReleaseIndicators>(
        `/org/farms/${selectedFarm.id}/reproductive-releases/indicators`,
      );
      setIndicators(result);
    } catch {
      setIndicators(null);
    } finally {
      setIndicatorsLoading(false);
    }
  }, [selectedFarm]);

  // ─── Fetch lots ────────────────────────────────────────
  const fetchLots = useCallback(async () => {
    if (!selectedFarm) return;
    try {
      const result = await api.get<{ data: LotListItem[] }>(
        `/org/farms/${selectedFarm.id}/lots?limit=500`,
      );
      setLots(result.data);
    } catch {
      setLots([]);
    }
  }, [selectedFarm]);

  // ─── Load data when tab changes ───────────────────────
  useEffect(() => {
    if (!selectedFarm) return;
    if (activeTab === 'candidates') {
      void fetchCandidates();
      void fetchCriteria();
    } else if (activeTab === 'config') {
      void fetchCriteria();
      void fetchIndicators();
      void fetchLots();
    }
  }, [activeTab, selectedFarm, fetchCandidates, fetchCriteria, fetchIndicators, fetchLots]);

  // ─── Save criteria ────────────────────────────────────
  const handleSaveCriteria = async (e: React.FormEvent) => {
    e.preventDefault();
    setCriteriaSaving(true);
    setCriteriaError(null);
    try {
      await api.put('/org/reproductive-criteria', criteriaForm);
      setSuccessMsg('Critérios salvos com sucesso');
      void fetchCriteria();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setCriteriaError(err instanceof Error ? err.message : 'Erro ao salvar critérios');
    } finally {
      setCriteriaSaving(false);
    }
  };

  // ─── Checkbox logic ───────────────────────────────────
  const toggleSelect = (animalId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(animalId)) {
        next.delete(animalId);
      } else {
        next.add(animalId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCandidates.map((c) => c.animalId)));
    }
  };

  // ─── Filtered candidates by age ────────────────────────
  const filteredCandidates = (() => {
    const minAge = minAgeFilter ? Number(minAgeFilter) : null;
    if (minAge == null || isNaN(minAge) || minAge <= 0) return candidates;
    return candidates.filter((c) => c.ageMonths != null && c.ageMonths >= minAge);
  })();

  const selectedAnimalsData = filteredCandidates.filter((c) => selectedIds.has(c.animalId));

  // ─── Bulk release ─────────────────────────────────────
  const handleBulkSuccess = useCallback(() => {
    setShowBulkModal(false);
    setSelectedIds(new Set());
    setSuccessMsg('Novilhas liberadas com sucesso');
    void fetchCandidates();
    void refetch();
    void fetchIndicators();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [fetchCandidates, refetch, fetchIndicators]);

  // ─── Individual release from candidate ─────────────────
  const handleReleaseCandidate = (candidate: CandidateItem) => {
    setPreselectedAnimalId(candidate.animalId);
    setShowModal(true);
  };

  // ─── Modal success ────────────────────────────────────
  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setPreselectedAnimalId(null);
    setSuccessMsg('Liberação registrada com sucesso');
    void refetch();
    void fetchCandidates();
    void fetchIndicators();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, fetchCandidates, fetchIndicators]);

  // ─── Body score badge ─────────────────────────────────
  const getScoreBadgeClass = (score: number | null) => {
    if (score === null) return '';
    if (score <= 2) return 'reproductive-releases-page__score--low';
    if (score === 3) return 'reproductive-releases-page__score--medium';
    return 'reproductive-releases-page__score--high';
  };

  // ─── Criteria configured? ─────────────────────────────
  const hasCriteria =
    criteria.minWeightKg !== null ||
    criteria.minAgeMonths !== null ||
    criteria.minBodyScore !== null;

  // ─── No farm selected ─────────────────────────────────
  if (!selectedFarm) {
    return (
      <section className="reproductive-releases-page">
        <div className="reproductive-releases-page__empty">
          <Baby size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver as liberações reprodutivas.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="reproductive-releases-page">
      {/* Header */}
      <header className="reproductive-releases-page__header">
        <div>
          <h1>Liberação reprodutiva</h1>
          <p>Liberação de novilhas para reprodução em {selectedFarm.name}</p>
        </div>
        <div className="reproductive-releases-page__actions">
          <button
            type="button"
            className="reproductive-releases-page__btn-primary"
            onClick={() => {
              setPreselectedAnimalId(null);
              setShowModal(true);
            }}
          >
            <Baby size={20} aria-hidden="true" />
            Nova liberação
          </button>
        </div>
      </header>

      {/* Success */}
      {successMsg && (
        <div className="reproductive-releases-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <nav className="reproductive-releases-page__tabs" aria-label="Abas">
        <button
          type="button"
          className={`reproductive-releases-page__tab ${activeTab === 'candidates' ? 'reproductive-releases-page__tab--active' : ''}`}
          onClick={() => setActiveTab('candidates')}
          aria-selected={activeTab === 'candidates'}
          role="tab"
        >
          <Users size={16} aria-hidden="true" />
          Candidatas
        </button>
        <button
          type="button"
          className={`reproductive-releases-page__tab ${activeTab === 'releases' ? 'reproductive-releases-page__tab--active' : ''}`}
          onClick={() => setActiveTab('releases')}
          aria-selected={activeTab === 'releases'}
          role="tab"
        >
          <List size={16} aria-hidden="true" />
          Liberações
        </button>
        <button
          type="button"
          className={`reproductive-releases-page__tab ${activeTab === 'config' ? 'reproductive-releases-page__tab--active' : ''}`}
          onClick={() => setActiveTab('config')}
          aria-selected={activeTab === 'config'}
          role="tab"
        >
          <Settings size={16} aria-hidden="true" />
          Configuração
        </button>
      </nav>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB: Candidatas                                            */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'candidates' && (
        <div className="reproductive-releases-page__panel">
          {/* Errors */}
          {candidatesError && (
            <div className="reproductive-releases-page__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {candidatesError}
            </div>
          )}

          {/* No criteria */}
          {!hasCriteria && !criteriaLoading && (
            <div className="reproductive-releases-page__empty">
              <Settings size={48} aria-hidden="true" />
              <h2>Critérios não configurados</h2>
              <p>Configure os critérios de liberação na aba Configuração para ver as candidatas.</p>
              <button
                type="button"
                className="reproductive-releases-page__btn-primary"
                onClick={() => setActiveTab('config')}
              >
                Configurar critérios
              </button>
            </div>
          )}

          {/* Loading */}
          {candidatesLoading && hasCriteria && (
            <div className="reproductive-releases-page__loading">Carregando candidatas...</div>
          )}

          {/* Empty candidates */}
          {!candidatesLoading && hasCriteria && candidates.length === 0 && (
            <div className="reproductive-releases-page__empty">
              <Baby size={48} aria-hidden="true" />
              <h2>Nenhuma candidata encontrada</h2>
              <p>Não há novilhas que atendam aos critérios de liberação no momento.</p>
            </div>
          )}

          {/* Candidate list */}
          {!candidatesLoading && hasCriteria && candidates.length > 0 && (
            <>
              {/* Age filter */}
              <div className="reproductive-releases-page__candidates-toolbar">
                <div className="reproductive-releases-page__filter-field">
                  <label htmlFor="min-age-filter">
                    <Clock size={14} aria-hidden="true" /> Idade mínima (meses)
                  </label>
                  <input
                    id="min-age-filter"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Ex: 18"
                    value={minAgeFilter}
                    onChange={(e) => {
                      setMinAgeFilter(e.target.value);
                      setSelectedIds(new Set());
                    }}
                    className="reproductive-releases-page__age-filter-input"
                  />
                </div>
                <span className="reproductive-releases-page__candidates-count">
                  {filteredCandidates.length} de {candidates.length} candidata
                  {candidates.length !== 1 ? 's' : ''}
                </span>
              </div>

              {filteredCandidates.length === 0 && (
                <div className="reproductive-releases-page__empty">
                  <Clock size={48} aria-hidden="true" />
                  <h2>Nenhuma candidata com essa idade</h2>
                  <p>
                    Nenhuma novilha possui {minAgeFilter} meses ou mais. Ajuste o filtro de idade.
                  </p>
                </div>
              )}
            </>
          )}

          {!candidatesLoading && hasCriteria && filteredCandidates.length > 0 && (
            <>
              <div className="reproductive-releases-page__table-container">
                <table className="reproductive-releases-page__table">
                  <caption className="sr-only">
                    Lista de novilhas candidatas à liberação reprodutiva
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        <input
                          type="checkbox"
                          checked={
                            filteredCandidates.length > 0 &&
                            selectedIds.size === filteredCandidates.length
                          }
                          onChange={toggleSelectAll}
                          aria-label="Selecionar todas as candidatas aptas"
                        />
                      </th>
                      <th scope="col">Brinco</th>
                      <th scope="col">Nome</th>
                      <th scope="col">Idade</th>
                      <th scope="col">Peso</th>
                      <th scope="col">Escore</th>
                      <th scope="col">Peso</th>
                      <th scope="col">Idade</th>
                      <th scope="col">Escore</th>
                      <th scope="col">Ações</th>
                    </tr>
                    <tr className="reproductive-releases-page__table-subheader">
                      <th></th>
                      <th></th>
                      <th></th>
                      <th></th>
                      <th></th>
                      <th></th>
                      <th colSpan={3} className="reproductive-releases-page__criteria-label">
                        Critérios
                      </th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidates.map((c) => (
                      <tr
                        key={c.animalId}
                        className={c.meetsAll ? 'reproductive-releases-page__row--eligible' : ''}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(c.animalId)}
                            onChange={() => toggleSelect(c.animalId)}
                            aria-label={`Selecionar ${c.earTag}`}
                          />
                        </td>
                        <td className="reproductive-releases-page__cell--mono">{c.earTag}</td>
                        <td>{c.animalName || '—'}</td>
                        <td className="reproductive-releases-page__cell--mono">
                          {c.ageMonths !== null ? `${c.ageMonths.toFixed(1)} m` : '—'}
                        </td>
                        <td className="reproductive-releases-page__cell--mono">
                          {c.lastWeightKg !== null ? `${c.lastWeightKg} kg` : '—'}
                        </td>
                        <td>
                          {c.bodyConditionScore !== null ? (
                            <span
                              className={`reproductive-releases-page__score ${getScoreBadgeClass(c.bodyConditionScore)}`}
                            >
                              {c.bodyConditionScore}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {c.meetsWeight ? (
                            <Check
                              size={16}
                              aria-hidden="true"
                              className="reproductive-releases-page__check"
                            />
                          ) : (
                            <XCircle
                              size={16}
                              aria-hidden="true"
                              className="reproductive-releases-page__x"
                            />
                          )}
                          <span className="sr-only">
                            {c.meetsWeight
                              ? 'Atende critério de peso'
                              : 'Não atende critério de peso'}
                          </span>
                        </td>
                        <td>
                          {c.meetsAge ? (
                            <Check
                              size={16}
                              aria-hidden="true"
                              className="reproductive-releases-page__check"
                            />
                          ) : (
                            <XCircle
                              size={16}
                              aria-hidden="true"
                              className="reproductive-releases-page__x"
                            />
                          )}
                          <span className="sr-only">
                            {c.meetsAge
                              ? 'Atende critério de idade'
                              : 'Não atende critério de idade'}
                          </span>
                        </td>
                        <td>
                          {c.meetsScore ? (
                            <Check
                              size={16}
                              aria-hidden="true"
                              className="reproductive-releases-page__check"
                            />
                          ) : (
                            <XCircle
                              size={16}
                              aria-hidden="true"
                              className="reproductive-releases-page__x"
                            />
                          )}
                          <span className="sr-only">
                            {c.meetsScore
                              ? 'Atende critério de escore'
                              : 'Não atende critério de escore'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="reproductive-releases-page__btn-release"
                            onClick={() => handleReleaseCandidate(c)}
                            aria-label={`Liberar ${c.earTag}`}
                          >
                            Liberar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile candidate cards */}
              <div className="reproductive-releases-page__mobile-candidates">
                {filteredCandidates.map((c) => (
                  <div
                    key={c.animalId}
                    className={`reproductive-releases-page__candidate-card ${c.meetsAll ? 'reproductive-releases-page__candidate-card--eligible' : ''}`}
                  >
                    <div className="reproductive-releases-page__candidate-card-header">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.animalId)}
                        onChange={() => toggleSelect(c.animalId)}
                        aria-label={`Selecionar ${c.earTag}`}
                      />
                      <div className="reproductive-releases-page__candidate-card-info">
                        <span className="reproductive-releases-page__candidate-card-tag">
                          {c.earTag}
                        </span>
                        <span className="reproductive-releases-page__candidate-card-name">
                          {' '}
                          {c.animalName || ''}
                        </span>
                      </div>
                    </div>
                    <div className="reproductive-releases-page__candidate-card-stats">
                      {c.ageMonths !== null && <span>{c.ageMonths.toFixed(1)} meses</span>}
                      {c.lastWeightKg !== null && <span>{c.lastWeightKg} kg</span>}
                      {c.bodyConditionScore !== null && (
                        <span
                          className={`reproductive-releases-page__score ${getScoreBadgeClass(c.bodyConditionScore)}`}
                        >
                          ECC {c.bodyConditionScore}
                        </span>
                      )}
                    </div>
                    <div className="reproductive-releases-page__candidate-card-criteria">
                      <span className="reproductive-releases-page__criterion">
                        {c.meetsWeight ? (
                          <Check
                            size={14}
                            aria-hidden="true"
                            className="reproductive-releases-page__check"
                          />
                        ) : (
                          <XCircle
                            size={14}
                            aria-hidden="true"
                            className="reproductive-releases-page__x"
                          />
                        )}
                        Peso
                      </span>
                      <span className="reproductive-releases-page__criterion">
                        {c.meetsAge ? (
                          <Check
                            size={14}
                            aria-hidden="true"
                            className="reproductive-releases-page__check"
                          />
                        ) : (
                          <XCircle
                            size={14}
                            aria-hidden="true"
                            className="reproductive-releases-page__x"
                          />
                        )}
                        Idade
                      </span>
                      <span className="reproductive-releases-page__criterion">
                        {c.meetsScore ? (
                          <Check
                            size={14}
                            aria-hidden="true"
                            className="reproductive-releases-page__check"
                          />
                        ) : (
                          <XCircle
                            size={14}
                            aria-hidden="true"
                            className="reproductive-releases-page__x"
                          />
                        )}
                        Escore
                      </span>
                    </div>
                    <div className="reproductive-releases-page__candidate-card-actions">
                      <button
                        type="button"
                        className="reproductive-releases-page__btn-release"
                        onClick={() => handleReleaseCandidate(c)}
                        aria-label={`Liberar ${c.earTag}`}
                      >
                        Liberar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bulk action bar */}
              {selectedIds.size > 0 && (
                <div className="reproductive-releases-page__bulk-bar">
                  <span className="reproductive-releases-page__bulk-count">
                    {selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    className="reproductive-releases-page__btn-primary"
                    onClick={() => setShowBulkModal(true)}
                  >
                    <Baby size={16} aria-hidden="true" />
                    Liberar selecionadas
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB: Liberações                                            */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'releases' && (
        <div className="reproductive-releases-page__panel">
          {/* Errors */}
          {error && (
            <div className="reproductive-releases-page__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Toolbar */}
          <div className="reproductive-releases-page__toolbar">
            <div className="reproductive-releases-page__filter-field reproductive-releases-page__filter-field--search">
              <label htmlFor="release-search">Busca</label>
              <div className="reproductive-releases-page__search">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="reproductive-releases-page__search-icon"
                />
                <input
                  id="release-search"
                  type="text"
                  placeholder="Brinco ou nome..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
            <div className="reproductive-releases-page__filter-field">
              <label htmlFor="release-date-from">De</label>
              <input
                id="release-date-from"
                type="date"
                className="reproductive-releases-page__date-input"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="reproductive-releases-page__filter-field">
              <label htmlFor="release-date-to">Até</label>
              <input
                id="release-date-to"
                type="date"
                className="reproductive-releases-page__date-input"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            {(dateFrom || dateTo) && (
              <div className="reproductive-releases-page__filter-field">
                <label className="reproductive-releases-page__label-spacer">&nbsp;</label>
                <button
                  type="button"
                  className="reproductive-releases-page__date-clear"
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                    setPage(1);
                  }}
                  aria-label="Limpar filtro de datas"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="reproductive-releases-page__filter-field">
              <label className="reproductive-releases-page__label-spacer">&nbsp;</label>
              <div
                className="reproductive-releases-page__view-toggle"
                role="group"
                aria-label="Modo de visualização"
              >
                <button
                  type="button"
                  className={`reproductive-releases-page__view-btn${viewMode === 'table' ? ' reproductive-releases-page__view-btn--active' : ''}`}
                  onClick={() => setViewMode('table')}
                  aria-label="Visualização em tabela"
                  aria-pressed={viewMode === 'table'}
                >
                  <List size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`reproductive-releases-page__view-btn${viewMode === 'cards' ? ' reproductive-releases-page__view-btn--active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  aria-label="Visualização em cards"
                  aria-pressed={viewMode === 'cards'}
                >
                  <LayoutGrid size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="reproductive-releases-page__loading">Carregando liberações...</div>
          )}

          {/* Empty */}
          {!isLoading && releases.length === 0 && (
            <div className="reproductive-releases-page__empty">
              <Baby size={48} aria-hidden="true" />
              <h2>Nenhuma liberação registrada</h2>
              <p>Registre liberações de novilhas usando o botão acima ou pela aba Candidatas.</p>
            </div>
          )}

          {/* Table view */}
          {!isLoading && releases.length > 0 && viewMode === 'table' && (
            <div className="reproductive-releases-page__table-container">
              <table className="reproductive-releases-page__table">
                <caption className="sr-only">Novilhas liberadas para reprodução</caption>
                <thead>
                  <tr>
                    <th scope="col">Brinco</th>
                    <th scope="col">Nome</th>
                    <th scope="col">Data</th>
                    <th scope="col">Peso (kg)</th>
                    <th scope="col">Idade (meses)</th>
                    <th scope="col">ECC</th>
                    <th scope="col">Cat. anterior</th>
                    <th scope="col">Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((r) => (
                    <tr key={r.id}>
                      <td className="reproductive-releases-page__cell--mono">{r.animalEarTag}</td>
                      <td>{r.animalName || '—'}</td>
                      <td>{new Date(r.releaseDate + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="reproductive-releases-page__cell--mono">
                        {r.weightKg !== null ? r.weightKg : '—'}
                      </td>
                      <td className="reproductive-releases-page__cell--mono">
                        {r.ageMonths !== null ? r.ageMonths : '—'}
                      </td>
                      <td>
                        {r.bodyConditionScore !== null ? (
                          <span
                            className={`reproductive-releases-page__score ${getScoreBadgeClass(r.bodyConditionScore)}`}
                          >
                            {r.bodyConditionScore}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{r.previousCategory || '—'}</td>
                      <td>{r.recorderName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile cards fallback (shown <768px when table mode is active) */}
          {!isLoading && releases.length > 0 && viewMode === 'table' && (
            <div className="reproductive-releases-page__mobile-releases">
              {releases.map((r) => (
                <div key={r.id} className="reproductive-releases-page__card">
                  <div className="reproductive-releases-page__card-header">
                    <div>
                      <h3 className="reproductive-releases-page__card-title">
                        {r.animalEarTag} — {r.animalName || 'Sem nome'}
                      </h3>
                      {r.previousCategory && (
                        <p className="reproductive-releases-page__card-subtitle">
                          Categoria anterior: {r.previousCategory}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="reproductive-releases-page__card-details">
                    <span className="reproductive-releases-page__detail">
                      <Calendar size={14} aria-hidden="true" />
                      {new Date(r.releaseDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    {r.weightKg !== null && (
                      <span className="reproductive-releases-page__detail reproductive-releases-page__detail--mono">
                        <Scale size={14} aria-hidden="true" />
                        {r.weightKg} kg
                      </span>
                    )}
                    {r.ageMonths !== null && (
                      <span className="reproductive-releases-page__detail reproductive-releases-page__detail--mono">
                        <Clock size={14} aria-hidden="true" />
                        {r.ageMonths} meses
                      </span>
                    )}
                    {r.bodyConditionScore !== null && (
                      <span
                        className={`reproductive-releases-page__score ${getScoreBadgeClass(r.bodyConditionScore)}`}
                      >
                        ECC {r.bodyConditionScore}
                      </span>
                    )}
                  </div>
                  <div className="reproductive-releases-page__card-footer">
                    <span>{r.recorderName}</span>
                  </div>
                  {r.notes && (
                    <div className="reproductive-releases-page__card-notes">{r.notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Cards view */}
          {!isLoading && releases.length > 0 && viewMode === 'cards' && (
            <div className="reproductive-releases-page__grid">
              {releases.map((r) => (
                <div key={r.id} className="reproductive-releases-page__card">
                  <div className="reproductive-releases-page__card-header">
                    <div>
                      <h3 className="reproductive-releases-page__card-title">
                        {r.animalEarTag} — {r.animalName || 'Sem nome'}
                      </h3>
                      {r.previousCategory && (
                        <p className="reproductive-releases-page__card-subtitle">
                          Categoria anterior: {r.previousCategory}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="reproductive-releases-page__card-details">
                    <span className="reproductive-releases-page__detail">
                      <Calendar size={14} aria-hidden="true" />
                      {new Date(r.releaseDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    {r.weightKg !== null && (
                      <span className="reproductive-releases-page__detail reproductive-releases-page__detail--mono">
                        <Scale size={14} aria-hidden="true" />
                        {r.weightKg} kg
                      </span>
                    )}
                    {r.ageMonths !== null && (
                      <span className="reproductive-releases-page__detail reproductive-releases-page__detail--mono">
                        <Clock size={14} aria-hidden="true" />
                        {r.ageMonths} meses
                      </span>
                    )}
                    {r.bodyConditionScore !== null && (
                      <span
                        className={`reproductive-releases-page__score ${getScoreBadgeClass(r.bodyConditionScore)}`}
                      >
                        ECC {r.bodyConditionScore}
                      </span>
                    )}
                  </div>

                  <div className="reproductive-releases-page__card-footer">
                    <span>{r.recorderName}</span>
                  </div>

                  {r.notes && (
                    <div className="reproductive-releases-page__card-notes">{r.notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {meta && releases.length > 0 && (
            <nav className="reproductive-releases-page__pagination" aria-label="Paginação">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <span>
                {page} de {meta.totalPages} — {meta.total}{' '}
                {meta.total === 1 ? 'registro' : 'registros'}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= meta.totalPages}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB: Configuração                                          */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'config' && (
        <div className="reproductive-releases-page__panel">
          {criteriaError && (
            <div className="reproductive-releases-page__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {criteriaError}
            </div>
          )}

          {/* Indicators */}
          <div className="reproductive-releases-page__indicators">
            <div className="reproductive-releases-page__indicator">
              <span className="reproductive-releases-page__indicator-value">
                {indicatorsLoading ? '...' : (indicators?.totalReleased ?? 0)}
              </span>
              <span className="reproductive-releases-page__indicator-label">Total liberadas</span>
            </div>
            <div className="reproductive-releases-page__indicator">
              <span className="reproductive-releases-page__indicator-value">
                {indicatorsLoading
                  ? '...'
                  : indicators?.avgAgeMonths !== null && indicators?.avgAgeMonths !== undefined
                    ? `${indicators.avgAgeMonths.toFixed(1)} m`
                    : '—'}
              </span>
              <span className="reproductive-releases-page__indicator-label">Idade média</span>
            </div>
            <div className="reproductive-releases-page__indicator">
              <span className="reproductive-releases-page__indicator-value">
                {indicatorsLoading
                  ? '...'
                  : indicators?.avgWeightKg !== null && indicators?.avgWeightKg !== undefined
                    ? `${indicators.avgWeightKg.toFixed(1)} kg`
                    : '—'}
              </span>
              <span className="reproductive-releases-page__indicator-label">Peso médio</span>
            </div>
            <div className="reproductive-releases-page__indicator">
              <span className="reproductive-releases-page__indicator-value">
                {indicatorsLoading
                  ? '...'
                  : indicators?.avgRearingDays !== null && indicators?.avgRearingDays !== undefined
                    ? `${indicators.avgRearingDays.toFixed(0)} d`
                    : '—'}
              </span>
              <span className="reproductive-releases-page__indicator-label">
                Tempo médio de recria
              </span>
            </div>
          </div>

          {/* Criteria form */}
          <div className="reproductive-releases-page__config-section">
            <h2 className="reproductive-releases-page__section-title">Critérios de liberação</h2>
            <p className="reproductive-releases-page__section-desc">
              Defina os critérios mínimos para que uma novilha seja considerada apta para
              reprodução.
            </p>

            {criteriaLoading ? (
              <div className="reproductive-releases-page__loading">Carregando critérios...</div>
            ) : (
              <form
                onSubmit={(e) => void handleSaveCriteria(e)}
                className="reproductive-releases-page__criteria-form"
              >
                <div className="reproductive-releases-page__criteria-grid">
                  <div className="reproductive-releases-page__field">
                    <label htmlFor="criteria-weight">Peso mínimo (kg)</label>
                    <input
                      id="criteria-weight"
                      type="number"
                      min="0"
                      step="0.1"
                      value={criteriaForm.minWeightKg ?? ''}
                      onChange={(e) =>
                        setCriteriaForm({
                          ...criteriaForm,
                          minWeightKg: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Ex: 300"
                    />
                  </div>
                  <div className="reproductive-releases-page__field">
                    <label htmlFor="criteria-age">Idade mínima (meses)</label>
                    <input
                      id="criteria-age"
                      type="number"
                      min="0"
                      value={criteriaForm.minAgeMonths ?? ''}
                      onChange={(e) =>
                        setCriteriaForm({
                          ...criteriaForm,
                          minAgeMonths: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Ex: 18"
                    />
                  </div>
                  <div className="reproductive-releases-page__field">
                    <label htmlFor="criteria-score">Escore corporal mínimo</label>
                    <select
                      id="criteria-score"
                      value={criteriaForm.minBodyScore ?? ''}
                      onChange={(e) =>
                        setCriteriaForm({
                          ...criteriaForm,
                          minBodyScore: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">Sem restrição</option>
                      <option value="1">1 — Muito magra</option>
                      <option value="2">2 — Magra</option>
                      <option value="3">3 — Regular</option>
                      <option value="4">4 — Boa</option>
                      <option value="5">5 — Excelente</option>
                    </select>
                  </div>
                  <div className="reproductive-releases-page__field">
                    <label htmlFor="criteria-lot">Lote de destino</label>
                    <select
                      id="criteria-lot"
                      value={criteriaForm.targetLotId ?? ''}
                      onChange={(e) =>
                        setCriteriaForm({
                          ...criteriaForm,
                          targetLotId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Nenhum lote de destino</option>
                      {lots.map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="reproductive-releases-page__criteria-actions">
                  <button
                    type="submit"
                    className="reproductive-releases-page__btn-primary"
                    disabled={criteriaSaving}
                  >
                    <Save size={16} aria-hidden="true" />
                    {criteriaSaving ? 'Salvando...' : 'Salvar critérios'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      <ReleaseModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setPreselectedAnimalId(null);
        }}
        farmId={selectedFarm.id}
        onSuccess={handleSuccess}
        preselectedAnimalId={preselectedAnimalId}
        preselectedCandidate={
          preselectedAnimalId
            ? (candidates.find((c) => c.animalId === preselectedAnimalId) ?? null)
            : null
        }
      />

      <BulkReleaseModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        farmId={selectedFarm.id}
        selectedAnimals={selectedAnimalsData}
        criteria={criteria}
        onSuccess={handleBulkSuccess}
      />
    </section>
  );
}
