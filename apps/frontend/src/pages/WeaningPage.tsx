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
  Calendar,
  Settings,
  Save,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useWeanings, useWeaningConfig, useUnweanedAnimals } from '@/hooks/useWeaning';
import type { WeaningConfig, UnweanedAnimal } from '@/types/weaning';
import ConfirmModal from '@/components/ui/ConfirmModal';
import WeaningModal from '@/components/weaning/WeaningModal';
import BulkWeaningModal from '@/components/weaning/BulkWeaningModal';
import { api } from '@/services/api';
import './WeaningPage.css';

type TabId = 'unweaned' | 'history';

export default function WeaningPage() {
  const { selectedFarm } = useFarmContext();
  const farmId = selectedFarm?.id ?? null;

  const [activeTab, setActiveTab] = useState<TabId>('unweaned');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showWeaningModal, setShowWeaningModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Config state
  const [configExpanded, setConfigExpanded] = useState(false);
  const [configForm, setConfigForm] = useState<WeaningConfig>({
    weaningDaysMale: null,
    weaningDaysFemale: null,
    minWeightKgMale: null,
    minWeightKgFemale: null,
  });
  const [configSaving, setConfigSaving] = useState(false);

  // History state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; earTag: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { config, refetch: refetchConfig } = useWeaningConfig();
  const {
    animals: unweanedAnimals,
    isLoading: unweanedLoading,
    error: unweanedError,
    refetch: refetchUnweaned,
  } = useUnweanedAnimals({ farmId });
  const {
    weanings,
    meta,
    isLoading: weanLoading,
    error: weanError,
    refetch: refetchWean,
  } = useWeanings({ farmId, page, search: searchDebounced || undefined });

  // Sync config form
  useEffect(() => {
    if (config) setConfigForm({ ...config });
  }, [config]);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }, []);

  const handleSaveConfig = useCallback(async () => {
    setConfigSaving(true);
    setGlobalError(null);
    try {
      await api.put('/org/weaning-config', configForm);
      showSuccess('Configuração de desmama salva com sucesso');
      void refetchConfig();
      void refetchUnweaned();
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Erro ao salvar configuração.');
    } finally {
      setConfigSaving(false);
    }
  }, [configForm, refetchConfig, refetchUnweaned, showSuccess]);

  const handleWeaningSuccess = useCallback(() => {
    setShowWeaningModal(false);
    showSuccess('Desmama registrada com sucesso');
    void refetchWean();
    void refetchUnweaned();
  }, [refetchWean, refetchUnweaned, showSuccess]);

  const handleBulkSuccess = useCallback(() => {
    setShowBulkModal(false);
    setSelectedIds(new Set());
    showSuccess('Desmamas registradas com sucesso');
    void refetchWean();
    void refetchUnweaned();
  }, [refetchWean, refetchUnweaned, showSuccess]);

  const handleDeleteWeaning = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/org/farms/${farmId}/weanings/${deleteTarget.id}`);
      showSuccess('Desmama excluída com sucesso');
      setDeleteTarget(null);
      void refetchWean();
      void refetchUnweaned();
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Erro ao excluir desmama.');
      setDeleteTarget(null);
    }
  }, [farmId, deleteTarget, refetchWean, refetchUnweaned, showSuccess]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === unweanedAnimals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unweanedAnimals.map((a) => a.id)));
    }
  };

  const selectedAnimals = unweanedAnimals.filter((a) => selectedIds.has(a.id));

  if (!selectedFarm) {
    return (
      <section className="weaning-page">
        <div className="weaning-page__empty">
          <CupSoda size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para gerenciar desmamas.</p>
        </div>
      </section>
    );
  }

  const configIsSet = config?.weaningDaysMale || config?.weaningDaysFemale;

  return (
    <section className="weaning-page">
      <header className="weaning-page__header">
        <div>
          <h1>Desmama</h1>
          <p>Gestão de desmama de {selectedFarm.name}</p>
        </div>
      </header>

      {successMsg && (
        <div className="weaning-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}
      {(globalError || unweanedError || weanError) && (
        <div className="weaning-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {globalError || unweanedError || weanError}
        </div>
      )}

      {/* ─── Config ────────────────────────────────────────────── */}
      <div className="weaning-page__config-panel">
        <button
          type="button"
          className="weaning-page__config-toggle"
          onClick={() => setConfigExpanded(!configExpanded)}
          aria-expanded={configExpanded}
        >
          <Settings size={16} aria-hidden="true" />
          Configuração de desmama
          {!configIsSet && (
            <span className="weaning-page__config-badge">Não configurado</span>
          )}
          {configExpanded ? (
            <ChevronUp size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
        </button>

        {configExpanded && (
          <div className="weaning-page__config-body">
            <div className="weaning-page__config-grid">
              <div className="weaning-page__config-group">
                <h4>Machos</h4>
                <div className="weaning-page__config-field">
                  <label htmlFor="cfg-days-m">Dias para desmama</label>
                  <input
                    id="cfg-days-m"
                    type="number"
                    min="1"
                    value={configForm.weaningDaysMale ?? ''}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        weaningDaysMale: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Ex: 210"
                  />
                </div>
                <div className="weaning-page__config-field">
                  <label htmlFor="cfg-weight-m">Peso mínimo (kg)</label>
                  <input
                    id="cfg-weight-m"
                    type="number"
                    min="0"
                    step="0.5"
                    value={configForm.minWeightKgMale ?? ''}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        minWeightKgMale: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Ex: 180"
                  />
                </div>
              </div>
              <div className="weaning-page__config-group">
                <h4>Fêmeas</h4>
                <div className="weaning-page__config-field">
                  <label htmlFor="cfg-days-f">Dias para desmama</label>
                  <input
                    id="cfg-days-f"
                    type="number"
                    min="1"
                    value={configForm.weaningDaysFemale ?? ''}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        weaningDaysFemale: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Ex: 180"
                  />
                </div>
                <div className="weaning-page__config-field">
                  <label htmlFor="cfg-weight-f">Peso mínimo (kg)</label>
                  <input
                    id="cfg-weight-f"
                    type="number"
                    min="0"
                    step="0.5"
                    value={configForm.minWeightKgFemale ?? ''}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        minWeightKgFemale: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Ex: 160"
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              className="weaning-page__btn-primary weaning-page__btn-sm"
              onClick={() => void handleSaveConfig()}
              disabled={configSaving}
            >
              <Save size={16} aria-hidden="true" />
              {configSaving ? 'Salvando...' : 'Salvar configuração'}
            </button>
          </div>
        )}
      </div>

      {/* ─── Tabs ──────────────────────────────────────────────── */}
      <nav className="weaning-page__tabs" aria-label="Abas de desmama">
        <button
          type="button"
          className={`weaning-page__tab ${activeTab === 'unweaned' ? 'weaning-page__tab--active' : ''}`}
          onClick={() => setActiveTab('unweaned')}
          aria-selected={activeTab === 'unweaned'}
          role="tab"
        >
          Não desmamados
          {unweanedAnimals.length > 0 && (
            <span className="weaning-page__tab-count">{unweanedAnimals.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`weaning-page__tab ${activeTab === 'history' ? 'weaning-page__tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
          aria-selected={activeTab === 'history'}
          role="tab"
        >
          Histórico
        </button>
      </nav>

      {/* ─── Tab: Não desmamados ────────────────────────────────── */}
      {activeTab === 'unweaned' && (
        <div className="weaning-page__tab-content">
          {selectedIds.size > 0 && (
            <div className="weaning-page__bulk-bar">
              <span>{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
              <button
                type="button"
                className="weaning-page__btn-primary"
                onClick={() => setShowBulkModal(true)}
              >
                <CupSoda size={16} aria-hidden="true" />
                Desmamar selecionados
              </button>
            </div>
          )}

          {unweanedLoading && (
            <div className="weaning-page__loading">Carregando bezerros...</div>
          )}

          {!unweanedLoading && unweanedAnimals.length === 0 && (
            <div className="weaning-page__empty">
              <CheckCircle size={48} aria-hidden="true" />
              <h2>Nenhum bezerro pendente de desmama</h2>
              <p>Todos os bezerros já foram desmamados ou não há bezerros cadastrados.</p>
            </div>
          )}

          {!unweanedLoading && unweanedAnimals.length > 0 && (
            <>
              <div className="weaning-page__table-container">
                <table className="weaning-page__table">
                  <caption className="sr-only">Bezerros não desmamados</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="weaning-page__th-check">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === unweanedAnimals.length}
                          onChange={toggleSelectAll}
                          aria-label="Selecionar todos"
                        />
                      </th>
                      <th scope="col">Brinco</th>
                      <th scope="col">Nome</th>
                      <th scope="col">Sexo</th>
                      <th scope="col">Idade (dias)</th>
                      <th scope="col">Peso (kg)</th>
                      <th scope="col">Data prevista</th>
                      <th scope="col">Lote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unweanedAnimals.map((a) => (
                      <tr
                        key={a.id}
                        className={a.isOverdue ? 'weaning-page__row--overdue' : ''}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(a.id)}
                            onChange={() => toggleSelect(a.id)}
                            aria-label={`Selecionar ${a.earTag}`}
                          />
                        </td>
                        <td className="weaning-page__cell-mono">{a.earTag}</td>
                        <td>{a.name || '—'}</td>
                        <td>{a.sex === 'MALE' ? 'M' : 'F'}</td>
                        <td className="weaning-page__cell-mono">
                          {a.ageDays !== null ? a.ageDays : '—'}
                        </td>
                        <td className="weaning-page__cell-mono">
                          {a.lastWeightKg !== null ? a.lastWeightKg : '—'}
                        </td>
                        <td>
                          {a.expectedWeaningDate ? (
                            <span className={a.isOverdue ? 'weaning-page__overdue-text' : ''}>
                              {a.isOverdue && (
                                <AlertTriangle
                                  size={14}
                                  className="weaning-page__overdue-icon"
                                  aria-label="Atrasado"
                                />
                              )}
                              {new Date(a.expectedWeaningDate).toLocaleDateString('pt-BR')}
                            </span>
                          ) : (
                            <span className="weaning-page__no-config">—</span>
                          )}
                        </td>
                        <td>{a.lotName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="weaning-page__unweaned-cards">
                <div className="weaning-page__select-all-mobile">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === unweanedAnimals.length}
                    onChange={toggleSelectAll}
                    aria-label="Selecionar todos"
                  />
                  <span>Selecionar todos</span>
                </div>
                {unweanedAnimals.map((a) => (
                  <div
                    key={a.id}
                    className={`weaning-page__unweaned-card ${a.isOverdue ? 'weaning-page__unweaned-card--overdue' : ''} ${selectedIds.has(a.id) ? 'weaning-page__unweaned-card--selected' : ''}`}
                    onClick={() => toggleSelect(a.id)}
                    role="checkbox"
                    aria-checked={selectedIds.has(a.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleSelect(a.id);
                      }
                    }}
                  >
                    <div className="weaning-page__unweaned-card-header">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(a.id)}
                        onChange={() => toggleSelect(a.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Selecionar ${a.earTag}`}
                      />
                      <span className="weaning-page__card-ear-tag">{a.earTag}</span>
                      {a.name && <span>{a.name}</span>}
                      <span className="weaning-page__sex-badge">
                        {a.sex === 'MALE' ? 'M' : 'F'}
                      </span>
                    </div>
                    <div className="weaning-page__unweaned-card-details">
                      <span>Idade: <strong>{a.ageDays ?? '—'}</strong> dias</span>
                      <span>Peso: <strong>{a.lastWeightKg ?? '—'}</strong> kg</span>
                      {a.expectedWeaningDate && (
                        <span className={a.isOverdue ? 'weaning-page__overdue-text' : ''}>
                          {a.isOverdue && <AlertTriangle size={12} aria-hidden="true" />}
                          Previsto: {new Date(a.expectedWeaningDate).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Tab: Histórico ─────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="weaning-page__tab-content">
          <div className="weaning-page__toolbar">
            <div className="weaning-page__search">
              <Search size={16} aria-hidden="true" className="weaning-page__search-icon" />
              <input
                type="text"
                placeholder="Buscar por brinco ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar desmamas"
              />
            </div>
            <button
              type="button"
              className="weaning-page__btn-primary"
              onClick={() => setShowWeaningModal(true)}
            >
              <Plus size={16} aria-hidden="true" />
              Nova desmama
            </button>
          </div>

          {weanLoading && <div className="weaning-page__loading">Carregando desmamas...</div>}

          {!weanLoading && weanings.length === 0 && (
            <div className="weaning-page__empty">
              <CupSoda size={48} aria-hidden="true" />
              <h2>Nenhuma desmama registrada</h2>
              <p>Registre a primeira desmama usando o botão acima ou selecione bezerros na aba anterior.</p>
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
                        onClick={() => setDeleteTarget({ id: w.id, earTag: w.calfEarTag })}
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
                  </div>
                  {w.observations && <div className="weaning-page__card-obs">{w.observations}</div>}
                  <div className="weaning-page__card-footer-info">
                    {w.recorderName} — {new Date(w.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <nav className="weaning-page__pagination" aria-label="Paginação desmamas">
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

      {/* ─── Modals ────────────────────────────────────────────── */}
      <WeaningModal
        isOpen={showWeaningModal}
        onClose={() => setShowWeaningModal(false)}
        farmId={selectedFarm.id}
        onSuccess={handleWeaningSuccess}
      />

      <BulkWeaningModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        farmId={selectedFarm.id}
        selectedAnimals={selectedAnimals}
        config={config}
        onSuccess={handleBulkSuccess}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Excluir desmama"
        message={`Deseja excluir o registro de desmama de ${deleteTarget?.earTag ?? ''}? Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        onConfirm={() => void handleDeleteWeaning()}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
