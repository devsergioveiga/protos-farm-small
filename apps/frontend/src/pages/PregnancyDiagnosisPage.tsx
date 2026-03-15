import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  ScanLine,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Calendar,
  AlertTriangle,
  List,
  BarChart3,
  Baby,
  Users,
  TrendingDown,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import {
  usePregnancyDiagnoses,
  useCalvingCalendar,
  useEmptyFemales,
  useDgIndicators,
} from '@/hooks/usePregnancyDiagnoses';
import type { DiagnosisItem } from '@/types/pregnancy-diagnosis';
import { DG_RESULTS, RESULT_BADGE_CONFIG, UTERINE_SEVERITY } from '@/types/pregnancy-diagnosis';
import DiagnosisModal from '@/components/pregnancy-diagnosis/DiagnosisModal';
import { api } from '@/services/api';
import './PregnancyDiagnosisPage.css';

type TabId = 'diagnoses' | 'calendar' | 'empty' | 'indicators';

export default function PregnancyDiagnosisPage() {
  const { selectedFarm } = useFarmContext();

  // ─── State ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('diagnoses');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiagnosisItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // ─── Debounced search ───────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── Data ───────────────────────────────────────────────
  const farmId = selectedFarm?.id ?? null;

  const { diagnoses, meta, isLoading, error, refetch } = usePregnancyDiagnoses({
    farmId,
    page,
    result: resultFilter || undefined,
  });

  const {
    calendar,
    isLoading: calLoading,
    refetch: refetchCalendar,
  } = useCalvingCalendar(activeTab === 'calendar' ? farmId : null);

  const {
    females,
    isLoading: emptyLoading,
    refetch: refetchEmpty,
  } = useEmptyFemales(activeTab === 'empty' ? farmId : null);

  const {
    indicators,
    isLoading: indLoading,
    refetch: refetchIndicators,
  } = useDgIndicators(activeTab === 'indicators' ? farmId : null);

  // ─── Filter diagnoses locally by search ─────────────────
  const filtered = search
    ? diagnoses.filter(
        (d) =>
          d.animalEarTag.toLowerCase().includes(search.toLowerCase()) ||
          (d.animalName ?? '').toLowerCase().includes(search.toLowerCase()) ||
          d.veterinaryName.toLowerCase().includes(search.toLowerCase()),
      )
    : diagnoses;

  // ─── Callbacks ──────────────────────────────────────────
  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedDiagnosis(null);
    setSuccessMsg(
      selectedDiagnosis
        ? 'Diagnóstico atualizado com sucesso'
        : 'Diagnóstico registrado com sucesso',
    );
    void refetch();
    void refetchCalendar();
    void refetchEmpty();
    void refetchIndicators();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, refetchCalendar, refetchEmpty, refetchIndicators, selectedDiagnosis]);

  const handleEdit = useCallback((d: DiagnosisItem) => {
    setSelectedDiagnosis(d);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (d: DiagnosisItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm('Excluir este diagnóstico? Esta ação não pode ser desfeita.')) return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/pregnancy-diagnoses/${d.id}`);
        setSuccessMsg('Diagnóstico excluído com sucesso');
        void refetch();
        void refetchCalendar();
        void refetchEmpty();
        void refetchIndicators();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir diagnóstico.');
      }
    },
    [refetch, refetchCalendar, refetchEmpty, refetchIndicators, selectedFarm],
  );

  const handleConfirm = useCallback(
    async (d: DiagnosisItem, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await api.post(`/org/farms/${selectedFarm!.id}/pregnancy-diagnoses/${d.id}/confirm`, {});
        setSuccessMsg('Gestação confirmada com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao confirmar gestação.');
      }
    },
    [refetch, selectedFarm],
  );

  const handleLoss = useCallback(
    async (d: DiagnosisItem, e: React.MouseEvent) => {
      e.stopPropagation();
      const reason = window.prompt('Motivo da perda gestacional:');
      if (reason === null) return;
      try {
        await api.post(`/org/farms/${selectedFarm!.id}/pregnancy-diagnoses/${d.id}/loss`, {
          lossReason: reason || null,
        });
        setSuccessMsg('Perda registrada');
        void refetch();
        void refetchIndicators();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao registrar perda.');
      }
    },
    [refetch, refetchIndicators, selectedFarm],
  );

  const handleReferIatf = useCallback(
    async (diagnosisId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await api.post(
          `/org/farms/${selectedFarm!.id}/pregnancy-diagnoses/${diagnosisId}/refer-iatf`,
          {},
        );
        setSuccessMsg('Encaminhada para IATF');
        void refetch();
        void refetchEmpty();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao encaminhar para IATF.');
      }
    },
    [refetch, refetchEmpty, selectedFarm],
  );

  const toggleMonth = useCallback((month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }, []);

  // ─── No farm selected ──────────────────────────────────
  if (!selectedFarm) {
    return (
      <section className="dg-page">
        <div className="dg-page__empty">
          <ScanLine size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver os diagnósticos de gestação.</p>
        </div>
      </section>
    );
  }

  const totalPages = meta ? meta.totalPages : 1;

  return (
    <section className="dg-page">
      {/* Header */}
      <header className="dg-page__header">
        <div>
          <h1>Diagnóstico de gestação</h1>
          <p>Diagnósticos reprodutivos do rebanho de {selectedFarm.name}</p>
        </div>
        <div className="dg-page__actions">
          <button
            type="button"
            className="dg-page__btn-primary"
            onClick={() => {
              setSelectedDiagnosis(null);
              setShowModal(true);
            }}
          >
            <Plus size={20} aria-hidden="true" />
            Novo diagnóstico
          </button>
        </div>
      </header>

      {/* Success */}
      {successMsg && (
        <div className="dg-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {/* Errors */}
      {(error || deleteError) && (
        <div className="dg-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      {/* Tabs */}
      <nav className="dg-page__tabs" role="tablist" aria-label="Abas de diagnóstico de gestação">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'diagnoses'}
          className={activeTab === 'diagnoses' ? 'dg-page__tab--active' : 'dg-page__tab'}
          onClick={() => setActiveTab('diagnoses')}
        >
          <List size={16} aria-hidden="true" />
          Diagnósticos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'calendar'}
          className={activeTab === 'calendar' ? 'dg-page__tab--active' : 'dg-page__tab'}
          onClick={() => setActiveTab('calendar')}
        >
          <Calendar size={16} aria-hidden="true" />
          Calendário de partos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'empty'}
          className={activeTab === 'empty' ? 'dg-page__tab--active' : 'dg-page__tab'}
          onClick={() => setActiveTab('empty')}
        >
          <Users size={16} aria-hidden="true" />
          Vazias
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'indicators'}
          className={activeTab === 'indicators' ? 'dg-page__tab--active' : 'dg-page__tab'}
          onClick={() => setActiveTab('indicators')}
        >
          <BarChart3 size={16} aria-hidden="true" />
          Indicadores
        </button>
      </nav>

      {/* ═══════════════════════════════════════════════════════
          TAB 1 — Diagnósticos
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'diagnoses' && (
        <>
          {/* Toolbar */}
          <div className="dg-page__toolbar">
            <div className="dg-page__search">
              <Search size={16} aria-hidden="true" className="dg-page__search-icon" />
              <input
                type="text"
                placeholder="Buscar por animal ou veterinário..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Buscar diagnósticos"
              />
            </div>
            <select
              className="dg-page__result-filter"
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por resultado"
            >
              <option value="">Todos os resultados</option>
              {DG_RESULTS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Loading */}
          {isLoading && <div className="dg-page__loading">Carregando diagnósticos...</div>}

          {/* Empty */}
          {!isLoading && filtered.length === 0 && (
            <div className="dg-page__empty">
              <ScanLine size={48} aria-hidden="true" />
              <h2>Nenhum diagnóstico registrado</h2>
              <p>Registre o primeiro diagnóstico de gestação usando o botão acima.</p>
            </div>
          )}

          {/* Cards */}
          {!isLoading && filtered.length > 0 && (
            <div className="dg-page__grid">
              {filtered.map((d) => {
                const badge = RESULT_BADGE_CONFIG[d.result] ?? {
                  label: d.resultLabel,
                  className: '',
                };
                const uterineSev = UTERINE_SEVERITY[d.uterineCondition] ?? '';

                return (
                  <div
                    key={d.id}
                    className="dg-page__card"
                    onClick={() => handleEdit(d)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleEdit(d);
                      }
                    }}
                  >
                    {/* Reproductive restriction warning */}
                    {d.reproductiveRestriction && (
                      <div className="dg-page__card-restriction" role="alert">
                        <ShieldAlert size={14} aria-hidden="true" />
                        Restrição reprodutiva
                        {d.restrictionEndDate && (
                          <span>
                            {' '}
                            até {new Date(d.restrictionEndDate).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="dg-page__card-header">
                      <div>
                        <h3 className="dg-page__card-title">
                          {d.animalEarTag} — {d.animalName || 'Sem nome'}
                        </h3>
                        <p className="dg-page__card-subtitle">{d.methodLabel}</p>
                      </div>
                      <div className="dg-page__card-actions">
                        <button
                          type="button"
                          className="dg-page__card-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(d);
                          }}
                          aria-label={`Editar diagnóstico de ${d.animalEarTag}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="dg-page__card-btn dg-page__card-btn--delete"
                          onClick={(e) => void handleDelete(d, e)}
                          aria-label={`Excluir diagnóstico de ${d.animalEarTag}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="dg-page__card-tags">
                      <span className={`dg-page__tag ${badge.className}`}>{d.resultLabel}</span>
                      {d.isConfirmed && (
                        <span className="dg-page__tag dg-page__tag--confirmed">
                          <CheckCircle size={12} aria-hidden="true" />
                          Confirmada
                        </span>
                      )}
                      {d.referredToIatf && (
                        <span className="dg-page__tag dg-page__tag--iatf">
                          <Zap size={12} aria-hidden="true" />
                          IATF
                        </span>
                      )}
                      {d.lossDate && (
                        <span className="dg-page__tag dg-badge--loss">
                          <AlertTriangle size={12} aria-hidden="true" />
                          Perda
                        </span>
                      )}
                      {d.uterineCondition !== 'NONE' && uterineSev && (
                        <span className={`dg-page__tag ${uterineSev}`}>
                          {d.uterineConditionLabel}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="dg-page__card-details">
                      <span className="dg-page__detail">
                        <Calendar size={14} aria-hidden="true" />
                        {new Date(d.diagnosisDate).toLocaleDateString('pt-BR')}
                      </span>
                      {d.gestationDays != null && (
                        <span className="dg-page__detail dg-page__detail--mono">
                          {d.gestationDays}d gestação
                        </span>
                      )}
                      <span className="dg-page__detail">{d.veterinaryName}</span>
                    </div>

                    {d.expectedCalvingDate && (
                      <div className="dg-page__card-calving">
                        <Baby size={14} aria-hidden="true" />
                        Parto previsto:{' '}
                        <span className="dg-page__mono">
                          {new Date(d.expectedCalvingDate).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}

                    {d.bullName && (
                      <div className="dg-page__card-bull">
                        Touro: {d.bullName}
                        {d.bullBreedName ? ` (${d.bullBreedName})` : ''}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="dg-page__card-footer">
                      {d.result === 'PREGNANT' && !d.isConfirmed && !d.lossDate && (
                        <button
                          type="button"
                          className="dg-page__action-btn dg-page__action-btn--confirm"
                          onClick={(e) => void handleConfirm(d, e)}
                        >
                          <CheckCircle size={14} aria-hidden="true" />
                          Confirmar
                        </button>
                      )}
                      {d.result === 'PREGNANT' && !d.lossDate && (
                        <button
                          type="button"
                          className="dg-page__action-btn dg-page__action-btn--loss"
                          onClick={(e) => void handleLoss(d, e)}
                        >
                          <TrendingDown size={14} aria-hidden="true" />
                          Perda
                        </button>
                      )}
                      {(d.result === 'EMPTY' || d.result === 'CYCLING') && !d.referredToIatf && (
                        <button
                          type="button"
                          className="dg-page__action-btn dg-page__action-btn--iatf"
                          onClick={(e) => void handleReferIatf(d.id, e)}
                        >
                          <Zap size={14} aria-hidden="true" />
                          IATF
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {meta && totalPages > 1 && (
            <nav className="dg-page__pagination" aria-label="Paginação">
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
                {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 2 — Calendário de partos
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'calendar' && (
        <div className="dg-calendar">
          {calLoading && <div className="dg-page__loading">Carregando calendário...</div>}

          {!calLoading && calendar.length === 0 && (
            <div className="dg-page__empty">
              <Calendar size={48} aria-hidden="true" />
              <h2>Nenhum parto previsto</h2>
              <p>Registre diagnósticos de gestação para ver as previsões de parto.</p>
            </div>
          )}

          {!calLoading &&
            calendar.map((m) => {
              const isExpanded = expandedMonths.has(m.month);
              return (
                <div key={m.month} className="dg-calendar__month">
                  <button
                    type="button"
                    className="dg-calendar__month-header"
                    onClick={() => toggleMonth(m.month)}
                    aria-expanded={isExpanded}
                  >
                    <div className="dg-calendar__month-info">
                      <h3>{m.month}</h3>
                      <span className="dg-calendar__count-badge">{m.count} partos</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={20} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={20} aria-hidden="true" />
                    )}
                  </button>

                  {isExpanded && (
                    <ul className="dg-calendar__animal-list">
                      {m.animals.map((a) => (
                        <li key={a.animalId} className="dg-calendar__animal-item">
                          <div className="dg-calendar__animal-info">
                            <span className="dg-calendar__animal-tag">{a.earTag}</span>
                            {a.animalName && (
                              <span className="dg-calendar__animal-name">{a.animalName}</span>
                            )}
                          </div>
                          <div className="dg-calendar__animal-details">
                            <span className="dg-page__mono">
                              {new Date(a.expectedDate).toLocaleDateString('pt-BR')}
                            </span>
                            {a.gestationDays != null && (
                              <span className="dg-calendar__gestation">{a.gestationDays}d</span>
                            )}
                            {a.bullName && (
                              <span className="dg-calendar__bull">Touro: {a.bullName}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 3 — Vazias
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'empty' && (
        <div className="dg-empty-tab">
          {emptyLoading && <div className="dg-page__loading">Carregando fêmeas vazias...</div>}

          {!emptyLoading && females.length === 0 && (
            <div className="dg-page__empty">
              <Users size={48} aria-hidden="true" />
              <h2>Nenhuma fêmea vazia</h2>
              <p>Não há fêmeas diagnosticadas como vazias no momento.</p>
            </div>
          )}

          {!emptyLoading && females.length > 0 && (
            <>
              {/* Desktop table */}
              <table className="dg-empty__table">
                <caption className="sr-only">Fêmeas vazias</caption>
                <thead>
                  <tr>
                    <th scope="col">Brinco</th>
                    <th scope="col">Nome</th>
                    <th scope="col">Data DG</th>
                    <th scope="col">Dias desde DG</th>
                    <th scope="col">Ciclicidade</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {females.map((f) => (
                    <tr key={f.animalId}>
                      <td className="dg-empty__tag">{f.earTag}</td>
                      <td>{f.animalName || '—'}</td>
                      <td>{new Date(f.diagnosisDate).toLocaleDateString('pt-BR')}</td>
                      <td className="dg-page__mono">{f.daysSinceDiagnosis}d</td>
                      <td>{f.cyclicityStatus ?? '—'}</td>
                      <td>
                        <div className="dg-empty__actions">
                          <button
                            type="button"
                            className="dg-page__action-btn dg-page__action-btn--iatf"
                            onClick={(e) => {
                              // Find the diagnosis by animal to get its id — use the generic refer
                              const diag = diagnoses.find(
                                (d) => d.animalId === f.animalId && d.result === 'EMPTY',
                              );
                              if (diag) void handleReferIatf(diag.id, e);
                            }}
                          >
                            <Zap size={14} aria-hidden="true" />
                            IATF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="dg-empty__cards">
                {females.map((f) => (
                  <div key={f.animalId} className="dg-empty__card">
                    <div className="dg-empty__card-header">
                      <span className="dg-empty__card-tag">{f.earTag}</span>
                      {f.animalName && <span>{f.animalName}</span>}
                    </div>
                    <div className="dg-empty__card-details">
                      <span>DG: {new Date(f.diagnosisDate).toLocaleDateString('pt-BR')}</span>
                      <span className="dg-page__mono">{f.daysSinceDiagnosis} dias</span>
                      {f.cyclicityStatus && <span>{f.cyclicityStatus}</span>}
                    </div>
                    <div className="dg-empty__card-actions">
                      <button
                        type="button"
                        className="dg-page__action-btn dg-page__action-btn--iatf"
                        onClick={(e) => {
                          const diag = diagnoses.find(
                            (d) => d.animalId === f.animalId && d.result === 'EMPTY',
                          );
                          if (diag) void handleReferIatf(diag.id, e);
                        }}
                      >
                        <Zap size={14} aria-hidden="true" />
                        Encaminhar IATF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 4 — Indicadores
          ═══════════════════════════════════════════════════════ */}
      {activeTab === 'indicators' && (
        <div className="dg-indicators">
          {indLoading && <div className="dg-page__loading">Carregando indicadores...</div>}

          {!indLoading && !indicators && (
            <div className="dg-page__empty">
              <BarChart3 size={48} aria-hidden="true" />
              <h2>Sem dados disponíveis</h2>
              <p>Registre diagnósticos para visualizar os indicadores reprodutivos.</p>
            </div>
          )}

          {!indLoading && indicators && (
            <div className="dg-indicators__grid">
              <div className="dg-indicators__card">
                <span className="dg-indicators__label">Total de diagnósticos</span>
                <span className="dg-indicators__value">{indicators.totalDiagnoses}</span>
              </div>
              <div className="dg-indicators__card dg-indicators__card--primary">
                <span className="dg-indicators__label">Taxa de prenhez</span>
                <span className="dg-indicators__value">
                  {indicators.pregnancyRate.toFixed(1).replace('.', ',')}%
                </span>
              </div>
              <div className="dg-indicators__card dg-indicators__card--warning">
                <span className="dg-indicators__label">Vazias</span>
                <span className="dg-indicators__value">{indicators.emptyCount}</span>
              </div>
              <div className="dg-indicators__card dg-indicators__card--danger">
                <span className="dg-indicators__label">Perdas</span>
                <span className="dg-indicators__value">{indicators.lossCount}</span>
              </div>
              <div className="dg-indicators__card">
                <span className="dg-indicators__label">Gestação média</span>
                <span className="dg-indicators__value dg-page__mono">
                  {indicators.avgGestationDays != null
                    ? `${indicators.avgGestationDays.toFixed(0)} dias`
                    : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <DiagnosisModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedDiagnosis(null);
        }}
        diagnosis={selectedDiagnosis}
        farmId={selectedFarm.id}
        onSuccess={handleSuccess}
      />
    </section>
  );
}
