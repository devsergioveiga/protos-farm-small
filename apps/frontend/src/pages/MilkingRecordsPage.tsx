import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  AlertTriangle,
  Pencil,
  Trash2,
  Milk,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Calendar,
  Download,
  Droplets,
  Users,
  TrendingUp,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import {
  useMilkingRecords,
  useLactatingAnimals,
  useDailySummary,
  useProductionTrend,
  bulkCreateMilking,
  deleteMilkingRecord,
  exportMilkingCsv,
} from '@/hooks/useMilkingRecords';
import type { MilkingRecordItem, BulkMilkingResult } from '@/types/milking-record';
import { MILKING_SHIFTS, SHIFT_BADGE_CONFIG } from '@/types/milking-record';
import MilkingModal from '@/components/milking-records/MilkingModal';
import './MilkingRecordsPage.css';

type TabId = 'quick' | 'records' | 'production';

export default function MilkingRecordsPage() {
  const { selectedFarm } = useFarmContext();

  const [activeTab, setActiveTab] = useState<TabId>('quick');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  /* ─── Records tab state ──────────────────────────────────────────── */
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MilkingRecordItem | null>(null);

  /* ─── Quick entry state ──────────────────────────────────────────── */
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickShift, setQuickShift] = useState('MORNING');
  const [quickEntries, setQuickEntries] = useState<Record<string, string>>({});
  const [quickSaving, setQuickSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkMilkingResult | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const farmId = selectedFarm?.id ?? null;

  const {
    records,
    meta,
    isLoading: recordsLoading,
    error: recordsError,
    refetch: refetchRecords,
  } = useMilkingRecords({
    farmId,
    page,
    search: search || undefined,
    shift: shiftFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const {
    animals: lactatingAnimals,
    isLoading: animalsLoading,
    refetch: refetchAnimals,
  } = useLactatingAnimals(farmId);

  const { summary, isLoading: summaryLoading, refetch: refetchSummary } = useDailySummary(farmId);

  const { trend, isLoading: trendLoading, refetch: refetchTrend } = useProductionTrend(farmId);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }, []);

  const handleRecordSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedRecord(null);
    showSuccess(selectedRecord ? 'Registro de ordenha atualizado' : 'Registro de ordenha criado');
    void refetchRecords();
    void refetchSummary();
    void refetchTrend();
    void refetchAnimals();
  }, [refetchRecords, refetchSummary, refetchTrend, refetchAnimals, selectedRecord, showSuccess]);

  const handleEdit = useCallback((r: MilkingRecordItem) => {
    setSelectedRecord(r);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (r: MilkingRecordItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setGlobalError(null);
      if (!window.confirm('Excluir este registro de ordenha? Esta ação não pode ser desfeita.'))
        return;
      try {
        await deleteMilkingRecord(selectedFarm!.id, r.id);
        showSuccess('Registro de ordenha excluído');
        void refetchRecords();
        void refetchSummary();
        void refetchTrend();
      } catch (err: unknown) {
        setGlobalError(err instanceof Error ? err.message : 'Erro ao excluir registro.');
      }
    },
    [refetchRecords, refetchSummary, refetchTrend, selectedFarm, showSuccess],
  );

  const handleQuickEntryChange = useCallback((animalId: string, value: string) => {
    setQuickEntries((prev) => ({ ...prev, [animalId]: value }));
  }, []);

  const handleQuickSave = useCallback(async () => {
    if (!farmId) return;
    const entries = Object.entries(quickEntries)
      .filter(([, v]) => v && Number(v) > 0)
      .map(([animalId, v]) => ({ animalId, liters: Number(v) }));

    if (entries.length === 0) {
      setGlobalError('Informe a produção de pelo menos um animal.');
      return;
    }

    setQuickSaving(true);
    setGlobalError(null);
    setBulkResult(null);

    try {
      const result = await bulkCreateMilking(farmId, {
        shift: quickShift,
        date: quickDate,
        entries,
      });
      setBulkResult(result);
      showSuccess(`${result.created} registro(s) de ordenha salvos com sucesso`);
      setQuickEntries({});
      void refetchRecords();
      void refetchSummary();
      void refetchTrend();
      void refetchAnimals();
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Erro ao salvar registros de ordenha.');
    } finally {
      setQuickSaving(false);
    }
  }, [
    farmId,
    quickEntries,
    quickShift,
    quickDate,
    refetchRecords,
    refetchSummary,
    refetchTrend,
    refetchAnimals,
    showSuccess,
  ]);

  const handleExport = useCallback(async () => {
    if (!farmId) return;
    try {
      const blob = await exportMilkingCsv(farmId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ordenha-${selectedFarm!.name}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Erro ao exportar CSV.');
    }
  }, [farmId, selectedFarm]);

  /* ─── Trend chart helper ─────────────────────────────────────────── */
  const maxLiters = trend.length > 0 ? Math.max(...trend.map((t) => t.totalLiters)) : 0;

  /* ─── Quick entry input refs for tab navigation ──────────────────── */
  const inputRefsMap = useRef<Map<string, HTMLInputElement>>(new Map());

  if (!selectedFarm) {
    return (
      <section className="milking-page">
        <div className="milking-page__empty">
          <Milk size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver os registros de ordenha.</p>
        </div>
      </section>
    );
  }

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'quick', label: 'Ordenha rápida' },
    { id: 'records', label: 'Registros' },
    { id: 'production', label: 'Produção' },
  ];

  return (
    <section className="milking-page">
      <header className="milking-page__header">
        <div>
          <h1>Ordenha</h1>
          <p>Registros de ordenha diária de {selectedFarm.name}</p>
        </div>
        <div className="milking-page__actions">
          <button
            type="button"
            className="milking-page__btn-secondary"
            onClick={() => void handleExport()}
          >
            <Download size={20} aria-hidden="true" />
            Exportar CSV
          </button>
          <button
            type="button"
            className="milking-page__btn-primary"
            onClick={() => {
              setSelectedRecord(null);
              setShowModal(true);
            }}
          >
            <Plus size={20} aria-hidden="true" />
            Novo registro
          </button>
        </div>
      </header>

      {successMsg && (
        <div className="milking-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}
      {(globalError || recordsError) && (
        <div className="milking-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {globalError || recordsError}
        </div>
      )}

      {/* Bulk variation alerts */}
      {bulkResult && bulkResult.alerts.length > 0 && (
        <div className="milking-page__variation-alerts" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <strong>Alertas de variação (&gt;30%):</strong>
            <ul>
              {bulkResult.alerts.map((a) => (
                <li key={a.earTag}>
                  {a.earTag}: {a.variation > 0 ? '+' : ''}
                  {a.variation.toFixed(1)}%
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Tabs */}
      <nav className="milking-page__tabs" aria-label="Abas de ordenha">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`milking-page__tab ${activeTab === tab.id ? 'milking-page__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ═══ Tab: Ordenha rápida ═══════════════════════════════════════ */}
      {activeTab === 'quick' && (
        <div className="milking-page__quick" role="tabpanel" aria-label="Ordenha rápida">
          <div className="milking-page__quick-controls">
            <div className="milking-page__quick-field">
              <label htmlFor="quick-date">Data</label>
              <input
                id="quick-date"
                type="date"
                value={quickDate}
                onChange={(e) => setQuickDate(e.target.value)}
              />
            </div>
            <div className="milking-page__quick-field">
              <label htmlFor="quick-shift">Turno</label>
              <select
                id="quick-shift"
                value={quickShift}
                onChange={(e) => setQuickShift(e.target.value)}
              >
                {MILKING_SHIFTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {animalsLoading && (
            <div className="milking-page__loading">Carregando animais em lactação...</div>
          )}

          {!animalsLoading && lactatingAnimals.length === 0 && (
            <div className="milking-page__empty">
              <Milk size={48} aria-hidden="true" />
              <h2>Nenhum animal em lactação</h2>
              <p>Cadastre animais em lactação para usar a ordenha rápida.</p>
            </div>
          )}

          {!animalsLoading && lactatingAnimals.length > 0 && (
            <>
              <div className="milking-page__quick-table-wrapper">
                <table className="milking-page__quick-table" aria-label="Entrada rápida de ordenha">
                  <thead>
                    <tr>
                      <th scope="col">Brinco</th>
                      <th scope="col">Nome</th>
                      <th scope="col">Lote</th>
                      <th scope="col">Última produção</th>
                      <th scope="col">Litros *</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lactatingAnimals.map((animal, idx) => (
                      <tr key={animal.animalId}>
                        <td className="milking-page__quick-eartag">{animal.earTag}</td>
                        <td>{animal.animalName || '—'}</td>
                        <td>{animal.lotName || '—'}</td>
                        <td className="milking-page__quick-last">
                          {animal.lastMilkingLiters !== null ? (
                            <span className="milking-page__mono">
                              {animal.lastMilkingLiters.toFixed(1)} L
                            </span>
                          ) : (
                            '—'
                          )}
                          {animal.lastMilkingDate && (
                            <span className="milking-page__quick-last-date">
                              {new Date(animal.lastMilkingDate).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </td>
                        <td>
                          <input
                            ref={(el) => {
                              if (el) inputRefsMap.current.set(animal.animalId, el);
                            }}
                            type="number"
                            min="0"
                            step="0.1"
                            value={quickEntries[animal.animalId] ?? ''}
                            onChange={(e) =>
                              handleQuickEntryChange(animal.animalId, e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const nextAnimal = lactatingAnimals[idx + 1];
                                if (nextAnimal) {
                                  const nextInput = inputRefsMap.current.get(nextAnimal.animalId);
                                  nextInput?.focus();
                                }
                              }
                            }}
                            className="milking-page__quick-input"
                            aria-label={`Litros para ${animal.earTag}`}
                            placeholder="0.0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="milking-page__quick-footer">
                <span className="milking-page__quick-count">
                  {Object.values(quickEntries).filter((v) => v && Number(v) > 0).length} de{' '}
                  {lactatingAnimals.length} animais preenchidos
                </span>
                <button
                  type="button"
                  className="milking-page__btn-primary"
                  onClick={() => void handleQuickSave()}
                  disabled={quickSaving}
                >
                  {quickSaving ? 'Salvando...' : 'Salvar tudo'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ Tab: Registros ════════════════════════════════════════════ */}
      {activeTab === 'records' && (
        <div className="milking-page__records" role="tabpanel" aria-label="Registros de ordenha">
          <div className="milking-page__toolbar">
            <div className="milking-page__search">
              <Search size={16} aria-hidden="true" className="milking-page__search-icon" />
              <input
                type="text"
                placeholder="Buscar por brinco ou nome..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Buscar registros de ordenha"
              />
            </div>
            <div className="milking-page__filters">
              <select
                value={shiftFilter}
                onChange={(e) => {
                  setShiftFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filtrar por turno"
              >
                <option value="">Todos os turnos</option>
                {MILKING_SHIFTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                aria-label="Data inicial"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                aria-label="Data final"
              />
            </div>
          </div>

          {recordsLoading && <div className="milking-page__loading">Carregando registros...</div>}

          {!recordsLoading && records.length === 0 && (
            <div className="milking-page__empty">
              <Milk size={48} aria-hidden="true" />
              <h2>Nenhum registro de ordenha</h2>
              <p>
                Registre a primeira ordenha usando a aba Ordenha rápida ou o botão Novo registro.
              </p>
            </div>
          )}

          {!recordsLoading && records.length > 0 && (
            <div className="milking-page__grid">
              {records.map((r) => {
                const shiftConfig = SHIFT_BADGE_CONFIG[r.shift];
                return (
                  <div
                    key={r.id}
                    className="milking-page__card"
                    onClick={() => handleEdit(r)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleEdit(r);
                      }
                    }}
                  >
                    <div className="milking-page__card-header">
                      <div>
                        <h3 className="milking-page__card-title">
                          {r.animalEarTag} — {r.animalName || 'Sem nome'}
                        </h3>
                        <div className="milking-page__card-date">
                          <Calendar size={14} aria-hidden="true" />
                          {new Date(r.milkingDate).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      <div className="milking-page__card-actions">
                        <button
                          type="button"
                          className="milking-page__card-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(r);
                          }}
                          aria-label={`Editar ordenha de ${r.animalEarTag}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="milking-page__card-btn milking-page__card-btn--delete"
                          onClick={(e) => void handleDelete(r, e)}
                          aria-label={`Excluir ordenha de ${r.animalEarTag}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="milking-page__card-body">
                      <span className="milking-page__liters-lg">
                        {r.liters.toFixed(1)}
                        <span className="milking-page__liters-unit"> L</span>
                      </span>
                      {shiftConfig && (
                        <span
                          className={`milking-page__shift-badge milking-page__${shiftConfig.className}`}
                        >
                          {shiftConfig.label}
                        </span>
                      )}
                    </div>

                    {r.variationAlert && r.variationPercent !== null && (
                      <div className="milking-page__card-variation">
                        <AlertTriangle size={14} aria-hidden="true" />
                        <span>
                          Variação: {r.variationPercent > 0 ? '+' : ''}
                          {r.variationPercent.toFixed(1)}%
                        </span>
                      </div>
                    )}

                    {r.notes && <p className="milking-page__card-notes">{r.notes}</p>}

                    <div className="milking-page__card-footer">
                      <span>{r.recorderName}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <nav className="milking-page__pagination" aria-label="Paginação">
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
                {page} de {meta.totalPages}
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

      {/* ═══ Tab: Produção ═════════════════════════════════════════════ */}
      {activeTab === 'production' && (
        <div className="milking-page__production" role="tabpanel" aria-label="Produção">
          {/* Summary cards */}
          {summaryLoading && (
            <div className="milking-page__loading">Carregando resumo de produção...</div>
          )}

          {!summaryLoading && summary && (
            <div className="milking-page__summary-cards">
              <div className="milking-page__summary-card">
                <div className="milking-page__summary-icon">
                  <Droplets size={24} aria-hidden="true" />
                </div>
                <div>
                  <span className="milking-page__summary-value">
                    {summary.totalLiters.toFixed(1)} L
                  </span>
                  <span className="milking-page__summary-label">Total do dia</span>
                </div>
              </div>
              <div className="milking-page__summary-card">
                <div className="milking-page__summary-icon">
                  <TrendingUp size={24} aria-hidden="true" />
                </div>
                <div>
                  <span className="milking-page__summary-value">
                    {summary.avgPerAnimal.toFixed(1)} L
                  </span>
                  <span className="milking-page__summary-label">Média por animal</span>
                </div>
              </div>
              <div className="milking-page__summary-card">
                <div className="milking-page__summary-icon">
                  <Users size={24} aria-hidden="true" />
                </div>
                <div>
                  <span className="milking-page__summary-value">{summary.animalCount}</span>
                  <span className="milking-page__summary-label">Animais ordenhados</span>
                </div>
              </div>
            </div>
          )}

          {/* Production trend chart */}
          <div className="milking-page__trend-section">
            <h2 className="milking-page__section-title">Tendência de produção (últimos 30 dias)</h2>

            {trendLoading && <div className="milking-page__loading">Carregando tendência...</div>}

            {!trendLoading && trend.length === 0 && (
              <div className="milking-page__empty milking-page__empty--compact">
                <TrendingUp size={32} aria-hidden="true" />
                <p>Sem dados de produção para exibir.</p>
              </div>
            )}

            {!trendLoading && trend.length > 0 && (
              <div
                className="milking-page__trend-chart"
                role="img"
                aria-label="Gráfico de tendência de produção"
              >
                {trend.map((item) => {
                  const pct = maxLiters > 0 ? (item.totalLiters / maxLiters) * 100 : 0;
                  return (
                    <div key={item.date} className="milking-page__trend-row">
                      <span className="milking-page__trend-date">
                        {new Date(item.date).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                      <div className="milking-page__trend-bar-container">
                        <div
                          className="milking-page__trend-bar"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className="milking-page__trend-value">
                        {item.totalLiters.toFixed(1)} L
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Per-lot breakdown */}
          {!summaryLoading && summary && summary.byLot.length > 0 && (
            <div className="milking-page__lot-section">
              <h2 className="milking-page__section-title">Produção por lote</h2>
              <div className="milking-page__lot-table-wrapper">
                <table className="milking-page__lot-table" aria-label="Produção por lote">
                  <thead>
                    <tr>
                      <th scope="col">Lote</th>
                      <th scope="col">Animais</th>
                      <th scope="col">Total (L)</th>
                      <th scope="col">Média/animal (L)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byLot.map((lot) => (
                      <tr key={lot.lotId}>
                        <td>{lot.lotName}</td>
                        <td className="milking-page__mono">{lot.animalCount}</td>
                        <td className="milking-page__mono">{lot.liters.toFixed(1)}</td>
                        <td className="milking-page__mono">
                          {lot.animalCount > 0 ? (lot.liters / lot.animalCount).toFixed(1) : '0.0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <MilkingModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
        farmId={selectedFarm.id}
        onSuccess={handleRecordSuccess}
      />
    </section>
  );
}
